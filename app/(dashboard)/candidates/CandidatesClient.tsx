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
import { CANDIDATE_STAGES, type Stage, type Candidate, type RejectionType } from "@/lib/mock-data";
import { persistStageChange } from "@/lib/stage-change";
import { formatDateWita, formatDateTimeShortWita } from "@/lib/format-wita";
import {
  Upload,
  Download,
  Eye,
  Mail,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import {
  DEFAULT_CANDIDATE_SORT,
  type CandidateSortField,
  type CandidateSortDir,
} from "@/lib/candidate-sort";

// "Blacklisted" is a separate filter layered on top of stages — NOT an 11th stage.
const stageFilters: (Stage | "All" | "Blacklisted")[] = [
  "All",
  ...CANDIDATE_STAGES,
  "Blacklisted",
];

/**
 * A sortable column header for the candidates table.
 *
 * Renders the column label as a clickable button with a sort-direction
 * indicator:
 *  - Inactive column: a muted double-arrow (ArrowUpDown) hinting it's sortable.
 *  - Active ascending: a solid up-arrow (ArrowUp).
 *  - Active descending: a solid down-arrow (ArrowDown).
 *
 * The header inherits the existing `<th>` typography (text size/weight/colour
 * come from the parent `<tr>`), so the only visual change vs. the old static
 * headers is the added clickable state + indicator icon — column widths,
 * spacing, and colours are preserved.
 */
function SortHeader({
  label,
  field,
  activeField,
  dir,
  onClick,
}: {
  label: string;
  field: CandidateSortField;
  activeField: CandidateSortField;
  dir: CandidateSortDir;
  onClick: (field: CandidateSortField) => void;
}) {
  const isActive = activeField === field;
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className="inline-flex items-center gap-1 -mx-1 px-1 py-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
      aria-label={`Sort by ${label}${
        isActive ? ` (${dir === "asc" ? "ascending" : "descending"})` : ""
      }`}
    >
      <span className={isActive ? "text-slate-600" : ""}>{label}</span>
      {isActive ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3 text-slate-600" />
        ) : (
          <ArrowDown className="h-3 w-3 text-slate-600" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 text-slate-300" />
      )}
    </button>
  );
}

/**
 * Computes the WAI-ARIA `aria-sort` value for a sortable column header cell.
 * Returns "ascending" / "descending" for the active column, "none" otherwise.
 */
function ariaSortValue(
  field: CandidateSortField,
  activeField: CandidateSortField,
  dir: CandidateSortDir,
): "ascending" | "descending" | "none" {
  if (field !== activeField) return "none";
  return dir === "asc" ? "ascending" : "descending";
}

export function CandidatesClient({
  initialCandidates,
  page,
  total,
  pageSize,
  search: initialSearch,
  stage: initialStage,
  sort: initialSort,
  sortDir: initialSortDir,
}: {
  initialCandidates: Candidate[];
  page: number;
  total: number;
  pageSize: number;
  search: string;
  stage: string;
  sort: CandidateSortField;
  sortDir: CandidateSortDir;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [stage, setStage] = useState<Stage | "All" | "Blacklisted">(
    (initialStage as Stage | "All" | "Blacklisted") || "All",
  );
  // Sort state mirrors the server-rendered props. The actual ordering happens
  // server-side (across the FULL filtered dataset), so the client only stores
  // the selection to render the active indicator and to push the new URL.
  const [sortField, setSortField] = useState<CandidateSortField>(initialSort);
  const [sortDir, setSortDir] = useState<CandidateSortDir>(initialSortDir);
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [isFiltering, setIsFiltering] = useState(false);
  const { showToast } = useToast();

  // Build a query string capturing the current list state (page, search,
  // stage, sort) so the candidate detail page can link back to the exact same
  // list view. Reads the live `page` from the URL search params (not just the
  // server prop) so that client-side pagination is always reflected, even
  // before a re-render fully propagates the new `page` prop.
  const returnQuery = (() => {
    const params = new URLSearchParams();
    const livePage = searchParams.get("page");
    const currentPage = livePage ? parseInt(livePage, 10) : page;
    if (currentPage > 1) params.set("fromPage", String(currentPage));
    if (search) params.set("fromSearch", search);
    if (stage && stage !== "All") params.set("fromStage", stage);
    // Preserve the active sort so returning from a detail page keeps the
    // same ordering. Only emit when it differs from the default to keep
    // URLs clean (the default is applied server-side when omitted).
    if (sortField !== DEFAULT_CANDIDATE_SORT.field || sortDir !== DEFAULT_CANDIDATE_SORT.dir) {
      params.set("fromSort", sortField);
      params.set("fromDir", sortDir);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  })();

  const candidateHref = (id: string) => `/candidates/${id}${returnQuery}`;
  const composeHref = (id: string) => `/candidates/${id}/compose${returnQuery}`;

  // Sync local state when server-rendered props change (e.g. after router.push
  // triggers a server re-render with new filtered data). Without this, useState
  // keeps the stale initial value and the table never updates.
  useEffect(() => {
    setCandidates(initialCandidates);
    setIsFiltering(false);
  }, [initialCandidates]);

  // Sync search/stage/sort from props so back/forward navigation restores state.
  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setStage((initialStage as Stage | "All" | "Blacklisted") || "All");
  }, [initialStage]);

  useEffect(() => {
    setSortField(initialSort);
  }, [initialSort]);

  useEffect(() => {
    setSortDir(initialSortDir);
  }, [initialSortDir]);

  // Restore the scroll position when returning to this list from a candidate
  // detail page. The position is saved (see `saveScrollPosition`) at the moment
  // the user clicks a candidate row to open the detail page. We restore it here
  // on mount and immediately clear the stored value so it doesn't "stick" and
  // get reapplied on unrelated visits (e.g. a fresh/direct visit, which should
  // fall back to the top of the page).
  useEffect(() => {
    const SCROLL_KEY = "nuanu:candidates:scrollY";
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved === null) return;
    sessionStorage.removeItem(SCROLL_KEY);
    const y = parseInt(saved, 10);
    if (Number.isNaN(y)) return;
    // The table rows are server-rendered, so they're already in the DOM on
    // mount. However, Next.js' default scroll-to-top on push navigation (and
    // the browser's own scroll restoration on back/forward) can race with our
    // restore and win, resetting the page to the top. To make our restore
    // reliably win, we apply it multiple times across several frames and a
    // short timeout — covering both the immediate post-mount paint and any
    // later scroll-reset triggered by the router. The "Back to Candidates"
    // link uses `scroll={false}` to suppress Next.js' scroll-to-top, but we
    // keep the redundant attempts here so browser back/forward also restores.
    const restore = () => window.scrollTo(0, y);
    let raf2 = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const raf1 = requestAnimationFrame(() => {
      restore();
      raf2 = requestAnimationFrame(restore);
      // A short timeout as a final safety net for slow layouts / async hydration.
      timeoutId = setTimeout(restore, 60);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

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

  // Sort handler: clicking a sortable column header toggles the sort.
  //  - Clicking an inactive column sorts ascending (except Applied Date,
  //    which defaults to descending — newest first — matching the historical
  //    default ordering).
  //  - Clicking the active column flips the direction.
  // Sorting is applied server-side across the FULL filtered/searched dataset
  // (not just the visible page), consistent with how search/stage filtering
  // already works. The existing search/stage params are preserved because we
  // build on top of the current searchParams.
  const handleSortChange = (field: CandidateSortField) => {
    let nextDir: CandidateSortDir;
    if (field === sortField) {
      // Toggle direction on the active column.
      nextDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      // New column: use a sensible default direction. Applied Date defaults
      // to desc (newest first); everything else defaults to asc.
      nextDir = field === "appliedDate" ? "desc" : "asc";
    }

    setSortField(field);
    setSortDir(nextDir);
    setIsFiltering(true);

    const params = new URLSearchParams(searchParams.toString());
    // Only emit sort params when they differ from the default, keeping URLs
    // clean. The server applies the default (appliedDate desc) when omitted.
    if (field === DEFAULT_CANDIDATE_SORT.field && nextDir === DEFAULT_CANDIDATE_SORT.dir) {
      params.delete("sort");
      params.delete("dir");
    } else {
      params.set("sort", field);
      params.set("dir", nextDir);
    }
    params.set("page", "1");
    router.push(`/candidates?${params.toString()}`);
  };

  const handleStageChange = async (
    candidateId: string,
    newStage: Stage,
    rejectionType?: RejectionType,
  ) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    // Optimistically update the stage in local state for responsiveness.
    const prevStage = candidate.stage;
    const prevRejectionType = candidate.rejectionType ?? null;
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              stage: newStage,
              rejectionType:
                newStage === "Rejected"
                  ? (rejectionType ?? "declined_by_hr")
                  : null,
            }
          : c,
      ),
    );

    // Persist the stage change (and rejectionType when moving to "Rejected")
    // to the database. Rejection emails are NOT auto-sent — HR reviews and
    // dispatches them manually from the compose page.
    const result = await persistStageChange(candidate, newStage, rejectionType);

    if (!result.success) {
      // Revert the optimistic stage update on failure.
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, stage: prevStage, rejectionType: prevRejectionType }
            : c,
        ),
      );
      showToast(result.error ?? "Failed to update stage", "error");
      return;
    }

    // Refresh the server data so the Router Cache is updated with the
    // persisted stage. Without this, navigating to a candidate detail page
    // and back could show stale data (the old stage before the change).
    router.refresh();
  };

  const handleAddToBlacklist = async (candidateId: string, reason: string) => {
    // Optimistic update
    const prev = candidates;
    setCandidates((cur) =>
      cur.map((c) =>
        c.id === candidateId
          ? { ...c, isBlacklisted: true, blacklistReason: reason }
          : c,
      ),
    );
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBlacklisted: true,
          blacklistReason: reason,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to blacklist candidate");
      }
      showToast("Candidate added to blacklist", "success");
      // Refresh server data so the Router Cache stays in sync with the DB.
      router.refresh();
    } catch (err) {
      // Revert on failure
      setCandidates(prev);
      showToast(
        err instanceof Error ? err.message : "Failed to blacklist candidate",
        "error",
      );
    }
  };

  const handleRemoveFromBlacklist = async (candidateId: string) => {
    // Optimistic update
    const prev = candidates;
    setCandidates((cur) =>
      cur.map((c) =>
        c.id === candidateId
          ? { ...c, isBlacklisted: false, blacklistReason: null }
          : c,
      ),
    );
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBlacklisted: false,
          blacklistReason: null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove from blacklist");
      }
      showToast("Candidate removed from blacklist", "success");
      // Refresh server data so the Router Cache stays in sync with the DB.
      router.refresh();
    } catch (err) {
      // Revert on failure
      setCandidates(prev);
      showToast(
        err instanceof Error ? err.message : "Failed to remove from blacklist",
        "error",
      );
    }
  };

  // Client-side filtering for "Blacklisted" (cross-stage filter) since the DB
  // query doesn't have a blacklist column — this is layered on top.
  const filtered = useMemo(() => {
    if (stage === "Blacklisted") {
      return candidates.filter((c) => c.isBlacklisted === true);
    }
    return candidates;
  }, [candidates, stage]);

  // Query params to preserve when paginating (keeps the active sort across
  // page navigation). Sort params are omitted when at the default so URLs
  // stay clean — the server applies the default (appliedDate desc) then.
  const queryParams: Record<string, string | undefined> = {
    search: search || undefined,
    stage: stage !== "All" ? stage : undefined,
    sort:
      sortField !== DEFAULT_CANDIDATE_SORT.field || sortDir !== DEFAULT_CANDIDATE_SORT.dir
        ? sortField
        : undefined,
    dir:
      sortField !== DEFAULT_CANDIDATE_SORT.field || sortDir !== DEFAULT_CANDIDATE_SORT.dir
        ? sortDir
        : undefined,
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
        return formatDateWita(iso);
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

  // Save the current vertical scroll position so it can be restored when the
  // user returns from a candidate detail page (see the restore effect above).
  // Attached to the candidate-name and "view" links — the ones that navigate
  // into /candidates/[id].
  const saveScrollPosition = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "nuanu:candidates:scrollY",
        String(window.scrollY),
      );
    }
  }, []);

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
                <th
                  className="text-left font-medium px-6 py-3"
                  aria-sort={ariaSortValue("name", sortField, sortDir)}
                >
                  <SortHeader
                    label="Candidate"
                    field="name"
                    activeField={sortField}
                    dir={sortDir}
                    onClick={handleSortChange}
                  />
                </th>
                <th className="text-left font-medium px-6 py-3">Applied For</th>
                <th
                  className="text-left font-medium px-6 py-3"
                  aria-sort={ariaSortValue("stage", sortField, sortDir)}
                >
                  <SortHeader
                    label="Stage"
                    field="stage"
                    activeField={sortField}
                    dir={sortDir}
                    onClick={handleSortChange}
                  />
                </th>
                <th
                  className="text-left font-medium px-6 py-3"
                  aria-sort={ariaSortValue("aiMatch", sortField, sortDir)}
                >
                  <SortHeader
                    label="AI Match"
                    field="aiMatch"
                    activeField={sortField}
                    dir={sortDir}
                    onClick={handleSortChange}
                  />
                </th>
                <th
                  className="text-left font-medium px-6 py-3"
                  aria-sort={ariaSortValue("appliedDate", sortField, sortDir)}
                >
                  <SortHeader
                    label="Applied Date"
                    field="appliedDate"
                    activeField={sortField}
                    dir={sortDir}
                    onClick={handleSortChange}
                  />
                </th>
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
                            href={candidateHref(c.id)}
                            onClick={saveScrollPosition}
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
                    {c.domicile && (
                      <p className="text-xs text-slate-400 mt-0.5">{c.domicile}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill status={c.stage} isBlacklisted={c.isBlacklisted} />
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
                    {formatDateTimeShortWita(c.appliedDate)}
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
                        href={candidateHref(c.id)}
                        onClick={saveScrollPosition}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                        aria-label="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={composeHref(c.id)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                        aria-label="Email"
                      >
                        <Mail className="h-4 w-4" />
                      </Link>
                      <StageChangeMenu
                        currentStage={c.stage}
                        currentRejectionType={c.rejectionType ?? null}
                        candidateId={c.id}
                        onStageChange={(newStage, rt) =>
                          handleStageChange(c.id, newStage, rt)
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
