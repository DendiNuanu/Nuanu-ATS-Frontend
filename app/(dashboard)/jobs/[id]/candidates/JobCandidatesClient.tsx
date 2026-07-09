"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  StatusPill,
  Avatar,
  SearchInput,
  Pagination,
  useToast,
} from "@/components/ui";
import { CANDIDATE_STAGES, type Stage, type Candidate } from "@/lib/mock-data";
import { formatDateWita } from "@/lib/format-wita";
import { ArrowLeft, ChevronRight, Users, Sparkles, Loader2 } from "lucide-react";

// Stage filter chips — mirrors the global /candidates list (minus "Blacklisted"
// which is a cross-vacancy concept not applicable to a single job's applicants).
const stageFilters: (Stage | "All")[] = ["All", ...CANDIDATE_STAGES];

export function JobCandidatesClient({
  vacancyId,
  vacancyTitle,
  initialCandidates,
  page,
  total,
  pageSize,
  search: initialSearch,
  stage: initialStage,
}: {
  vacancyId: string;
  vacancyTitle: string;
  initialCandidates: Candidate[];
  page: number;
  total: number;
  pageSize: number;
  search: string;
  stage: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [search, setSearch] = useState(initialSearch);
  const [stage, setStage] = useState<Stage | "All">(
    (initialStage as Stage | "All") || "All",
  );
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [isFiltering, setIsFiltering] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoringProgress, setScoringProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  /**
   * Runs AI Match scoring for all candidates currently visible in this job's
   * candidate list. Iterates sequentially (to avoid overwhelming the Groq API)
   * and updates the local state with each candidate's new score as it completes.
   */
  const handleSyncAIScores = async () => {
    if (scoring || candidates.length === 0) return;
    setScoring(true);
    setScoringProgress({ done: 0, total: candidates.length });
    let done = 0;
    let successCount = 0;
    let failCount = 0;
    for (const c of candidates) {
      try {
        const res = await fetch("/api/ai-scoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId: c.id }),
        });
        if (res.ok) {
          const data = await res.json();
          const scores = data.scores;
          if (scores) {
            setCandidates((prev) =>
              prev.map((p) =>
                p.id === c.id
                  ? { ...p, aiMatch: Math.round(scores.overallScore) }
                  : p,
              ),
            );
          }
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
      done++;
      setScoringProgress({ done, total: candidates.length });
    }
    setScoring(false);
    if (failCount === 0) {
      showToast(`AI scoring completed for ${successCount} candidates`, "success");
    } else {
      showToast(
        `Scored ${successCount} candidates, ${failCount} failed`,
        "error",
      );
    }
    router.refresh();
  };

  const basePath = `/jobs/${vacancyId}/candidates`;

  // Sync local state when server-rendered props change (e.g. after router.push
  // triggers a server re-render with new filtered data).
  useEffect(() => {
    setCandidates(initialCandidates);
    setIsFiltering(false);
  }, [initialCandidates]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setStage((initialStage as Stage | "All") || "All");
  }, [initialStage]);

  // Debounced search: update URL when search changes (with a small delay).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>( null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setIsFiltering(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("search", value);
      } else {
        params.delete("search");
      }
      params.set("page", "1");
      router.push(`${basePath}?${params.toString()}`);
    }, 400);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleStageChangeFilter = (newStage: Stage | "All") => {
    setStage(newStage);
    setIsFiltering(true);
    const params = new URLSearchParams(searchParams.toString());
    if (newStage === "All") {
      params.delete("stage");
    } else {
      params.set("stage", newStage);
    }
    params.set("page", "1");
    router.push(`${basePath}?${params.toString()}`);
  };

  // Query params to preserve when paginating
  const queryParams: Record<string, string | undefined> = {
    search: search || undefined,
    stage: stage !== "All" ? stage : undefined,
  };

  const filtered = useMemo(() => candidates, [candidates]);

  return (
    <div className="space-y-6">
      {/* Sticky Header with breadcrumb */}
      <div className="sticky top-16 z-10 -mx-6 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="font-medium text-slate-500 transition hover:text-[#006b5f]"
          >
            Dashboard
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <Link
            href="/jobs"
            className="font-medium text-slate-500 transition hover:text-[#006b5f]"
          >
            Jobs & Vacancies
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <Link
            href={`/jobs/${vacancyId}`}
            className="font-medium text-slate-500 transition hover:text-[#006b5f]"
          >
            {vacancyTitle}
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <span className="font-semibold text-slate-900">Candidates</span>
        </div>
        <Link
          href={`/jobs/${vacancyId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-[#006b5f]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {vacancyTitle}
        </Link>
      </div>

      {/* Title + count + AI scoring */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            {vacancyTitle}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f5f3] px-3 py-1 text-sm font-semibold text-[#006b5f]">
            <Users className="h-4 w-4" />
            {total.toLocaleString()} Candidates
          </span>
        </div>
        <button
          onClick={handleSyncAIScores}
          disabled={scoring || candidates.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#006b5f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#005449] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scoring ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {scoring
            ? `Scoring ${scoringProgress.done}/${scoringProgress.total}...`
            : "Sync AI Match Scores"}
        </button>
      </div>

      {/* Search + stage filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchInput
          placeholder="Search by name or email..."
          value={search}
          onChange={handleSearchChange}
          className="sm:max-w-md"
        />
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {stageFilters.map((s) => (
            <button
              key={s}
              onClick={() => handleStageChangeFilter(s)}
              className={`h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                stage === s
                  ? "bg-[#006b5f] text-white"
                  : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3 text-left font-medium">Candidate</th>
                <th className="px-6 py-3 text-left font-medium">Stage</th>
                <th className="px-6 py-3 text-left font-medium">AI Match</th>
                <th className="px-6 py-3 text-left font-medium">Applied</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} color={c.avatarColor} size="md" />
                      <div className="min-w-0">
                        <Link
                          href={`/candidates/${c.id}`}
                          className="font-medium text-slate-900 hover:text-[#006b5f]"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-slate-400 truncate">
                          {c.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill status={c.stage} isBlacklisted={c.isBlacklisted} rejectionType={c.rejectionType} />
                  </td>
                  <td className="px-6 py-4">
                    {c.aiMatch > 0 ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.aiMatch >= 75
                            ? "bg-green-50 text-green-700"
                            : c.aiMatch >= 50
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.aiMatch}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {formatDateWita(c.appliedDate)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/candidates/${c.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#006b5f] hover:text-[#005449]"
                    >
                      View
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            {isFiltering ? (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <svg
                  className="animate-spin h-4 w-4 text-slate-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading candidates...
              </div>
            ) : search ? (
              <p className="text-sm text-slate-500">
                No candidates found for &lsquo;{search}&rsquo;
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <Users className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">
                  No candidates match your filters.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          basePath={basePath}
          queryParams={queryParams}
        />
      </Card>
    </div>
  );
}
