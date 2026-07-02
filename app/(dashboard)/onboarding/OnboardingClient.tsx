"use client";

import { useState, useMemo } from "react";
import { PageHeader, Card, MetricCard, SearchInput, EmptyState } from "@/components/ui";
import { Rocket, UserPlus, CheckCircle2, Clock } from "lucide-react";
import type { OnboardingStats, OnboardingRecord } from "@/lib/data-access";

const statusFilters = ["All", "In Progress", "Completed", "Pending"] as const;

const statusBadgeClass: Record<OnboardingRecord["status"], string> = {
  "In Progress": "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Pending: "bg-slate-100 text-slate-600",
};

export function OnboardingClient({
  stats,
  records,
}: {
  stats: OnboardingStats;
  records: OnboardingRecord[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("All");

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchesStatus = status === "All" || r.status === status;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.employeeName.toLowerCase().includes(q) ||
        r.position.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [records, search, status]);

  return (
    <div>
      <PageHeader title="Onboarding" subtitle="Track new hire onboarding progress." />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard icon={UserPlus} label="New Hires" value={stats.newHires} />
        <MetricCard icon={Clock} label="In Progress" value={stats.inProgress} accent="text-amber-600 bg-amber-50" />
        <MetricCard icon={CheckCircle2} label="Completed" value={stats.completed} accent="text-emerald-600 bg-emerald-50" />
        <MetricCard icon={Rocket} label="Avg Onboarding" value={stats.avgDays} />
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SearchInput
          placeholder="Search onboarding records..."
          value={search}
          onChange={setSearch}
          className="sm:max-w-md"
        />
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                status === s
                  ? "bg-[#006b5f] text-white"
                  : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Records table or empty state */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Rocket}
            title="No onboarding records"
            description="There are no onboarding records matching your filters. Start onboarding a new hire to see them here."
            ctaLabel="Start Onboarding"
            onCta={() => console.log("start")}
          />
        </Card>
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3 text-left font-semibold">Employee</th>
                  <th className="px-6 py-3 text-left font-semibold">Position</th>
                  <th className="px-6 py-3 text-left font-semibold">Start Date</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{r.employeeName}</div>
                      <div className="text-xs text-slate-400">{r.employeeCode}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{r.position}</td>
                    <td className="px-6 py-4 text-slate-500">{r.startDate}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClass[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
