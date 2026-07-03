import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 },
      );
    }

    // Resolve the user. The app has no auth layer yet, so we fall back to
    // the first active user.
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password (stored in plaintext in this prototype DB).
    if (currentPassword !== user.password) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { password: newPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update password:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
