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
        "inline-flex min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600",
        className,
      )}
      title={`Email Sent (${type})`}
    >
      <MailCheck className="h-3 w-3 shrink-0" />
      <span className="min-w-0 truncate">Email Sent ({type})</span>
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
  const label = `Email sent (${type}) · ${timestamp}`;
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-semibold text-white"
      title={label}
      aria-label={label}
    >
      <Check className="h-3 w-3 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
