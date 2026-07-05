import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * GET /api/interview-result/[id]
 *
 * PUBLIC endpoint (no auth required) that returns a read-only summary of a
 * candidate for the shareable interview-result review page.
 *
 * Returns only the data a reviewer needs to assess the candidate:
 *   - name, appliedFor (position), aiMatch score, avatar initials
 *   - the assigned reviewer (User 1 / User 2) so the public form knows whose
 *     review to pre-fill / attribute the submission to
 *   - any previously submitted review for that reviewer role (so a reviewer
 *     returning to the link sees their existing review instead of a blank form)
 *
 * Sensitive data (contact info, full application details, stage, etc.) is
 * intentionally NOT exposed.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const applicationId = params.id;

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        appliedFor: true,
        candidate: {
          select: { id: true, name: true, avatar: true },
        },
        candidateScore: {
          select: { overallScore: true },
        },
        user1Reviewer: {
          select: { id: true, name: true, email: true },
        },
        user2Reviewer: {
          select: { id: true, name: true, email: true },
        },
        hrReviewer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!app) {
      return NextResponse.json(
        { error: "Candidate not found", notFound: true },
        { status: 404 },
      );
    }

    // Fetch any existing interview comments so the public form can pre-fill
    // a previously submitted review (for USER_1 / USER_2 roles).
    const comments = await prisma.interviewComment.findMany({
      where: { applicationId },
      select: {
        id: true,
        content: true,
        rating: true,
        recommendation: true,
        reviewerRole: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      candidate: {
        id: app.id,
        name: app.candidate?.name ?? "Candidate",
        appliedFor: app.appliedFor ?? null,
        avatar: app.candidate?.avatar ?? null,
        aiMatch:
          app.candidateScore?.overallScore != null
            ? Math.round(app.candidateScore.overallScore)
            : null,
      },
      reviewers: {
        hr: app.hrReviewer
          ? { id: app.hrReviewer.id, name: app.hrReviewer.name }
          : null,
        user1: app.user1Reviewer
          ? { id: app.user1Reviewer.id, name: app.user1Reviewer.name }
          : null,
        user2: app.user2Reviewer
          ? { id: app.user2Reviewer.id, name: app.user2Reviewer.name }
          : null,
      },
      comments,
    });
  } catch (error) {
    console.error("Failed to fetch interview result:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/interview-result/[id]
 *
 * PUBLIC endpoint (no auth required) that submits a reviewer's assessment from
 * the shareable interview-result page.
 *
 * Body:
 *   - reviewerRole: "HR" | "USER_1" | "USER_2"
 *   - rating: number (1-5)
 *   - recommendation: "Strong Hire" | "Hire" | "No Hire" | "Strong No Hire"
 *   - comment: string
 *   - reviewerId?: string (the assigned reviewer's user id — used as authorId)
 *
 * This writes to the SAME InterviewComment table used by the HR candidate
 * detail page, so submissions appear in both places (single source of truth).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const applicationId = params.id;
    const body = await request.json();

    const reviewerRole =
      typeof body.reviewerRole === "string" ? body.reviewerRole : null;
    const validRoles = ["HR", "USER_1", "USER_2"];
    if (!reviewerRole || !validRoles.includes(reviewerRole)) {
      return NextResponse.json(
        { error: "A valid reviewerRole (HR, USER_1, USER_2) is required" },
        { status: 400 },
      );
    }

    const content =
      typeof body.comment === "string" ? body.comment.trim() : "";
    if (!content) {
      return NextResponse.json(
        { error: "Please enter a comment" },
        { status: 400 },
      );
    }

    const rating = body.rating != null ? Number(body.rating) : null;
    if (rating == null || Number.isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 },
      );
    }

    const recommendation =
      typeof body.recommendation === "string" && body.recommendation
        ? body.recommendation
        : null;
    if (!recommendation) {
      return NextResponse.json(
        { error: "Please select a recommendation" },
        { status: 400 },
      );
    }

    // Verify the application exists.
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        hrReviewerId: true,
        user1ReviewerId: true,
        user2ReviewerId: true,
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 },
      );
    }

    // Resolve the authorId. For the public page we use the reviewerId from the
    // body (the assigned reviewer's user id). If not provided, fall back to
    // the application's assigned reviewer for the given role.
    let authorId: string | undefined =
      typeof body.reviewerId === "string" && body.reviewerId.trim()
        ? body.reviewerId
        : undefined;

    if (!authorId) {
      if (reviewerRole === "HR" && application.hrReviewerId) {
        authorId = application.hrReviewerId;
      } else if (reviewerRole === "USER_1" && application.user1ReviewerId) {
        authorId = application.user1ReviewerId;
      } else if (reviewerRole === "USER_2" && application.user2ReviewerId) {
        authorId = application.user2ReviewerId;
      }
    }

    if (!authorId) {
      // Fall back to the first active user (matches project convention).
      const user = await prisma.user.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json(
          { error: "No active user found to attribute the review" },
          { status: 400 },
        );
      }
      authorId = user.id;
    }

    // Upsert: update the most recent existing comment for this role, or create.
    const existing = await prisma.interviewComment.findFirst({
      where: { applicationId, reviewerRole },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    const data = {
      applicationId,
      content,
      rating,
      recommendation,
      reviewerRole,
      authorId,
    };

    let comment;
    if (existing) {
      comment = await prisma.interviewComment.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
          content: true,
          rating: true,
          recommendation: true,
          reviewerRole: true,
          updatedAt: true,
        },
      });
    } else {
      comment = await prisma.interviewComment.create({
        data,
        select: {
          id: true,
          content: true,
          rating: true,
          recommendation: true,
          reviewerRole: true,
          updatedAt: true,
        },
      });
    }

    // Revalidate the candidate detail page so the HR view shows the new
    // comment immediately.
    revalidatePath(`/candidates/${applicationId}`);

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("Failed to submit interview review:", error);
    const message =
      error instanceof Error ? error.message : "Failed to submit review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
