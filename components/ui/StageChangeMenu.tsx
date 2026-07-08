"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Check, Ban, Undo } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CANDIDATE_STAGES,
  STAGE_DOT_COLORS,
  REJECTION_TYPES,
  REJECTION_TYPE_LABELS,
  type Stage,
  type RejectionType,
} from "@/lib/mock-data";

type ExtraAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

type StageChangeMenuProps = {
  currentStage: Stage;
  /**
   * Called when the user selects a new stage. When the new stage is
   * "Rejected", `rejectionType` carries the chosen sub-type (defaults to
   * "declined_by_hr" when the caller doesn't supply one). For all other
   * stages `rejectionType` is undefined.
   */
  onStageChange: (stage: Stage, rejectionType?: RejectionType) => void;
  candidateId: string;
  /** Current rejection sub-type (only meaningful when currentStage is "Rejected"). */
  currentRejectionType?: RejectionType | null;
  extraActions?: ExtraAction[];
  align?: "left" | "right";
  /** Whether the candidate is currently blacklisted. */
  isBlacklisted?: boolean;
  /** Called when the user confirms blacklisting a candidate (with a reason). */
  onAddToBlacklist?: (reason: string) => void;
  /** Called when the user removes a candidate from the blacklist. */
  onRemoveFromBlacklist?: () => void;
};

export function StageChangeMenu({
  currentStage,
  onStageChange,
  currentRejectionType = null,
  extraActions = [],
  align = "right",
  isBlacklisted = false,
  onAddToBlacklist,
  onRemoveFromBlacklist,
}: StageChangeMenuProps) {
  const [open, setOpen] = useState(false);
  const [showBlacklistForm, setShowBlacklistForm] = useState(false);
  const [showRejectionSubtypes, setShowRejectionSubtypes] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setShowBlacklistForm(false);
        setShowRejectionSubtypes(false);
        setConfirmRemove(false);
        setReason("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Focus the textarea when the blacklist form opens
  useEffect(() => {
    if (showBlacklistForm && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showBlacklistForm]);

  const handleConfirmBlacklist = () => {
    onAddToBlacklist?.(reason.trim() || "No reason provided");
    setReason("");
    setShowBlacklistForm(false);
    setOpen(false);
  };

  const handleConfirmRemove = () => {
    onRemoveFromBlacklist?.();
    setConfirmRemove(false);
    setOpen(false);
  };

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
            const isRejected = stage === "Rejected";
            // "Rejected" expands a sub-list of rejection sub-types instead
            // of immediately firing onStageChange. The user picks a reason,
            // which then triggers the stage change + persists rejectionType.
            if (isRejected) {
              return (
                <div key={stage}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setShowRejectionSubtypes((v) => !v)}
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
                  {showRejectionSubtypes && (
                    <div className="bg-slate-50/60">
                      {REJECTION_TYPES.map((rt) => {
                        const isRtActive = isActive && currentRejectionType === rt;
                        return (
                          <button
                            key={rt}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onStageChange("Rejected", rt);
                              setShowRejectionSubtypes(false);
                              setOpen(false);
                            }}
                            className={`flex w-full items-center gap-2.5 py-2 pl-8 pr-3 text-sm transition-colors text-left ${
                              isRtActive
                                ? "font-medium text-[#006b5f]"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <span className="flex-1">{REJECTION_TYPE_LABELS[rt]}</span>
                            {isRtActive && <Check className="h-4 w-4 text-[#006b5f]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
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

          {/* Blacklist actions */}
          {(onAddToBlacklist || onRemoveFromBlacklist) && (
            <>
              <div className="my-1 border-t border-slate-100" />
              {!isBlacklisted && onAddToBlacklist && !showBlacklistForm && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setShowBlacklistForm(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  <Ban className="h-4 w-4 text-red-500" />
                  Add to blacklist
                </button>
              )}
              {isBlacklisted && onRemoveFromBlacklist && !confirmRemove && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setConfirmRemove(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <Undo className="h-4 w-4 text-slate-400" />
                  Remove from blacklist
                </button>
              )}
              {isBlacklisted && confirmRemove && (
                <div className="px-3 py-2">
                  <p className="text-xs text-slate-600 mb-2">Are you sure?</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmRemove}
                      className="flex-1 rounded-md bg-slate-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                    >
                      Yes, remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Inline blacklist reason form (popover within the dropdown) */}
          {showBlacklistForm && (
            <div className="border-t border-slate-100 px-3 py-3">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Reason for blacklisting
              </label>
              <textarea
                ref={textareaRef}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. No-show at 3 scheduled interviews"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none resize-none"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleConfirmBlacklist}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Confirm blacklist
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBlacklistForm(false);
                    setReason("");
                  }}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
