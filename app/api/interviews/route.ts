import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createCalendarEvent,
  getValidAccessToken,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar";

/**
 * Creates an Interview record. When `syncCalendar` is true and the user
 * has a connected Google Calendar, a Calendar event with a Google Meet
 * link is created and stored on the interview row.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      candidateId,
      interviewerId,
      type = "video",
      stage = "hr_interview",
      date,
      time,
      duration = 60,
      location,
      meetingUrl,
      notes,
      syncCalendar = false,
    } = body as {
      candidateId?: string;
      interviewerId?: string;
      type?: string;
      stage?: string;
      date?: string;
      time?: string;
      duration?: number;
      location?: string;
      meetingUrl?: string;
      notes?: string;
      syncCalendar?: boolean;
    };

    if (!candidateId || !date || !time) {
      return NextResponse.json(
        { error: "candidateId, date, and time are required" },
        { status: 400 },
      );
    }

    // Resolve the application for this candidate.
    const application = await prisma.application.findFirst({
      where: { candidateId },
      include: { candidate: true, vacancy: true },
      orderBy: { createdAt: "desc" },
    });
    if (!application) {
      return NextResponse.json(
        { error: "No application found for this candidate" },
        { status: 400 },
      );
    }

    // Resolve interviewer — fall back to first active user.
    let resolvedInterviewerId = interviewerId;
    if (!resolvedInterviewerId) {
      const user = await prisma.user.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (!user) {
        return NextResponse.json(
          { error: "No active interviewer found" },
          { status: 400 },
        );
      }
      resolvedInterviewerId = user.id;
    }

    // Build the scheduledAt timestamp from date + time.
    const scheduledAt = new Date(`${date}T${time}:00`);

    // Resolve the requesting user (for calendar sync).
    const requestingUser = await prisma.user.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    let calendarEventId: string | null = null;
    let googleEventId: string | null = null;
    let finalMeetingLink: string | null = meetingUrl ?? null;
    let calendarSynced = false;

    if (syncCalendar && requestingUser && isGoogleCalendarConfigured()) {
      const accessToken = await getValidAccessToken(requestingUser.id);
      if (accessToken) {
        try {
          const endISO = new Date(
            scheduledAt.getTime() + duration * 60_000,
          ).toISOString();

          const candidateName = application.candidate?.name ?? "Candidate";
          const vacancyTitle = application.vacancy?.title ?? "Interview";

          const result = await createCalendarEvent(accessToken, {
            summary: `Interview: ${candidateName} — ${vacancyTitle}`,
            description:
              notes ??
              `${type.charAt(0).toUpperCase() + type.slice(1)} interview for ${vacancyTitle}.`,
            startISO: scheduledAt.toISOString(),
            endISO,
            location: type === "onsite" ? location ?? undefined : undefined,
            attendees: [
              ...(application.candidate?.email
                ? [{ email: application.candidate.email }]
                : []),
            ],
          });

          calendarEventId = result.eventId;
          googleEventId = result.eventId;
          if (result.meetLink) {
            finalMeetingLink = result.meetLink;
          }
          calendarSynced = true;
        } catch (calErr) {
          console.error("Calendar sync failed:", calErr);
          // Continue without calendar sync — the interview is still created.
        }
      }
    }

    const interview = await prisma.interview.create({
      data: {
        applicationId: application.id,
        interviewerId: resolvedInterviewerId,
        type,
        stage,
        scheduledAt,
        duration,
        location: location ?? null,
        meetingUrl: finalMeetingLink,
        status: "scheduled",
        calendarEventId,
        googleEventId,
        calendarSynced,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      interviewId: interview.id,
      meetingLink: finalMeetingLink,
      calendarSynced,
    });
  } catch (error) {
    console.error("Failed to schedule interview:", error);
    const message =
      error instanceof Error ? error.message : "Failed to schedule interview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
