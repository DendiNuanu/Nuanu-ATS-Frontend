"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Button, useToast } from "@/components/ui";
import {
  Mic,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { formatDateWita } from "@/lib/format-wita";

type TranscriptLine = {
  speaker: string;
  text: string;
  timestamp: number;
};

type TranscriptSession = {
  id: string;
  sessionId: string;
  status: "in_progress" | "completed";
  aiSummary: string | null;
  aiProvider: string | null;
  aiError: string | null;
  lines: TranscriptLine[];
  createdAt: string;
  completedAt: string | null;
  createdBy: { name: string; email: string };
};

/**
 * "AI Interview Transcript" section for the Interview Results tab.
 *
 * Shows one card per transcription session (a session = one Meet call
 * captured by the Nuanu Interview Transcriber extension). The AI summary
 * is displayed prominently; the raw transcript is collapsed by default
 * because interviews can run long.
 *
 * Live status: sessions with status "in_progress" show a pulsing red
 * indicator — the extension is actively streaming captions. The list
 * auto-refreshes every 15s while any session is in progress (and once
 * more 30s after the last in-progress session disappears, to catch the
 * AI summary that is generated right after completion).
 */
export function InterviewTranscriptSection({ candidateId }: { candidateId: string }) {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<TranscriptSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(
          `/api/interview-transcripts?candidateId=${encodeURIComponent(candidateId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("Failed to load transcripts");
        const data = await res.json();
        setSessions(data.transcripts ?? []);
      } catch {
        if (!silent) showToast("Failed to load interview transcripts", "error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [candidateId, showToast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh while a session is streaming, plus one final catch-up
  // poll shortly after completion so the AI summary appears without a
  // manual reload.
  const hasInProgress = sessions.some((s) => s.status === "in_progress");
  useEffect(() => {
    if (!hasInProgress) return;
    const interval = setInterval(() => void load(true), 15000);
    return () => clearInterval(interval);
  }, [hasInProgress, load]);

  useEffect(() => {
    if (sessions.length === 0 || hasInProgress) return;
    // One delayed refresh after the last in-progress session completes.
    const timeout = setTimeout(() => void load(true), 30000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInProgress]);

  const handleRetrySummary = async (sessionId: string) => {
    setRetryingId(sessionId);
    try {
      const res = await fetch("/api/interview-transcripts/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retrySummary: true, transcriptId: sessionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Retry failed");
      }
      showToast("Summary regenerated", "success");
      void load(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Retry failed", "error");
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return (
      <Card title="AI Interview Transcript">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading transcripts…
        </div>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card
        title="AI Interview Transcript"
        subtitle="Live transcripts captured by the Nuanu Interview Transcriber Chrome extension during Google Meet calls."
      >
        <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            No transcripts yet. Install the Nuanu Interview Transcriber Chrome
            extension, log in with your ATS account, select this candidate, and
            start transcribing during a Google Meet interview. A summary will
            appear here automatically after the call ends.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session, index) => {
        const isInProgress = session.status === "in_progress";
        const lineCount = Array.isArray(session.lines) ? session.lines.length : 0;
        const isOpen = expanded[session.id] ?? false;
        return (
          <Card
            key={session.id}
            title={
              sessions.length > 1
                ? `AI Interview Transcript — Session ${sessions.length - index}`
                : "AI Interview Transcript"
            }
            subtitle={`${formatDateWita(session.createdAt)} · ${lineCount} lines · by ${session.createdBy?.name ?? "Unknown"}`}
          >
            {/* Status row */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {isInProgress ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  Transcribing live…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f5f3] px-2.5 py-1 text-xs font-medium text-[#006b5f]">
                  <Mic className="h-3 w-3" />
                  Completed
                </span>
              )}
              {session.aiProvider && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  Summary via {session.aiProvider}
                </span>
              )}
              <button
                type="button"
                onClick={() => void load(true)}
                className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>

            {/* AI summary */}
            {session.aiSummary ? (
              <div className="rounded-lg border border-[#006b5f]/20 bg-[#e6f5f3]/40 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#006b5f]">
                  AI Summary
                </p>
                <div className="space-y-1.5 text-sm leading-relaxed text-slate-700">
                  {session.aiSummary.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    if (trimmed.startsWith("## ")) {
                      return (
                        <p
                          key={i}
                          className="pt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {trimmed.replace("## ", "")}
                        </p>
                      );
                    }
                    if (trimmed.startsWith("- ")) {
                      return (
                        <p key={i} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                          <span>{trimmed.replace("- ", "")}</span>
                        </p>
                      );
                    }
                    return <p key={i}>{trimmed}</p>;
                  })}
                </div>
              </div>
            ) : isInProgress ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                The AI summary will be generated automatically when the session
                is marked complete (Stop button or call end).
              </div>
            ) : session.aiError ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{session.aiError}</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={
                    retryingId === session.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )
                  }
                  onClick={() => void handleRetrySummary(session.id)}
                  disabled={retryingId === session.id}
                >
                  Retry summary
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                Generating AI summary…
              </div>
            )}

            {/* Raw transcript (collapsed by default) */}
            {lineCount > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((cur) => ({ ...cur, [session.id]: !isOpen }))
                  }
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {isOpen ? "Hide" : "Show"} full transcript ({lineCount} lines)
                </button>
                {isOpen && (
                  <div className="mt-2 max-h-96 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                    {session.lines.map((line, i) => {
                      const totalSeconds = Math.floor(line.timestamp / 1000);
                      const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
                      const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
                      const ss = String(totalSeconds % 60).padStart(2, "0");
                      return (
                        <div key={i} className="text-sm leading-relaxed">
                          <span className="font-medium text-slate-900">
                            {line.speaker}
                          </span>{" "}
                          <span className="text-xs text-slate-400">
                            {hh}:{mm}:{ss}
                          </span>
                          <p className="text-slate-600">{line.text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
