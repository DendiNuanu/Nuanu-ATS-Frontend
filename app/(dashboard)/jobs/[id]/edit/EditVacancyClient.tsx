"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, Button, useToast } from "@/components/ui";
import { formatIDRInput, parseIDR } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import type { VacancyDetail } from "@/lib/data-access";

const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const LOCATION_TYPES = [
  { value: "onsite", label: "On-site" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On Hold" },
  { value: "closed", label: "Closed" },
];

const FALLBACK_DEPARTMENTS = [
  "Engineering",
  "Legal",
  "Human Resources",
  "Finance",
  "Marketing",
  "Operations",
];

export function EditVacancyClient({
  vacancy,
  departments,
}: {
  vacancy: VacancyDetail;
  departments: string[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deptOptions = departments.length > 0 ? departments : FALLBACK_DEPARTMENTS;

  const [form, setForm] = useState({
    title: vacancy.title,
    department: vacancy.departmentName,
    employmentType: vacancy.employmentType,
    headcount: vacancy.headcount,
    location: vacancy.location,
    locationType: vacancy.locationType,
    salaryMin: vacancy.salaryMin != null ? String(vacancy.salaryMin) : "",
    salaryMax: vacancy.salaryMax != null ? String(vacancy.salaryMax) : "",
    description: vacancy.description,
    requirements: vacancy.requirements,
    status: vacancy.status,
  });

  const update = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/vacancies/${vacancy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          departmentName: form.department,
          employmentType: form.employmentType,
          headcount: Number(form.headcount) || 1,
          location: form.location,
          locationType: form.locationType,
          salaryMin: parseIDR(form.salaryMin),
          salaryMax: parseIDR(form.salaryMax),
          description: form.description,
          requirements: form.requirements,
          status: form.status,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update vacancy (${res.status})`);
      }

      showToast("Vacancy updated successfully");
      router.push(`/jobs/${vacancy.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update vacancy");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-16 z-10 -mx-6 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/jobs/${vacancy.id}`}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-[#006b5f]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vacancy
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="font-heading text-xl font-bold text-slate-900">
            Edit Vacancy
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => router.push(`/jobs/${vacancy.id}`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-vacancy-form"
            variant="primary"
            size="md"
            disabled={submitting || !form.title.trim()}
          >
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form id="edit-vacancy-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-slate-900 mb-4">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Job Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Senior Frontend Developer"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Department</label>
              <select
                value={form.department}
                onChange={(e) => update("department", e.target.value)}
                className={inputClass}
              >
                {deptOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Employment Type</label>
              <select
                value={form.employmentType}
                onChange={(e) => update("employmentType", e.target.value)}
                className={inputClass}
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Number of Openings</label>
              <input
                type="number"
                min="1"
                value={form.headcount}
                onChange={(e) => update("headcount", e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="e.g. Bali, Indonesia"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Work Arrangement</label>
              <select
                value={form.locationType}
                onChange={(e) => update("locationType", e.target.value)}
                className={inputClass}
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Salary Range */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-slate-900 mb-4">
            Salary Range (IDR)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Minimum Salary</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatIDRInput(form.salaryMin)}
                onChange={(e) => {
                  const n = parseIDR(e.target.value);
                  update("salaryMin", n != null ? String(n) : "");
                }}
                placeholder="e.g. 5.000.000"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Maximum Salary</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatIDRInput(form.salaryMax)}
                onChange={(e) => {
                  const n = parseIDR(e.target.value);
                  update("salaryMax", n != null ? String(n) : "");
                }}
                placeholder="e.g. 10.000.000"
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        {/* Description & Requirements */}
        <Card>
          <h2 className="font-heading text-lg font-semibold text-slate-900 mb-4">
            Job Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Job Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Describe the role, responsibilities, and what the candidate will be doing..."
                className={`${inputClass} min-h-[200px] resize-y`}
              />
            </div>
            <div>
              <label className={labelClass}>Requirements</label>
              <textarea
                value={form.requirements}
                onChange={(e) => update("requirements", e.target.value)}
                placeholder="List the required skills, experience, and qualifications..."
                className={`${inputClass} min-h-[150px] resize-y`}
              />
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
