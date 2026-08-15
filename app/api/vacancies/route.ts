import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createVacancy, type CreateVacancyInput } from "@/lib/data-access";

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
    if (!body.departmentName || typeof body.departmentName !== "string") {
      return NextResponse.json(
        { error: "Department is required" },
        { status: 400 },
      );
    }

    const externalId = body.seekJobId ?? body.externalJobId ?? null;
    const externalUrl = body.seekJobUrl ?? body.externalJobUrl ?? null;
    const input: CreateVacancyInput = {
      title: body.title.trim(),
      departmentName: body.departmentName,
      employmentType: body.employmentType ?? "full-time",
      headcount: Number(body.headcount) || 1,
      location: body.location ?? "",
      locationType: body.locationType ?? "onsite",
      salaryMin: body.salaryMin != null ? Number(body.salaryMin) : null,
      salaryMax: body.salaryMax != null ? Number(body.salaryMax) : null,
      description: body.description ?? "",
      requirements: body.requirements ?? "",
      status: body.status ?? "draft",
      ...(externalId || externalUrl
        ? {
            externalPosting: {
              channel: String(body.channel ?? "seek"),
              externalId: externalId ? String(externalId) : null,
              externalUrl: externalUrl ? String(externalUrl) : null,
            },
          }
        : {}),
    };

    const id = await createVacancy(input);

    // Invalidate the jobs list cache so the new vacancy appears immediately.
    revalidatePath("/jobs");

    return NextResponse.json({ id, success: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to create vacancy:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create vacancy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
