"use client";

import { useState } from "react";
import { PageHeader, Card, MetricCard, SearchInput, EmptyState } from "@/components/ui";
import { Rocket, UserPlus, CheckCircle2, Clock } from "lucide-react";

const statusFilters = ["All", "In Progress", "Completed", "Pending"] as const;

export default function OnboardingPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("All");

  return (
    <div>
      <PageHeader title="Onboarding" subtitle="Track new hire onboarding progress." />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard icon={UserPlus} label="New Hires" value="8" trend={{ value: "+2", direction: "up" }} />
        <MetricCard icon={Clock} label="In Progress" value="5" accent="text-amber-600 bg-amber-50" />
        <MetricCard icon={CheckCircle2} label="Completed" value="3" trend={{ value: "+1", direction: "up" }} accent="text-emerald-600 bg-emerald-50" />
        <MetricCard icon={Rocket} label="Avg Onboarding" value="14 days" trend={{ value: "-2 days", direction: "up" }} />
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

      {/* Empty state */}
      <Card>
        <EmptyState
          icon={Rocket}
          title="No onboarding records"
          description="There are no onboarding records matching your filters. Start onboarding a new hire to see them here."
          ctaLabel="Start Onboarding"
          onCta={() => console.log("start")}
        />
      </Card>
    </div>
  );
}
