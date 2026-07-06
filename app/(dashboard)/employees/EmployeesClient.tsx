"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  PageHeader,
  Card,
  StatusPill,
  Avatar,
  SearchInput,
  Button,
  useToast,
} from "@/components/ui";
import type { Employee } from "@/lib/mock-data";
import { formatDateWita } from "@/lib/format-wita";
import { Download, Check, X, Clock } from "lucide-react";

type StatusFilter = "All" | "Active" | "On Leave" | "Probation" | "Resigned";

const STATUS_OPTIONS: StatusFilter[] = [
  "All",
  "Active",
  "On Leave",
  "Probation",
  "Resigned",
];

/**
 * Calculates the number of days until the given ISO date.
 * Returns a negative number if the date has already passed.
 */
function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  const now = new Date();
  // Zero out time portions for a clean day-level diff
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const diffMs = targetDay.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Renders a retention check cell with "Due in Xd" text and Yes/No toggle buttons.
 * The toggle is functional — it PATCHes the API and updates local state.
 */
function CheckCell({
  employeeId,
  retained,
  dueAt,
  checkType,
  onToggle,
}: {
  employeeId: string;
  retained: boolean | null;
  dueAt: string | null;
  checkType: "90" | "180";
  onToggle: (employeeId: string, checkType: "90" | "180", retained: boolean) => void;
}) {
  const days = daysUntil(dueAt);

  // If the check has already been completed (retained is true or false), show the result
  if (retained === true) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-md">
          <Check className="h-3 w-3" />
          Yes
        </span>
        <button
          onClick={() => onToggle(employeeId, checkType, false)}
          className="text-xs text-slate-400 hover:text-red-600 transition-colors"
          title="Mark as not retained"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (retained === false) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-md">
          <X className="h-3 w-3" />
          No
        </span>
        <button
          onClick={() => onToggle(employeeId, checkType, true)}
          className="text-xs text-slate-400 hover:text-green-600 transition-colors"
          title="Mark as retained"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Not yet completed — show due date + toggle buttons
  const dueLabel =
    days !== null
      ? days < 0
        ? `Overdue ${Math.abs(days)}d`
        : days === 0
          ? "Due today"
          : `Due in ${days}d`
      : "—";

  const dueColor =
    days !== null && days < 0
      ? "text-red-600"
      : days !== null && days <= 7
        ? "text-amber-600"
        : "text-slate-500";

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 text-xs ${dueColor}`}>
        <Clock className="h-3 w-3" />
        {dueLabel}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onToggle(employeeId, checkType, true)}
          className="inline-flex items-center justify-center h-6 w-6 rounded border border-green-300 text-green-600 hover:bg-green-50 transition-colors"
          title="Mark as retained (Yes)"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onToggle(employeeId, checkType, false)}
          className="inline-flex items-center justify-center h-6 w-6 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          title="Mark as not retained (No)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function EmployeesClient({
  initialEmployees,
}: {
  initialEmployees: Employee[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const { showToast } = useToast();

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.position.toLowerCase().includes(search.toLowerCase()) ||
        e.department.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "All" || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [employees, search, statusFilter]);

  const handleToggleCheck = useCallback(
    async (employeeId: string, checkType: "90" | "180", retained: boolean) => {
      // Optimistic update
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? checkType === "90"
              ? { ...e, retained90: retained }
              : { ...e, retained180: retained }
            : e,
        ),
      );

      try {
        const res = await fetch(`/api/employees/${employeeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkType, retained }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update check status");
        }

        showToast(
          `${checkType === "90" ? "90-day" : "6-month"} check updated successfully`,
        );
      } catch (error) {
        // Revert on error
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === employeeId
              ? checkType === "90"
                ? { ...e, retained90: !retained ? null : retained }
                : { ...e, retained180: !retained ? null : retained }
              : e,
          ),
        );
        showToast(
          error instanceof Error
            ? error.message
            : "Failed to update check status",
          "error",
        );
      }
    },
    [showToast],
  );

  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) {
      showToast("No employees to export", "info");
      return;
    }

    const headers = [
      "Employee ID",
      "Name",
      "Position",
      "Department",
      "Status",
      "Start Date",
      "90-Day Check",
      "90-Day Due Date",
      "6-Month Check",
      "6-Month Due Date",
    ];

    const escapeCell = (value: string): string => {
      const str = String(value ?? "");
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatDate = (iso: string): string => {
      try {
        return formatDateWita(iso);
      } catch {
        return iso;
      }
    };

    const checkLabel = (retained: boolean | null): string => {
      if (retained === true) return "Yes";
      if (retained === false) return "No";
      return "Pending";
    };

    const csvLines = [
      headers.map(escapeCell).join(","),
      ...filtered.map((e) =>
        [
          e.employeeId,
          e.name,
          e.position,
          e.department,
          e.status,
          formatDate(e.joinDate),
          checkLabel(e.retained90),
          e.check90DueAt ? formatDate(e.check90DueAt) : "",
          checkLabel(e.retained180),
          e.check180DueAt ? formatDate(e.check180DueAt) : "",
        ]
          .map(escapeCell)
          .join(","),
      ),
    ];

    const csv = csvLines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `employees-export-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${filtered.length} employees to CSV`);
  }, [filtered, showToast]);

  return (
    <div>
      <PageHeader
        title="Employee Database"
        subtitle={`${employees.length} employees · Candidates converted after hiring`}
        actions={
          <Button
            variant="secondary"
            size="md"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SearchInput
          placeholder="Search employees..."
          value={search}
          onChange={setSearch}
          className="sm:max-w-md"
        />
        <div className="relative sm:max-w-[200px]">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as StatusFilter)
            }
            className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Status" : s}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th className="text-left font-medium px-6 py-3">Employee</th>
                <th className="text-left font-medium px-6 py-3">Position</th>
                <th className="text-left font-medium px-6 py-3">Department</th>
                <th className="text-left font-medium px-6 py-3">Start Date</th>
                <th className="text-left font-medium px-6 py-3">90-Day Check</th>
                <th className="text-left font-medium px-6 py-3">6-Month Check</th>
                <th className="text-left font-medium px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/employees/${e.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar name={e.name} size="md" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{e.name}</p>
                        <p className="text-xs text-slate-400">{e.employeeId}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <Link href={`/employees/${e.id}`} className="block">
                      {e.position}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <Link href={`/employees/${e.id}`} className="block">
                      {e.department}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                    {formatDateWita(e.joinDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <CheckCell
                      employeeId={e.id}
                      retained={e.retained90}
                      dueAt={e.check90DueAt}
                      checkType="90"
                      onToggle={handleToggleCheck}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <CheckCell
                      employeeId={e.id}
                      retained={e.retained180}
                      dueAt={e.check180DueAt}
                      checkType="180"
                      onToggle={handleToggleCheck}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/employees/${e.id}`} className="inline-block">
                      <StatusPill status={e.status} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-slate-400">
          No employees found.
        </div>
      )}
    </div>
  );
}
