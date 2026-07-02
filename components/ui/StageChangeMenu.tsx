"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CANDIDATE_STAGES, STAGE_DOT_COLORS, type Stage } from "@/lib/mock-data";

type ExtraAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

type StageChangeMenuProps = {
  currentStage: Stage;
  onStageChange: (stage: Stage) => void;
  candidateId: string;
  extraActions?: ExtraAction[];
  align?: "left" | "right";
};

export function StageChangeMenu({
  currentStage,
  onStageChange,
  extraActions = [],
  align = "right",
}: StageChangeMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label="Change stage"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-md max-h-[60vh] overflow-y-auto scrollbar-thin ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="menu"
        >
          {/* Stage list */}
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Move to stage
          </p>
          {CANDIDATE_STAGES.map((stage) => {
            const isActive = stage === currentStage;
            return (
              <button
                key={stage}
                type="button"
                role="menuitem"
                onClick={() => {
                  onStageChange(stage);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                  isActive
                    ? "bg-[#e6f5f3] font-medium text-[#006b5f]"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${STAGE_DOT_COLORS[stage]}`} />
                <span className="flex-1">{stage}</span>
                {isActive && <Check className="h-4 w-4 text-[#006b5f]" />}
              </button>
            );
          })}

          {/* Divider + extra actions */}
          {extraActions.length > 0 && (
            <>
              <div className="my-1 border-t border-slate-100" />
              {extraActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      action.onClick();
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                  >
                    <Icon className="h-4 w-4 text-slate-400" />
                    {action.label}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
