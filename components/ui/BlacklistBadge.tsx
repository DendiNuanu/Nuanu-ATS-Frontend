import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";

type BlacklistBadgeProps = {
  className?: string;
};

/**
 * Small red/rose "Blacklisted" badge shown next to a candidate's name
 * (table rows, profile header, pipeline cards) whenever isBlacklisted is true.
 * Independent from the Stage system — purely a flag layered on top.
 */
export function BlacklistBadge({ className }: BlacklistBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 whitespace-nowrap",
        className,
      )}
    >
      <Ban className="h-3 w-3" />
      Blacklisted
    </span>
  );
}
