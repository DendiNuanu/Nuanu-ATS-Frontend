"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  Users,
  TrendingUp,
  Clock,
  Target,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, MetricCard, Button } from "@/components/ui";

const dateRanges = ["7 Days", "30 Days", "90 Days", "12 Months"];

const metrics = [
  {
    label: "Total Applications",
    value: "1,284",
    trend: { value: "+12.5%", direction: "up" as const },
    icon: Users,
  },
  {
    label: "Hire Conversion Rate",
    value: "8.4%",
    trend: { value: "+2.1%", direction: "up" as const },
    icon: Target,
  },
  {
    label: "Avg Time to Hire",
    value: "23 days",
    trend: { value: "-3 days", direction: "up" as const },
    icon: Clock,
  },
  {
    label: "Cost per Hire",
    value: "Rp 4.2M",
    trend: { value: "-5.2%", direction: "up" as const },
    icon: TrendingUp,
  },
];

const sourcingData = [
  { channel: "LinkedIn", applications: 412, interviews: 78, hires: 14 },
  { channel: "JobStreet", applications: 318, interviews: 52, hires: 9 },
  { channel: "Referral", applications: 156, interviews: 41, hires: 11 },
  { channel: "Company Website", applications: 198, interviews: 35, hires: 7 },
  { channel: "Instagram", applications: 124, interviews: 18, hires: 3 },
  { channel: "Job Fair", applications: 76, interviews: 12, hires: 2 },
];

const trendData = [
  { month: "Jan", applications: 84, hires: 6 },
  { month: "Feb", applications: 102, hires: 8 },
  { month: "Mar", applications: 128, hires: 11 },
  { month: "Apr", applications: 96, hires: 7 },
  { month: "May", applications: 142, hires: 12 },
  { month: "Jun", applications: 118, hires: 9 },
  { month: "Jul", applications: 156, hires: 14 },
  { month: "Aug", applications: 134, hires: 10 },
  { month: "Sep", applications: 168, hires: 13 },
  { month: "Oct", applications: 124, hires: 8 },
  { month: "Nov", applications: 92, hires: 6 },
  { month: "Dec", applications: 78, hires: 5 },
];

const miniMetrics = [
  { label: "Application → Screen", value: 68, color: "bg-teal-600" },
  { label: "Screen → Interview", value: 42, color: "bg-indigo-500" },
  { label: "Interview → Offer", value: 28, color: "bg-amber-500" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState("30 Days");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Recruitment performance insights and trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {dateRanges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  range === r
                    ? "bg-[#006b5f] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="md">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            icon={m.icon}
            trend={m.trend}
          />
        ))}
      </div>

      {/* Sourcing & Channel Analytics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Large bar chart */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-semibold text-slate-900">
                Applications by Channel
              </h2>
              <p className="text-sm text-slate-500">
                Volume across sourcing channels ({range.toLowerCase()})
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourcingData} barGap={4}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="channel"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="applications" fill="#006b5f" radius={[6, 6, 0, 0]} />
                <Bar dataKey="interviews" fill="#5eead4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="hires" fill="#fbbf24" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center gap-6 text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#006b5f]" />
              Applications
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#5eead4]" />
              Interviews
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
              Hires
            </span>
          </div>
        </Card>

        {/* Mini funnel metrics */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-slate-900">
            Conversion Funnel
          </h2>
          <p className="mb-6 text-sm text-slate-500">Stage-to-stage rates</p>
          <div className="space-y-5">
            {miniMetrics.map((m) => (
              <div key={m.label}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {m.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {m.value}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${m.color}`}
                    style={{ width: `${m.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Overall Conversion
            </p>
            <p className="mt-1 font-heading text-2xl font-bold text-[#006b5f]">
              8.4%
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Application → Hire
            </p>
          </div>
        </Card>
      </div>

      {/* Trend Line Chart */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-slate-900">
              Hiring Trend
            </h2>
            <p className="text-sm text-slate-500">
              Monthly applications vs hires over the past year
            </p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              />
              <Line
                type="monotone"
                dataKey="applications"
                stroke="#006b5f"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#006b5f" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="hires"
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#fbbf24" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center gap-6 text-xs text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#006b5f]" />
            Applications
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
            Hires
          </span>
        </div>
      </Card>

      {/* Recruitment Channel Effectiveness Table */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-slate-900">
              Recruitment Channel Effectiveness
            </h2>
            <p className="text-sm text-slate-500">
              Detailed breakdown by sourcing channel
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Channel
                </th>
                <th className="pb-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Applications
                </th>
                <th className="pb-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Interviews
                </th>
                <th className="pb-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hires
                </th>
                <th className="pb-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Conv. Rate
                </th>
                <th className="pb-3 pl-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sourcingData.map((row) => {
                const convRate = ((row.hires / row.applications) * 100).toFixed(1);
                const isPositive = parseFloat(convRate) >= 5;
                return (
                  <tr key={row.channel} className="hover:bg-slate-50">
                    <td className="py-3.5 pr-4">
                      <span className="font-medium text-slate-900">
                        {row.channel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-700">
                      {row.applications}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-700">
                      {row.interviews}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                      {row.hires}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isPositive
                            ? "bg-teal-50 text-teal-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {convRate}%
                      </span>
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      {isPositive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-600">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Up
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                          <ArrowDownRight className="h-3.5 w-3.5" />
                          Flat
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
