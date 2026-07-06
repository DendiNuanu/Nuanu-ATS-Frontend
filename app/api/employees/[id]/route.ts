import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * PATCH /api/employees/[id]
 *
 * Toggles the 90-day or 6-month (180-day) retention check for an employee.
 *
 * Request body:
 *   { checkType: "90" | "180", retained: boolean }
 *
 * When `retained` is set to true, the check is marked as passed.
 * When `retained` is set to false, the check is marked as failed.
 * The corresponding `check90DueAt` / `check180DueAt` date is NOT changed —
 * it remains as the scheduled due date. Only the boolean result is updated.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Employee id is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const checkType: string = body.checkType;
    const retained: boolean = Boolean(body.retained);

    if (checkType !== "90" && checkType !== "180") {
      return NextResponse.json(
        { error: "checkType must be '90' or '180'" },
        { status: 400 },
      );
    }

    const data =
      checkType === "90"
        ? { retained90: retained }
        : { retained180: retained };

    const updated = await prisma.employee.update({
      where: { id },
      data,
      select: {
        id: true,
        retained90: true,
        retained180: true,
        check90DueAt: true,
        check180DueAt: true,
      },
    });

    // Revalidate the employees list + detail pages so fresh data shows.
    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);

    return NextResponse.json({
      success: true,
      employee: {
        id: updated.id,
        retained90: updated.retained90,
        retained180: updated.retained180,
        check90DueAt: updated.check90DueAt?.toISOString() ?? null,
        check180DueAt: updated.check180DueAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to update employee check status:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update employee check status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
