import { NextRequest, NextResponse } from "next/server";
import { updateCandidate } from "@/lib/data-access";
import { revalidatePath } from "next/cache";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const applicationId = params.id;

    await updateCandidate(applicationId, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      location: body.location,
      experienceYears:
        body.experienceYears != null ? Number(body.experienceYears) : undefined,
      source: body.source,
      appliedDate: body.appliedDate,
      expectedSalary:
        body.expectedSalary != null ? Number(body.expectedSalary) : undefined,
      stage: body.stage,
      domicile: body.domicile,
      appliedFor: body.appliedFor,
      referPosition: body.referPosition,
      isStarred:
        body.isStarred !== undefined ? Boolean(body.isStarred) : undefined,
      isBlacklisted:
        body.isBlacklisted !== undefined
          ? Boolean(body.isBlacklisted)
          : undefined,
      blacklistReason:
        body.blacklistReason !== undefined ? String(body.blacklistReason) : undefined,
    });

    // Revalidate the candidate detail + list pages so fresh data shows.
    revalidatePath(`/candidates/${applicationId}`);
    revalidatePath("/candidates");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update candidate:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
