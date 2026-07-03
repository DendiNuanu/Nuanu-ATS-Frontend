import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createRequisition } from "@/lib/data-access";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json(
        { error: "Job title is required" },
        { status: 400 },
      );
    }
    if (
      !body.departmentName ||
      typeof body.departmentName !== "string" ||
      !body.departmentName.trim()
    ) {
      return NextResponse.json(
        { error: "Department is required" },
        { status: 400 },
      );
    }

    // Resolve the requesting user. The app has no auth layer yet, so we
    // fall back to the first active user (or the most recently created user).
    let requestedById = body.requestedById;
    if (!requestedById) {
      const user = await prisma.user.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (!user) {
        return NextResponse.json(
          { error: "No active user found to assign as requester" },
          { status: 400 },
        );
      }
      requestedById = user.id;
    }

    const id = await createRequisition({
      title: String(body.title).trim(),
      departmentName: String(body.departmentName).trim(),
      employmentType: body.employmentType ?? "full-time",
      headcount: Number(body.headcount) || 1,
      location: body.location ?? "",
      salaryMin: body.salaryMin != null ? Number(body.salaryMin) : null,
      salaryMax: body.salaryMax != null ? Number(body.salaryMax) : null,
      justification: body.justification ?? "",
      requestedById,
    });

    revalidatePath("/approvals");

    return NextResponse.json({ id, success: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to create requisition:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create requisition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
