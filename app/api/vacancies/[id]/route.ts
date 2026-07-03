import { NextRequest, NextResponse } from "next/server";
import { updateVacancy, type UpdateVacancyInput } from "@/lib/data-access";
import { revalidatePath } from "next/cache";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const body = await request.json();

    const input: UpdateVacancyInput = {};

    if (body.title !== undefined) input.title = String(body.title).trim();
    if (body.departmentName !== undefined)
      input.departmentName = String(body.departmentName);
    if (body.employmentType !== undefined)
      input.employmentType = String(body.employmentType);
    if (body.headcount !== undefined)
      input.headcount = Number(body.headcount) || 1;
    if (body.location !== undefined) input.location = String(body.location);
    if (body.locationType !== undefined)
      input.locationType = String(body.locationType);
    if (body.salaryMin !== undefined)
      input.salaryMin = body.salaryMin != null ? Number(body.salaryMin) : null;
    if (body.salaryMax !== undefined)
      input.salaryMax = body.salaryMax != null ? Number(body.salaryMax) : null;
    if (body.description !== undefined)
      input.description = String(body.description);
    if (body.requirements !== undefined)
      input.requirements = String(body.requirements);
    if (body.status !== undefined) input.status = String(body.status);

    await updateVacancy(id, input);

    revalidatePath("/jobs");
    revalidatePath(`/jobs/${id}`);
    revalidatePath(`/jobs/${id}/edit`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update vacancy:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update vacancy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
