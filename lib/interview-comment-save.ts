import { prisma } from "@/lib/prisma";

const COMMENT_SELECT = {
  id: true,
  content: true,
  rating: true,
  recommendation: true,
  reviewerRole: true,
  updatedAt: true,
} as const;

export type SaveInterviewCommentInput = {
  applicationId: string;
  content: string;
  rating: number | null;
  recommendation: string | null;
  reviewerRole: string;
  authorId: string;
};

/**
 * Serializes writes per application and keeps one stable row per reviewer
 * slot across both the authenticated and shared-review API routes.
 */
export async function saveInterviewComment(input: SaveInterviewCommentInput) {
  return prisma.$transaction(async (tx) => {
    // PostgreSQL transaction advisory locks prevent two API requests from both
    // observing an empty reviewer slot and creating rows concurrently.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.applicationId}))`;

    // Reviewer slots are independent. Never let matching text in HR, User 1,
    // or User 2 prevent the requested slot from being persisted. Ordering by
    // updatedAt also keeps historical duplicate-role data deterministic.
    const roleComment = await tx.interviewComment.findFirst({
      where: {
        applicationId: input.applicationId,
        reviewerRole: input.reviewerRole,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    const data = {
      content: input.content,
      rating: input.rating,
      recommendation: input.recommendation,
      reviewerRole: input.reviewerRole,
      authorId: input.authorId,
    };

    if (roleComment) {
      return tx.interviewComment.update({
        where: { id: roleComment.id },
        data,
        select: COMMENT_SELECT,
      });
    }

    return tx.interviewComment.create({
      data: {
        applicationId: input.applicationId,
        ...data,
      },
      select: COMMENT_SELECT,
    });
  });
}
