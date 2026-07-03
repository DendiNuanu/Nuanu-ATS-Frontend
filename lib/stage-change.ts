import type { Candidate, Stage } from "@/lib/mock-data";
import { EMAIL_TEMPLATES, fillTemplate } from "@/lib/email-templates";
import { formatDateTimeWita } from "@/lib/format-wita";

/**
 * Result of a stage-change persistence operation.
 * - `success` — whether the stage was persisted to the DB.
 * - `emailSent` — whether a rejection email was actually sent (only when
 *   moving to "Rejected" and no prior rejection email existed).
 * - `timestamp` — formatted timestamp string for the email badge (when sent).
 * - `error` — error message if any step failed.
 */
export type StageChangeResult = {
  success: boolean;
  emailSent: boolean;
  timestamp?: string;
  error?: string;
};

/**
 * Formats a Date as "DD/MM/YYYY · HH:MM" in WITA — matching the format used by
 * the server-side `formatEmailTimestamp()` in data-access.ts so the optimistic
 * client-side badge matches what the server renders after refresh.
 */
function formatEmailTimestamp(date: Date): string {
  return formatDateTimeWita(date);
}

/**
 * Persists a stage change to the database via PATCH /api/candidates/[id],
 * and — when the new stage is "Rejected" and no rejection email has been
 * sent yet — sends the rejection email via POST /api/send-email.
 *
 * This replaces the old client-only `handleStageChange` that only updated
 * React `useState` without persisting to the DB or actually sending an
 * email. The old code caused email-sent badges to disappear on page refresh
 * because `Application.emailSentAt` / `emailSentSubject` were never written.
 *
 * The caller should:
 *  1. Optimistically update the stage in local state for responsiveness.
 *  2. Call this function.
 *  3. On `success === false`, revert the stage and show the error.
 *  4. On `emailSent === true`, update local state with the email badge data.
 *  5. On `success === true && emailSent === false && error`, the stage was
 *     saved but the email failed — show a warning.
 */
export async function persistStageChange(
  candidate: Candidate,
  newStage: Stage,
): Promise<StageChangeResult> {
  // 1. Persist the stage change to the database.
  try {
    const res = await fetch(`/api/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        emailSent: false,
        error: data.error ?? "Failed to update stage",
      };
    }
  } catch {
    return {
      success: false,
      emailSent: false,
      error: "Network error — could not reach the server to update stage",
    };
  }

  // 2. If moving to "Rejected" and no rejection email has been sent yet,
  //    send the rejection email template via the SMTP API. The API endpoint
  //    calls recordEmailSent() which persists emailSentAt / emailSentSubject
  //    to the Application row — this is what makes the badge survive refresh.
  if (newStage === "Rejected" && !candidate.rejectionEmailSent) {
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === "rejected");
    if (tpl) {
      try {
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: candidate.email,
            subject: tpl.subject,
            body: fillTemplate(tpl.body, candidate.name),
            candidateId: candidate.id,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return {
            success: true,
            emailSent: false,
            error: data.error ?? "Failed to send rejection email",
          };
        }

        // Email sent + persisted to DB by recordEmailSent().
        return {
          success: true,
          emailSent: true,
          timestamp: formatEmailTimestamp(new Date()),
        };
      } catch {
        return {
          success: true,
          emailSent: false,
          error: "Network error — could not reach the server to send email",
        };
      }
    }
  }

  return { success: true, emailSent: false };
}
