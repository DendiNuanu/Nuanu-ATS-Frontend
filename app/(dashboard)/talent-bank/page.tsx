"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, Card, Button, Avatar, SearchInput, StatusPill, StageChangeMenu } from "@/components/ui";
import { mockCandidates, type Stage, type Candidate } from "@/lib/mock-data";
import { Download, Eye, Mail, StickyNote } from "lucide-react";

export default function TalentBankPage() {
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);

  const handleStageChange = (candidateId: string, newStage: Stage) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, stage: newStage } : c)),
    );
  };

  const talentBank = candidates.filter((c) => c.stage === "Talent Bank");
  const filtered = talentBank.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.position.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Talent Bank"
        subtitle="Curated candidates intentionally moved into the talent bank."
        actions={
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => console.log("export")}>
            Export Data
          </Button>
        }
      />

      <div className="mb-6">
        <SearchInput
          placeholder="Search talent bank..."
          value={search}
          onChange={setSearch}
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
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size="md" color={c.avatarColor} />
                      <div className="min-w-0">
                        <Link
                          href={`/candidates/${c.id}`}
                          className="font-medium text-slate-900 hover:text-[#006b5f]"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-slate-500">{c.email}</p>
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
                          className="h-full rounded-full bg-[#006b5f]"
                          style={{ width: `${c.aiMatch}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">{c.aiMatch}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(c.appliedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
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
                        extraActions={[
                          { label: "Add note", icon: StickyNote, onClick: () => console.log("add-note", c.id) },
                          { label: "Download resume", icon: Download, onClick: () => console.log("download-resume", c.id) },
                        ]}
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
            <p className="text-sm text-slate-500">No candidates in the talent bank.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
