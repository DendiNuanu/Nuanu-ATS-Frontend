import nodemailer from "nodemailer";

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
};

export type DeliveryConfirmation = {
  messageId: string;
  accepted: string[];
};

/** Sends through Brevo and returns only after the provider accepts a recipient. */
export async function sendBrevoEmail(
  email: OutboundEmail,
): Promise<DeliveryConfirmation> {
  const smtpLogin = process.env.BREVO_SMTP_LOGIN;
  const smtpKey = process.env.BREVO_SMTP_KEY;
  if (!smtpLogin || !smtpKey) {
    throw new Error(
      "Email service is not configured. Set BREVO_SMTP_LOGIN and BREVO_SMTP_KEY in the server environment.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user: smtpLogin, pass: smtpKey },
  });

  await transporter.verify();
  const info = await transporter.sendMail({
    from: "Nuanu <job@nuanu.com>",
    ...email,
  });
  const accepted = Array.isArray(info.accepted)
    ? info.accepted.map(String)
    : [];
  if (!info.messageId || accepted.length === 0) {
    throw new Error("The email provider did not confirm recipient acceptance.");
  }

  return { messageId: info.messageId, accepted };
}

export function describeEmailDeliveryError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (/535|authentication|auth required|invalid login/i.test(detail)) {
    return "SMTP authentication failed. The Brevo SMTP key is invalid, expired, or revoked.";
  }
  if (
    /connect|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|TLS|certificate/i.test(
      detail,
    )
  ) {
    return "Could not connect to the Brevo SMTP server.";
  }
  return detail;
}
