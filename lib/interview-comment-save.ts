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

function normalizeComment(content: string): string {
  return content
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/g, ""))
    .join("\n")
    .trim();
}

/**
 * Serializes writes per application and makes identical-content submissions
 * idempotent across both the authenticated and shared-review API routes.
 */
export async function saveInterviewComment(input: SaveInterviewCommentInput) {
  return prisma.$transaction(async (tx) => {
    // PostgreSQL transaction advisory locks prevent two API requests from both
    // observing an empty reviewer slot and creating rows concurrently.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.applicationId}))`;

    const comments = await tx.interviewComment.findMany({
      where: { applicationId: input.applicationId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        content: true,
        reviewerRole: true,
      },
    });

    const normalizedContent = normalizeComment(input.content);
    const contentDuplicate = comments.find(
      (comment) => normalizeComment(comment.content) === normalizedContent,
    );

    // Do not create a second row when the same text is submitted through a
    // different reviewer section or API route. Preserve the original row and
    // its author/reviewer metadata.
    if (contentDuplicate) {
      return tx.interviewComment.findUniqueOrThrow({
        where: { id: contentDuplicate.id },
        select: COMMENT_SELECT,
      });
    }

    const roleComment = comments.find(
      (comment) => comment.reviewerRole === input.reviewerRole,
    );
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
