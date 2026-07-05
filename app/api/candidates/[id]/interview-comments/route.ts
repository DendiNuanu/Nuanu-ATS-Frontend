import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * GET /api/candidates/[id]/interview-comments
 *
 * Returns all interview comments for a candidate's application, grouped by
 * reviewer role. Used by the candidate detail page to pre-fill the
 * HR Manager / User 1 / User 2 feedback sections so they persist across
 * page refreshes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const applicationId = params.id;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    const comments = await prisma.interviewComment.findMany({
      where: { applicationId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        content: true,
        rating: true,
        recommendation: true,
        reviewerRole: true,
        authorId: true,
        author: { select: { id: true, name: true, email: true } },
        updatedAt: true,
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Failed to fetch interview comments:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch comments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/candidates/[id]/interview-comments
 *
 * Creates or updates (upserts) an interview comment for a specific reviewer
 * role on a candidate's application. Because there should be at most one
 * comment per (application, reviewerRole), we look up an existing comment and
 * update it, otherwise create a new one.
 *
 * Body:
 *   - reviewerRole: "HR" | "USER_1" | "USER_2"
 *   - rating: number (1-5)
 *   - recommendation: "Strong Hire" | "Hire" | "No Hire" | "Strong No Hire"
 *   - comment: string
 *   - authorEmail?: string (resolved to authorId; falls back to first active user)
 *   - authorId?: string (explicit author override, used by the public review page)
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
        { error: "Comment is required" },
        { status: 400 },
      );
    }

    const rating =
      body.rating != null ? Number(body.rating) : null;
    if (rating != null && (Number.isNaN(rating) || rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 },
      );
    }

    const recommendation =
      typeof body.recommendation === "string" && body.recommendation
        ? body.recommendation
        : null;

    // Verify the application exists.
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    // Resolve the author. Prefer an explicit authorId (used by the public
    // review page where we know the assigned reviewer), then the client
    // provided email (from auth context), then fall back to the first active
    // user — matching the project's existing no-auth-layer pattern.
    let authorId: string | undefined;

    if (typeof body.authorId === "string" && body.authorId.trim()) {
      const user = await prisma.user.findUnique({
        where: { id: body.authorId },
        select: { id: true },
      });
      if (user) {
        authorId = user.id;
      }
    }

    if (!authorId) {
      const authorEmail =
        typeof body.authorEmail === "string" ? body.authorEmail.trim() : null;
      if (authorEmail) {
        const user = await prisma.user.findFirst({
          where: {
            email: { equals: authorEmail, mode: "insensitive" },
            deletedAt: null,
          },
          select: { id: true },
        });
        if (user) {
          authorId = user.id;
        }
      }
    }

    if (!authorId) {
      const user = await prisma.user.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json(
          { error: "No active user found to attribute the comment" },
          { status: 400 },
        );
      }
      authorId = user.id;
    }

    // Look up an existing comment for this (application, reviewerRole) pair.
    // We take the most recently updated one so re-saving updates the same row
    // rather than creating duplicates.
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

    // Revalidate the candidate detail page so fresh comments show on refresh.
    revalidatePath(`/candidates/${applicationId}`);

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("Failed to save interview comment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save comment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
