import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/departments
 * Returns all active departments (id + name), ordered by name — the same
 * shape/source as `fetchDepartmentOptions()` in lib/data-access.ts. Useful
 * for refreshing the dropdown after a create.
 */
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ departments });
  } catch (error) {
    console.error("Failed to list departments:", error);
    return NextResponse.json(
      { error: "Failed to list departments" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/departments  { name: string }
 *
 * Find-or-create a department by name (case-insensitive), so HR can add new
 * dept/project values on the fly from the candidate Edit Profile combobox.
 *
 * Follows the same find-or-create convention as `createRequisition` /
 * `updateCandidate` in lib/data-access.ts:
 *  - If a department with the same name already exists (case-insensitive),
 *    it is returned as-is (and re-activated if it was soft-deleted).
 *  - Otherwise a new row is created with a slug+timestamp code (the `code`
 *    column is NOT NULL + unique, but has no business meaning in this app).
 *
 * The created department is durable and shared app-wide: it immediately
 * becomes an option in every department dropdown backed by the Department
 * table (candidate edit, vacancies, users, requisitions).
 */
export async function POST(request: NextRequest) {
  try {
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

    // Case-insensitive find (mirrors createRequisition) so "art village" and
    // "Art Village" resolve to the same row instead of creating a duplicate.
    let department = await prisma.department.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    let created = false;
    if (!department) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 20);
      department = await prisma.department.create({
        data: {
          name,
          code: `${slug || "dept"}-${Date.now().toString(36)}`,
          isActive: true,
        },
        select: { id: true, name: true },
      });
      created = true;
    } else if (department) {
      // Re-activate a soft-deleted department if it was disabled.
      await prisma.department.update({
        where: { id: department.id },
        data: { deletedAt: null, isActive: true },
      });
    }

    return NextResponse.json({ department, created }, { status: created ? 201 : 200 });
  } catch (error) {
    console.error("Failed to create department:", error);
    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 },
    );
  }
}
