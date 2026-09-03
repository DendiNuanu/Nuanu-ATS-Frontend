import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Resolve the user to update. The app has no auth layer yet, so we
    // fall back to the first active user.
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

    const data: Record<string, string> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.email === "string" && body.email.trim()) {
      // User.email is UNIQUE — only write it when it actually changes, and
      // pre-check that no OTHER user already owns the new address. Otherwise
      // prisma.user.update fails with P2002 "Unique constraint failed".
      const nextEmail = body.email.trim();
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      const unchanged =
        current !== null &&
        nextEmail.toLowerCase() === current.email.toLowerCase();
      if (!unchanged) {
        const owner = await prisma.user.findFirst({
          where: {
            email: { equals: nextEmail, mode: "insensitive" },
            id: { not: userId },
          },
          select: { id: true },
        });
        if (owner) {
          return NextResponse.json(
            {
              error: `Email "${nextEmail}" is already used by another user. Please use a different email.`,
            },
            { status: 409 },
          );
        }
        data.email = nextEmail;
      }
    }
    if (typeof body.phone === "string") {
      data.phone = body.phone.trim() || null;
    }
    if (typeof body.location === "string") {
      data.location = body.location.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data,
    });

    revalidatePath("/settings");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update profile:", error);

    // Prisma P2002 = unique constraint violation (e.g. the email was claimed
    // by a concurrent request between our pre-check and the write).
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "The submitted email is already in use by another user. Please use a different email.",
        },
        { status: 409 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
