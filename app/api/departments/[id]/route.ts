import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * Usage counts for a department across every table that references it.
 * Used by DELETE (to warn/block) and surfaced in the management UI so HR
 * knows what is attached to a dept/project before removing it.
 */
async function departmentUsage(id: string) {
  const [
    vacancies,
    applications,
    positionSlots,
    users,
    budgets,
  ] = await Promise.all([
    prisma.vacancy.count({ where: { departmentId: id } }),
    prisma.application.count({ where: { departmentId: id } }),
    prisma.candidatePositionSlot.count({ where: { departmentId: id } }),
    prisma.user.count({ where: { departmentId: id } }),
    prisma.budget.count({ where: { departmentId: id } }),
  ]);
  return { vacancies, applications, positionSlots, users, budgets };
}

/**
 * GET /api/departments/[id]
 * Returns the department plus its usage counts.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const department = await prisma.department.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, isActive: true, deletedAt: true },
    });
    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }
    const usage = await departmentUsage(params.id);
    return NextResponse.json({ department, usage });
  } catch (error) {
    console.error("Failed to get department:", error);
    return NextResponse.json(
      { error: "Failed to get department" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/departments/[id]  { name: string }
 *
 * Renames a department/project. The rename propagates everywhere instantly
 * because every consumer (candidate slots, applications, vacancies, users)
 * stores departmentId and resolves the display name via the relation —
 * no denormalized names to fix up.
 *
 * Case-insensitive uniqueness is enforced manually (the DB unique constraint
 * on `name` is case-sensitive) so "art village" and "Art Village" cannot
 * coexist.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "A department/project name is required." },
        { status: 400 },
      );
    }
    if (name.length > 100) {
      return NextResponse.json(
        { error: "Department/project name is too long (max 100 characters)." },
        { status: 400 },
      );
    }

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { error: "Department not found." },
        { status: 404 },
      );
    }

    // Case-insensitive duplicate check (excluding this row itself).
    const duplicate = await prisma.department.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        id: { not: id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `A department named "${name}" already exists.` },
        { status: 409 },
      );
    }

    const department = await prisma.department.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });

    revalidatePath("/settings");
    revalidatePath("/candidates");

    return NextResponse.json({ department });
  } catch (error) {
    console.error("Failed to rename department:", error);
    return NextResponse.json(
      { error: "Failed to rename department" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/departments/[id]
 *
 * Soft-deletes a department/project (sets deletedAt + isActive=false) so it
 * disappears from every dropdown, while historical records stay intact:
 *
 *  - Dropdowns (fetchDepartmentOptions / fetchDepartmentNames / GET
 *    /api/departments) filter on deletedAt: null + isActive: true, so the
 *    row vanishes from every picker immediately.
 *  - Historical records (applications, position slots, vacancies) keep
 *    their departmentId, and Prisma relation includes do NOT filter
 *    soft-deleted rows — so candidate/vacancy pages still display the old
 *    department name. No data loss, no "No department" regression.
 *  - Vacancies/Users/Budgets have restrictive FKs — a hard delete would
 *    either fail or cascade destructively, so soft-delete is the only safe
 *    strategy.
 *
 * If the department is still referenced by vacancies or users, the endpoint
 * requires ?force=1 (the UI shows a confirm dialog with the usage counts).
 * Applications/slots never block deletion — they degrade gracefully.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const force = new URL(request.url).searchParams.get("force") === "1";

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { error: "Department not found." },
        { status: 404 },
      );
    }

    const usage = await departmentUsage(id);

    // Vacancies and users are "structural" references — deleting a dept that
    // still has open vacancies or assigned staff would orphan them silently.
    const blocking = usage.vacancies > 0 || usage.users > 0;
    if (blocking && !force) {
      return NextResponse.json(
        {
          error:
            "This department is still used by vacancies or users. Re-assign them first, or pass force=1 to hide the department anyway.",
          usage,
        },
        { status: 409 },
      );
    }

    await prisma.department.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath("/settings");
    revalidatePath("/candidates");

    return NextResponse.json({ success: true, usage });
  } catch (error) {
    console.error("Failed to delete department:", error);
    return NextResponse.json(
      { error: "Failed to delete department" },
      { status: 500 },
    );
  }
}
