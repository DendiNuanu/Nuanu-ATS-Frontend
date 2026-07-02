import { cn } from "@/lib/utils";
import type { Stage } from "@/lib/mock-data";

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
  className?: string;
};

export function StatusPill({ status, className }: StatusPillProps) {
  const style =
    stageStyles[status as Stage] ?? genericStyles[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap",
        style,
        className,
      )}
    >
      {status}
    </span>
  );
}
