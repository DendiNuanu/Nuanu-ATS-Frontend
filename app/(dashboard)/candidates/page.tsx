"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, Card, StatusPill, Button, Avatar, SearchInput, StageChangeMenu, BlacklistBadge, RejectionEmailBadge, RejectionSentPill, useToast } from "@/components/ui";
import { mockCandidates, CANDIDATE_STAGES, type Stage, type Candidate } from "@/lib/mock-data";
import { Upload, Download, Eye, Mail } from "lucide-react";

// "Blacklisted" is a separate filter layered on top of stages — NOT an 11th stage.
const stageFilters: (Stage | "All" | "Blacklisted")[] = ["All", ...CANDIDATE_STAGES, "Blacklisted"];

export default function CandidatesPage() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<Stage | "All" | "Blacklisted">("All");
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);
  const { showToast } = useToast();

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
          updated.rejectionEmailSent = true;
          updated.rejectionEmailSentAt = `${dd}/${mm}/${yyyy} · ${hh}:${min}`;
          showToast(`Rejection email sent to ${c.name}`);
        }
        return updated;
      }),
    );
  };

  const handleAddToBlacklist = (candidateId: string, reason: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId ? { ...c, isBlacklisted: true, blacklistReason: reason } : c,
      ),
    );
  };

  const handleRemoveFromBlacklist = (candidateId: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId ? { ...c, isBlacklisted: false, blacklistReason: null } : c,
      ),
    );
  };

  const filtered = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.position.toLowerCase().includes(search.toLowerCase());
    // "Blacklisted" is a cross-stage filter — shows blacklisted candidates regardless of stage.
    const matchesStage =
      stage === "All"
        ? true
        : stage === "Blacklisted"
          ? c.isBlacklisted === true
          : c.stage === stage;
    return matchesSearch && matchesStage;
  });

  return (
    <div>
      <PageHeader
        title="Candidates"
        subtitle="All applicants across your active vacancies."
        actions={
          <>
            <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => console.log("upload")}>
              Upload CV
            </Button>
            <Button variant="primary" icon={<Download className="h-4 w-4" />} onClick={() => console.log("export")}>
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
          onChange={setSearch}
          className="sm:max-w-md"
        />
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {stageFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
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
                        {c.rejectionEmailSent && (
                          <div className="mt-1">
                            <RejectionEmailBadge />
                          </div>
                        )}
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
                    {new Date(c.appliedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {c.rejectionEmailSent && c.rejectionEmailSentAt && (
                        <RejectionSentPill timestamp={c.rejectionEmailSentAt} />
                      )}
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
                        onStageChange={(newStage) => handleStageChange(c.id, newStage)}
                        isBlacklisted={c.isBlacklisted === true}
                        onAddToBlacklist={(reason) => handleAddToBlacklist(c.id, reason)}
                        onRemoveFromBlacklist={() => handleRemoveFromBlacklist(c.id)}
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
            <p className="text-sm text-slate-500">No candidates match your filters.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
