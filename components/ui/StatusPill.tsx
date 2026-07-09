import { cn } from "@/lib/utils";
import type { Stage, RejectionType } from "@/lib/mock-data";
import { REJECTION_TYPE_LABELS } from "@/lib/mock-data";

const stageStyles: Record<Stage, string> = {
  "New": "bg-blue-100 text-blue-700",
  "Talent Bank": "bg-slate-100 text-slate-600",
  "Screening": "bg-purple-100 text-purple-700",
  "HR Interview": "bg-amber-100 text-amber-700",
  "User Interview": "bg-orange-100 text-orange-700",
  "Assessment": "bg-indigo-100 text-indigo-700",
  "User Interview II": "bg-cyan-100 text-cyan-700",
  "Offering": "bg-teal-100 text-teal-800",
  "Hired": "bg-green-100 text-green-700",
  "Rejected": "bg-red-100 text-red-700",
  "Onboarding": "bg-emerald-100 text-emerald-700",
};

// Distinct colors for each rejection sub-type so they are visually
// distinguishable on the Candidates list while staying within the same
// rounded-pill style as the other stage badges.
// - declined_by_hr        → red    (HR decided not to proceed — default)
// - declined_by_user      → orange (hiring team chose other candidates)
// - declined_by_candidate → rose   (candidate was unresponsive / no-show)
const rejectionTypeStyles: Record<RejectionType, string> = {
  declined_by_hr: "bg-red-100 text-red-700",
  declined_by_user: "bg-orange-100 text-orange-700",
  declined_by_candidate: "bg-rose-100 text-rose-700",
};

// Generic status pill that also accepts arbitrary status strings
// (e.g. job status, offer status, employee status) with sensible defaults.
const genericStyles: Record<string, string> = {
  Open: "bg-green-100 text-green-700",
  "On Hold": "bg-amber-100 text-amber-700",
  Closed: "bg-slate-100 text-slate-600",
  Draft: "bg-slate-100 text-slate-600",
  Active: "bg-green-100 text-green-700",
  "On Leave": "bg-amber-100 text-amber-700",
  Probation: "bg-blue-100 text-blue-700",
  Resigned: "bg-red-100 text-red-700",
  Sent: "bg-blue-100 text-blue-700",
  Accepted: "bg-green-100 text-green-700",
  Expired: "bg-slate-100 text-slate-600",
  Pending: "bg-amber-100 text-amber-700",
  Completed: "bg-green-100 text-green-700",
};

type StatusPillProps = {
  status: string;
  /** When true, overrides the displayed status to "Blacklisted". */
  isBlacklisted?: boolean;
  /**
   * Sub-type of rejection. When the candidate's stage is "Rejected" and a
   * rejectionType is provided, the pill shows the distinct sub-type label
   * (e.g. "Declined by HR") instead of the generic "Rejected" text, with a
   * color that distinguishes each sub-type. Ignored for non-rejected stages
   * and when the candidate is blacklisted.
   */
  rejectionType?: RejectionType | null;
  className?: string;
};

export function StatusPill({ status, isBlacklisted, rejectionType, className }: StatusPillProps) {
  // Blacklisted candidates should always show "Blacklisted" regardless of
  // their underlying pipeline stage — the blacklist flag is the authoritative
  // status the user needs to see.
  const isRejected = status === "Rejected";
  const showRejectionSubType = !isBlacklisted && isRejected && rejectionType;

  const displayStatus = isBlacklisted
    ? "Blacklisted"
    : showRejectionSubType
      ? REJECTION_TYPE_LABELS[rejectionType as RejectionType]
      : status;

  const style = isBlacklisted
    ? "bg-red-100 text-red-700"
    : showRejectionSubType
      ? rejectionTypeStyles[rejectionType as RejectionType]
      : (stageStyles[status as Stage] ?? genericStyles[status] ?? "bg-slate-100 text-slate-600");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap",
        style,
        className,
      )}
    >
      {displayStatus}
    </span>
  );
}
