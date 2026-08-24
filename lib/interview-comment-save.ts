import { prisma } from "@/lib/prisma";

const COMMENT_SELECT = {
  id: true,
  content: true,
  rating: true,
  recommendation: true,
  reviewerRole: true,
  round: true,
  interviewDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type SaveInterviewCommentInput = {
  applicationId: string;
  content: string;
  rating: number | null;
  recommendation: string | null;
  reviewerRole: string;
  authorId: string;
  round: number;
  interviewDate: Date | null;
};

/**
 * Serializes writes per application and updates exactly one reviewer/round
 * slot. Historical rows are preserved when a new interview round is saved.
 */
export async function saveInterviewComment(input: SaveInterviewCommentInput) {
  return prisma.$transaction(async (tx) => {
    // PostgreSQL transaction advisory locks prevent two API requests from both
    // observing an empty reviewer slot and creating rows concurrently.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.applicationId}))`;

    const roundComment = await tx.interviewComment.findFirst({
      where: {
        applicationId: input.applicationId,
        reviewerRole: input.reviewerRole,
        round: input.round,
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
      round: input.round,
      interviewDate: input.interviewDate,
    };

    if (roundComment) {
      return tx.interviewComment.update({
        where: { id: roundComment.id },
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
