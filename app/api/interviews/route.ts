import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import {
  createCalendarEvent,
  updateCalendarEvent,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar";
import { findOrCreateGeneralVacancy } from "@/lib/data-access";
import { WITA_TIMEZONE } from "@/lib/format-wita";

/**
 * Creates an Interview record. When `syncCalendar` is true and the user
 * has a connected Google Calendar, a Calendar event with a Google Meet
 * link is created and stored on the interview row.
 *
 * After the interview is created, a real email invitation is sent to the
 * candidate via the Brevo SMTP relay (same integration as /api/send-email).
 *
 * Application resolution:
 *  - The schedule form's candidate dropdown is populated by
 *    `fetchCandidateOptions()`, which returns Application IDs (not User IDs).
 *    So the client sends `candidateId` = the Application ID.
 *  - First, try to find the Application by its own ID directly (the normal
 *    path — every candidate in the dropdown already has an Application).
 *  - If that fails, fall back to searching by `candidateId` (User ID) for
 *    callers that pass a real User ID instead of an Application ID.
 *  - If neither finds an Application, auto-create a minimal one linked to
 *    the general vacancy — but ONLY after verifying the User exists, to
 *    avoid a foreign-key constraint violation.
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
    // The schedule form sends the Application ID (from fetchCandidateOptions),
    // so try finding by Application ID first. If that doesn't match, try
    // finding by candidateId (User ID) for backward compatibility.
    let application = await prisma.application.findUnique({
      where: { id: candidateId },
      include: { candidate: true, vacancy: true },
    });

    if (!application) {
      // Fallback: the caller might have passed a real User ID (candidateId).
      application = await prisma.application.findFirst({
        where: { candidateId },
        include: { candidate: true, vacancy: true },
        orderBy: { createdAt: "desc" },
      });
    }

    // If still no application, auto-create a minimal one linked to the
    // general vacancy. But FIRST verify the User (candidate) actually
    // exists to avoid a foreign-key constraint violation.
    if (!application) {
      const user = await prisma.user.findUnique({
        where: { id: candidateId },
      });

      if (!user) {
        return NextResponse.json(
          {
            error:
              "Candidate not found — cannot schedule interview. The provided ID does not match any existing candidate or application.",
          },
          { status: 404 },
        );
      }

      const generalVacancyId = await findOrCreateGeneralVacancy();

      // Check if an application already exists for this (vacancy, candidate)
      // pair — the schema has @@unique([vacancyId, candidateId]).
      const existing = await prisma.application.findUnique({
        where: {
          vacancyId_candidateId: {
            vacancyId: generalVacancyId,
            candidateId: user.id,
          },
        },
        include: { candidate: true, vacancy: true },
      });

      if (existing) {
        application = existing;
      } else {
        application = await prisma.application.create({
          data: {
            vacancyId: generalVacancyId,
            candidateId: user.id,
            source: "direct",
            currentStage: "new",
            appliedFor: null,
          },
          include: { candidate: true, vacancy: true },
        });
      }
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
    //
    // The user enters a WITA (UTC+8) time via <input type="time">. Native
    // HTML time inputs have NO timezone info, so `new Date("2026-07-06T10:00")`
    // would be interpreted as the SERVER's local timezone (UTC on the server),
    // causing an 8-hour offset when displayed back via formatTimeWita (which
    // converts UTC → WITA, adding 8 hours to the already-correct value).
    //
    // Fix: explicitly tag the input as WITA by appending "+08:00", so JS
    // creates the correct UTC equivalent (10:00 WITA → 02:00 UTC). When
    // formatTimeWita converts UTC → WITA on display, it shows "10:00" again.
    const scheduledAt = new Date(`${date}T${time}:00+08:00`);

    // Google Calendar sync via service account (no per-user tokens).
    // The service account impersonates job@nuanu.com directly, so there is no
    // need to resolve a "requesting user" or fetch stored OAuth tokens.
    let calendarEventId: string | null = null;
    let googleEventId: string | null = null;
    let finalMeetingLink: string | null = meetingUrl ?? null;
    let calendarSynced = false;

    if (syncCalendar && isGoogleCalendarConfigured()) {
      try {
        const endISO = new Date(
          scheduledAt.getTime() + duration * 60_000,
        ).toISOString();

        const candidateName = application.candidate?.name ?? "Candidate";
        const vacancyTitle = application.vacancy?.title ?? "Interview";

        const result = await createCalendarEvent({
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
        // Fail gracefully: the service account key may be missing/unreadable,
        // or Domain-Wide Delegation may not be authorized. Either way, the
        // interview is still created — the user can enter a manual meeting URL.
        console.error("Calendar sync failed (service account):", calErr);
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

    // Send a real email invitation to the candidate via Brevo SMTP.
    // This is best-effort: if the email fails, the interview record is still
    // persisted and the response reports partial success.
    let emailSent = false;
    let emailError: string | null = null;

    const candidateEmail = application.candidate?.email ?? null;
    const candidateName = application.candidate?.name ?? "Candidate";

    if (candidateEmail) {
      try {
        const emailResult = await sendInterviewInvitationEmail({
          to: candidateEmail,
          candidateName,
          scheduledAt,
          duration,
          type,
          location: location ?? null,
          meetingUrl: finalMeetingLink,
          notes: notes ?? null,
        });
        emailSent = emailResult;

        if (emailSent) {
          // Record the email send on the application so profile badges update.
          await prisma.application.update({
            where: { id: application.id },
            data: {
              emailSentAt: new Date(),
              emailSentSubject: "Interview Invitation — Nuanu Recruitment",
              lastActivityAt: new Date(),
            },
          });
        }
      } catch (emailErr) {
        console.error("Interview invitation email failed:", emailErr);
        emailError =
          emailErr instanceof Error
            ? emailErr.message
            : "Unknown email error";
      }
    } else {
      emailError = "Candidate has no email address on file";
    }

    return NextResponse.json({
      success: true,
      interviewId: interview.id,
      meetingLink: finalMeetingLink,
      calendarSynced,
      emailSent,
      emailError,
      candidateEmail,
    });
  } catch (error) {
    console.error("Failed to schedule interview:", error);
    const message =
      error instanceof Error ? error.message : "Failed to schedule interview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — Reschedule an interview or add a meeting URL
// ---------------------------------------------------------------------------

/**
 * PATCH /api/interviews?id=<interviewId>
 *
 * Updates an existing interview record. Supports two use cases:
 *  1. Reschedule: change date/time/duration/type/notes and optionally update
 *     the Google Calendar event + send a rescheduled notification email.
 *  2. Add meeting URL: when only `meetingUrl` is provided (e.g. the "No link"
 *     button on the interviews list), patches the meeting URL without
 *     changing the schedule.
 *
 * Body fields (all optional except the interview id via query param):
 *  - date, time, duration, type, location, notes, meetingUrl
 */
export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const interviewId = url.searchParams.get("id");

    if (!interviewId) {
      return NextResponse.json(
        { error: "Interview id is required as a query parameter" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      date,
      time,
      duration,
      type,
      location,
      notes,
      meetingUrl,
    } = body as {
      date?: string;
      time?: string;
      duration?: number;
      type?: string;
      location?: string;
      notes?: string;
      meetingUrl?: string;
    };

    // Fetch the existing interview with relations for context.
    const existing = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: { candidate: true, vacancy: true },
        },
        interviewer: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 },
      );
    }

    // Determine if this is a reschedule (date/time changed) or just a
    // meeting URL update.
    const isReschedule = Boolean(date && time);

    // Build the new scheduledAt if rescheduling.
    // Same WITA timezone fix as POST: interpret input as WITA (+08:00).
    const scheduledAt = isReschedule
      ? new Date(`${date}T${time}:00+08:00`)
      : existing.scheduledAt;

    const newDuration = duration ?? existing.duration;
    const newType = type ?? existing.type;
    const newLocation = location ?? existing.location;
    const newNotes = notes ?? existing.notes;
    const newMeetingUrl = meetingUrl ?? existing.meetingUrl;

    // If rescheduling and the interview has a Google Calendar event, update
    // the calendar event's time too (not create a duplicate). Uses the service
    // account directly — no per-user OAuth tokens needed.
    const calendarSynced = existing.calendarSynced;
    if (
      isReschedule &&
      existing.calendarEventId &&
      isGoogleCalendarConfigured()
    ) {
      try {
        const endISO = new Date(
          scheduledAt.getTime() + newDuration * 60_000,
        ).toISOString();

        const candidateName =
          existing.application?.candidate?.name ?? "Candidate";
        const vacancyTitle =
          existing.application?.vacancy?.title ?? "Interview";

        await updateCalendarEvent(existing.calendarEventId, {
          summary: `Interview: ${candidateName} — ${vacancyTitle}`,
          description:
            newNotes ??
            `${newType.charAt(0).toUpperCase() + newType.slice(1)} interview for ${vacancyTitle}.`,
          startISO: scheduledAt.toISOString(),
          endISO,
          location:
            newType === "onsite" ? newLocation ?? undefined : undefined,
          attendees: [
            ...(existing.application?.candidate?.email
              ? [{ email: existing.application.candidate.email }]
              : []),
          ],
        });
      } catch (calErr) {
        // Fail gracefully — the interview record is still updated below.
        console.error("Calendar event update failed (service account):", calErr);
      }
    }

    // Update the interview record.
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        ...(isReschedule && { scheduledAt }),
        ...(duration !== undefined && { duration: newDuration }),
        ...(type !== undefined && { type: newType }),
        ...(location !== undefined && { location: newLocation }),
        ...(notes !== undefined && { notes: newNotes }),
        ...(meetingUrl !== undefined && { meetingUrl: newMeetingUrl }),
      },
    });

    // Send a rescheduled notification email to the candidate.
    let emailSent = false;
    let emailError: string | null = null;

    const candidateEmail = existing.application?.candidate?.email ?? null;
    const candidateName = existing.application?.candidate?.name ?? "Candidate";

    if (isReschedule && candidateEmail) {
      try {
        emailSent = await sendRescheduledEmail({
          to: candidateEmail,
          candidateName,
          scheduledAt,
          duration: newDuration,
          type: newType,
          location: newLocation ?? null,
          meetingUrl: newMeetingUrl ?? null,
          notes: newNotes ?? null,
        });
      } catch (emailErr) {
        console.error("Reschedule notification email failed:", emailErr);
        emailError =
          emailErr instanceof Error
            ? emailErr.message
            : "Unknown email error";
      }
    }

    return NextResponse.json({
      success: true,
      interviewId,
      calendarSynced,
      emailSent,
      emailError,
      candidateEmail,
    });
  } catch (error) {
    console.error("Failed to update interview:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update interview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Interview invitation email helper
// ---------------------------------------------------------------------------

/**
 * Sends a professional interview invitation email to the candidate via the
 * Brevo SMTP relay (same integration as /api/send-email).
 *
 * Returns `true` on success, throws on failure.
 */
async function sendInterviewInvitationEmail(params: {
  to: string;
  candidateName: string;
  scheduledAt: Date;
  duration: number;
  type: string;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
}): Promise<boolean> {
  const {
    to,
    candidateName,
    scheduledAt,
    duration,
    type,
    location,
    meetingUrl,
    notes,
  } = params;

  const smtpLogin = process.env.BREVO_SMTP_LOGIN;
  const smtpKey = process.env.BREVO_SMTP_KEY;

  if (!smtpLogin || !smtpKey) {
    console.error(
      "Missing Brevo SMTP credentials (BREVO_SMTP_LOGIN / BREVO_SMTP_KEY)",
    );
    throw new Error(
      "Email service is not configured. Set BREVO_SMTP_LOGIN and BREVO_SMTP_KEY.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // STARTTLS on port 587
    auth: {
      user: smtpLogin,
      pass: smtpKey,
    },
  });

  // Format date/time in WITA (UTC+8) for the candidate.
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dateStr = dateFormatter.format(scheduledAt);
  const timeStr = timeFormatter.format(scheduledAt);
  const endTime = new Date(scheduledAt.getTime() + duration * 60_000);
  const endTimeStr = timeFormatter.format(endTime);

  const typeLabel =
    type === "video"
      ? "Video Interview"
      : type === "phone"
        ? "Phone Interview"
        : "On-site Interview";

  // Build the email body — clean, professional, consistent with the tone of
  // the other templates in lib/email-templates.ts.
  const lines: string[] = [
    `Dear ${candidateName},`,
    "",
    "Thank you for your continued interest in opportunities at Nuanu.",
    "",
    "We are pleased to invite you to an interview as part of our recruitment process. Please find the details below:",
    "",
    `  Interview Type: ${typeLabel}`,
    `  Date: ${dateStr}`,
    `  Time: ${timeStr} - ${endTimeStr} WITA (UTC+8)`,
    `  Duration: ${duration} minutes`,
  ];

  if (type === "onsite" && location) {
    lines.push(`  Location: ${location}`);
  }
  if (meetingUrl) {
    lines.push(`  Meeting Link: ${meetingUrl}`);
  }
  if (notes && notes.trim()) {
    lines.push("");
    lines.push("Additional notes:");
    lines.push(notes.trim());
  }

  lines.push("");
  lines.push(
    "Please confirm your availability by replying to this email. If the scheduled time does not work for you, let us know and we will be happy to arrange an alternative slot.",
  );
  lines.push("");
  lines.push(
    "If you have any questions or need further information before the interview, do not hesitate to reach out.",
  );
  lines.push("");
  lines.push("We look forward to speaking with you.");
  lines.push("");
  lines.push("Warm regards,");
  lines.push("HR Team – Nuanu");

  const subject = "Interview Invitation — Nuanu Recruitment";
  const text = lines.join("\n");

  await transporter.sendMail({
    from: "Nuanu <job@nuanu.com>",
    to,
    subject,
    text,
  });

  return true;
}

// ---------------------------------------------------------------------------
// Reschedule notification email helper
// ---------------------------------------------------------------------------

/**
 * Sends a rescheduled interview notification email to the candidate via the
 * Brevo SMTP relay. Mirrors the structure of sendInterviewInvitationEmail but
 * with reschedule-specific wording so the candidate knows the time changed.
 *
 * Returns `true` on success, throws on failure.
 */
async function sendRescheduledEmail(params: {
  to: string;
  candidateName: string;
  scheduledAt: Date;
  duration: number;
  type: string;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
}): Promise<boolean> {
  const {
    to,
    candidateName,
    scheduledAt,
    duration,
    type,
    location,
    meetingUrl,
    notes,
  } = params;

  const smtpLogin = process.env.BREVO_SMTP_LOGIN;
  const smtpKey = process.env.BREVO_SMTP_KEY;

  if (!smtpLogin || !smtpKey) {
    console.error(
      "Missing Brevo SMTP credentials (BREVO_SMTP_LOGIN / BREVO_SMTP_KEY)",
    );
    throw new Error(
      "Email service is not configured. Set BREVO_SMTP_LOGIN and BREVO_SMTP_KEY.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // STARTTLS on port 587
    auth: {
      user: smtpLogin,
      pass: smtpKey,
    },
  });

  // Format date/time in WITA (UTC+8) for the candidate.
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dateStr = dateFormatter.format(scheduledAt);
  const timeStr = timeFormatter.format(scheduledAt);
  const endTime = new Date(scheduledAt.getTime() + duration * 60_000);
  const endTimeStr = timeFormatter.format(endTime);

  const typeLabel =
    type === "video"
      ? "Video Interview"
      : type === "phone"
        ? "Phone Interview"
        : "On-site Interview";

  const lines: string[] = [
    `Dear ${candidateName},`,
    "",
    "We are writing to inform you that your interview with Nuanu has been rescheduled. Please find the updated details below:",
    "",
    `  Interview Type: ${typeLabel}`,
    `  Date: ${dateStr}`,
    `  Time: ${timeStr} - ${endTimeStr} WITA (UTC+8)`,
    `  Duration: ${duration} minutes`,
  ];

  if (type === "onsite" && location) {
    lines.push(`  Location: ${location}`);
  }
  if (meetingUrl) {
    lines.push(`  Meeting Link: ${meetingUrl}`);
  }
  if (notes && notes.trim()) {
    lines.push("");
    lines.push("Additional notes:");
    lines.push(notes.trim());
  }

  lines.push("");
  lines.push(
    "Please confirm your availability for the new time by replying to this email. If the updated schedule does not work for you, let us know and we will arrange an alternative slot.",
  );
  lines.push("");
  lines.push(
    "If you have any questions or need further information, do not hesitate to reach out.",
  );
  lines.push("");
  lines.push("We look forward to speaking with you.");
  lines.push("");
  lines.push("Warm regards,");
  lines.push("HR Team – Nuanu");

  const subject = "Interview Rescheduled — Nuanu Recruitment";
  const text = lines.join("\n");

  await transporter.sendMail({
    from: "Nuanu <job@nuanu.com>",
    to,
    subject,
    text,
  });

  return true;
}
