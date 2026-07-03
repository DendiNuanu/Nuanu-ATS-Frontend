"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, Card, MetricCard, StatusPill, Button, Avatar, Tabs, SearchInput } from "@/components/ui";
import type { AssessmentRow, AssessmentStats } from "@/lib/data-access";
import { formatDateWita } from "@/lib/format-wita";
import { Send, ClipboardList, Clock, CheckCircle2, Plus, Eye, MoreHorizontal } from "lucide-react";

const tabs = [
  { id: "activity", label: "Assessment Activity" },
  { id: "templates", label: "Template Library" },
];

const templates = [
  { id: "t1", name: "Frontend Technical Test", type: "Technical", questions: 12, uses: 24 },
  { id: "t2", name: "Design Portfolio Review", type: "Case Study", questions: 5, uses: 18 },
  { id: "t3", name: "SQL & Analytics Test", type: "Technical", questions: 15, uses: 31 },
  { id: "t4", name: "Behavioral Assessment", type: "Behavioral", questions: 20, uses: 42 },
  { id: "t5", name: "Cognitive Aptitude Test", type: "Cognitive", questions: 30, uses: 27 },
];

export function AssessmentClient({
  assessments,
  stats,
}: {
  assessments: AssessmentRow[];
  stats: AssessmentStats;
}) {
  const [activeTab, setActiveTab] = useState("activity");
  const [search, setSearch] = useState("");

  const filtered = assessments.filter(
    (a) =>
      a.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      a.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Assessment"
        subtitle="Send and track candidate assessments."
        actions={
          <Link href="/assessment/send">
            <Button icon={<Plus className="h-4 w-4" />}>Send Assessment</Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard icon={Send} label="Total Sent" value={stats.totalSent.toString()} trend={{ value: "Live", direction: "up" }} />
        <MetricCard icon={Clock} label="Pending" value={stats.pending.toString()} accent="text-amber-600 bg-amber-50" />
        <MetricCard icon={CheckCircle2} label="Completed" value={stats.completed.toString()} trend={{ value: "Live", direction: "up" }} accent="text-emerald-600 bg-emerald-50" />
        <MetricCard icon={ClipboardList} label="Avg Score" value={stats.avgScore} trend={{ value: "Live", direction: "up" }} />
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} className="mb-6" />

      {activeTab === "activity" && (
        <>
          <div className="mb-6">
            <SearchInput
              placeholder="Search assessments..."
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
                    <th className="text-left font-medium px-6 py-3">Assessment</th>
                    <th className="text-left font-medium px-6 py-3">Type</th>
                    <th className="text-left font-medium px-6 py-3">Score</th>
                    <th className="text-left font-medium px-6 py-3">Status</th>
                    <th className="text-left font-medium px-6 py-3">Sent Date</th>
                    <th className="text-right font-medium px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        No assessments found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={a.candidateName} size="md" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">{a.candidateName}</p>
                              <p className="text-xs text-slate-400">{a.position}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{a.title}</td>
                        <td className="px-6 py-4 text-slate-500">{a.type}</td>
                        <td className="px-6 py-4">
                          {a.score !== null ? (
                            <span className="font-semibold text-slate-900">{a.score}%</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill status={a.status} />
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {formatDateWita(a.sentDate)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="View">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="More">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-[#e6f5f3] flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-[#006b5f]" />
                </div>
                <StatusPill status={t.type} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 font-heading">{t.name}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {t.questions} questions · Used {t.uses} times
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Button variant="secondary" size="sm" className="flex-1">Preview</Button>
                <Button variant="primary" size="sm" className="flex-1">Use Template</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
