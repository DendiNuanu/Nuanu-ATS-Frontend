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

const metrics = [
  {
    icon: Briefcase,
    label: "Active Vacancies",
    value: "24",
    trend: { value: "+3", direction: "up" as const },
  },
  {
    icon: Users,
    label: "Total Candidates",
    value: "1,284",
    trend: { value: "+12%", direction: "up" as const },
  },
  {
    icon: Clock,
    label: "Avg Time to Hire",
    value: "21 days",
    trend: { value: "-4 days", direction: "up" as const },
  },
  {
    icon: CheckCircle2,
    label: "Offer Accept Rate",
    value: "87%",
    trend: { value: "+5%", direction: "up" as const },
  },
  {
    icon: Sparkles,
    label: "Avg AI Match Score",
    value: "82",
    trend: { value: "+3", direction: "up" as const },
  },
  {
    icon: DollarSign,
    label: "Cost per Hire",
    value: "Rp 8.4M",
    trend: { value: "-6%", direction: "up" as const },
  },
];

const sourcingData = [
  { channel: "SEEK", candidates: 540, hires: 18 },
  { channel: "Referral", candidates: 210, hires: 22 },
  { channel: "LinkedIn", candidates: 280, hires: 9 },
  { channel: "Direct", candidates: 150, hires: 6 },
  { channel: "Job Fair", candidates: 74, hires: 3 },
  { channel: "Website", candidates: 30, hires: 2 },
];

const channelRows = [
  { channel: "SEEK", candidates: 540, hires: 18, rate: "3.3%", cost: "Rp 4.2M" },
  { channel: "Referral", candidates: 210, hires: 22, rate: "10.5%", cost: "Rp 1.1M" },
  { channel: "LinkedIn", candidates: 280, hires: 9, rate: "3.2%", cost: "Rp 6.8M" },
  { channel: "Direct", candidates: 150, hires: 6, rate: "4.0%", cost: "Rp 0.5M" },
  { channel: "Job Fair", candidates: 74, hires: 3, rate: "4.1%", cost: "Rp 2.0M" },
];

const domicileSplit = [
  { region: "Jakarta", count: 540, pct: 42 },
  { region: "Bandung", count: 280, pct: 22 },
  { region: "Surabaya", count: 190, pct: 15 },
  { region: "Yogyakarta", count: 140, pct: 11 },
  { region: "Others", count: 134, pct: 10 },
];

const genderSplit = [
  { label: "Male", pct: 58, color: "bg-[#006b5f]" },
  { label: "Female", pct: 40, color: "bg-blue-500" },
  { label: "Prefer not to say", pct: 2, color: "bg-slate-300" },
];

const funnel = [
  { stage: "Applied", count: 1284, pct: 100 },
  { stage: "Screening", count: 642, pct: 50 },
  { stage: "Interview", count: 218, pct: 17 },
  { stage: "Offer", count: 64, pct: 5 },
  { stage: "Hired", count: 58, pct: 4.5 },
];

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard Overview"
        subtitle="Recruitment activity summary for the last 30 days."
      />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-6">
        {metrics.map((m) => (
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
          </div>
        </Card>

        <Card title="Channel Effectiveness" subtitle="Hire rate and cost per channel">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <th className="text-left font-medium px-4 py-3 rounded-l-lg">Channel</th>
                  <th className="text-right font-medium px-4 py-3">Candidates</th>
                  <th className="text-right font-medium px-4 py-3">Hires</th>
                  <th className="text-right font-medium px-4 py-3">Rate</th>
                  <th className="text-right font-medium px-4 py-3 rounded-r-lg">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {channelRows.map((row) => (
                  <tr key={row.channel} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{row.channel}</td>
                    <td className="px-4 py-4 text-right text-slate-600">{row.candidates}</td>
                    <td className="px-4 py-4 text-right text-slate-600">{row.hires}</td>
                    <td className="px-4 py-4 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {row.rate}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600">{row.cost}</td>
                  </tr>
                ))}
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
                {domicileSplit.map((d) => (
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
                ))}
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
                        className={`h-full rounded-full ${g.color}`}
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
              const widthPct = Math.max(8, (f.count / funnel[0].count) * 100);
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
