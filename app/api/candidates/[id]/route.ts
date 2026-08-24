import { NextRequest, NextResponse } from "next/server";
import { fetchHiredConversion, updateCandidate } from "@/lib/data-access";
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

    const positionSlots = Array.isArray(body.positionSlots)
      ? body.positionSlots
          .map((slot: unknown) => {
            if (!slot || typeof slot !== "object") return null;
            const value = slot as Record<string, unknown>;
            const kind = value.kind;
            const slotIndex = Number(value.slotIndex);
            if (
              (kind !== "applied_for" && kind !== "refer_as") ||
              !Number.isInteger(slotIndex) ||
              slotIndex < 0 ||
              slotIndex > 99
            ) {
              return null;
            }
            return {
              kind,
              slotIndex,
              position: String(value.position ?? "").trim(),
              departmentId: value.departmentId ? String(value.departmentId) : null,
              appliedDate: value.appliedDate ? String(value.appliedDate) : null,
            };
          })
          .filter((slot: unknown): slot is NonNullable<typeof slot> => slot !== null)
      : undefined;

    if (Array.isArray(body.positionSlots) && positionSlots?.length !== body.positionSlots.length) {
      return NextResponse.json({ error: "Invalid position slot data." }, { status: 400 });
    }

    const confirmedDbStage = await updateCandidate(applicationId, {
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
      positionSlots,
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
      socialMedia:
        body.socialMedia !== undefined
          ? body.socialMedia
            ? String(body.socialMedia)
            : null
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

    // Return the stage confirmed by the write path, never the untrusted request
    // body. This makes stale and concurrent clients detect a rejected update.
    const dbToUiStage: Record<string, string> = {
      new: "New",
      talent_bank: "Talent Bank",
      screening: "Screening",
      hr_interview: "HR Interview",
      user_interview: "User Interview",
      assessment: "Assessment",
      user_interview_ii: "User Interview II",
      offering: "Offering",
      hired: "Hired",
      rejected: "Rejected",
      onboarding: "Onboarding",
    };
    const conversion =
      confirmedDbStage === "hired"
        ? await fetchHiredConversion(applicationId)
        : null;

    return NextResponse.json({
      success: true,
      stage: dbToUiStage[confirmedDbStage] ?? confirmedDbStage,
      rejectionType: body.rejectionType ?? null,
      rejectionEmailQueued: confirmedDbStage === "rejected",
      conversion,
    });
  } catch (error) {
    console.error("Failed to update candidate:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
