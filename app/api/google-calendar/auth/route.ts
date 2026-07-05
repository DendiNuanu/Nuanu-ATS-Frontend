import { NextResponse } from "next/server";

/**
 * @deprecated — The interactive Google OAuth consent flow has been removed.
 *
 * Google Calendar is now connected automatically and permanently via a GCP
 * Service Account with Domain-Wide Delegation (impersonating job@nuanu.com).
 * There is nothing for the user to manually connect anymore.
 *
 * This route is kept as a no-op stub so any stale links/bookmarks don't 404.
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Interactive Google Calendar connection is no longer required. Calendar sync is now handled automatically via a service account. See Settings → Calendar.",
    },
    { status: 410 }, // 410 Gone — the resource has been permanently removed
  );
}
