import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { fetchCandidateById, recordEmailSent } from "@/lib/data-access";
import { describeEmailDeliveryError, sendBrevoEmail } from "@/lib/brevo-email";
import { isRejectionSubject } from "@/lib/email-templates";

/**
 * POST /api/send-email
 *
 * Sends a real outbound candidate email via the Brevo SMTP relay and records
 * the send in the database (application.emailSentAt / emailSentSubject) so the
 * email-sent badges on the candidate profile reflect reality.
 *
 * Body: { to: string, subject: string, body: string, candidateId: string }
 *
 * SMTP credentials are read from environment variables — never hardcoded, never
 * sent to the client. The official outbound address is always
 * "Nuanu <job@nuanu.com>" regardless of which staff member is logged in.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: text, candidateId } = body as {
      to?: string;
      subject?: string;
      body?: string;
      candidateId?: string;
    };

    // Validate required fields
    if (!to || typeof to !== "string" || !to.trim()) {
      return NextResponse.json(
        { error: "Recipient (to) is required" },
        { status: 400 },
      );
    }
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 },
      );
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "Email body is required" },
        { status: 400 },
      );
    }
    if (!candidateId || typeof candidateId !== "string") {
      return NextResponse.json(
        { error: "candidateId is required" },
        { status: 400 },
      );
    }

    // Verify the candidate exists and the recipient address matches — this
    // prevents the API from being used to email arbitrary addresses.
    const candidate = await fetchCandidateById(candidateId);
    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 },
      );
    }
    if (candidate.email.toLowerCase() !== to.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Recipient address does not match the candidate" },
        { status: 400 },
      );
    }

    // ── Duplicate rejection email guard ────────────────────────────────────
    // If a rejection email was ALREADY sent to this candidate (tracked via
    // `rejectionEmailSent` / `emailSentSubject`), block the send and return a
    // clear 409 Conflict. This is the authoritative backend enforcement — the
    // UI also disables the send button, but the backend must be the source of
    // truth so a race condition, direct API call, or stale client cannot
    // result in a duplicate rejection email.
    if (
      candidate.rejectionEmailSent &&
      isRejectionSubject(subject)
    ) {
      const sentAt = candidate.rejectionEmailSentAt ?? "previously";
      return NextResponse.json(
        {
          error: `A rejection email was already sent to this candidate on ${sentAt}. Duplicate rejection emails are not allowed.`,
          alreadySent: true,
          sentAt,
        },
        { status: 409 },
      );
    }

    const info = await sendBrevoEmail({ to, subject, text });

    // Persist the provider-confirmed send before the UI may display SENT. If
    // this audit write fails, return a special non-retryable state: the message
    // was accepted by Brevo, but the app cannot truthfully show its DB badge.
    try {
      await recordEmailSent(candidateId, subject);
    } catch (recordError) {
      console.error(
        "Email was provider-confirmed but recording the send failed:",
        recordError,
      );
      return NextResponse.json(
        {
          error:
            "Brevo accepted the email, but the ATS could not record confirmation. Do not resend; contact an administrator.",
          providerAccepted: true,
          messageId: info.messageId,
        },
        { status: 503 },
      );
    }

    // Revalidate the candidate detail + list pages so the email-sent badge
    // appears immediately without a manual refresh. Without this, the Router
    // Cache could serve the pre-send state (no badge) until the cache TTL.
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/candidates/${candidateId}/compose`);
    revalidatePath("/candidates");

    return NextResponse.json(
      {
        success: true,
        messageId: info.messageId,
        recorded: true,
        providerAccepted: true,
        accepted: info.accepted,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to send email:", error);
    const detail = error instanceof Error ? error.message : String(error);

    // Surface SMTP auth failures from sendMail with a clear, actionable message.
    return NextResponse.json(
      { error: describeEmailDeliveryError(error), smtpDetail: detail },
      { status: 502 },
    );
  }
}
