"use client";

import { useRef, useState } from "react";
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
  StickyNote,
  UserPlus,
  MailCheck,
  Ban,
  CheckCircle2,
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

  const contentRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPdf = async () => {
    if (!contentRef.current || isGenerating) return;
    setIsGenerating(true);
    // Hoisted so the finally block can restore the on-screen grid layout.
    let prevGridDisplay = "";
    try {
      // Dynamic imports keep these client-only libs out of the SSR bundle
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // Force single-column layout during capture so every section renders at
      // full width (the on-screen 2-col grid would produce cramped half-width
      // cards in the PDF). Restore the original display value afterwards.
      const grid = contentRef.current.querySelector<HTMLElement>(
        ".grid.lg\\:grid-cols-2",
      );
      prevGridDisplay = grid ? grid.style.display : "";
      if (grid) grid.style.display = "block";

      // Collect every top-level section/card inside the capture area. Each is
      // treated as an atomic block that must not be split across a page break.
      const sections = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>("section"),
      );

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; // mm on all sides
      const contentWidth = pageWidth - margin * 2;
      const sectionGap = 4; // mm between sections
      let cursorY = margin; // current Y position on the page

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        // eslint-disable-next-line no-await-in-loop
        const canvas = await html2canvas(section, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        const imgData = canvas.toDataURL("image/png");
        // Convert canvas pixel dimensions to mm at the content width.
        const imgHeightMm = (canvas.height * contentWidth) / canvas.width;

        // Add inter-section spacing (skip before the first section).
        if (i > 0) cursorY += sectionGap;

        // If the section doesn't fit in the remaining page space AND it would
        // fit on a fresh page, start a new page first (page-break-before).
        if (
          cursorY + imgHeightMm > pageHeight - margin &&
          imgHeightMm <= pageHeight - margin * 2
        ) {
          pdf.addPage();
          cursorY = margin;
        }

        // If the section is taller than a full content area (rare edge case:
        // extremely long career history), slice it across multiple pages.
        if (imgHeightMm > pageHeight - margin * 2) {
          // Draw the first portion on the current page.
          const availH = pageHeight - margin - cursorY;
          if (availH > 0) {
            const srcSliceH = (availH * canvas.width) / contentWidth;
            const pageCanvas = document.createElement("canvas");
            pageCanvas.width = canvas.width;
            pageCanvas.height = Math.ceil(srcSliceH);
            const ctx = pageCanvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(canvas, 0, 0, pageCanvas.width, pageCanvas.height);
              pdf.addImage(
                pageCanvas.toDataURL("image/png"),
                "PNG",
                margin,
                cursorY,
                contentWidth,
                availH,
              );
            }
          }
          let drawnMm = pageHeight - margin - cursorY;
          while (drawnMm + 0.1 < imgHeightMm) {
            pdf.addPage();
            const nextMm = Math.min(
              pageHeight - margin * 2,
              imgHeightMm - drawnMm,
            );
            const srcSliceH = (nextMm * canvas.width) / contentWidth;
            const srcY = (drawnMm * canvas.width) / contentWidth;
            const pageCanvas = document.createElement("canvas");
            pageCanvas.width = canvas.width;
            pageCanvas.height = Math.ceil(srcSliceH);
            const ctx2 = pageCanvas.getContext("2d");
            if (ctx2) {
              ctx2.drawImage(
                canvas,
                0,
                srcY,
                pageCanvas.width,
                pageCanvas.height,
                0,
                0,
                pageCanvas.width,
                pageCanvas.height,
              );
              pdf.addImage(
                pageCanvas.toDataURL("image/png"),
                "PNG",
                margin,
                margin,
                contentWidth,
                nextMm,
              );
            }
            drawnMm += nextMm;
          }
          cursorY = margin; // next section starts on a fresh page
        } else {
          // Normal case: section fits on the current page.
          pdf.addImage(
            imgData,
            "PNG",
            margin,
            cursorY,
            contentWidth,
            imgHeightMm,
          );
          cursorY += imgHeightMm;
        }
      }

      // Sanitize filename: keep alphanumerics + hyphens, collapse spaces
      const sanitizedName = candidate.name
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      pdf.save(`${sanitizedName || "candidate"}-summary.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      // Restore the on-screen grid layout.
      const grid = contentRef.current?.querySelector<HTMLElement>(
        ".grid.lg\\:grid-cols-2",
      );
      if (grid) grid.style.display = prevGridDisplay;
      setIsGenerating(false);
    }
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
            onClick={handleDownloadPdf}
            disabled={isGenerating}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#006b5f] px-4 text-sm font-medium text-white transition hover:bg-[#005a50] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                PDF Download
              </>
            )}
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

      {/* PDF capture area — candidate header + all summary sections */}
      <div ref={contentRef} className="space-y-6">
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

      {/* Two-column layout — collapses to a single column when printing so
          cards stack vertically and never render as a cramped 2-col grid
          on a narrow print page. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:block">
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
            <InfoRow
              label="Portfolio"
              value={
                candidate.portfolioUrl
                  ? candidate.portfolioUrl.startsWith("/backups-resumes/")
                    ? "File attached"
                    : candidate.portfolioUrl
                  : null
              }
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
            {candidate.source === "Referral" && (
              <InfoRow label="Referred By" value={candidate.referredBy} />
            )}
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

        {/* Notes */}
        {candidate.notes && candidate.notes.length > 0 && (
          <Section title="Notes" icon={StickyNote}>
            <div className="space-y-3">
              {candidate.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      {note.authorName}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDateWita(note.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Activity Timeline */}
        {candidate.stageHistory && candidate.stageHistory.length > 0 && (
          <Section title="Activity Timeline" icon={Clock}>
            <ol className="relative border-l border-slate-200 pl-6 space-y-4">
              {/* Application received — always first */}
              <li className="relative">
                <span className="absolute -left-[1.65rem] flex h-6 w-6 items-center justify-center rounded-full bg-[#e6f5f3]">
                  <UserPlus className="h-3.5 w-3.5 text-[#006b5f]" />
                </span>
                <p className="text-sm font-semibold text-slate-800">
                  Application Received
                </p>
                <p className="text-xs text-slate-500">
                  Applied via {candidate.source} for {candidate.position}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDateWita(candidate.appliedDate)}
                </p>
              </li>
              {candidate.stageHistory.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[1.65rem] flex h-6 w-6 items-center justify-center rounded-full bg-blue-50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    Moved to {entry.stage}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDateWita(entry.enteredAt)}
                  </p>
                </li>
              ))}
              {/* Rejection email sent */}
              {candidate.rejectionEmailSent && candidate.rejectionEmailSentAt && (
                <li className="relative">
                  <span className="absolute -left-[1.65rem] flex h-6 w-6 items-center justify-center rounded-full bg-amber-50">
                    <MailCheck className="h-3.5 w-3.5 text-amber-600" />
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    Rejection Email Sent
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {candidate.rejectionEmailSentAt}
                  </p>
                </li>
              )}
              {/* Blacklisted */}
              {candidate.isBlacklisted && candidate.blacklistedAt && (
                <li className="relative">
                  <span className="absolute -left-[1.65rem] flex h-6 w-6 items-center justify-center rounded-full bg-red-50">
                    <Ban className="h-3.5 w-3.5 text-red-600" />
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    Added to Blacklist
                  </p>
                  {candidate.blacklistReason && (
                    <p className="text-xs text-slate-500">
                      {candidate.blacklistReason}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDateWita(candidate.blacklistedAt)}
                  </p>
                </li>
              )}
            </ol>
          </Section>
        )}
      </div>
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
