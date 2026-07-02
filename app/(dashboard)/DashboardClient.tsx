"use client";

import { PageHeader, Card, MetricCard } from "@/components/ui";
import {
  Briefcase,
  Users,
  Clock,
  CheckCircle2,
  Sparkles,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardData } from "@/lib/data-access";

const genderColors: Record<string, string> = {
  Male: "bg-[#006b5f]",
  Female: "bg-blue-500",
  "Prefer not to say": "bg-slate-300",
};

export function DashboardClient({ data }: { data: DashboardData }) {
  const { metrics, sourcingData, funnel, domicileSplit, genderSplit } = data;

  const metricCards = [
    {
      icon: Briefcase,
      label: "Active Vacancies",
      value: metrics.activeVacancies.toLocaleString(),
      trend: { value: "Live", direction: "up" as const },
    },
    {
      icon: Users,
      label: "Total Candidates",
      value: metrics.totalCandidates.toLocaleString(),
      trend: { value: "Live", direction: "up" as const },
    },
    {
      icon: Clock,
      label: "Avg Time to Hire",
      value: metrics.avgTimeToHire,
      trend: { value: "Live", direction: "up" as const },
    },
    {
      icon: CheckCircle2,
      label: "Offer Accept Rate",
      value: metrics.offerAcceptRate,
      trend: { value: "Live", direction: "up" as const },
    },
    {
      icon: Sparkles,
      label: "Avg AI Match Score",
      value: metrics.avgAiMatchScore,
      trend: { value: "Live", direction: "up" as const },
    },
    {
      icon: DollarSign,
      label: "Cost per Hire",
      value: metrics.costPerHire,
      trend: { value: "Live", direction: "up" as const },
    },
  ];

  return (
    <div>
      <PageHeader title="Dashboard Overview" />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-6">
        {metricCards.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Sourcing chart + channel table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card
          title="Sourcing Rates by Channel"
          subtitle="Candidate volume per sourcing channel"
        >
          <div className="h-72 w-full">
            {sourcingData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sourcingData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="channel"
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="candidates" fill="#006b5f" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">
                No sourcing data yet
              </div>
            )}
          </div>
        </Card>

        <Card title="Channel Effectiveness" subtitle="Hire rate per channel">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <th className="text-left font-medium px-4 py-3 rounded-l-lg">Channel</th>
                  <th className="text-right font-medium px-4 py-3">Candidates</th>
                  <th className="text-right font-medium px-4 py-3">Hires</th>
                  <th className="text-right font-medium px-4 py-3 rounded-r-lg">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sourcingData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      No channel data yet
                    </td>
                  </tr>
                ) : (
                  sourcingData.map((row) => {
                    const rate =
                      row.candidates > 0
                        ? ((row.hires / row.candidates) * 100).toFixed(1)
                        : "0";
                    return (
                      <tr key={row.channel} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-medium text-slate-900">{row.channel}</td>
                        <td className="px-4 py-4 text-right text-slate-600">{row.candidates}</td>
                        <td className="px-4 py-4 text-right text-slate-600">{row.hires}</td>
                        <td className="px-4 py-4 text-right">
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Diversity + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Diversity Metrics" subtitle="Domicile and gender distribution">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
                Domicile
              </p>
              <div className="space-y-3">
                {domicileSplit.length === 0 ? (
                  <p className="text-sm text-slate-400">No domicile data yet</p>
                ) : (
                  domicileSplit.map((d) => (
                    <div key={d.region} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-slate-600 flex-shrink-0">
                        {d.region}
                      </span>
                      <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#006b5f]"
                          style={{ width: `${d.pct}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-sm text-slate-500">
                        {d.count} ({d.pct}%)
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
                Gender Split
              </p>
              <div className="space-y-3">
                {genderSplit.map((g) => (
                  <div key={g.label} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-slate-600 flex-shrink-0">
                      {g.label}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${genderColors[g.label] ?? "bg-slate-300"}`}
                        style={{ width: `${g.pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm text-slate-500">{g.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Hiring Pipeline Funnel" subtitle="Conversion across stages">
          <div className="space-y-4">
            {funnel.map((f, i) => {
              const widthPct = Math.max(8, (f.count / Math.max(1, funnel[0].count)) * 100);
              return (
                <div key={f.stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700">{f.stage}</span>
                    <span className="text-sm text-slate-500">
                      {f.count.toLocaleString()}{" "}
                      <span className="text-slate-400">({f.pct}%)</span>
                    </span>
                  </div>
                  <div className="h-9 rounded-lg bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center justify-end pr-3 text-xs font-semibold text-white transition-all"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor:
                          i === 0
                            ? "#1a8b82"
                            : i === funnel.length - 1
                              ? "#005248"
                              : "#006b5f",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
