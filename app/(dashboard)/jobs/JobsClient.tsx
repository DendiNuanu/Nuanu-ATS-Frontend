"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  Card,
  StatusPill,
  Button,
  SearchInput,
} from "@/components/ui";
import type { Job } from "@/lib/mock-data";
import { Plus, SlidersHorizontal, MapPin, Users, Briefcase, Pencil } from "lucide-react";

const statusFilters = ["All", "Open", "On Hold", "Closed", "Draft"] as const;

export function JobsClient({ initialJobs }: { initialJobs: Job[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("All");

  const filtered = initialJobs.filter((j) => {
    const matchesSearch =
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.department.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "All" || j.status === status;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <PageHeader
        title="Jobs & Vacancies"
        subtitle="Manage open requisitions and track hiring progress."
        actions={
          <Link href="/jobs/create">
            <Button icon={<Plus className="h-4 w-4" />}>
              Create Vacancy
            </Button>
          </Link>
        }
      />

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SearchInput
          placeholder="Search jobs by title or department..."
          value={search}
          onChange={setSearch}
          className="sm:max-w-md"
        />
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
          <SlidersHorizontal className="h-4 w-4 text-slate-400 flex-shrink-0" />
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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((job) => {
          const progress = Math.round((job.hiredCount / job.openings) * 100);
          return (
            <Card key={job.id} className="flex flex-col gap-4 group relative">
              {/* Edit icon — top right */}
              <Link
                href={`/jobs/${job.id}/edit`}
                className="absolute top-3 right-3 z-10 h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#006b5f] transition-colors"
                aria-label="Edit vacancy"
              >
                <Pencil className="h-4 w-4" />
              </Link>

              <Link href={`/jobs/${job.id}`} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3 pr-10">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-xl bg-[#e6f5f3] flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-5 w-5 text-[#006b5f]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 font-heading leading-snug group-hover:text-[#006b5f] transition-colors">
                      {job.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {job.department} · {job.employmentType}
                    </p>
                  </div>
                </div>
                <StatusPill status={job.status} />
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {job.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {job.candidateCount} candidates
                </span>
              </div>

              {/* Hire progress */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Hire Progress
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {job.hiredCount}/{job.openings} hired
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#006b5f]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  Posted{" "}
                  {new Date(job.postedDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {job.seekBadge && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    SEEK
                  </span>
                )}
              </div>
              </Link>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="text-center py-16">
          <p className="text-sm text-slate-500">No jobs match your filters.</p>
        </Card>
      )}
    </div>
  );
}
