import { NextResponse } from "next/server";
import { buildAuthUrl, isGoogleCalendarConfigured } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

/**
 * Starts the Google OAuth2 flow by redirecting the browser to Google's
 * consent screen. The `state` param encodes the user ID so the callback
 * knows which user to associate the tokens with.
 */
export async function GET(request: Request) {
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    // Fall back to the first active user (same pattern as other API routes).
    const user = await prisma.user.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (!user) {
      return NextResponse.json(
        { error: "No active user found" },
        { status: 400 },
      );
    }
    resolvedUserId = user.id;
  }

  const state = resolvedUserId;
  const authUrl = buildAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
