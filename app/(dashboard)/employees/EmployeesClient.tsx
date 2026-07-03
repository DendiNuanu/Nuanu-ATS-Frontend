"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  Card,
  StatusPill,
  Avatar,
  SearchInput,
} from "@/components/ui";
import type { Employee } from "@/lib/mock-data";

export function EmployeesClient({
  initialEmployees,
}: {
  initialEmployees: Employee[];
}) {
  const [search, setSearch] = useState("");

  const filtered = initialEmployees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage your organization's employee records."
      />

      <div className="mb-6">
        <SearchInput
          placeholder="Search employees..."
          value={search}
          onChange={setSearch}
          className="sm:max-w-md"
        />
      </div>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th className="text-left font-medium px-6 py-3">Employee</th>
                <th className="text-left font-medium px-6 py-3">Position</th>
                <th className="text-left font-medium px-6 py-3">Department</th>
                <th className="text-left font-medium px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
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
