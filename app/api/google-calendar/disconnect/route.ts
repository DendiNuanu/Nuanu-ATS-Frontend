import { NextResponse } from "next/server";

/**
 * @deprecated — The interactive Google OAuth consent flow has been removed.
 *
 * Google Calendar is now connected automatically and permanently via a GCP
 * Service Account with Domain-Wide Delegation (impersonating job@nuanu.com).
 * There is nothing to disconnect — the service account is configured on the
 * server, not per-user.
 *
 * This route is kept as a no-op stub so any stale UI calls don't 404.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Disconnect is no longer applicable. Google Calendar sync is now handled automatically via a service account configured on the server.",
    },
    { status: 410 }, // 410 Gone
  );
}
