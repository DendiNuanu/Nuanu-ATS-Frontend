"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, Card, MetricCard, SearchInput, EmptyState, Button } from "@/components/ui";
import { Rocket, UserPlus, CheckCircle2, Clock, Trash2, Loader2, AlertTriangle } from "lucide-react";
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
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("All");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/onboarding/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "Failed to delete record");
        setDeletingId(null);
        return;
      }
      setConfirmId(null);
      setDeletingId(null);
      router.refresh();
    } catch {
      setDeleteError("Network error. Please try again.");
      setDeletingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Onboarding"
        subtitle="Track new hire onboarding progress."
        actions={
          <Link href="/onboarding/start">
            <Button icon={<Rocket className="h-4 w-4" />}>
              Start Onboarding
            </Button>
          </Link>
        }
      />

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

      {deleteError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Records table or empty state */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Rocket}
            title="No onboarding records"
            description="There are no onboarding records matching your filters. Start onboarding a new hire to see them here."
            ctaLabel="Start Onboarding"
            onCta={() => router.push("/onboarding/start")}
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
                  <th className="px-6 py-3 text-right font-semibold">Actions</th>
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
                    <td className="px-6 py-4 text-right">
                      {confirmId === r.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Delete?
                          </span>
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={deletingId === r.id}
                            className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            {deletingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Yes"
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setConfirmId(null);
                              setDeleteError(null);
                            }}
                            disabled={deletingId === r.id}
                            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(r.id)}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete onboarding record"
                          aria-label="Delete onboarding record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
