"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  Card,
  Avatar,
  SearchInput,
} from "@/components/ui";
import { ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";

type EmployeeOption = {
  id: string;
  name: string;
  employeeCode: string;
  position: string;
};

export function StartOnboardingClient({
  employees,
}: {
  employees: EmployeeOption[];
}) {
  const [search, setSearch] = useState("");

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Onboarding
        </Link>
      </div>

      <PageHeader
        title="Start Onboarding"
        subtitle="Select an employee to begin the onboarding process and fill in the New Hire Confirmation form."
      />

      {employees.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              All employees have onboarding records
            </h3>
            <p className="text-sm text-slate-500 max-w-md">
              There are no employees without an onboarding record. All new
              hires are already in the onboarding pipeline.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-6">
            <SearchInput
              placeholder="Search employees..."
              value={search}
              onChange={setSearch}
              className="sm:max-w-md"
            />
          </div>

          <Card noPadding className="mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                    <th className="text-left font-medium px-6 py-3">
                      Employee
                    </th>
                    <th className="text-left font-medium px-6 py-3">
                      Position
                    </th>
                    <th className="text-left font-medium px-6 py-3">
                      Employee Code
                    </th>
                    <th className="text-right font-medium px-6 py-3 w-16">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      className="group hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/onboarding/start/${e.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar name={e.name} size="md" />
                          <span className="font-medium text-slate-900 group-hover:text-[#006b5f] transition-colors">
                            {e.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <Link
                          href={`/onboarding/start/${e.id}`}
                          className="hover:text-[#006b5f] transition-colors"
                        >
                          {e.position}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {e.employeeCode}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/onboarding/start/${e.id}`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-[#006b5f] hover:bg-[#e6f5f3] transition-colors"
                          aria-label={`Start onboarding for ${e.name}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Link href="/onboarding">
              <span className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
