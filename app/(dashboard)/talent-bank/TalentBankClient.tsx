"use client";

import { useState } from "react";
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

  const handleSearchChange = (value: string) => {
    setSearch(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    router.push(`/talent-bank?${params.toString()}`);
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

    // Refresh server data so the Router Cache stays in sync with the DB.
    router.refresh();
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

  const queryParams: Record<string, string | undefined> = {
    search: search || undefined,
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th className="text-left font-medium px-6 py-3">Candidate</th>
                <th className="text-left font-medium px-6 py-3">Position</th>
                <th className="text-left font-medium px-6 py-3">Stage</th>
                <th className="text-left font-medium px-6 py-3">AI Match</th>
                <th className="text-left font-medium px-6 py-3">Added Date</th>
                <th className="text-right font-medium px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c) => (
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
                          {c.isBlacklisted && <BlacklistBadge />}
                        </div>
                        <p className="text-xs text-slate-500">{c.email}</p>
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
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-700">{c.position}</p>
                    <p className="text-xs text-slate-400">{c.department}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill status={c.stage} isBlacklisted={c.isBlacklisted} rejectionType={c.rejectionType} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
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
                  <td className="px-6 py-4 text-slate-500">
                    {formatDateWita(c.appliedDate)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
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
              No candidates in the talent bank.
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
