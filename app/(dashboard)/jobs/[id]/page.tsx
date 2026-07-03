import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchVacancyById,
  fetchCandidatesByVacancy,
} from "@/lib/data-access";
import { Card, StatusPill, Avatar } from "@/components/ui";
import { formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

import {
  ArrowLeft,
  Pencil,
  MapPin,
  Users,
  Briefcase,
  Building2,
  FileText,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [vacancy, candidates] = await Promise.all([
    fetchVacancyById(id),
    fetchCandidatesByVacancy(id),
  ]);
  if (!vacancy) notFound();

  const progress =
    vacancy.headcount > 0
      ? Math.round((vacancy.filledCount / vacancy.headcount) * 100)
      : 0;

  const employmentLabel =
    {
      "full-time": "Full-time",
      "part-time": "Part-time",
      contract: "Contract",
      internship: "Internship",
    }[vacancy.employmentType] ?? vacancy.employmentType;

  const locationLabel =
    {
      onsite: "On-site",
      remote: "Remote",
      hybrid: "Hybrid",
    }[vacancy.locationType] ?? vacancy.locationType;

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-16 z-10 -mx-6 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/jobs"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-[#006b5f]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="font-heading text-xl font-bold text-slate-900">
            {vacancy.title}
          </h1>
        </div>
        <Link
          href={`/jobs/${vacancy.id}/edit`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-[#e6f5f3] flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-6 w-6 text-[#006b5f]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-heading text-2xl font-bold text-slate-900">
                  {vacancy.title}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {vacancy.departmentName} · {employmentLabel} · {locationLabel}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-400" />
                {vacancy.departmentName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                {vacancy.location || "—"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-400" />
                {vacancy.candidateCount} candidates
              </span>
              <StatusPill status={vacancy.status} />
            </div>
          </Card>

          {vacancy.description && (
            <Card title="Job Description">
              <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap">
                {vacancy.description}
              </div>
            </Card>
          )}

          {vacancy.requirements && (
            <Card title="Requirements">
              <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap">
                {vacancy.requirements}
              </div>
            </Card>
          )}

          {!vacancy.description && !vacancy.requirements && (
            <Card className="text-center py-12">
              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                No description or requirements have been added yet.
              </p>
            </Card>
          )}

          {/* Candidate list for this vacancy */}
          <div id="candidates-section" className="scroll-mt-24">
          <Card title={`Candidates (${candidates.length})`} noPadding>
            {candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Users className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">
                  No candidates have applied for this vacancy yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-6 py-3 text-left font-medium">Candidate</th>
                      <th className="px-6 py-3 text-left font-medium">Stage</th>
                      <th className="px-6 py-3 text-left font-medium">AI Match</th>
                      <th className="px-6 py-3 text-left font-medium">Applied</th>
                      <th className="px-6 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {candidates.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={c.name}
                              color={c.avatarColor}
                              size="md"
                            />
                            <div className="min-w-0">
                              <Link
                                href={`/candidates/${c.id}`}
                                className="font-medium text-slate-900 hover:text-[#006b5f]"
                              >
                                {c.name}
                              </Link>
                              <p className="text-xs text-slate-400 truncate">
                                {c.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill status={c.stage} />
                        </td>
                        <td className="px-6 py-4">
                          {c.aiMatch > 0 ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.aiMatch >= 75
                                  ? "bg-green-50 text-green-700"
                                  : c.aiMatch >= 50
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {c.aiMatch}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(c.appliedDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/candidates/${c.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-[#006b5f] hover:text-[#005449]"
                          >
                            View
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card title="Hiring Progress">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Filled</span>
              <span className="text-sm font-semibold text-slate-900">
                {vacancy.filledCount}/{vacancy.headcount}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#006b5f]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">{progress}% complete</p>
          </Card>

          <Card title="Salary Range">
            {vacancy.salaryMin != null || vacancy.salaryMax != null ? (
              <div className="space-y-2">
                {vacancy.salaryMin != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Minimum</span>
                    <span className="font-semibold text-slate-900">
                      {formatIDR(vacancy.salaryMin)}
                    </span>
                  </div>
                )}
                {vacancy.salaryMax != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Maximum</span>
                    <span className="font-semibold text-slate-900">
                      {formatIDR(vacancy.salaryMax)}
                    </span>
                  </div>
                )}
                <p className="text-xs text-slate-400 pt-1">
                  Currency: {vacancy.currency}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Not specified</p>
            )}
          </Card>

          <Card title="Details">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Vacancy Code</dt>
                <dd className="font-medium text-slate-900">{vacancy.code}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Posted</dt>
                <dd className="font-medium text-slate-900">
                  {new Date(vacancy.postedDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Openings</dt>
                <dd className="font-medium text-slate-900">
                  {vacancy.headcount}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Employment</dt>
                <dd className="font-medium text-slate-900">{employmentLabel}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Work Arrangement</dt>
                <dd className="font-medium text-slate-900">{locationLabel}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Quick Actions">
            <div className="flex flex-col gap-2">
              <Link
                href={`/jobs/${vacancy.id}/edit`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit Vacancy
              </Link>
              <a
                href="#candidates-section"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                View Candidates
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
