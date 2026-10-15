"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type { Candidate } from "@/lib/mock-data";
import { formatDateWita } from "@/lib/format-wita";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  MailCheck,
  UserPlus,
  FileText,
  Ban,
  CheckCircle2,
  Clock,
  Sparkles,
  CalendarDays,
  Check,
  X,
} from "lucide-react";

type ActivityEntry = {
  id: string;
  applicationId?: string;
  position?: string;
  eventType: string;
  eventKey: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  timestamp: string;
  sourceAt: string | null;
  displayAt: string | null;
  editable: boolean;
};

type Props = {
  candidate: Candidate;
};

function toDateTimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getOverrideMap(candidate: Candidate) {
  return new Map(
    (candidate.timelineEventOverrides ?? []).map((entry) => [
      `${entry.eventType}:${entry.eventKey}`,
      entry.displayAt,
    ]),
  );
}

function formatOptionalDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatDateWita(value);
}

export function ActivityTimelineTab({ candidate }: Props) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const overrideMap = getOverrideMap(candidate);
  const role = user.role.toLowerCase();
  const canEditTimeline = role.includes("admin") || role.includes("staff");

  const entries: ActivityEntry[] = [];
  const baseApplicationReceived = candidate.appliedDate ?? null;
  const baseResumeParsed = candidate.resumeParsedAt ?? candidate.appliedDate ?? null;
  const baseAiMatch = candidate.aiMatchScoredAt ?? candidate.appliedDate ?? null;
  const baseBlacklist = candidate.blacklistedAt ?? null;

  entries.push({
    id: "application_received",
    eventType: "application_received",
    eventKey: "application_received",
    icon: <UserPlus className="h-4 w-4" />,
    iconBg: "bg-[#e6f5f3]",
    iconColor: "text-[#006b5f]",
    title: "Application Received",
    description: `Applied via ${candidate.source} for ${candidate.position}`,
    timestamp: formatOptionalDate(
      overrideMap.get("application_received:application_received") ?? baseApplicationReceived,
    ),
    sourceAt: baseApplicationReceived,
    displayAt: overrideMap.get("application_received:application_received") ?? baseApplicationReceived,
    editable: true,
  });

  entries.push({
    id: "resume_parsed",
    eventType: "resume_parsed",
    eventKey: "resume_parsed",
    icon: <FileText className="h-4 w-4" />,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    title: "Resume Parsed",
    description: "Candidate profile created from uploaded resume",
    timestamp: formatOptionalDate(
      overrideMap.get("resume_parsed:resume_parsed") ?? baseResumeParsed,
    ),
    sourceAt: baseResumeParsed,
    displayAt: overrideMap.get("resume_parsed:resume_parsed") ?? baseResumeParsed,
    editable: true,
  });

  entries.push({
    id: "ai_match",
    eventType: "ai_match",
    eventKey: "ai_match",
    icon: <Sparkles className="h-4 w-4" />,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    title: "AI Match Analysis Completed",
    description: `AI match score: ${candidate.aiMatch}%`,
    timestamp: formatOptionalDate(
      overrideMap.get("ai_match:ai_match") ?? baseAiMatch,
    ),
    sourceAt: baseAiMatch,
    displayAt: overrideMap.get("ai_match:ai_match") ?? baseAiMatch,
    editable: true,
  });

  (candidate.stageHistory ?? []).forEach((transition) => {
    const key = `pipeline_stage:${transition.id}`;
    entries.push({
      id: key,
      eventType: "pipeline_stage",
      eventKey: transition.id,
      icon: <CheckCircle2 className="h-4 w-4" />,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      title: `Moved to ${transition.stage}`,
      description: `Candidate stage updated to ${transition.stage}`,
      timestamp: formatOptionalDate(overrideMap.get(key) ?? transition.enteredAt),
      sourceAt: transition.enteredAt,
      displayAt: overrideMap.get(key) ?? transition.enteredAt,
      editable: true,
    });
  });

  if (candidate.rejectionEmailSent) {
    const rejectionEmailTimestamp = (() => {
      const value = candidate.rejectionEmailSentAt;
      if (!value) return null;

      const direct = new Date(value);

      if (!Number.isNaN(direct.getTime())) {
        return direct.toISOString();
      }

      const match = value.match(
        /^(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2}):(\d{2})$/,
      );

      if (!match) return null;

      const [, day, month, year, hour, minute] = match;

      const legacy = new Date(
        `${year}-${month}-${day}T${hour}:${minute}:00+08:00`,
      );

      return Number.isNaN(legacy.getTime())
        ? null
        : legacy.toISOString();
    })();

    entries.push({
      id: "rejection-email",
      eventType: "rejection_email",
      eventKey: "rejection_email",
      icon: <MailCheck className="h-4 w-4" />,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
      title: "Rejection Email Sent",
      description: `Automated rejection email sent to ${candidate.name}${
        candidate.rejectionEmailSentAt ? ` · ${candidate.rejectionEmailSentAt}` : ""
      }`,
      timestamp: candidate.rejectionEmailSentAt ?? "—",
      sourceAt: rejectionEmailTimestamp,
      displayAt: rejectionEmailTimestamp,
      editable: false,
    });
  }

  if (candidate.isBlacklisted) {
    const key = "blacklist:blacklist";
    entries.push({
      id: key,
      eventType: "blacklist",
      eventKey: "blacklist",
      icon: <Ban className="h-4 w-4" />,
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
      title: "Added to Blacklist",
      description: candidate.blacklistReason
        ? `Reason: ${candidate.blacklistReason}`
        : "Candidate added to blacklist",
      timestamp: formatOptionalDate(overrideMap.get(key) ?? baseBlacklist),
      sourceAt: baseBlacklist,
      displayAt: overrideMap.get(key) ?? baseBlacklist,
      editable: true,
    });
  }

  const handleSave = async (
    entry: ActivityEntry,
    displayAtValue = draftValue,
  ) => {
    if (!entry.editable) return;
    setSavingId(entry.id);
    try {
      const body = {
        eventType: entry.eventType,
        eventKey: entry.eventKey,
        displayAt: displayAtValue
          ? new Date(displayAtValue).toISOString()
          : null,
        authorEmail: user.email,
      };
      const response = await fetch(
        `/api/candidates/${entry.applicationId ?? candidate.id}/timeline-events`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to update timeline date");
      }
      setEditingId(null);
      setDraftValue("");
      setSaveError(null);
      router.refresh();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to update timeline date",
      );
    } finally {
      setSavingId(null);
    }
  };

  const timelineEntries: ActivityEntry[] = candidate.timelineEntries
    ? candidate.timelineEntries.map((entry) => {
        const isInterviewEvent =
          entry.eventType === "interview_result" ||
          entry.eventType === "interview_comment";
        const isBlacklist = entry.eventType === "blacklist";
        const isRejectionEmail = entry.eventType === "rejection_email";
        const isStage = entry.eventType === "pipeline_stage";
        const isResume = entry.eventType === "resume_parsed";
        const isAiMatch = entry.eventType === "ai_match";
        return {
          ...entry,
          icon: isBlacklist ? (
            <Ban className="h-4 w-4" />
          ) : isRejectionEmail ? (
            <MailCheck className="h-4 w-4" />
          ) : isInterviewEvent ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isStage ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isResume ? (
            <FileText className="h-4 w-4" />
          ) : isAiMatch ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          ),
          iconBg: isBlacklist
            ? "bg-red-50"
            : isRejectionEmail
              ? "bg-rose-50"
            : isInterviewEvent || isStage
              ? "bg-emerald-50"
              : isResume
                ? "bg-blue-50"
                : isAiMatch
                  ? "bg-purple-50"
                  : "bg-[#e6f5f3]",
          iconColor: isBlacklist
            ? "text-red-600"
            : isRejectionEmail
              ? "text-rose-600"
            : isInterviewEvent || isStage
              ? "text-emerald-600"
              : isResume
                ? "text-blue-600"
                : isAiMatch
                  ? "text-purple-600"
                  : "text-[#006b5f]",
          timestamp: formatOptionalDate(entry.displayAt ?? entry.sourceAt),
        };
      })
    : entries.map((entry) => ({
        ...entry,
        applicationId: candidate.id,
      }));

  const sortEntries = [...timelineEntries].sort((a, b) => {
    const aTime = new Date(a.displayAt ?? a.sourceAt ?? 0).getTime();
    const bTime = new Date(b.displayAt ?? b.sourceAt ?? 0).getTime();
    return aTime - bTime || new Date(a.sourceAt ?? 0).getTime() - new Date(b.sourceAt ?? 0).getTime();
  });

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-base font-bold text-slate-900 font-heading mb-1">
          Activity Timeline
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          A chronological record of key events for this candidate.
        </p>
        {saveError && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </p>
        )}

        <div className="relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />

          <ol className="space-y-6">
            {sortEntries.map((entry) => (
              <li key={entry.id} className="relative flex gap-4">
                <div
                  className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ring-4 ring-white ${entry.iconBg} ${entry.iconColor}`}
                >
                  {entry.icon}
                </div>

                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.title}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {entry.description}
                      </p>
                      {entry.position && (
                        <p className="mt-1 text-xs font-medium text-slate-400">
                          Position: {entry.position}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {entry.timestamp}
                      </span>
                      {entry.displayAt && entry.sourceAt && (
                      <span
                        title={`Original date: ${formatOptionalDate(entry.sourceAt)}`}
                        className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                      >
                        manually changed
                      </span>
                      )}
                      {entry.editable && canEditTimeline && (
                        <button
                          type="button"
                          aria-label={`Edit ${entry.title} date`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                          onClick={() => {
                            setEditingId(entry.id);
                            setDraftValue(toDateTimeLocalValue(entry.displayAt ?? entry.sourceAt));
                            setSaveError(null);
                          }}
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {editingId === entry.id && entry.editable && canEditTimeline && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={draftValue}
                        onChange={(event) => setDraftValue(event.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm outline-none focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/15"
                      />
                      <button
                        type="button"
                        onClick={() => handleSave(entry)}
                        disabled={savingId === entry.id}
                        className="inline-flex items-center gap-1 rounded-md bg-[#006b5f] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {savingId === entry.id ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setDraftValue("");
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                      {(candidate.timelineEntries
                        ? Boolean(entry.displayAt)
                        : Boolean(
                            overrideMap.get(
                              `${entry.eventType}:${entry.eventKey}`,
                            ),
                          )) && (
                        <button
                          type="button"
                          onClick={() => {
                            void handleSave(entry, "");
                          }}
                          disabled={savingId === entry.id}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}
