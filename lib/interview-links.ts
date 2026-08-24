import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInterviewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInterviewLink(input: {
  applicationId: string;
  reviewerId: string;
  reviewerRole: "USER_1" | "USER_2" | "HR";
  round: number;
}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);
  await prisma.interviewLink.create({
    data: {
      applicationId: input.applicationId,
      reviewerId: input.reviewerId,
      reviewerRole: input.reviewerRole,
      round: input.round,
      tokenHash: hashInterviewToken(token),
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function getValidInterviewLink(token: string) {
  if (!token || token.length < 40) return null;
  const link = await prisma.interviewLink.findUnique({
    where: { tokenHash: hashInterviewToken(token) },
    include: {
      application: {
        select: {
          id: true,
          appliedFor: true,
          candidate: { select: { id: true, name: true, avatar: true } },
          candidateScore: { select: { overallScore: true } },
          user1Reviewer: { select: { id: true, name: true, email: true } },
          user2Reviewer: { select: { id: true, name: true, email: true } },
          hrReviewer: { select: { id: true, name: true, email: true } },
        },
      },
      reviewer: { select: { id: true, name: true } },
    },
  });
  if (!link || link.expiresAt <= new Date() || link.usedAt) return null;
  return link;
}
