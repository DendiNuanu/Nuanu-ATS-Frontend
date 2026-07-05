import { google, type calendar_v3 } from "googleapis";
import fs from "fs";

/**
 * Google Calendar integration via a GCP Service Account + Domain-Wide
 * Delegation.
 *
 * This replaces the previous interactive OAuth2 flow. The service account
 * impersonates a fixed organizational account (job@nuanu.com) configured in
 * the Google Workspace Admin Console, so calendar events are created under
 * that account permanently — with NO interactive login, consent screen, or
 * re-authentication ever required.
 *
 * Required environment variables (set in .env.local on the server):
 *  - GOOGLE_SERVICE_ACCOUNT_KEY_PATH  → absolute path to the service account
 *    JSON key file (kept OUTSIDE the repo, e.g. ~/.secrets-nuanu/...json)
 *  - GOOGLE_CALENDAR_IMPERSONATE_EMAIL → the Workspace user to impersonate
 *    (e.g. job@nuanu.com). Must have DWD authorized for the calendar scope.
 */

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

// Module-level cache. The googleapis JWT client manages its own access-token
// lifecycle (auto-refreshes ~1h tokens), so a single long-lived client is
// both efficient and correct for a long-running pm2 process.
let cachedCalendarClient: calendar_v3.Calendar | null = null;

/**
 * Whether the service-account-based integration is fully configured.
 * Returns true only when BOTH the key-file path and the impersonation email
 * are present (and the key file is readable).
 */
export function isGoogleCalendarConfigured(): boolean {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const impersonate = process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;
  if (!keyPath || !impersonate) return false;
  try {
    return fs.existsSync(keyPath);
  } catch {
    return false;
  }
}

/**
 * The Workspace email the service account impersonates. Used by the Settings
 * UI to display "Connected as: job@nuanu.com".
 */
export function getImpersonateEmail(): string | null {
  return process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL ?? null;
}

/**
 * Build (and cache) an authenticated Google Calendar client backed by a JWT
 * service-account client with Domain-Wide Delegation.
 *
 * Throws a clear error if the integration is not configured or the key file
 * is unreadable — callers are expected to catch this and degrade gracefully
 * (e.g. schedule the interview without calendar sync).
 */
function getCalendarClient(): calendar_v3.Calendar {
  if (cachedCalendarClient) return cachedCalendarClient;

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const subject = process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;

  if (!keyPath || !subject) {
    throw new Error(
      "Google Calendar service account is not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH and GOOGLE_CALENDAR_IMPERSONATE_EMAIL.",
    );
  }

  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Google service account key file not found at: ${keyPath}. Upload the JSON key and set GOOGLE_SERVICE_ACCOUNT_KEY_PATH to its absolute path.`,
    );
  }

  const jwtClient = new google.auth.JWT({
    keyFile: keyPath,
    scopes: [CALENDAR_SCOPE],
    // `subject` enables Domain-Wide Delegation: the service account acts AS
    // this Workspace user for all calendar operations. Events are created on
    // this user's primary calendar with this user as the organizer.
    subject,
  });

  cachedCalendarClient = google.calendar({ version: "v3", auth: jwtClient });
  return cachedCalendarClient;
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
 * Create a Google Calendar event on the impersonated account's primary
 * calendar, with an auto-generated Google Meet link.
 *
 * `calendarId: 'primary'` correctly refers to job@nuanu.com's primary
 * calendar because the JWT client impersonates that account directly.
 */
export async function createCalendarEvent(
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  const calendar = getCalendarClient();

  const res = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.startISO, timeZone: "Asia/Makassar" },
      end: { dateTime: input.endISO, timeZone: "Asia/Makassar" },
      attendees: input.attendees,
      conferenceData: {
        createRequest: {
          requestId: `interview-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 60 },
          { method: "popup", minutes: 15 },
        ],
      },
    },
  });

  const event = res.data;
  const meetLink =
    event.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === "video",
    )?.uri ??
    event.hangoutLink ??
    undefined;

  return {
    eventId: event.id ?? "",
    htmlLink: event.htmlLink ?? "",
    meetLink,
  };
}

/**
 * Update an existing Google Calendar event's time and details.
 * Used when rescheduling an interview (patches the same event — no duplicate).
 */
export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventInput,
): Promise<void> {
  const calendar = getCalendarClient();

  await calendar.events.patch({
    calendarId: "primary",
    eventId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.startISO, timeZone: "Asia/Makassar" },
      end: { dateTime: input.endISO, timeZone: "Asia/Makassar" },
      attendees: input.attendees,
    },
  });
}

/**
 * Delete a Google Calendar event from the impersonated account's primary
 * calendar. Used when an interview is deleted so the calendar stays in sync.
 *
 * This is best-effort: if the event was already manually deleted from the
 * calendar (410/404) or the API call fails for any reason, the caller should
 * catch the error and still proceed with deleting the local DB record.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();

  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
}
