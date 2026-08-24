import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getValidInterviewLink } from "@/lib/interview-links";
import { InterviewResultClient } from "./InterviewResultClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interview Result Review — Nuanu",
  description: "Review a candidate's interview result.",
};

export default async function InterviewResultPage({
  params,
}: {
  params: { id: string };
}) {
  const link = await getValidInterviewLink(params.id);
  if (!link) notFound();
  const applicationId = link.applicationId;
  const app = link.application;

  // Fetch existing comments so the form can pre-fill a previously submitted
  // review for the relevant reviewer role.
  const rawComments = await prisma.interviewComment.findMany({
    where: { applicationId },
    select: {
      id: true,
      content: true,
      rating: true,
      recommendation: true,
      reviewerRole: true,
      round: true,
      interviewDate: true,
      updatedAt: true,
    },
  });

  // Serialise Date objects to ISO strings for the client component.
  const comments = rawComments.map((c) => ({
    ...c,
    interviewDate: c.interviewDate?.toISOString() ?? null,
    updatedAt: c.updatedAt.toISOString(),
  }));

  const candidate = {
    id: app.id,
    name: app.candidate?.name ?? "Candidate",
    appliedFor: app.appliedFor ?? null,
    avatar: app.candidate?.avatar ?? null,
    aiMatch:
      app.candidateScore?.overallScore != null
        ? Math.round(app.candidateScore.overallScore)
        : null,
  };

  const reviewers = {
    hr: app.hrReviewer
      ? { id: app.hrReviewer.id, name: app.hrReviewer.name }
      : null,
    user1: app.user1Reviewer
      ? { id: app.user1Reviewer.id, name: app.user1Reviewer.name }
      : null,
    user2: app.user2Reviewer
      ? { id: app.user2Reviewer.id, name: app.user2Reviewer.name }
      : null,
  };

  return (
    <InterviewResultClient
      candidate={candidate}
      reviewers={reviewers}
      comments={comments}
      accessToken={params.id}
      reviewerRole={link.reviewerRole as "HR" | "USER_1" | "USER_2"}
      round={link.round}
      reviewerName={link.reviewer.name}
    />
  );
}
