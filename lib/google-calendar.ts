import { prisma } from "@/lib/prisma";

/**
 * Google Calendar OAuth2 + Events API helpers.
 *
 * Requires the following environment variables:
 *  - GOOGLE_CLIENT_ID
 *  - GOOGLE_CLIENT_SECRET
 *  - GOOGLE_REDIRECT_URI  (e.g. https://hr.ats.new.nuanu.site/api/google-calendar/callback)
 *
 * Tokens are stored in the CalendarIntegration table (one row per user).
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export function getGoogleClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/google-calendar/callback`;

  return { clientId, clientSecret, redirectUri };
}

export function isGoogleCalendarConfigured(): boolean {
  const { clientId, clientSecret } = getGoogleClientConfig();
  return Boolean(clientId && clientSecret);
}

/**
 * Build the Google OAuth consent-screen URL.
 */
export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleClientConfig();
  const params = new URLSearchParams({
    client_id: clientId ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    // "consent" forces a new refresh token each connect (needed so disconnect
    // + reconnect actually gets a new token). "select_account" forces Google
    // to show the account picker every time, preventing accidental
    // re-authorization with the wrong (already-logged-in) Google account.
    prompt: "consent select_account",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

/**
 * Exchange an authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = getGoogleClientConfig();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId ?? "",
      client_secret: clientSecret ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  return res.json();
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getGoogleClientConfig();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId ?? "",
      client_secret: clientSecret ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }
  return res.json();
}

/**
 * Get a valid access token for the given user, refreshing if necessary.
 * Returns null if the user has no calendar integration.
 */
export async function getValidAccessToken(
  userId: string,
): Promise<string | null> {
  const integration = await prisma.calendarIntegration.findUnique({
    where: { userId },
  });
  if (!integration) return null;

  // If token expires in the next 60 seconds, refresh it.
  const expiresSoon = integration.expiryDate.getTime() - Date.now() < 60_000;
  if (expiresSoon && integration.refreshToken) {
    try {
      const tokens = await refreshAccessToken(integration.refreshToken);
      await prisma.calendarIntegration.update({
        where: { userId },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? integration.refreshToken,
          expiryDate: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });
      return tokens.access_token;
    } catch {
      // Refresh failed — fall through to return the stale token.
    }
  }

  return integration.accessToken;
}

export type CalendarEventInput = {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  attendees?: { email: string }[];
  location?: string;
};

export type CalendarEventResult = {
  eventId: string;
  htmlLink: string;
  meetLink?: string;
};

/**
 * Create a Google Calendar event with an auto-generated Google Meet link.
 */
export async function createCalendarEvent(
  accessToken: string,
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startISO, timeZone: "Asia/Makassar" },
    end: { dateTime: input.endISO, timeZone: "Asia/Makassar" },
    attendees: input.attendees,
    conferenceData: {
      createRequest: {
        requestId: `interview-${Date.now()}`,
        conferenceSolutionId: "hangoutsMeet",
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 },
        { method: "popup", minutes: 15 },
      ],
    },
  };

  const params = new URLSearchParams({ conferenceDataVersion: "1" });
  const res = await fetch(`${GOOGLE_EVENTS_URL}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar event creation failed: ${text}`);
  }

  const event = await res.json();
  const meetLink =
    event.conferenceData?.entryPoints?.find(
      (e: { entryPointType: string; uri: string }) =>
        e.entryPointType === "video",
    )?.uri ??
    event.conferenceData?.conferenceSolution?.entryPoints?.[0]?.uri ??
    event.hangoutLink;

  return {
    eventId: event.id,
    htmlLink: event.htmlLink,
    meetLink,
  };
}

/**
 * Update an existing Google Calendar event's time and details.
 * Used when rescheduling an interview.
 */
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  input: CalendarEventInput,
): Promise<void> {
  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startISO, timeZone: "Asia/Makassar" },
    end: { dateTime: input.endISO, timeZone: "Asia/Makassar" },
    attendees: input.attendees,
  };

  const params = new URLSearchParams({ conferenceDataVersion: "1" });
  const res = await fetch(`${GOOGLE_EVENTS_URL}/${eventId}?${params}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar event update failed: ${text}`);
  }
}

/**
 * Fetch the email address of the Google account that authorized the
 * integration, using the stored access token (refreshing if necessary).
 *
 * Used by the Settings UI to show "Connected as: <email>" so the user can
 * immediately spot if they connected the wrong account.
 *
 * Returns the email string, or null if it cannot be determined.
 */
export async function getConnectedAccountEmail(
  userId: string,
): Promise<string | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  try {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Revoke a Google OAuth token via Google's revocation endpoint.
 *
 * This invalidates the token on Google's side so the granted scopes are
 * released. Best-effort — if the network call fails we still delete the
 * local integration row (the caller's responsibility).
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({ token });
    const res = await fetch(`${GOOGLE_REVOKE_URL}?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return res.ok;
  } catch {
    return false;
  }
}
