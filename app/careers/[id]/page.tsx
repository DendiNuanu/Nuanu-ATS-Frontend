import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchVacancyById } from "@/lib/data-access";
import { formatIDR } from "@/lib/utils";
import {
  Briefcase,
  MapPin,
  Users,
  Building2,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

// Always render fresh vacancy data — never serve a stale cached page.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Job Details — Nuanu Careers",
  description: "View job details and apply at Nuanu.",
};

const employmentLabel: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};

const locationLabel: Record<string, string> = {
  onsite: "On-site",
  remote: "Remote",
  hybrid: "Hybrid",
};

export default async function CareerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const vacancy = await fetchVacancyById(id);
  if (!vacancy) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <a href="/careers" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#006b5f] flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="font-heading text-lg font-bold text-slate-900">
              Nuanu
            </span>
          </a>
          <a
            href="/careers"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#006b5f] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Positions
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Job header */}
        <div className="rounded-xl border border-slate-200 bg-white p-8 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="h-14 w-14 rounded-xl bg-[#e6f5f3] flex items-center justify-center flex-shrink-0">
              <Briefcase className="h-7 w-7 text-[#006b5f]" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-bold text-slate-900">
                {vacancy.title}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {vacancy.departmentName} ·{" "}
                {employmentLabel[vacancy.employmentType] ??
                  vacancy.employmentType}{" "}
                ·{" "}
                {locationLabel[vacancy.locationType] ?? vacancy.locationType}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-6">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-slate-400" />
              {vacancy.departmentName}
            </span>
            {vacancy.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                {vacancy.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-400" />
              {vacancy.headcount}{" "}
              {vacancy.headcount === 1 ? "opening" : "openings"}
            </span>
          </div>

          {/* Salary */}
          {vacancy.salaryMin != null || vacancy.salaryMax != null ? (
            <div className="rounded-lg bg-[#e6f5f3] px-4 py-3 mb-6">
              <p className="text-xs font-medium uppercase tracking-wide text-[#006b5f] mb-1">
                Salary Range
              </p>
              <p className="text-lg font-bold text-slate-900">
                {vacancy.salaryMin != null && vacancy.salaryMax != null
                  ? `${formatIDR(vacancy.salaryMin)} – ${formatIDR(vacancy.salaryMax)}`
                  : vacancy.salaryMin != null
                    ? `From ${formatIDR(vacancy.salaryMin)}`
                    : `Up to ${formatIDR(vacancy.salaryMax!)}`}
              </p>
            </div>
          ) : null}

          <a
            href={`mailto:job@nuanu.com?subject=${encodeURIComponent(`Application: ${vacancy.title}`)}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#006b5f] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#005248]"
          >
            Apply Now
          </a>
        </div>

        {/* Job description */}
        {vacancy.description && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 mb-6">
            <h2 className="font-heading text-lg font-semibold text-slate-900 mb-4">
              Job Description
            </h2>
            <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap">
              {vacancy.description}
            </div>
          </div>
        )}

        {/* Requirements */}
        {vacancy.requirements && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 mb-6">
            <h2 className="font-heading text-lg font-semibold text-slate-900 mb-4">
              Requirements
            </h2>
            <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap">
              {vacancy.requirements}
            </div>
          </div>
        )}

        {/* No content fallback */}
        {!vacancy.description && !vacancy.requirements && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              More details about this role will be available soon.
            </p>
          </div>
        )}

        {/* Back link */}
        <div className="text-center mt-8">
          <a
            href="/careers"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#006b5f] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all positions
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="mx-auto max-w-4xl px-6 py-8 text-center">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Nuanu. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
