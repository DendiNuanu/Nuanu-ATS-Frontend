import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
    notFound();
  }

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
      updatedAt: true,
    },
  });

  // Serialise Date objects to ISO strings for the client component.
  const comments = rawComments.map((c) => ({
    ...c,
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
    />
  );
}
