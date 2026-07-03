import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { fetchCandidateById, recordEmailSent } from "@/lib/data-access";

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

    // Persist the email-sent state so the profile badges update correctly.
    await recordEmailSent(candidateId, subject);

    return NextResponse.json(
      { success: true, messageId: info.messageId },
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
