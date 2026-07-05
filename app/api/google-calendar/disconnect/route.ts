import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revokeToken } from "@/lib/google-calendar";

/**
 * Removes the Google Calendar integration for the current user.
 *
 * Best-effort revokes the stored refresh token on Google's side (so the
 * granted scopes are released) before deleting the local integration row.
 * Even if the revocation network call fails, the local row is still deleted
 * so the app treats the integration as disconnected.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let userId = body.userId as string | undefined;

    if (!userId) {
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
      userId = user.id;
    }

    // Fetch the integration row so we can revoke the token before deleting.
    const integration = await prisma.calendarIntegration.findUnique({
      where: { userId },
      select: { refreshToken: true, accessToken: true },
    });

    if (integration) {
      // Revoke the refresh token (preferred) — falls back to access token.
      const tokenToRevoke = integration.refreshToken || integration.accessToken;
      await revokeToken(tokenToRevoke);
    }

    await prisma.calendarIntegration.deleteMany({
      where: { userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect calendar:", error);
    const message =
      error instanceof Error ? error.message : "Failed to disconnect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
