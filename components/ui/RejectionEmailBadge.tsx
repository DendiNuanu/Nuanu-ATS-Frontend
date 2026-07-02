"use client";

import { MailCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small rose/red uppercase badge shown below the source tag in table rows.
 * Indicates a rejection email was sent to this candidate.
 */
export function RejectionEmailBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600 whitespace-nowrap",
        className,
      )}
    >
      <MailCheck className="h-3 w-3" />
      Rejection Email Sent
    </span>
  );
}

/**
 * Solid green pill shown in the actions area of table rows.
 * Displays a checkmark and the timestamp the rejection email was sent.
 */
export function RejectionSentPill({ timestamp }: { timestamp: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap">
      <Check className="h-3 w-3" />
      Rejection sent · {timestamp}
    </span>
  );
}
