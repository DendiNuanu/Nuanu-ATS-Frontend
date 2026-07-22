import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { fetchCandidateById, recordEmailSent } from "@/lib/data-access";
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

    const smtpLogin = process.env.BREVO_SMTP_LOGIN;
    const smtpKey = process.env.BREVO_SMTP_KEY;

    if (!smtpLogin || !smtpKey) {
      console.error(
        "Missing Brevo SMTP credentials (BREVO_SMTP_LOGIN / BREVO_SMTP_KEY)",
      );
      return NextResponse.json(
        {
          error:
            "Email service is not configured. Set BREVO_SMTP_LOGIN and BREVO_SMTP_KEY in the server environment.",
        },
        { status: 500 },
      );
    }

    // Brevo SMTP relay — port 587 with STARTTLS.
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false, // STARTTLS on port 587
      auth: {
        user: smtpLogin,
        pass: smtpKey,
      },
    });

    // Verify the SMTP connection up front so we can surface a clear,
    // actionable error (auth failure, wrong host/port, etc.) instead of a
    // generic 500. This catches the common "535 5.7.8 Authentication failed"
    // case and returns a precise message to the frontend.
    try {
      await transporter.verify();
    } catch (verifyError) {
      console.error("SMTP connection/verification failed:", verifyError);
      const detail =
        verifyError instanceof Error ? verifyError.message : String(verifyError);

      // 535 5.7.8 = SMTP authentication rejected (wrong/revoked/expired key).
      if (/535|authentication|auth required|invalid login/i.test(detail)) {
        return NextResponse.json(
          {
            error:
              "SMTP authentication failed (535 5.7.8). The Brevo SMTP key (BREVO_SMTP_KEY) is invalid, expired, or revoked. Generate a new SMTP key in Brevo → Transactional → Settings → SMTP & API and update BREVO_SMTP_KEY in .env.local.",
            smtpDetail: detail,
          },
          { status: 502 },
        );
      }

      // Connection-level failures (wrong host/port, TLS, network).
      if (/connect|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|TLS|certificate/i.test(detail)) {
        return NextResponse.json(
          {
            error:
              "Could not connect to the Brevo SMTP server. Check network connectivity and the SMTP host/port configuration.",
            smtpDetail: detail,
          },
          { status: 502 },
        );
      }

      return NextResponse.json(
        {
          error: "SMTP verification failed before sending.",
          smtpDetail: detail,
        },
        { status: 502 },
      );
    }

    const info = await transporter.sendMail({
      from: "Nuanu <job@nuanu.com>",
      to,
      subject,
      text,
    });

    // B8 RELIABILITY FIX: The SMTP provider (Brevo) has now CONFIRMED
    // delivery acceptance (we have a messageId). Persisting the email-sent
    // state to our DB is a separate concern — if it fails (e.g. transient DB
    // error), the email STILL WENT OUT, so we must NOT return an error to
    // the client (which would make HR think the send failed and re-send →
    // duplicate email). Instead, log the DB-record failure and return
    // success with a `recorded: false` flag so the client can surface a
    // non-blocking warning ("email sent, but couldn't update the record —
    // the badge may not show until refreshed").
    let recorded = true;
    try {
      await recordEmailSent(candidateId, subject);
    } catch (recordError) {
      // The email was sent successfully — this DB write failure must NOT
      // cause a false error. Log it for ops visibility and flag the response.
      console.error(
        "Email was sent successfully but recording the send in the DB failed:",
        recordError,
      );
      recorded = false;
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
        recorded,
        // Confirmed by the email provider — the client can trust this to
        // show the "email sent" badge immediately, even if the DB record
        // write is lagging.
        delivered: true,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to send email:", error);
    const detail = error instanceof Error ? error.message : String(error);

    // Surface SMTP auth failures from sendMail with a clear, actionable message.
    if (/535|authentication failed|invalid login/i.test(detail)) {
      return NextResponse.json(
        {
          error:
            "SMTP authentication failed (535 5.7.8). The Brevo SMTP key (BREVO_SMTP_KEY) is invalid, expired, or revoked. Generate a new SMTP key in Brevo → Transactional → Settings → SMTP & API and update BREVO_SMTP_KEY in .env.local.",
          smtpDetail: detail,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to send email.", smtpDetail: detail },
      { status: 500 },
    );
  }
}
