"use client";

import { useState } from "react";
import { PageHeader, Avatar, SearchInput, StageChangeMenu } from "@/components/ui";
import { mockCandidates, CANDIDATE_STAGES, STAGE_DOT_COLORS, type Stage, type Candidate } from "@/lib/mock-data";
import { Plus, GripVertical, StickyNote, Download } from "lucide-react";

const columns: { stage: Stage; dot: string }[] = CANDIDATE_STAGES.map((stage) => ({
  stage,
  dot: STAGE_DOT_COLORS[stage],
}));

const vacancies = [
  "All Vacancies",
  "Senior Frontend Engineer",
  "Product Designer",
  "Backend Engineer",
  "Data Analyst",
];

export default function PipelinePage() {
  const [search, setSearch] = useState("");
  const [vacancy, setVacancy] = useState(vacancies[0]);
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);

  const handleStageChange = (candidateId: string, newStage: Stage) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, stage: newStage } : c)),
    );
  };

  const filtered = candidates.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.position.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Drag candidates across stages to update their status."
      />

      {/* Search + vacancy filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SearchInput
          placeholder="Search candidates..."
          value={search}
          onChange={setSearch}
          className="sm:max-w-md"
        />
        <select
          value={vacancy}
          onChange={(e) => setVacancy(e.target.value)}
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
        >
          {vacancies.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {columns.map((col) => {
          const cards = filtered.filter((c) => c.stage === col.stage);
          return (
            <div
              key={col.stage}
              className="flex-shrink-0 w-72 bg-slate-50 rounded-xl border border-slate-200 flex flex-col max-h-[calc(100vh-280px)]"
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold text-slate-700">{col.stage}</span>
                  <span className="text-xs font-medium text-slate-400 bg-white rounded-full px-2 py-0.5">
                    {cards.length}
                  </span>
                </div>
                <button className="h-6 w-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-200">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
                {cards.map((c) => (
                  <div
                    key={c.id}
                    className="group bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-[#006b5f]/30 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2.5">
                      <GripVertical className="h-4 w-4 text-slate-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Avatar name={c.name} size="sm" color={c.avatarColor} />
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {c.name}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 truncate mb-2">{c.position}</p>
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              c.aiMatch >= 85
                                ? "text-emerald-600"
                                : c.aiMatch >= 70
                                  ? "text-[#006b5f]"
                                  : "text-amber-600"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${c.aiMatch >= 85 ? "bg-emerald-500" : c.aiMatch >= 70 ? "bg-[#006b5f]" : "bg-amber-500"}`} />
                            {c.aiMatch}% match
                          </span>
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
                      </div>
                    </div>
                  </div>
                ))}
                {cards.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-slate-400">No candidates</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
