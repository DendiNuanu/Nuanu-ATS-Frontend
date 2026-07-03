"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card, Button, Avatar, StatusPill, RadialGauge } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import type { AIScoringCandidate } from "@/lib/data-access";
import { ScanLine, Sparkles, ChevronDown, Loader2 } from "lucide-react";

export function AIScoringClient({
  candidates,
  vacancyOptions,
}: {
  candidates: AIScoringCandidate[];
  vacancyOptions: string[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [vacancy, setVacancy] = useState(vacancyOptions[0] ?? "All Vacancies");
  const [scanning, setScanning] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [shortlistingId, setShortlistingId] = useState<string | null>(null);

  const handleScanAll = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/ai-scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanAll: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to scan resumes");
      }
      const data = await res.json();
      const successCount = data.results?.filter((r: { success: boolean }) => r.success).length ?? 0;
      const failCount = (data.scanned ?? 0) - successCount;
      if (successCount > 0) {
        showToast(
          `Scanned ${successCount} candidate${successCount !== 1 ? "s" : ""} successfully${
            failCount > 0 ? ` (${failCount} failed)` : ""
          }`,
          "success",
        );
      } else {
        showToast("No unscored candidates found to scan", "info");
      }
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to scan resumes",
        "error",
      );
    } finally {
      setScanning(false);
    }
  };

  const handleFullAnalysis = async (candidateId: string) => {
    setScoringId(candidateId);
    try {
      const res = await fetch("/api/ai-scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: candidateId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to analyse candidate");
      }
      showToast("AI analysis completed — scores updated", "success");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to analyse candidate",
        "error",
      );
    } finally {
      setScoringId(null);
    }
  };

  const handleShortlist = async (candidateId: string) => {
    setShortlistingId(candidateId);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to shortlist candidate");
      }
      showToast("Candidate shortlisted", "success");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to shortlist candidate",
        "error",
      );
    } finally {
      setShortlistingId(null);
    }
  };

  const filtered =
    vacancy === "All Vacancies" || vacancy === "All"
      ? candidates
      : candidates.filter((c) => c.position === vacancy);

  return (
    <div>
      <PageHeader
        title="AI Scoring"
        subtitle="Automated resume analysis and candidate ranking."
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f5f3] px-3 py-1.5 text-xs font-semibold text-[#006b5f]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#006b5f] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#006b5f]" />
              </span>
              Intelligence Engine Active
            </span>
            <Button
              variant="primary"
              icon={scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              onClick={handleScanAll}
              disabled={scanning}
            >
              {scanning ? "Scanning..." : "Scan New Resumes"}
            </Button>
          </>
        }
      />

      {/* Vacancy filter */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Vacancy</label>
        <div className="relative sm:max-w-xs">
          <select
            value={vacancy}
            onChange={(e) => setVacancy(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none appearance-none"
          >
            {vacancyOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Candidate cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <ScanLine className="h-10 w-10 text-slate-300 mb-3" />
            <h3 className="font-heading text-lg font-semibold text-slate-900">
              No scored candidates yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Run an AI scan to generate match scores for candidates.
            </p>
          </Card>
        ) : (
          filtered.map((c) => (
            <Card key={c.id} className="!p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                {/* Radial gauge */}
                <div className="flex-shrink-0 flex justify-center">
                  <RadialGauge value={c.aiMatch} size={96} />
                </div>

                {/* Candidate info */}
                <div className="flex-1 flex items-center gap-4 min-w-0">
                  <Avatar name={c.name} size="lg" color={c.avatarColor} />
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-slate-900 font-heading truncate">
                      {c.name}
                    </p>
                    <p className="text-sm text-slate-500 truncate">{c.position}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.department}</p>
                    <div className="mt-2">
                      <StatusPill status={c.stage} />
                    </div>
                  </div>
                </div>

                {/* Match breakdown */}
                <div className="hidden lg:block flex-shrink-0 w-56 space-y-2">
                  {[
                    { label: "Skills", value: c.hardSkillsScore },
                    { label: "Experience", value: c.experienceScore },
                    { label: "Education", value: c.educationScore },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">{s.label}</span>
                        <span className="text-xs font-semibold text-slate-600">{s.value}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#006b5f]"
                          style={{ width: `${s.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col items-stretch gap-2 flex-shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={shortlistingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    onClick={() => handleShortlist(c.id)}
                    disabled={shortlistingId === c.id}
                  >
                    {shortlistingId === c.id ? "..." : "Shortlist"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleFullAnalysis(c.id)}
                    disabled={scoringId === c.id}
                  >
                    {scoringId === c.id ? "Analysing..." : "Full Analysis"}
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
