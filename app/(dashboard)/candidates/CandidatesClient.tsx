"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PageHeader,
  Card,
  StatusPill,
  Button,
  Avatar,
  SearchInput,
  StageChangeMenu,
  BlacklistBadge,
  RejectionEmailBadge,
  RejectionSentPill,
  EmailSentBadge,
  EmailSentPill,
  Pagination,
  useToast,
} from "@/components/ui";
import { CANDIDATE_STAGES, type Stage, type Candidate } from "@/lib/mock-data";
import { Upload, Download, Eye, Mail } from "lucide-react";

// "Blacklisted" is a separate filter layered on top of stages — NOT an 11th stage.
const stageFilters: (Stage | "All" | "Blacklisted")[] = [
  "All",
  ...CANDIDATE_STAGES,
  "Blacklisted",
];

export function CandidatesClient({
  initialCandidates,
  page,
  total,
  pageSize,
  search: initialSearch,
  stage: initialStage,
}: {
  initialCandidates: Candidate[];
  page: number;
  total: number;
  pageSize: number;
  search: string;
  stage: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [stage, setStage] = useState<Stage | "All" | "Blacklisted">(
    (initialStage as Stage | "All" | "Blacklisted") || "All",
  );
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [isFiltering, setIsFiltering] = useState(false);
  const { showToast } = useToast();

  // Sync local state when server-rendered props change (e.g. after router.push
  // triggers a server re-render with new filtered data). Without this, useState
  // keeps the stale initial value and the table never updates.
  useEffect(() => {
    setCandidates(initialCandidates);
    setIsFiltering(false);
  }, [initialCandidates]);

  // Sync search/stage from props so back/forward navigation restores state.
  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setStage((initialStage as Stage | "All" | "Blacklisted") || "All");
  }, [initialStage]);

  // Debounced search: update URL when search changes (with a small delay).
  // We keep the input responsive by updating local `search` immediately, but
  // only push the URL (triggering the server fetch) after the user stops typing.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      router.push(`/candidates?${params.toString()}`);
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

  const handleStageChangeFilter = (newStage: Stage | "All" | "Blacklisted") => {
    setStage(newStage);
    setIsFiltering(true);
    const params = new URLSearchParams(searchParams.toString());
    if (newStage === "All") {
      params.delete("stage");
    } else {
      params.set("stage", newStage);
    }
    params.set("page", "1");
    router.push(`/candidates?${params.toString()}`);
  };

  const handleStageChange = (candidateId: string, newStage: Stage) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id !== candidateId) return c;
        const updated: Candidate = { ...c, stage: newStage };
        // Auto-trigger rejection email when moved to Rejected (only if not already sent — audit trail persists)
        if (newStage === "Rejected" && !c.rejectionEmailSent) {
          const now = new Date();
          const dd = String(now.getDate()).padStart(2, "0");
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const yyyy = now.getFullYear();
          const hh = String(now.getHours()).padStart(2, "0");
          const min = String(now.getMinutes()).padStart(2, "0");
          const ts = `${dd}/${mm}/${yyyy} · ${hh}:${min}`;
          updated.rejectionEmailSent = true;
          updated.rejectionEmailSentAt = ts;
          updated.lastEmailSent = { type: "Rejected", sentAt: ts };
          showToast(`Rejection email sent to ${c.name}`);
        }
        return updated;
      }),
    );
  };

  const handleAddToBlacklist = (candidateId: string, reason: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? { ...c, isBlacklisted: true, blacklistReason: reason }
          : c,
      ),
    );
  };

  const handleRemoveFromBlacklist = (candidateId: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? { ...c, isBlacklisted: false, blacklistReason: null }
          : c,
      ),
    );
  };

  // Client-side filtering for "Blacklisted" (cross-stage filter) since the DB
  // query doesn't have a blacklist column — this is layered on top.
  const filtered = useMemo(() => {
    if (stage === "Blacklisted") {
      return candidates.filter((c) => c.isBlacklisted === true);
    }
    return candidates;
  }, [candidates, stage]);

  // Query params to preserve when paginating
  const queryParams: Record<string, string | undefined> = {
    search: search || undefined,
    stage: stage !== "All" ? stage : undefined,
  };

  // Export the currently-visible candidates to a CSV file.
  // Exports the `filtered` list (respects the active stage filter + search).
  const handleExportCSV = useCallback(() => {
    const rows = filtered;
    if (rows.length === 0) {
      showToast("No candidates to export", "info");
      return;
    }

    const headers = [
      "Name",
      "Email",
      "Applied For",
      "Stage",
      "AI Match (%)",
      "Applied Date",
    ];

    // Escape a CSV cell: wrap in quotes if it contains comma/quote/newline,
    // and double any embedded quotes.
    const escapeCell = (value: string): string => {
      const str = String(value ?? "");
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatDate = (iso: string): string => {
      try {
        return new Date(iso).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      } catch {
        return iso;
      }
    };

    const csvLines = [
      headers.map(escapeCell).join(","),
      ...rows.map((c) =>
        [
          c.name,
          c.email,
          c.position,
          c.stage,
          String(c.aiMatch),
          formatDate(c.appliedDate),
        ]
          .map(escapeCell)
          .join(","),
      ),
    ];
    const csv = csvLines.join("\n");

    // Trigger download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `candidates-export-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${rows.length} candidates to CSV`);
  }, [filtered, showToast]);

  return (
    <div>
      <PageHeader
        title="Candidates"
        subtitle="All applicants across your active vacancies."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => router.push("/candidates/upload")}
            >
              Upload CV
            </Button>
            <Button
              variant="primary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExportCSV}
            >
              Export Data
            </Button>
          </>
        }
      />

      {/* Search + stage filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SearchInput
          placeholder="Search by name, email, or position..."
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
                <th className="text-left font-medium px-6 py-3">Candidate</th>
                <th className="text-left font-medium px-6 py-3">Applied For</th>
                <th className="text-left font-medium px-6 py-3">Stage</th>
                <th className="text-left font-medium px-6 py-3">AI Match</th>
                <th className="text-left font-medium px-6 py-3">Applied Date</th>
                <th className="text-right font-medium px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size="md" color={c.avatarColor} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/candidates/${c.id}`}
                            className="font-medium text-slate-900 hover:text-[#006b5f]"
                          >
                            {c.name}
                          </Link>
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {c.source}
                          </span>
                          {c.isBlacklisted && <BlacklistBadge />}
                        </div>
                        <p className="text-xs text-slate-500">{c.email}</p>
                        {/* Badge logic: show rejection badge only when stage is "Rejected";
                            otherwise show generic "Email Sent" for any email sent */}
                        {c.rejectionEmailSent && c.stage === "Rejected" ? (
                          <div className="mt-1">
                            <RejectionEmailBadge />
                          </div>
                        ) : c.rejectionEmailSent || c.lastEmailSent ? (
                          <div className="mt-1">
                            <EmailSentBadge
                              type={c.lastEmailSent?.type ?? "Email"}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-700">{c.position}</p>
                    <p className="text-xs text-slate-400">{c.department}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill status={c.stage} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            c.aiMatch >= 85
                              ? "bg-emerald-500"
                              : c.aiMatch >= 70
                                ? "bg-[#006b5f]"
                                : "bg-amber-500"
                          }`}
                          style={{ width: `${c.aiMatch}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        {c.aiMatch}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(c.appliedDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {/* Pill logic: rejection pill only when stage is "Rejected";
                          otherwise generic "Email Sent" pill for any email sent */}
                      {c.rejectionEmailSent && c.rejectionEmailSentAt && c.stage === "Rejected" ? (
                        <RejectionSentPill timestamp={c.rejectionEmailSentAt} />
                      ) : c.rejectionEmailSent && c.rejectionEmailSentAt ? (
                        <EmailSentPill
                          type="Email"
                          timestamp={c.rejectionEmailSentAt}
                        />
                      ) : c.lastEmailSent ? (
                        <EmailSentPill
                          type={c.lastEmailSent.type}
                          timestamp={c.lastEmailSent.sentAt}
                        />
                      ) : null}
                      <Link
                        href={`/candidates/${c.id}`}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                        aria-label="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/candidates/${c.id}/compose`}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                        aria-label="Email"
                      >
                        <Mail className="h-4 w-4" />
                      </Link>
                      <StageChangeMenu
                        currentStage={c.stage}
                        candidateId={c.id}
                        onStageChange={(newStage) =>
                          handleStageChange(c.id, newStage)
                        }
                        isBlacklisted={c.isBlacklisted === true}
                        onAddToBlacklist={(reason) =>
                          handleAddToBlacklist(c.id, reason)
                        }
                        onRemoveFromBlacklist={() =>
                          handleRemoveFromBlacklist(c.id)
                        }
                      />
                    </div>
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
                Tidak ada kandidat ditemukan untuk &lsquo;{search}&rsquo;
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                No candidates match your filters.
              </p>
            )}
          </div>
        )}

        {/* Pagination */}
        {stage !== "Blacklisted" && (
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            basePath="/candidates"
            queryParams={queryParams}
          />
        )}
      </Card>
    </div>
  );
}
