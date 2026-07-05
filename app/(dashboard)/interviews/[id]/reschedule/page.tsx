import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fetchCalendarConnected } from "@/lib/data-access";
import { RescheduleInterviewClient } from "./RescheduleInterviewClient";

export const dynamic = "force-dynamic";

export default async function RescheduleInterviewPage({
  params,
}: {
  params: { id: string };
}) {
  const [interview, calendarConnected] = await Promise.all([
    prisma.interview.findUnique({
      where: { id: params.id },
      include: {
        application: {
          include: { candidate: true, vacancy: true },
        },
        interviewer: true,
      },
    }),
    fetchCalendarConnected(),
  ]);

  if (!interview) {
    notFound();
  }

  // Serialize dates to ISO strings for the client component.
  const serialized = {
    id: interview.id,
    scheduledAt: interview.scheduledAt.toISOString(),
    duration: interview.duration,
    type: interview.type,
    location: interview.location ?? "",
    meetingUrl: interview.meetingUrl ?? "",
    notes: interview.notes ?? "",
    calendarSynced: interview.calendarSynced,
    calendarEventId: interview.calendarEventId ?? null,
    candidateName: interview.application?.candidate?.name ?? "Candidate",
    candidateEmail: interview.application?.candidate?.email ?? null,
    position: interview.application?.vacancy?.title ?? "—",
    interviewerName: interview.interviewer?.name ?? "—",
  };

  return (
    <RescheduleInterviewClient
      interview={serialized}
      calendarConnected={calendarConnected}
    />
  );
}
