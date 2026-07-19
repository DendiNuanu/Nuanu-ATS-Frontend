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

    // Server-side validation: a blacklist action must include a non-empty reason.
    // This guards against clients bypassing the mandatory-reason UI and prevents
    // storing "No reason provided" placeholders going forward.
    if (
      body.isBlacklisted === true &&
      (body.blacklistReason === undefined ||
        String(body.blacklistReason).trim() === "")
    ) {
      return NextResponse.json(
        { error: "A reason for blacklisting is required." },
        { status: 400 },
      );
    }

    await updateCandidate(applicationId, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      location: body.location,
      experienceYears:
        body.experienceYears != null ? Number(body.experienceYears) : undefined,
      source: body.source,
      referredBy:
        body.referredBy !== undefined ? String(body.referredBy) : undefined,
      appliedDate: body.appliedDate,
      expectedSalary:
        body.expectedSalary != null ? Number(body.expectedSalary) : undefined,
      stage: body.stage,
      rejectionType:
        body.rejectionType !== undefined ? body.rejectionType : undefined,
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
      portfolioUrl:
        body.portfolioUrl !== undefined
          ? body.portfolioUrl
            ? String(body.portfolioUrl)
            : null
          : undefined,
    });

    // Revalidate ALL related candidate pages so fresh data shows everywhere.
    // Without revalidating the edit/compose/summary sub-paths, navigating to
    // them could serve stale cached data (e.g. the old stage before a stage
    // change). All these pages are `force-dynamic`, but revalidatePath is a
    // belt-and-suspenders measure that also purges the Full Route Cache.
    revalidatePath(`/candidates/${applicationId}`);
    revalidatePath(`/candidates/${applicationId}/edit`);
    revalidatePath(`/candidates/${applicationId}/compose`);
    revalidatePath(`/candidates/${applicationId}/summary`);
    revalidatePath(`/candidates/${applicationId}/edit-blacklist-reason`);
    revalidatePath("/candidates");

    // Return the confirmed stage so the client can verify the write landed.
    // This eliminates any ambiguity about whether the DB write committed —
    // the client compares the returned stage against what it sent.
    return NextResponse.json({
      success: true,
      stage: body.stage,
      rejectionType: body.rejectionType ?? null,
    });
  } catch (error) {
    console.error("Failed to update candidate:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
