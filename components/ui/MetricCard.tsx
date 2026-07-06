import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: { value: string; direction: "up" | "down" };
  /**
   * Badge colour tone. "live" (default) renders the emerald "Live" badge used
   * by the existing dashboard cards. "pending" renders an amber badge for
   * metrics whose underlying data is not yet available (placeholder "—").
   */
  badgeTone?: "live" | "pending";
  /** Optional small subtext rendered below the label (e.g. "Hires ÷ Interviewed"). */
  hint?: string;
  className?: string;
  accent?: string;
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  badgeTone = "live",
  hint,
  className,
  accent = "text-[#006b5f] bg-[#e6f5f3]",
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center",
            accent,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
              badgeTone === "pending"
                ? "text-amber-700 bg-amber-50"
                : trend.direction === "up"
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-red-700 bg-red-50",
            )}
          >
            {badgeTone === "pending" ? (
              <Clock className="h-3.5 w-3.5" />
            ) : trend.direction === "up" ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 font-heading">
          {value}
        </div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mt-1">
          {label}
        </div>
        {hint && (
          <div className="text-[11px] text-slate-400 mt-1 normal-case tracking-normal">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
