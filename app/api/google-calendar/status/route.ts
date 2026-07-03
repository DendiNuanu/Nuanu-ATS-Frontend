import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";

/**
 * Returns whether the current user has a connected Google Calendar.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  let resolvedUserId = userId;
  if (!resolvedUserId) {
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

  const integration = await prisma.calendarIntegration.findUnique({
    where: { userId: resolvedUserId },
    select: {
      id: true,
      provider: true,
      expiryDate: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    connected: Boolean(integration),
    configured: isGoogleCalendarConfigured(),
    connectedAt: integration?.createdAt?.toISOString() ?? null,
  });
}
