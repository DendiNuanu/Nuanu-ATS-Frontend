"use client";

import { useState, useCallback } from "react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  TrendingUp,
  Clock,
  Target,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  UserCheck,
  HeartHandshake,
  Award,
  Gauge,
  Briefcase,
  MapPin,
  Calendar,
  Building2,
  Zap,
} from "lucide-react";
import { Card, MetricCard, Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import type { AnalyticsData } from "@/lib/data-access";

const dateRanges = ["7 Days", "30 Days", "90 Days", "12 Months"];

const GENDER_COLORS: Record<string, string> = {
  Male: "#006b5f",
  Female: "#5eead4",
  "Prefer not to say": "#cbd5e1",
};

const AGE_COLORS = ["#006b5f", "#0d9488", "#5eead4", "#fbbf24", "#f59e0b", "#cbd5e1"];

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const { showToast } = useToast();
  const [range, setRange] = useState("30 Days");

  const handleExport = useCallback(() => {
    const escapeCell = (value: string | number): string => {
      const s = String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows: string[] = [];

    // Metrics section
    rows.push("Section,Metric,Value");
    rows.push(`Metrics,Total Applications,${data.metrics.totalApplications}`);
    rows.push(`Metrics,Hire Conversion Rate,${data.metrics.hireConversionRate}`);
    rows.push(`Metrics,Avg Time to Hire,${data.metrics.avgTimeToHire}`);
    rows.push(`Metrics,Cost per Hire,${data.metrics.costPerHire}`);
    rows.push("");

    // Sourcing data
    rows.push("Channel,Applications,Interviews,Hires,Conversion Rate");
    for (const row of data.sourcingData) {
      const convRate =
        row.applications > 0
          ? ((row.hires / row.applications) * 100).toFixed(1) + "%"
          : "0.0%";
      rows.push(
        [
          escapeCell(row.channel),
          row.applications,
          row.interviews,
          row.hires,
          convRate,
        ].join(","),
      );
    }
    rows.push("");

    // Funnel rates
    rows.push("Funnel Stage,Conversion Rate (%)");
    for (const f of data.funnelRates) {
      rows.push(`${escapeCell(f.label)},${f.value}`);
    }
    rows.push("");

    // Trend data
    rows.push("Month,Applications,Hires");
    for (const t of data.trendData) {
      rows.push(`${escapeCell(t.month)},${t.applications},${t.hires}`);
    }

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Analytics exported as CSV", "success");
  }, [data, showToast]);

  const metrics = [
    {
      label: "Total Applications",
      value: data.metrics.totalApplications.toLocaleString(),
      icon: Users,
    },
    {
      label: "Hire Conversion Rate",
      value: data.metrics.hireConversionRate,
      icon: Target,
    },
    {
      label: "Avg Time to Hire",
      value: data.metrics.avgTimeToHire,
      icon: Clock,
    },
    {
      label: "Cost per Hire",
      value: data.metrics.costPerHire,
      icon: TrendingUp,
    },
  ];

  const overallConversion = data.metrics.hireConversionRate;

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
          <Button
            variant="secondary"
            size="md"
            onClick={handleExport}
            icon={<Download className="h-4 w-4" />}
          >
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
          {data.sourcingData.length === 0 ? (
            <div className="flex h-72 w-full items-center justify-center text-sm text-slate-400">
              No sourcing data available yet.
            </div>
          ) : (
            <>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.sourcingData} barGap={4}>
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
            </>
          )}
        </Card>

        {/* Mini funnel metrics */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-slate-900">
            Conversion Funnel
          </h2>
          <p className="mb-6 text-sm text-slate-500">Stage-to-stage rates</p>
          <div className="space-y-5">
            {data.funnelRates.map((m) => (
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
              {overallConversion}
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
        {data.trendData.every((t) => t.applications === 0 && t.hires === 0) ? (
          <div className="flex h-64 w-full items-center justify-center text-sm text-slate-400">
            No trend data available yet.
          </div>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trendData}>
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
          </>
        )}
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
        {data.sourcingData.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No channel data available yet.
          </div>
        ) : (
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
                {data.sourcingData.map((row) => {
                  const convRate =
                    row.applications > 0
                      ? ((row.hires / row.applications) * 100).toFixed(1)
                      : "0.0";
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
        )}
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          NEW SECTIONS BELOW — strictly additive, matching existing card style
         ═══════════════════════════════════════════════════════════════════════ */}

      {/* Sourcing Rate Mini-Cards (Referral / LinkedIn / SEEK) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50">
              <UserCheck className="h-5 w-5 text-[#006b5f]" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Referral Hiring Rate
              </p>
              <p className="font-heading text-xl font-bold text-slate-900">
                {data.sourcingRates.referralRate}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {data.sourcingRates.referralHires} of {data.sourcingRates.totalHires} hires from employee referrals
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
              <Briefcase className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                LinkedIn Hiring Rate
              </p>
              <p className="font-heading text-xl font-bold text-slate-900">
                {data.sourcingRates.linkedinRate}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {data.sourcingRates.linkedinHires} of {data.sourcingRates.totalHires} hires sourced from LinkedIn
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Target className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                SEEK Hiring Rate
              </p>
              <p className="font-heading text-xl font-bold text-slate-900">
                {data.sourcingRates.seekRate}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {data.sourcingRates.seekHires} of {data.sourcingRates.totalHires} hires sourced from SEEK
          </p>
        </Card>
      </div>

      {/* Full Pipeline Funnel (replaces simplified 3-stage view) */}
      <Card>
        <div className="mb-4">
          <h2 className="font-heading text-lg font-semibold text-slate-900">
            Recruitment Pipeline Funnel
          </h2>
          <p className="text-sm text-slate-500">
            Candidate count at each pipeline stage with drop-off rates
          </p>
        </div>
        {data.pipelineFunnel.every((s) => s.count === 0) ? (
          <div className="flex h-48 w-full items-center justify-center text-sm text-slate-400">
            No pipeline data available yet.
          </div>
        ) : (
          <div className="space-y-3">
            {data.pipelineFunnel.map((stage, i) => (
              <div key={stage.stage}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      {stage.stage}
                    </span>
                    {stage.dropOff != null && stage.dropOff > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                        <ArrowDownRight className="h-3 w-3" />
                        {stage.dropOff}% drop-off
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {stage.count}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${stage.pct}%`,
                      backgroundColor: AGE_COLORS[i % AGE_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Offer & Retention Section */}
      <div>
        <div className="mb-3">
          <h2 className="font-heading text-lg font-semibold text-slate-900">
            Offer & Retention
          </h2>
          <p className="text-sm text-slate-500">
            Offer acceptance and new-hire retention metrics
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50">
                <HeartHandshake className="h-5 w-5 text-[#006b5f]" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Offer Acceptance Rate
                </p>
                <p className="font-heading text-xl font-bold text-slate-900">
                  {data.offerRetention.offerAcceptRate}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {data.offerRetention.acceptedOffers} of {data.offerRetention.totalOffersSent} offers accepted
            </p>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                <UserCheck className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  90-Day Retention
                </p>
                <p className="font-heading text-xl font-bold text-slate-900">
                  {data.offerRetention.retention90}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {data.offerRetention.retention90Available
                ? "New hires retained during first 90 days"
                : "Not enough historical data"}
            </p>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Quality of Hire
                </p>
                <p className="font-heading text-xl font-bold text-slate-900">
                  {data.offerRetention.qualityOfHire}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {data.offerRetention.qualityOfHireAvailable
                ? "Employees retained after 6 months"
                : "Not enough historical data"}
            </p>
          </Card>
        </div>
      </div>

      {/* Hiring Speed Summary + Yield Ratio */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#006b5f]" />
            <div>
              <h2 className="font-heading text-lg font-semibold text-slate-900">
                Hiring Speed Summary
              </h2>
              <p className="text-sm text-slate-500">
                Key speed indicators across all hiring
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Users className="h-3.5 w-3.5" />
                Total Hires
              </div>
              <p className="mt-1 font-heading text-2xl font-bold text-slate-900">
                {data.hiringSpeed.totalHires}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Zap className="h-3.5 w-3.5" />
                Fastest Hire
              </div>
              <p className="mt-1 font-heading text-2xl font-bold text-slate-900">
                {data.hiringSpeed.fastestHireDays != null
                  ? `${data.hiringSpeed.fastestHireDays}d`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                Peak Month
              </div>
              <p className="mt-1 font-heading text-2xl font-bold text-slate-900">
                {data.hiringSpeed.peakHiringMonth ?? "—"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Building2 className="h-3.5 w-3.5" />
                Top Dept (Hires)
              </div>
              <p className="mt-1 font-heading text-lg font-bold text-slate-900 truncate">
                {data.hiringSpeed.departmentWithMostHires ?? "—"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Briefcase className="h-3.5 w-3.5" />
                Open Roles
              </div>
              <p className="mt-1 font-heading text-2xl font-bold text-slate-900">
                {data.hiringSpeed.openRoles}
              </p>
            </div>
          </div>
        </Card>

        {/* Yield Ratio Card */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-[#006b5f]" />
            <div>
              <h2 className="font-heading text-lg font-semibold text-slate-900">
                Yield Ratio
              </h2>
              <p className="text-sm text-slate-500">Hires ÷ Interviewed</p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Conversion Rate
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-[#006b5f]">
              {data.yieldRatio.value}
            </p>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Hired</span>
              <span className="font-semibold text-slate-900">
                {data.yieldRatio.hired}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Interviewed</span>
              <span className="font-semibold text-slate-900">
                {data.yieldRatio.interviewed}
              </span>
            </div>
            {!data.yieldRatio.available && (
              <p className="pt-1 text-xs text-slate-400">
                No interview data available yet.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Department Breakdown Table */}
      <Card>
        <div className="mb-4">
          <h2 className="font-heading text-lg font-semibold text-slate-900">
            Department Breakdown
          </h2>
          <p className="text-sm text-slate-500">
            Hiring activity and conversion by department
          </p>
        </div>
        {data.departmentBreakdown.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No department data available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Department
                  </th>
                  <th className="pb-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Open Roles
                  </th>
                  <th className="pb-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Applications
                  </th>
                  <th className="pb-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hires
                  </th>
                  <th className="pb-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Avg. Time-to-Fill
                  </th>
                  <th className="pb-3 pl-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Conv. Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.departmentBreakdown.map((row) => (
                  <tr key={row.department} className="hover:bg-slate-50">
                    <td className="py-3.5 pr-4">
                      <span className="font-medium text-slate-900">
                        {row.department}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-700">
                      {row.openRoles}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-700">
                      {row.applications}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                      {row.hires}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-700">
                      {row.avgTimeToFill}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {row.conversionRate}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Diversity Metrics Section */}
      <div>
        <div className="mb-3">
          <h2 className="font-heading text-lg font-semibold text-slate-900">
            Diversity Metrics
          </h2>
          <p className="text-sm text-slate-500">
            Domicile, gender, and age distribution of candidates
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Domicile Distribution */}
          <Card className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#006b5f]" />
              <h3 className="font-heading text-base font-semibold text-slate-900">
                Location / Domicile Distribution
              </h3>
            </div>
            {data.diversity.domicile.length === 0 ? (
              <div className="flex h-48 w-full items-center justify-center text-sm text-slate-400">
                No domicile data available yet.
              </div>
            ) : (
              <div className="space-y-3">
                {data.diversity.domicile.map((d) => (
                  <div key={d.region} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-slate-600 flex-shrink-0 truncate">
                      {d.region}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#006b5f]"
                        style={{ width: `${Math.max(2, d.pct)}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-sm text-slate-500">
                      {d.count} ({d.pct}%)
                    </span>
                  </div>
                ))}
                {data.diversity.domicileAdditional > 0 && (
                  <p className="pt-1 text-xs text-slate-400">
                    +{data.diversity.domicileAdditional} additional locations
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Gender Distribution Donut */}
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#006b5f]" />
              <h3 className="font-heading text-base font-semibold text-slate-900">
                Gender Distribution
              </h3>
            </div>
            {data.diversity.totalProfiles === 0 ? (
              <div className="flex h-48 w-full items-center justify-center text-sm text-slate-400">
                No gender data available yet.
              </div>
            ) : (
              <>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.diversity.gender}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {data.diversity.gender.map((entry) => (
                          <Cell
                            key={entry.label}
                            fill={GENDER_COLORS[entry.label] ?? "#cbd5e1"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          fontSize: 13,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-2">
                  {data.diversity.gender.map((g) => (
                    <div
                      key={g.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2 text-slate-600">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              GENDER_COLORS[g.label] ?? "#cbd5e1",
                          }}
                        />
                        {g.label}
                      </span>
                      <span className="text-slate-500">
                        {g.count} ({g.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Age Group Distribution Bar Chart */}
        <Card className="mt-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-[#006b5f]" />
            <h3 className="font-heading text-base font-semibold text-slate-900">
              Age Group Distribution
            </h3>
          </div>
          {data.diversity.totalProfiles === 0 ? (
            <div className="flex h-48 w-full items-center justify-center text-sm text-slate-400">
              No age data available yet.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.diversity.ageGroups}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
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
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.diversity.ageGroups.map((_, i) => (
                      <Cell
                        key={i}
                        fill={AGE_COLORS[i % AGE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Gender and age are collected optionally. Candidates may choose
            &ldquo;Prefer not to say&rdquo; or leave date of birth blank. This
            data is used solely for internal diversity and inclusive hiring
            analytics.
          </p>
        </Card>
      </div>
    </div>
  );
}
