"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  StatusPill,
  Button,
  Avatar,
  Tabs,
  RadialGauge,
  BlacklistBadge,
} from "@/components/ui";
import type { Candidate } from "@/lib/mock-data";
import { InterviewResultsTab } from "./tabs/InterviewResultsTab";
import { ReferenceChecksTab } from "./tabs/ReferenceChecksTab";
import { NotesTab } from "./tabs/NotesTab";
import { ActivityTimelineTab } from "./tabs/ActivityTimelineTab";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Pencil,
  Calendar,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

const tabs = [
  { id: "overview", label: "Profile Overview" },
  { id: "resume", label: "Resume/CV" },
  { id: "interviews", label: "Interview Results" },
  { id: "references", label: "Reference Checks" },
  { id: "assessments", label: "Assessments" },
  { id: "notes", label: "Notes" },
  { id: "activity", label: "Activity Timeline" },
];

export function CandidateDetailClient({
  candidate: initialCandidate,
  backHref = "/candidates",
}: {
  candidate: Candidate;
  backHref?: string;
}) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  const [activeTab, setActiveTab] = useState("overview");

  // Resolve multi-slot values (fall back to legacy single fields)
  const appliedForValues =
    candidate.appliedForSlots?.filter(Boolean) ??
    (candidate.position ? [candidate.position] : []);
  // "Refer As" mirrors "Applied For" (the position) unless an explicit
  // `referPosition` override exists — matching the real production app.
  // Never fall back to a first-name nickname.
  const referAsValues =
    candidate.referAsSlots?.filter(Boolean) ??
    (candidate.referAs ? [candidate.referAs] : appliedForValues);

  const handleRemoveFromBlacklist = () => {
    setCandidate((prev) => ({
      ...prev,
      isBlacklisted: false,
      blacklistReason: null,
    }));
  };

  return (
    <div>
      {/* Back link */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#006b5f] mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Candidates
      </Link>

      {/* Header */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <Avatar name={candidate.name} size="xl" color={candidate.avatarColor} />
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 font-heading">
                {candidate.name}
              </h1>
              <StatusPill status={candidate.stage} />
              {candidate.isBlacklisted && <BlacklistBadge />}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {candidate.position} · {candidate.department}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                {candidate.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {candidate.phone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {candidate.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Applied{" "}
                {new Date(candidate.appliedDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<Mail className="h-4 w-4" />}
              onClick={() => router.push(`/candidates/${candidate.id}/compose`)}
            >
              Message
            </Button>
            <Button
              variant="primary"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => router.push(`/candidates/${candidate.id}/edit`)}
            >
              Edit Profile
            </Button>
          </div>
        </div>
      </Card>

      {/* Blacklist warning banner */}
      {candidate.isBlacklisted && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">
              This candidate is blacklisted
            </p>
            <p className="text-sm text-red-700 mt-0.5">
              {candidate.blacklistReason || "No reason provided."}
            </p>
          </div>
          <Button variant="destructive" onClick={handleRemoveFromBlacklist}>
            Remove from blacklist
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} className="mb-6" />

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: editable-looking fields */}
          <div className="lg:col-span-2 space-y-6">
            <Card title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <Field label="Full Name" value={candidate.name} />
                <Field label="Email" value={candidate.email} />
                <Field label="Phone" value={candidate.phone} />
                <Field label="Location" value={candidate.location ?? "-"} />
                <Field label="Experience" value={candidate.experience ?? "-"} />
                <Field label="Source" value={candidate.source} />
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">
                    Applied For
                  </p>
                  {appliedForValues.length <= 1 ? (
                    <p className="text-sm font-medium text-slate-900">
                      {appliedForValues[0] ?? "-"}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {appliedForValues.map((v, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">
                    Refer As
                  </p>
                  {referAsValues.length <= 1 ? (
                    <p className="text-sm font-medium text-slate-900">
                      {referAsValues[0] ?? "-"}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {referAsValues.map((v, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-md bg-[#e6f5f3] px-2 py-0.5 text-xs font-medium text-[#006b5f]"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">
                    Current Stage
                  </p>
                  <StatusPill status={candidate.stage} />
                </div>
                <Field
                  label="Expected Monthly Salary"
                  value={candidate.expectedSalary ?? "-"}
                />
              </div>
            </Card>

            <Card title="Career History">
              <div className="space-y-5">
                {candidate.careerHistory && candidate.careerHistory.length > 0 ? (
                  candidate.careerHistory.map((job, i) => (
                    <div key={`${job.role}-${i}`} className="flex gap-4">
                      <div className="h-10 w-10 rounded-lg bg-[#e6f5f3] flex items-center justify-center flex-shrink-0">
                        <Briefcase className="h-5 w-5 text-[#006b5f]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {job.role}
                        </p>
                        <p className="text-sm text-slate-500">
                          {job.company}
                          {job.period ? ` · ${job.period}` : ""}
                        </p>
                        {job.description && (
                          <p className="text-sm text-slate-500 mt-1">
                            {job.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    No career history on file
                  </p>
                )}
              </div>
            </Card>

            <Card title="Education">
              {candidate.educationEntries && candidate.educationEntries.length > 0 ? (
                <div className="space-y-5">
                  {candidate.educationEntries.map((edu, i) => (
                    <div key={`${edu.degree}-${i}`} className="flex gap-4">
                      <div className="h-10 w-10 rounded-lg bg-[#e6f5f3] flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-5 w-5 text-[#006b5f]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {edu.degree}
                        </p>
                        <p className="text-sm text-slate-500">
                          {edu.institution}
                          {edu.period ? ` · ${edu.period}` : ""}
                          {edu.gpa ? ` · GPA ${edu.gpa}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : candidate.education ? (
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-[#e6f5f3] flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="h-5 w-5 text-[#006b5f]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {candidate.education}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  No education on file
                </p>
              )}
            </Card>
          </div>

          {/* Right: AI Match gauge */}
          <div className="space-y-6">
            <Card title="AI Match Analysis">
              <div className="flex flex-col items-center text-center py-4">
                <RadialGauge value={candidate.aiMatch} size={140} label="Match Score" />
                <p className="text-sm text-slate-500 mt-4">
                  {candidate.scoreExplanation ??
                    (candidate.aiMatch > 0
                      ? `Alignment with the ${candidate.position} role based on skills, experience, and seniority.`
                      : "This candidate has not been scored yet. Run AI scoring to generate a match analysis.")}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                {[
                  { label: "Skills Match", value: candidate.scoreBreakdown?.skills ?? 0 },
                  { label: "Experience", value: candidate.scoreBreakdown?.experience ?? 0 },
                  { label: "Education", value: candidate.scoreBreakdown?.education ?? 0 },
                  { label: "Culture Fit", value: candidate.scoreBreakdown?.cultureFit ?? 0 },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">{s.label}</span>
                      <span className="text-xs font-semibold text-slate-700">
                        {s.value}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#006b5f]"
                        style={{ width: `${s.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Quick Actions">
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={() => console.log("rescore")}
                >
                  Re-run AI Scoring
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  icon={<Mail className="h-4 w-4" />}
                  onClick={() => console.log("email")}
                >
                  Send Email
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "interviews" && (
        <InterviewResultsTab
          candidateName={candidate.name}
          candidateId={candidate.id}
        />
      )}

      {activeTab === "references" && (
        <ReferenceChecksTab
          candidateName={candidate.name}
          candidatePosition={candidate.position}
        />
      )}

      {activeTab === "notes" && <NotesTab />}

      {activeTab === "activity" && <ActivityTimelineTab candidate={candidate} />}

      {activeTab !== "overview" &&
        activeTab !== "interviews" &&
        activeTab !== "references" &&
        activeTab !== "notes" &&
        activeTab !== "activity" && (
          <Card>
            <div className="text-center py-16">
              <div className="h-16 w-16 rounded-full bg-[#e6f5f3] flex items-center justify-center mx-auto mb-4">
                <Briefcase className="h-8 w-8 text-[#006b5f]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-heading mb-1.5">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                This tab content will be populated in the full application. This
                is a placeholder for the prototype.
              </p>
            </div>
          </Card>
        )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
