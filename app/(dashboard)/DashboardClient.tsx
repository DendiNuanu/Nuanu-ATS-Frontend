"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Card, MetricCard } from "@/components/ui";
import {
  Briefcase,
  Users,
  Clock,
  CheckCircle2,
  Sparkles,
  DollarSign,
  ArrowUpRight,
  Filter,
  Calendar,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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
import type { DashboardData, DashboardDateRange } from "@/lib/data-access";
import type { VacancyFilterOption } from "@/lib/data-access";

const genderColors: Record<string, string> = {
  Male: "bg-[#006b5f]",
  Female: "bg-blue-500",
  "Prefer not to say": "bg-slate-300",
};

const DATE_RANGE_OPTIONS: { value: DashboardDateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

export function DashboardClient({
  data,
  vacancyOptions,
  initialDateRange,
  initialVacancyId,
}: {
  data: DashboardData;
  vacancyOptions: VacancyFilterOption[];
  initialDateRange: DashboardDateRange;
  initialVacancyId: string;
}) {
  const { metrics, advancedMetrics, sourcingData, funnel, domicileSplit, genderSplit } = data;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateRange, setDateRange] = useState<DashboardDateRange>(initialDateRange);
  const [vacancyId, setVacancyId] = useState<string>(initialVacancyId);

  // Push filter changes to the URL so the server component re-fetches with
  // the new filters applied. This keeps the filter state in the URL (shareable
  // + survives refresh) and triggers Next.js server-side re-rendering.
  const applyFilters = (nextDateRange: DashboardDateRange, nextVacancyId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", nextDateRange);
    if (nextVacancyId) {
      params.set("vacancy", nextVacancyId);
    } else {
      params.delete("vacancy");
    }
    router.push(`/?${params.toString()}`);
  };

  const handleDateRangeChange = (value: DashboardDateRange) => {
    setDateRange(value);
    applyFilters(value, vacancyId);
  };

  const handleVacancyChange = (value: string) => {
    setVacancyId(value);
    applyFilters(dateRange, value);
  };

  // ── Channel Effectiveness table sorting ──────────────────────────────
  // Default is `null` (no active sort) so the table preserves the server's
  // default order (candidates descending) on page load, per the requirement.
  // Clicking a header toggles asc/desc; clicking a different header switches
  // to that column with a sensible default direction.
  type ChannelSortField = "channel" | "candidates" | "hires" | "rate";
  const [channelSortField, setChannelSortField] = useState<ChannelSortField | null>(null);
  const [channelSortDir, setChannelSortDir] = useState<"asc" | "desc">("desc");

  const handleChannelSort = (field: ChannelSortField) => {
    if (field === channelSortField) {
      setChannelSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setChannelSortField(field);
      // Sensible default: numeric columns default to desc (highest first),
      // the text column (channel) defaults to asc (A–Z).
      setChannelSortDir(field === "channel" ? "asc" : "desc");
    }
  };

  const sortedSourcingData = useMemo(() => {
    if (channelSortField === null) return sourcingData;
    const dir = channelSortDir === "asc" ? 1 : -1;
    return [...sourcingData].sort((a, b) => {
      if (channelSortField === "channel") {
        return a.channel.localeCompare(b.channel) * dir;
      }
      if (channelSortField === "rate") {
        const rateA = a.candidates > 0 ? a.hires / a.candidates : 0;
        const rateB = b.candidates > 0 ? b.hires / b.candidates : 0;
        return (rateA - rateB) * dir;
      }
      return (a[channelSortField] - b[channelSortField]) * dir;
    });
  }, [sourcingData, channelSortField, channelSortDir]);

  // ── Domicile list sorting ────────────────────────────────────────────
  // Two pieces of state:
  //   • domicileSortBy  — which field to sort by ("count" | "alpha")
  //   • domicileSortDir — direction ("asc" | "desc")
  // Clicking a button that is NOT already active switches to that field
  // with a sensible default direction (count→desc, alpha→asc). Clicking
  // the ALREADY-active button toggles the direction (asc↔desc). This gives
  // a real working toggle: Count → Highest/Lowest, A–Z → A–Z/Z–A.
  const [domicileSortBy, setDomicileSortBy] = useState<"count" | "alpha">("count");
  const [domicileSortDir, setDomicileSortDir] = useState<"asc" | "desc">("desc");

  const handleDomicileSort = (field: "count" | "alpha") => {
    if (field === domicileSortBy) {
      // Same field → flip direction.
      setDomicileSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      // New field → switch with a sensible default direction.
      setDomicileSortBy(field);
      setDomicileSortDir(field === "count" ? "desc" : "asc");
    }
  };

  const sortedDomicileSplit = useMemo(() => {
    const copy = [...domicileSplit];
    const dir = domicileSortDir === "asc" ? 1 : -1;
    if (domicileSortBy === "alpha") {
      copy.sort((a, b) => a.region.localeCompare(b.region) * dir);
    } else {
      copy.sort((a, b) => (a.count - b.count) * dir);
    }
    return copy;
  }, [domicileSplit, domicileSortBy, domicileSortDir]);

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

  // Advanced metric cards — 4 new cards in a dedicated section.
  // Yield Ratio + Avg Time-to-Fill use real data; 90-Day Retention +
  // Quality of Hire show an honest "—" placeholder when no employee has
  // reached the required tenure (with an amber "Pending" badge + hint).
  const advancedCards = useMemo(() => {
    const retentionAvailable = advancedMetrics.retention90Available;
    const qualityAvailable = advancedMetrics.qualityOfHireAvailable;
    return [
      {
        icon: Filter,
        label: "Yield Ratio",
        value: advancedMetrics.yieldRatio,
        hint: `Hires ÷ Interviewed (${advancedMetrics.yieldRatioHired}/${advancedMetrics.yieldRatioInterviewed})`,
        trend: { value: "Live", direction: "up" as const },
        badgeTone: "live" as const,
        accent: "text-[#006b5f] bg-[#e6f5f3]",
      },
      {
        icon: Clock,
        label: "Avg. Time-to-Fill",
        value: advancedMetrics.avgTimeToFill,
        hint: "Apply → Offer accepted",
        trend: { value: "Live", direction: "up" as const },
        badgeTone: "live" as const,
        accent: "text-blue-600 bg-blue-50",
      },
      {
        icon: CheckCircle2,
        label: "90-Day Retention",
        value: advancedMetrics.retention90,
        hint: retentionAvailable
          ? "New hires still active"
          : "New hires still active · awaiting 90-day tenure",
        trend: { value: retentionAvailable ? "Live" : "Pending", direction: "up" as const },
        badgeTone: retentionAvailable ? ("live" as const) : ("pending" as const),
        accent: "text-emerald-600 bg-emerald-50",
      },
      {
        icon: Sparkles,
        label: "Quality of Hire",
        value: advancedMetrics.qualityOfHire,
        hint: qualityAvailable
          ? "Retained after 6 months"
          : "Retained after 6 months · awaiting 180-day tenure",
        trend: { value: qualityAvailable ? "Live" : "Pending", direction: "up" as const },
        badgeTone: qualityAvailable ? ("live" as const) : ("pending" as const),
        accent: "text-amber-600 bg-amber-50",
      },
    ];
  }, [advancedMetrics]);

  return (
    <div>
      <PageHeader
        title="Dashboard Overview"
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Date Range filter */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Date Range
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={dateRange}
                  onChange={(e) =>
                    handleDateRangeChange(e.target.value as DashboardDateRange)
                  }
                  className="h-11 w-full sm:w-44 rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none appearance-none"
                >
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Vacancy filter */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Vacancy
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={vacancyId}
                  onChange={(e) => handleVacancyChange(e.target.value)}
                  className="h-11 w-full sm:w-52 rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none appearance-none"
                >
                  <option value="">All Vacancies</option>
                  {vacancyOptions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        }
      />

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
                  {([
                    { key: "channel", label: "Channel", align: "left" },
                    { key: "candidates", label: "Candidates", align: "right" },
                    { key: "hires", label: "Hires", align: "right" },
                    { key: "rate", label: "Rate", align: "right" },
                  ] as const).map((col, i) => {
                    const isActive = channelSortField === col.key;
                    const SortIcon =
                      !isActive
                        ? ArrowUpDown
                        : channelSortDir === "asc"
                          ? ArrowUp
                          : ArrowDown;
                    return (
                      <th
                        key={col.key}
                        className={`font-medium px-4 py-3 cursor-pointer select-none hover:text-slate-600 ${
                          col.align === "left" ? "text-left" : "text-right"
                        } ${i === 0 ? "rounded-l-lg" : ""} ${i === 3 ? "rounded-r-lg" : ""}`}
                        onClick={() => handleChannelSort(col.key)}
                      >
                        <span
                          className={`inline-flex items-center gap-1 ${
                            col.align === "right" ? "flex-row-reverse" : ""
                          }`}
                        >
                          {col.label}
                          <SortIcon
                            className={`h-3 w-3 ${isActive ? "text-slate-600" : "text-slate-300"}`}
                          />
                        </span>
                      </th>
                    );
                  })}
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
                  sortedSourcingData.map((row) => {
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
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Domicile
                </p>
                {domicileSplit.length > 0 && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleDomicileSort("count")}
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        domicileSortBy === "count"
                          ? "bg-[#006b5f] text-white"
                          : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      }`}
                      title={
                        domicileSortBy === "count"
                          ? domicileSortDir === "desc"
                            ? "Highest to Lowest (click to reverse)"
                            : "Lowest to Highest (click to reverse)"
                          : "Sort by count, Highest to Lowest"
                      }
                    >
                      {domicileSortBy === "count" ? (
                        domicileSortDir === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                      Count
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDomicileSort("alpha")}
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        domicileSortBy === "alpha"
                          ? "bg-[#006b5f] text-white"
                          : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      }`}
                      title={
                        domicileSortBy === "alpha"
                          ? domicileSortDir === "asc"
                            ? "Alphabetical A–Z (click to reverse)"
                            : "Alphabetical Z–A (click to reverse)"
                          : "Sort alphabetically, A–Z"
                      }
                    >
                      {domicileSortBy === "alpha" ? (
                        domicileSortDir === "asc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                      A–Z
                    </button>
                  </div>
                )}
              </div>
              <div key={`${domicileSortBy}-${domicileSortDir}`} className="space-y-3">
                {domicileSplit.length === 0 ? (
                  <p className="text-sm text-slate-400">No domicile data yet</p>
                ) : (
                  sortedDomicileSplit.map((d) => (
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

      {/* ── Advanced Metrics — NEW section (4 cards) ───────────────────────────
          Placed in its own row below the existing Diversity + Funnel section.
          Grid is 4 columns on xl, 2 on sm, 1 on mobile — matching the spacing
          (gap-6) of the existing metric cards row above. */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Quality & Efficiency Metrics
          </h2>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {advancedCards.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>
      </div>
    </div>
  );
}
