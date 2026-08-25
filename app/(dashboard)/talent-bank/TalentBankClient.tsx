"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PageHeader,
  Card,
  Button,
  Avatar,
  SearchInput,
  StatusPill,
  StageChangeMenu,
  BlacklistBadge,
  EmailSentBadge,
  EmailSentPill,
  Pagination,
  useToast,
} from "@/components/ui";
import { type Stage, type Candidate, type RejectionType } from "@/lib/mock-data";
import { persistStageChange } from "@/lib/stage-change";
import { formatDateWita } from "@/lib/format-wita";
import { Download, Eye, Mail } from "lucide-react";

export function TalentBankClient({
  initialCandidates,
  page,
  total,
  pageSize,
  search: initialSearch,
}: {
  initialCandidates: Candidate[];
  page: number;
  total: number;
  pageSize: number;
  search: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const { showToast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the table synchronized with server-rendered results after a URL
  // navigation. Without this, the input URL changes but stale rows remain.
  useEffect(() => {
    setCandidates(initialCandidates);
  }, [initialCandidates]);

  // Keep the input synchronized with browser back/forward navigation.
  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const handleSearchChange = (value: string) => {
    setSearch(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce navigation so each keystroke cannot race with the previous
    // server render and leave the list showing an older query.
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const normalizedValue = value.trim();
      if (normalizedValue) {
        params.set("search", normalizedValue);
      } else {
        params.delete("search");
      }
      params.set("page", "1");
      debounceRef.current = null;
      router.push(`/talent-bank?${params.toString()}`);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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

    // Persist the stage first; rejection delivery is queued independently.
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

    // Refresh server data so the Router Cache stays in sync with the DB.
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
    } else if (newStage === "Rejected") {
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

  const queryParams: Record<string, string | undefined> = {
    search: search.trim() || undefined,
  };

  return (
    <div>
      <PageHeader
        title="Talent Bank"
        subtitle="Curated candidates intentionally moved into the talent bank."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() => console.log("export")}
          >
            Export Data
          </Button>
        }
      />

      <div className="mb-6">
        <SearchInput
          placeholder="Search talent bank..."
          value={search}
          onChange={handleSearchChange}
          className="sm:max-w-md"
        />
      </div>

      <Card noPadding>
        {/* Keep overflow scoped to the table. The explicit desktop column budget
            prevents fixed-layout cells from stealing space from one another. */}
        <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[1080px] table-fixed text-sm">
            <colgroup>
              <col className="w-[220px]" />
              <col className="w-[190px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[120px]" />
              <col className="w-[330px]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left font-medium">Candidate</th>
                <th className="px-4 py-3 text-left font-medium">Position</th>
                <th className="px-4 py-3 text-left font-medium">Stage</th>
                <th className="px-4 py-3 text-left font-medium">AI Match</th>
                <th className="px-4 py-3 text-left font-medium">Added Date</th>
                <th className="px-3 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 align-top">
                    <div className="flex min-w-0 items-start gap-2">
                      <Avatar name={c.name} size="md" color={c.avatarColor} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            href={`/candidates/${c.id}`}
                            className="min-w-0 truncate font-medium text-slate-900 hover:text-[#006b5f]"
                            title={c.name}
                          >
                            {c.name}
                          </Link>
                          {c.isBlacklisted && <BlacklistBadge />}
                        </div>
                        <p className="truncate text-xs text-slate-500" title={c.email}>{c.email}</p>
                        {/* Talent Bank: always show generic "Email Sent" badge */}
                        {c.rejectionEmailSent || c.lastEmailSent ? (
                          <div className="mt-1">
                            <EmailSentBadge
                              type={
                                c.lastEmailSent?.type ?? "Email"
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="min-w-0 px-3 py-3 align-top">
                    <p className="truncate font-medium text-slate-700" title={c.position}>
                      {c.position}
                    </p>
                    <p className="truncate text-xs text-slate-400" title={c.department}>{c.department}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <StatusPill status={c.stage} isBlacklisted={c.isBlacklisted} rejectionType={c.rejectionType} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-2 min-w-0 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#006b5f]"
                          style={{ width: `${c.aiMatch}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        {c.aiMatch}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-slate-500">
                    <span className="block truncate" title={formatDateWita(c.appliedDate)}>{formatDateWita(c.appliedDate)}</span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                      {/* Talent Bank: always show generic "Email Sent" pill */}
                      {c.rejectionEmailSent && c.rejectionEmailSentAt ? (
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

        {candidates.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-slate-500">
              {search.trim()
                ? `No talent bank candidates match "${search.trim()}".`
                : "No candidates in the talent bank."}
            </p>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          basePath="/talent-bank"
          queryParams={queryParams}
        />
      </Card>
    </div>
  );
}
