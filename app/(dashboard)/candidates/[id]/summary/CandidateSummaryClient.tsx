"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Avatar, StatusPill, BlacklistBadge } from "@/components/ui";
import type { Candidate } from "@/lib/mock-data";
import { formatDateWita } from "@/lib/format-wita";
import {
  ArrowLeft,
  Printer,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  Languages,
  Calendar,
  DollarSign,
  Clock,
  FileText,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 print:break-inside-avoid">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
        <Icon className="h-4 w-4 text-[#006b5f]" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />}
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-slate-400">{label}</dt>
        <dd className="text-sm text-slate-800">{value || "—"}</dd>
      </div>
    </div>
  );
}

export function CandidateSummaryClient({
  candidate,
}: {
  candidate: Candidate;
}) {
  const searchParams = useSearchParams();

  // Reconstruct the `from*` query string (list origin) so links back to the
  // detail/edit pages propagate the list state and "Back to Candidates"
  // returns to the exact filtered/searched list the user came from.
  const returnQuery = (() => {
    const params = new URLSearchParams();
    const fromPage = searchParams.get("fromPage");
    const fromSearch = searchParams.get("fromSearch");
    const fromStage = searchParams.get("fromStage");
    const fromSort = searchParams.get("fromSort");
    const fromDir = searchParams.get("fromDir");
    if (fromPage) params.set("fromPage", fromPage);
    if (fromSearch) params.set("fromSearch", fromSearch);
    if (fromStage) params.set("fromStage", fromStage);
    if (fromSort) params.set("fromSort", fromSort);
    if (fromDir) params.set("fromDir", fromDir);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  })();

  const appliedForValues = candidate.appliedForSlots?.length
    ? candidate.appliedForSlots.filter(Boolean)
    : candidate.position
      ? [candidate.position]
      : [];

  const referAsValues = candidate.referAsSlots?.length
    ? candidate.referAsSlots.filter(Boolean)
      : candidate.referAs
        ? [candidate.referAs]
        : [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header — hidden when printing */}
      <div className="sticky top-16 z-10 -mx-6 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur print:hidden lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href={`/candidates/${candidate.id}${returnQuery}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Back to candidate"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-900">
              Candidate Summary
            </h1>
            <p className="text-sm text-slate-500">{candidate.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#006b5f] px-4 text-sm font-medium text-white transition hover:bg-[#005a50]"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-slate-900">
          Candidate Summary — {candidate.name}
        </h1>
        <p className="text-sm text-slate-500">
          Generated on {formatDateWita(new Date().toISOString())}
        </p>
      </div>

      {/* Candidate Header Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 print:break-inside-avoid">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={candidate.name} size="xl" color={candidate.avatarColor} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">
                  {candidate.name}
                </h2>
                {candidate.isBlacklisted && <BlacklistBadge />}
              </div>
              <p className="text-sm text-slate-600">{candidate.position}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <StatusPill
                  status={candidate.stage}
                  isBlacklisted={candidate.isBlacklisted}
                  rejectionType={candidate.rejectionType}
                />
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {candidate.source}
                </span>
              </div>
            </div>
          </div>
          {candidate.aiMatch > 0 && (
            <div className="flex flex-col items-center rounded-lg bg-slate-50 px-6 py-3">
              <span className="text-3xl font-bold text-[#006b5f]">
                {candidate.aiMatch}%
              </span>
              <span className="text-xs text-slate-500">AI Match</span>
            </div>
          )}
        </div>
      </section>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal & Contact Information */}
        <Section title="Personal & Contact" icon={Mail}>
          <dl className="divide-y divide-slate-50">
            <InfoRow label="Full Name" value={candidate.name} icon={Mail} />
            <InfoRow label="Email" value={candidate.email} icon={Mail} />
            <InfoRow label="Phone" value={candidate.phone} icon={Phone} />
            <InfoRow label="Location" value={candidate.location} icon={MapPin} />
            <InfoRow label="Domicile" value={candidate.domicile} icon={MapPin} />
            <InfoRow label="Experience" value={candidate.experience} icon={Briefcase} />
            <InfoRow label="Gender" value={candidate.gender} />
            <InfoRow
              label="Applied Date"
              value={formatDateWita(candidate.appliedDate)}
              icon={Calendar}
            />
          </dl>
        </Section>

        {/* Position & Application */}
        <Section title="Position & Application" icon={Briefcase}>
          <dl className="divide-y divide-slate-50">
            <InfoRow label="Department" value={candidate.department} />
            <div className="py-1.5">
              <dt className="text-xs font-medium text-slate-400">Applied For</dt>
              <dd className="text-sm text-slate-800">
                {appliedForValues.length > 0 ? (
                  <ul className="list-inside list-disc space-y-0.5">
                    {appliedForValues.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="py-1.5">
              <dt className="text-xs font-medium text-slate-400">Refer As</dt>
              <dd className="text-sm text-slate-800">
                {referAsValues.length > 0 ? (
                  <ul className="list-inside list-disc space-y-0.5">
                    {referAsValues.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <InfoRow label="Source" value={candidate.source} />
            <InfoRow
              label="Availability / Notice Period"
              value={candidate.noticePeriod}
              icon={Clock}
            />
            <InfoRow
              label="Salary Expectation"
              value={candidate.expectedSalaryText ?? candidate.expectedSalary}
              icon={DollarSign}
            />
          </dl>
        </Section>

        {/* Career History */}
        <Section title="Career History" icon={Briefcase}>
          {candidate.careerHistory && candidate.careerHistory.length > 0 ? (
            <div className="space-y-4">
              {candidate.careerHistory.map((job, i) => (
                <div key={i} className="border-l-2 border-slate-100 pl-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {job.role}
                  </p>
                  <p className="text-xs text-slate-500">
                    {job.company}
                    {job.period ? ` · ${job.period}` : ""}
                  </p>
                  {job.description && (
                    <p className="mt-1 text-xs text-slate-600">
                      {job.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : candidate.experience ? (
            <p className="text-sm text-slate-600">{candidate.experience}</p>
          ) : (
            <p className="text-sm text-slate-400">No career history on file.</p>
          )}
        </Section>

        {/* Education */}
        <Section title="Education" icon={GraduationCap}>
          {candidate.educationEntries &&
          candidate.educationEntries.length > 0 ? (
            <div className="space-y-3">
              {candidate.educationEntries.map((edu, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-slate-800">
                    {edu.degree}
                  </p>
                  <p className="text-xs text-slate-500">
                    {edu.institution}
                    {edu.period ? ` · ${edu.period}` : ""}
                    {edu.gpa ? ` · GPA: ${edu.gpa}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : candidate.education ? (
            <p className="text-sm text-slate-600">{candidate.education}</p>
          ) : (
            <p className="text-sm text-slate-400">No education data on file.</p>
          )}
        </Section>

        {/* Skills */}
        <Section title="Skills" icon={Award}>
          {candidate.skills && candidate.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No skills on file.</p>
          )}
        </Section>

        {/* Languages */}
        <Section title="Languages" icon={Languages}>
          {candidate.languages && candidate.languages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {candidate.languages.map((lang, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {lang}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No languages on file.</p>
          )}
        </Section>

        {/* Licences & Certifications */}
        {candidate.licencesCertifications &&
          candidate.licencesCertifications.length > 0 && (
            <Section title="Licences & Certifications" icon={Award}>
              <div className="space-y-3">
                {candidate.licencesCertifications.map((cert, i) => (
                  <div key={i}>
                    <p className="text-sm font-semibold text-slate-800">
                      {cert.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {cert.issuingBody}
                      {cert.period ? ` · ${cert.period}` : ""}
                      {cert.expiryDate ? ` · Expires: ${cert.expiryDate}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

        {/* Application Questions */}
        {candidate.applicationQuestions &&
          candidate.applicationQuestions.length > 0 && (
            <Section title="Application Questions" icon={FileText}>
              <div className="space-y-3">
                {candidate.applicationQuestions.map((qa, i) => (
                  <div key={i}>
                    <p className="text-xs font-medium text-slate-400">
                      {qa.question}
                    </p>
                    <p className="text-sm text-slate-800">
                      {qa.answer || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

        {/* AI Match Analysis */}
        {candidate.aiMatch > 0 && (
          <Section title="AI Match Analysis" icon={Sparkles}>
            <div className="mb-4 flex items-center gap-4">
              <div className="flex flex-col items-center">
                <span className="text-4xl font-bold text-[#006b5f]">
                  {candidate.aiMatch}%
                </span>
                <span className="text-xs text-slate-500">Overall Match</span>
              </div>
            </div>
            {candidate.scoreBreakdown && (
              <div className="space-y-3">
                {[
                  { label: "Skills Match", value: candidate.scoreBreakdown.skills },
                  { label: "Experience", value: candidate.scoreBreakdown.experience },
                  { label: "Education", value: candidate.scoreBreakdown.education },
                  { label: "Culture Fit", value: candidate.scoreBreakdown.cultureFit },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{s.label}</span>
                      <span className="text-xs font-semibold text-slate-700">
                        {s.value}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#006b5f]"
                        style={{ width: `${s.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {candidate.scoreExplanation && (
              <p className="mt-4 text-sm text-slate-600">
                {candidate.scoreExplanation}
              </p>
            )}
          </Section>
        )}

        {/* Blacklist Info */}
        {candidate.isBlacklisted && (
          <Section title="Blacklist Status" icon={AlertTriangle}>
            <div className="rounded-lg bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <BlacklistBadge />
                <span className="text-sm font-semibold text-red-700">
                  This candidate is blacklisted
                </span>
              </div>
              {candidate.blacklistReason && (
                <p className="mt-2 text-sm text-red-600">
                  <span className="font-medium">Reason:</span>{" "}
                  {candidate.blacklistReason}
                </p>
              )}
            </div>
          </Section>
        )}
      </div>

      {/* Footer actions — hidden when printing */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4 print:hidden">
        <Link
          href={`/candidates/${candidate.id}${returnQuery}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#006b5f]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Candidate Detail
        </Link>
        <Link
          href={`/candidates/${candidate.id}/edit${returnQuery}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#006b5f]"
        >
          Edit Candidate
        </Link>
      </div>
    </div>
  );
}
