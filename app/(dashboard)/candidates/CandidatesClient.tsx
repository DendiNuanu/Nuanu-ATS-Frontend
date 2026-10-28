"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import {
  CANDIDATE_STAGES,
  type Stage,
  type Candidate,
  type RejectionType,
} from "@/lib/mock-data";
import { persistStageChange } from "@/lib/stage-change";
import {
  Upload,
  Download,
  Eye,
  Trash2,
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

type CandidateListFilter = Stage | "All" | "Blacklisted";

// Blacklisted is a cross-stage filter, not a pipeline stage.
const stageFilters: CandidateListFilter[] = [
  "All",
  ...CANDIDATE_STAGES,
  "Blacklisted",
];

/**
 * Quick "..." MOVE TO STAGE options on the candidates list (Task 1).
 *
 * The list view intentionally only offers the 3 most common actions —
 * Screening, Rejected (+ its rejection sub-types) and Add to blacklist
 * (rendered separately by StageChangeMenu below the divider). All other
 * stage transitions must be done from the candidate detail page, where the
 * full pipeline is available. This is a UI-level restriction only: the
 * stage filter tabs above the table still cover every stage, and no schema
 * or enum changed.
 */
const QUICK_STAGE_OPTIONS: Stage[] = ["Screening", "Rejected"];

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

/** Show every explicit Refer As position, just like Applied For. */
function ReferAsCell({ candidate }: { candidate: Candidate }) {
  const stored = candidate.referAsSlots?.length
    ? candidate.referAsSlots
    : candidate.referAs ? [candidate.referAs] : [];

  const explicit = stored
    .map((value) => value.trim())
    .filter((value) =>
      Boolean(value) &&
      !["—", "-", "none", "n/a", "null"].includes(value.toLowerCase())
    );

  const fallback = candidate.applicationPositions?.length
    ? candidate.applicationPositions
    : [candidate.position];

  const values = explicit.length ? explicit : fallback;
  const cleaned = values
    .map((value) => value.trim())
    .filter((value) =>
      Boolean(value) && value !== "—" && value !== "-"
    );
  const unique = Array.from(new Map(cleaned.map((value) => [value.toLowerCase(), value])).values());
  if (!unique.length) return <span className="text-slate-300">—</span>;
  const applied = new Set((candidate.applicationPositions?.length
    ? candidate.applicationPositions
    : [candidate.position]).map((value) => value.trim().toLowerCase()));
  return (
    <div className="flex flex-wrap gap-1" title={unique.join(", ")}>
      {unique.map((position) => (
        <span key={position.toLowerCase()}
          className={`inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-medium ${applied.has(position.toLowerCase()) ? "bg-slate-100 text-slate-500" : "bg-teal-50 text-[#006b5f]"}`}>
          <span className="truncate">{position}</span>
        </span>
      ))}
    </div>
  );
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
  const [stage, setStage] = useState<CandidateListFilter>(
    (initialStage as CandidateListFilter) || "All",
  );
  // Sort state mirrors the server-rendered props. The actual ordering happens
  // server-side (across the FULL filtered dataset), so the client only stores
  // the selection to render the active indicator and to push the new URL.
  const [sortField, setSortField] = useState<CandidateSortField>(initialSort);
  const [sortDir, setSortDir] = useState<CandidateSortDir>(initialSortDir);
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  // Tracks in-flight stage changes so the `initialCandidates` sync effect
  // (triggered by router.refresh()) does NOT overwrite an optimistic update
  // with stale server data while the write is still committing. Each entry
  // maps candidateId → { stage, rejectionType }. Cleared once the write is
  // confirmed. This is the core fix for B7 (status reverting to "New"):
  // without it, a router.refresh() that returns the OLD (pre-change) value
  // would clobber the optimistic "Rejected" state.
  const [pendingStageChanges, setPendingStageChanges] = useState<
    Record<string, { stage: Stage; rejectionType: RejectionType | null }>
  >({});

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
    if (
      sortField !== DEFAULT_CANDIDATE_SORT.field ||
      sortDir !== DEFAULT_CANDIDATE_SORT.dir
    ) {
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
  //
  // B7 FIX: While a stage change is in flight (pendingStageChanges), preserve
  // the optimistic stage so a stale server refresh can't clobber it. Once the
  // write is confirmed and the server returns the FRESH value, the pending
  // entry is cleared and the server value takes over. This eliminates the
  // "reverts to New" race where router.refresh() returns the pre-change value
  // before the DB write commits.
  useEffect(() => {
    setCandidates(() => {
      const pendingIds = Object.keys(pendingStageChanges);
      if (pendingIds.length === 0) {
        return initialCandidates;
      }
      // Merge: take server data, but override stage for any candidate with a
      // pending (in-flight) stage change so the optimistic value survives.
      return initialCandidates.map((c) => {
        const pending = pendingStageChanges[c.id];
        if (!pending) return c;
        return {
          ...c,
          stage: pending.stage,
          rejectionType: pending.rejectionType,
        };
      });
    });
    setIsFiltering(false);
  }, [initialCandidates, pendingStageChanges]);

  // Sync search/stage/sort from props so back/forward navigation restores state.
  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setStage((initialStage as CandidateListFilter) || "All");
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
      // Keep the locally selected stage authoritative. The URL can still hold
      // the previous server value while a client navigation is in flight.
      if (stage === "All") {
        params.delete("stage");
      } else {
        params.set("stage", stage);
      }
      params.set("page", "1");
      debounceRef.current = null;
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

  const handleStageChangeFilter = (newStage: CandidateListFilter) => {
    // A queued search navigation was built from the previous URL and could run
    // after this click, reverting the selected stage. Cancel it and include the
    // current input value in this single authoritative navigation instead.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setStage(newStage);
    setIsFiltering(true);
    const params = new URLSearchParams(searchParams.toString());
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }
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

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSortField(field);
    setSortDir(nextDir);
    setIsFiltering(true);

    const params = new URLSearchParams(searchParams.toString());
    // Preserve local filter state even when its server navigation has not yet
    // updated useSearchParams.
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }
    if (stage === "All") {
      params.delete("stage");
    } else {
      params.set("stage", stage);
    }
    // Only emit sort params when they differ from the default, keeping URLs
    // clean. The server applies the default (appliedDate desc) when omitted.
    if (
      field === DEFAULT_CANDIDATE_SORT.field &&
      nextDir === DEFAULT_CANDIDATE_SORT.dir
    ) {
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
    const optimisticRejectionType =
      newStage === "Rejected" ? (rejectionType ?? "declined_by_hr") : null;
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              stage: newStage,
              rejectionType: optimisticRejectionType,
            }
          : c,
      ),
    );
    // Mark this stage change as in-flight so the initialCandidates sync effect
    // preserves the optimistic value even if router.refresh() returns stale
    // data before the DB write commits (B7 fix).
    setPendingStageChanges((prev) => ({
      ...prev,
      [candidateId]: {
        stage: newStage,
        rejectionType: optimisticRejectionType,
      },
    }));

    // Persist the stage and subtype first. The server queues rejection delivery
    // independently, so SMTP latency or failure cannot roll back this UI state.
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
      // Clear the pending marker — the write failed, so server data is
      // authoritative again.
      setPendingStageChanges((prev) => {
        const next = { ...prev };
        delete next[candidateId];
        return next;
      });
      showToast(result.error ?? "Failed to update stage", "error");
      return;
    }

    // The write is confirmed (persistStageChange verified the server echoed
    // back the correct stage). Clear the pending marker so the next
    // router.refresh() — which now returns the FRESH value — takes over.
    setPendingStageChanges((prev) => {
      const next = { ...prev };
      delete next[candidateId];
      return next;
    });

    // Refresh the server data so the Router Cache is updated with the
    // persisted stage. Without this, navigating to a candidate detail page
    // and back could show stale data (the old stage before the change).
    router.refresh();

    if (newStage === "Hired" && result.conversion) {
      showToast(
        "Hired: draft offer and pending-onboarding employee profile are ready.",
        "success",
        [
          { label: "Open Offers", href: "/offers" },
          {
            label: "Open Employee",
            href: `/employees/${result.conversion.employeeId}`,
          },
        ],
      );
    }

    if (newStage === "Rejected") {
      showToast(
        result.rejectionEmailQueued
          ? "Candidate rejected. The matching email was queued for delivery."
          : "Candidate rejected. Use Compose Email to send manually if needed.",
        "success",
      );
    }
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to blacklist candidate");
      }
      showToast(
        data.warning
          ? `Candidate added to blacklist. ${data.warning}`
          : "Candidate added to blacklist",
        "success",
      );
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

  const handleRemoveFromBlacklist = async (
    candidateId: string,
    applicationId = candidateId,
  ) => {
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
      const res = await fetch(`/api/candidates/${applicationId}`, {
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

  // The server groups applications by person, then applies stage/blacklist
  // filters and pagination to those grouped rows.
  const filtered = candidates;

  // Query params to preserve when paginating (keeps the active sort across
  // page navigation). Sort params are omitted when at the default so URLs
  // stay clean — the server applies the default (appliedDate desc) then.
  const queryParams: Record<string, string | undefined> = {
    search: search || undefined,
    stage: stage !== "All" ? stage : undefined,
    sort:
      sortField !== DEFAULT_CANDIDATE_SORT.field ||
      sortDir !== DEFAULT_CANDIDATE_SORT.dir
        ? sortField
        : undefined,
    dir:
      sortField !== DEFAULT_CANDIDATE_SORT.field ||
      sortDir !== DEFAULT_CANDIDATE_SORT.dir
        ? sortDir
        : undefined,
  };

  const handleExportCSV = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (stage !== "All") params.set("stage", stage);
      if (sortField !== DEFAULT_CANDIDATE_SORT.field) {
        params.set("sort", sortField);
      }
      if (
        sortField !== DEFAULT_CANDIDATE_SORT.field ||
        sortDir !== DEFAULT_CANDIDATE_SORT.dir
      ) {
        params.set("dir", sortDir);
      }

      const query = params.toString();
      const response = await fetch(
        `/api/candidates/export${query ? `?${query}` : ""}`,
      );
      if (!response.ok) {
        throw new Error("Export request failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const today = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        filenameMatch?.[1] ?? `candidates-export-${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const exportedCount = response.headers.get("x-export-row-count");
      showToast(
        exportedCount
          ? `Exported ${exportedCount} candidates to CSV`
          : "Candidate export downloaded",
      );
    } catch (error) {
      console.error("Failed to export candidates:", error);
      showToast("Failed to export candidates. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, search, showToast, sortDir, sortField, stage]);

  // Save the current vertical scroll position so it can be restored when the
  // user returns from a candidate detail page (see the restore effect above).
  // Attached to the candidate-name and "view" links — the ones that navigate
  // into /candidates/[id].

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const closeDelete = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError("");
  }, [deleting]);

  useEffect(() => {
    if (!deleteTarget) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDelete();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [deleteTarget, closeDelete]);

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(
        `/api/candidates/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Delete failed");
      }

      window.location.reload();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Delete failed"
      );
      setDeleting(false);
    }
  };

  const saveScrollPosition = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "nuanu:candidates:scrollY",
        String(window.scrollY),
      );
    }
  }, []);

  return (
    <div className="min-w-0 max-w-full">
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
              disabled={isExporting}
              aria-busy={isExporting}
            >
              {isExporting ? "Exporting..." : "Export Data"}
            </Button>
          </>
        }
      />

      {/* Search + stage filter */}
      <div className="mb-6 flex min-w-0 flex-col gap-3">
        <SearchInput
          placeholder="Search by name, email, or position..."
          value={search}
          onChange={handleSearchChange}
          className="w-full sm:max-w-md"
        />
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
          {stageFilters.map((s) => (
            <button
              key={s}
              onClick={() => handleStageChangeFilter(s)}
              className={`h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${
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
        {/* Keep table overflow inside this wrapper; never let it widen the page body. */}
        <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[960px] table-fixed text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[21%]" />
              <col className="w-[19%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th
                  className="text-left font-medium px-4 py-3"
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
                <th className="text-left font-medium px-4 py-3">Applied For</th>
                <th className="text-left font-medium px-4 py-3">Refer As</th>
                <th
                  className="text-left font-medium px-4 py-3"
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
                  className="text-left font-medium px-4 py-3"
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
                <th className="text-right font-medium px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar
                        name={c.name}
                        size="md"
                        color={c.avatarColor}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={candidateHref(c.id)}
                          onClick={saveScrollPosition}
                          className="block min-w-0 whitespace-normal break-words [overflow-wrap:anywhere] font-medium text-slate-900 hover:text-[#006b5f]"
                          title={c.name}
                        >
                          {c.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500" title={c.email}>
                          {c.email}
                        </p>
                        {/* Badge logic: show rejection badge only when stage is "Rejected";
                            otherwise show generic "Email Sent" for any email sent */}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="shrink-0">
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {c.source}
                            </span>
                          </span>
                          {c.isBlacklisted && (
                            <span className="shrink-0">
                              <BlacklistBadge />
                            </span>
                          )}
                          {c.rejectionEmailSent && c.stage === "Rejected" ? (
                            <>
                              <span className="shrink-0">
                                <RejectionEmailBadge />
                              </span>
                              {c.rejectionEmailSentAt && (
                                <span className="shrink-0">
                                  <RejectionSentPill
                                    timestamp={c.rejectionEmailSentAt}
                                  />
                                </span>
                              )}
                            </>
                          ) : c.rejectionEmailSent || c.lastEmailSent ? (
                            <>
                              <span className="shrink-0">
                                <EmailSentBadge
                                  type={c.lastEmailSent?.type ?? "Email"}
                                />
                              </span>
                              {c.rejectionEmailSent && c.rejectionEmailSentAt ? (
                                <span className="shrink-0">
                                  <EmailSentPill
                                    type="Email"
                                    timestamp={c.rejectionEmailSentAt}
                                  />
                                </span>
                              ) : c.lastEmailSent ? (
                                <span className="shrink-0">
                                  <EmailSentPill
                                    type={c.lastEmailSent.type}
                                    timestamp={c.lastEmailSent.sentAt}
                                  />
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div
                      className="flex flex-wrap gap-1"
                      title={(c.applicationPositions ?? [c.position]).join(", ")}
                    >
                      {(c.applicationPositions?.length
                        ? c.applicationPositions
                        : [c.position]
                      ).map((position) => (
                        <span
                          key={position}
                          className="inline-flex max-w-full items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          <span className="truncate">{position}</span>
                        </span>
                      ))}
                    </div>
                    {c.domicile && (
                      <p className="mt-0.5 truncate text-xs text-slate-400" title={c.domicile}>
                        {c.domicile}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <ReferAsCell candidate={c} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill
                      status={c.stage}
                      isBlacklisted={c.isBlacklisted}
                      rejectionType={c.rejectionType}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 min-w-0 flex-1 rounded-full bg-slate-100 overflow-hidden">
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
                  <td className="px-2 py-3 align-top">
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                      <Link
                        href={candidateHref(c.id)}
                        onClick={saveScrollPosition}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100"
                        aria-label="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={composeHref(c.id)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100"
                        aria-label="Email"
                      >
                        <Mail className="h-4 w-4" />
                      </Link>
                      <StageChangeMenu
                        currentStage={c.stage}
                        stages={QUICK_STAGE_OPTIONS}
                        currentRejectionType={c.rejectionType ?? null}
                        candidateId={c.id}
                        extraActions={[
                          {
                            label: "Delete Candidate",
                            icon: Trash2,
                            onClick: () => {
                              setDeleteError("");
                              setDeleteTarget({
                                id: c.id,
                                name: c.name,
                              });
                            },
                          },
                        ]}
                        onStageChange={(newStage, rt) =>
                          handleStageChange(c.id, newStage, rt)
                        }
                        isBlacklisted={c.isBlacklisted === true}
                        onAddToBlacklist={(reason) =>
                          handleAddToBlacklist(c.id, reason)
                        }
                        onRemoveFromBlacklist={() =>
                          handleRemoveFromBlacklist(
                            c.id,
                            c.blacklistApplicationId ?? c.id,
                          )
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

        {/* Pagination — shown for ALL stage filters including "Blacklisted".
            The server paginates every filter server-side, so hiding pagination
            for "Blacklisted" made candidates beyond page 1 unreachable. */}
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          basePath="/candidates"
          queryParams={queryParams}
        />
      </Card>
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDelete();
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>

            <h2
              id="delete-title"
              className="text-xl font-semibold text-slate-900"
            >
              Delete Candidate?
            </h2>

            <p
              id="delete-description"
              className="mt-3 text-sm leading-6 text-slate-600"
            >
              Are you sure you want to delete the selected application for
              <strong> {deleteTarget.name}</strong>?
              Other applications will remain available.
              This action cannot be undone.
            </p>

            {deleteError && (
              <div
                role="alert"
                className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                disabled={deleting}
                onClick={closeDelete}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete Candidate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
