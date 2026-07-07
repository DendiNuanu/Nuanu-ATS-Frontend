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
      noticePeriod:
        body.noticePeriod !== undefined ? String(body.noticePeriod) : undefined,
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
      hrReviewerId:
        body.hrReviewerId !== undefined
          ? body.hrReviewerId
            ? String(body.hrReviewerId)
            : null
          : undefined,
      user1ReviewerId:
        body.user1ReviewerId !== undefined
          ? body.user1ReviewerId
            ? String(body.user1ReviewerId)
            : null
          : undefined,
      user2ReviewerId:
        body.user2ReviewerId !== undefined
          ? body.user2ReviewerId
            ? String(body.user2ReviewerId)
            : null
          : undefined,
      departmentId:
        body.departmentId !== undefined
          ? body.departmentId
            ? String(body.departmentId)
            : null
          : undefined,
      departmentName:
        body.departmentName !== undefined
          ? String(body.departmentName)
          : undefined,
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
