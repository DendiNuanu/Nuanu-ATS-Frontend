"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Card,
  Button,
  Avatar,
  SearchInput,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Rocket, CheckCircle2 } from "lucide-react";

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
  const router = useRouter();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(search.toLowerCase()),
  );

  const handleStart = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start onboarding");
      }
      showToast("Onboarding started successfully!", "success");
      router.push("/onboarding");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to start onboarding",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
        subtitle="Select an employee to begin the onboarding process."
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
                    <th className="text-left font-medium px-6 py-3 w-8"></th>
                    <th className="text-left font-medium px-6 py-3">
                      Employee
                    </th>
                    <th className="text-left font-medium px-6 py-3">
                      Position
                    </th>
                    <th className="text-left font-medium px-6 py-3">
                      Employee Code
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedId === e.id
                          ? "bg-[#e6f5f3]"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="h-4 w-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
                          {selectedId === e.id && (
                            <div className="h-2 w-2 rounded-full bg-[#006b5f]" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={e.name} size="md" />
                          <span className="font-medium text-slate-900">
                            {e.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{e.position}</td>
                      <td className="px-6 py-4 text-slate-400">
                        {e.employeeCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Link href="/onboarding">
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </Link>
            <Button
              onClick={handleStart}
              disabled={!selectedId || submitting}
              icon={<Rocket className="h-4 w-4" />}
            >
              {submitting ? "Starting..." : "Start Onboarding"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
