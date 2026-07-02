import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Button } from "./Button";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className,
      )}
    >
      <div className="h-16 w-16 rounded-full bg-[#e6f5f3] flex items-center justify-center mb-5">
        <Icon className="h-8 w-8 text-[#006b5f]" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 font-heading mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      )}
      {ctaLabel && (
        <Button icon={<Icon className="h-4 w-4" />} onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
