import { sendBrevoEmail, describeEmailDeliveryError } from "@/lib/brevo-email";
import {
  EMAIL_TEMPLATES,
  fillTemplate,
  isRejectionSubject,
} from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

const TEMPLATE_BY_REJECTION_TYPE: Record<string, string> = {
  declined_by_hr: "rejected",
  declined_by_user: "declined-by-user",
  declined_by_candidate: "declined-by-candidate",
};

const MAX_ATTEMPTS = 5;

export async function deliverRejectionEmailJob(
  applicationId: string,
): Promise<"sent" | "already_sent" | "failed" | "not_found"> {
  const job = await prisma.rejectionEmailJob.findUnique({
    where: { applicationId },
    include: {
      application: {
        include: {
          candidate: { select: { name: true, email: true } },
          vacancy: { select: { title: true } },
        },
      },
    },
  });
  if (!job) return "not_found";
  const rejectionAlreadySent =
    job.application.emailSentAt !== null &&
    isRejectionSubject(job.application.emailSentSubject ?? "");
  if (job.status === "sent" || rejectionAlreadySent) {
    if (job.status !== "sent") {
      await prisma.rejectionEmailJob.update({
        where: { id: job.id },
        data: { status: "sent", sentAt: job.application.emailSentAt },
      });
    }
    return "already_sent";
  }
  if (job.attempts >= MAX_ATTEMPTS) return "failed";

  const claimed = await prisma.rejectionEmailJob.updateMany({
    where: {
      id: job.id,
      status: { in: ["pending", "failed"] },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: { status: "processing", attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return "failed";

  const templateId = TEMPLATE_BY_REJECTION_TYPE[job.rejectionType];
  const template = EMAIL_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    await markFailed(job.id, job.attempts + 1, "Unknown rejection type");
    return "failed";
  }

  const context = {
    jobTitle: job.application.vacancy.title,
    companyName: "Nuanu",
  };
  const subject = fillTemplate(
    template.subject,
    job.application.candidate.name,
    context,
  );
  const text = fillTemplate(
    template.body,
    job.application.candidate.name,
    context,
  );

  try {
    const confirmation = await sendBrevoEmail({
      to: job.application.candidate.email,
      subject,
      text,
    });
    const sentAt = new Date();
    await prisma.$transaction([
      prisma.application.update({
        where: { id: applicationId },
        data: { emailSentAt: sentAt, emailSentSubject: subject, lastActivityAt: sentAt },
      }),
      prisma.rejectionEmailJob.update({
        where: { id: job.id },
        data: { status: "sent", sentAt, lastError: null },
      }),
    ]);
    console.info("Automatic rejection email sent", {
      applicationId,
      rejectionType: job.rejectionType,
      messageId: confirmation.messageId,
    });
    return "sent";
  } catch (error) {
    const message = describeEmailDeliveryError(error);
    await markFailed(job.id, job.attempts + 1, message);
    console.error("Automatic rejection email delivery failed", {
      applicationId,
      rejectionType: job.rejectionType,
      attempt: job.attempts + 1,
      error: message,
    });
    return "failed";
  }
}

async function markFailed(jobId: string, attempts: number, error: string) {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  await prisma.rejectionEmailJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      lastError: error.slice(0, 2000),
      nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
    },
  });
}

export async function retryDueRejectionEmails(limit = 10) {
  const jobs = await prisma.rejectionEmailJob.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      attempts: { lt: MAX_ATTEMPTS },
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { applicationId: true },
  });
  return Promise.allSettled(
    jobs.map((job) => deliverRejectionEmailJob(job.applicationId)),
  );
}

