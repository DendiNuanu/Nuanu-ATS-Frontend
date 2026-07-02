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
        { error: "Email service is not configured" },
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
    const message =
      error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
