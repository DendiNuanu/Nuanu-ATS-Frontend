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
 * Serializes writes per application and keeps one stable row per reviewer
 * slot across both the authenticated and shared-review API routes.
 */
export async function saveInterviewComment(input: SaveInterviewCommentInput) {
  return prisma.$transaction(async (tx) => {
    // PostgreSQL transaction advisory locks prevent two API requests from both
    // observing an empty reviewer slot and creating rows concurrently.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.applicationId}))`;

    // Reviewer slots are independent. If legacy data contains multiple rows
    // with the same role, prefer the row whose persisted text matches the form
    // being saved. This prevents an unchanged historical comment from
    // overwriting a different row merely because that row was updated later.
    const roleComments = await tx.interviewComment.findMany({
      where: {
        applicationId: input.applicationId,
        reviewerRole: input.reviewerRole,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, content: true },
    });
    const normalizedInput = normalizeComment(input.content);
    const roleComment =
      roleComments.find(
        (comment) => normalizeComment(comment.content) === normalizedInput,
      ) ?? roleComments[0];
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
