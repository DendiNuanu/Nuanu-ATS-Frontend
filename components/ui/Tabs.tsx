"use client";

import { cn } from "@/lib/utils";

export type Tab = { id: string; label: string };

type TabsProps = {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
};

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b border-slate-200 overflow-x-auto scrollbar-thin",
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
            active === tab.id
              ? "border-[#006b5f] text-[#006b5f]"
              : "border-transparent text-slate-500 hover:text-slate-700",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
