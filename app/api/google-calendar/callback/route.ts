import { NextResponse } from "next/server";

/**
 * @deprecated — The interactive Google OAuth consent flow has been removed.
 *
 * Google Calendar is now connected automatically and permanently via a GCP
 * Service Account with Domain-Wide Delegation (impersonating job@nuanu.com).
 * There is no OAuth callback to handle anymore.
 *
 * This route is kept as a no-op stub so any stale redirects from Google don't
 * 404. It simply sends the user back to Settings.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(
    new URL(
      "/settings?calendar_error=" +
        encodeURIComponent(
          "Interactive Google Calendar connection is no longer required. Calendar sync is now automatic via service account.",
        ),
      url.origin,
    ),
  );
}
