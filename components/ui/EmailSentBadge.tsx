"use client";

import { MailCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Neutral slate/blue badge shown below the source tag in table rows.
 * Indicates a non-rejection email was sent to this candidate (e.g. "On Hold",
 * "Process Slow", "Not Open", "Been Fulfilled").
 *
 * This is distinct from RejectionEmailBadge (red, for the "Rejected" template).
 */
export function EmailSentBadge({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap",
        className,
      )}
    >
      <MailCheck className="h-3 w-3" />
      Email Sent ({type})
    </span>
  );
}

/**
 * Neutral slate/blue pill shown in the actions area of table rows.
 * Displays a checkmark, the email template type, and the timestamp.
 *
 * This is distinct from RejectionSentPill (green, for the "Rejected" template).
 */
export function EmailSentPill({
  type,
  timestamp,
}: {
  type: string;
  timestamp: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap">
      <Check className="h-3 w-3" />
      Email sent ({type}) · {timestamp}
    </span>
  );
}
