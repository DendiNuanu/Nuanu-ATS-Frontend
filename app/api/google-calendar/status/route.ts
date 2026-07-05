import { NextResponse } from "next/server";
import {
  isGoogleCalendarConfigured,
  getImpersonateEmail,
} from "@/lib/google-calendar";

/**
 * Returns the Google Calendar integration status.
 *
 * With the Service Account + Domain-Wide Delegation approach, there is no
 * per-user OAuth token to look up. The integration is "connected" whenever
 * the service account key file and impersonation email are configured on the
 * server — authentication is fully automatic and permanent.
 */
export async function GET() {
  const configured = isGoogleCalendarConfigured();
  const connectedEmail = getImpersonateEmail();

  return NextResponse.json({
    connected: configured,
    configured,
    connectedEmail,
    // Kept for backward-compat with any client that reads connectedAt.
    connectedAt: null,
  });
}
