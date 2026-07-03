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
import { useToast } from "@/components/ui/Toast";
import type { AnalyticsData } from "@/lib/data-access";

const dateRanges = ["7 Days", "30 Days", "90 Days", "12 Months"];

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
    </div>
  );
}
