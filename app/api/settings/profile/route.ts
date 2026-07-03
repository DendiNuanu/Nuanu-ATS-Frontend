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
      data.email = body.email.trim();
    }
    if (typeof body.phone === "string") {
      data.phone = body.phone.trim() || null;
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
    const message =
      error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
