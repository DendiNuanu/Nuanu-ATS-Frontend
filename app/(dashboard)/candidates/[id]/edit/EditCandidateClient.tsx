"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, useToast } from "@/components/ui";
import { formatIDRInput } from "@/lib/utils";
import { CANDIDATE_STAGES, type Stage, type Source, type Candidate } from "@/lib/mock-data";
import { Check, X } from "lucide-react";

const SOURCES: Source[] = [
  "SEEK",
  "Referral",
  "LinkedIn",
  "Direct",
  "Job Fair",
  "Website",
  "Email Job Nuanu",
];

/** Extract the leading digits from a salary string like "Rp 25.000.000 / month". */
function parseSalary(str?: string): number {
  if (!str) return 0;
  const digits = str.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20";

function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-slate-500">
      {children}
    </label>
  );
}

export function EditCandidateClient({
  candidate,
  departments,
}: {
  candidate: Candidate;
  departments: { id: string; name: string }[];
}) {
  const { id } = candidate;
  const router = useRouter();
  const { showToast } = useToast();

  // --- Position Information: multi-slot with per-slot Apply ---
  const initialAppliedFor = candidate.appliedForSlots?.length
    ? [...candidate.appliedForSlots]
    : candidate.position
      ? [candidate.position]
      : [];
  const appliedForInit = [
    initialAppliedFor[0] ?? "",
    initialAppliedFor[1] ?? "",
    initialAppliedFor[2] ?? "",
  ];

  // "Refer As" mirrors "Applied For" by default (matching the real app).
  const initialReferAs = candidate.referAsSlots?.length
    ? [...candidate.referAsSlots]
    : candidate.appliedForSlots?.length
      ? [...candidate.appliedForSlots]
      : candidate.position
        ? [candidate.position]
        : [];
  const referAsInit = [
    initialReferAs[0] ?? "",
    initialReferAs[1] ?? "",
    initialReferAs[2] ?? "",
  ];

  const [appliedForSlots, setAppliedForSlots] = useState<string[]>(appliedForInit);
  const [appliedForDrafts, setAppliedForDrafts] = useState<string[]>(appliedForInit);
  const [referAsSlots, setReferAsSlots] = useState<string[]>(referAsInit);
  const [referAsDrafts, setReferAsDrafts] = useState<string[]>(referAsInit);

  // --- Personal Information ---
  const [name, setName] = useState(candidate.name);
  const [email, setEmail] = useState(candidate.email);
  const [phone, setPhone] = useState(candidate.phone);
  const [location, setLocation] = useState(candidate.location ?? "");
  const [experience, setExperience] = useState(candidate.experience ?? "");
  const [source, setSource] = useState<Source>(candidate.source);
  const [appliedDate, setAppliedDate] = useState(
    candidate.appliedDate.slice(0, 10),
  );
  const [salaryNum, setSalaryNum] = useState<number>(
    parseSalary(candidate.expectedSalary),
  );

  // --- Pipeline & Stage ---
  const [stage, setStage] = useState<Stage>(candidate.stage);
  const [domicile, setDomicile] = useState(
    candidate.domicile ?? candidate.location ?? "",
  );
  const [noticePeriod, setNoticePeriod] = useState(
    candidate.noticePeriod ?? "",
  );

  // --- Department override ---
  // The candidate's current department name (from vacancy or override).
  // Used to pre-select the dropdown when departmentId is null.
  const [departmentId, setDepartmentId] = useState<string>(
    candidate.departmentId ?? "",
  );
  const currentDeptName = candidate.department;
  // Custom department name — used when the user selects "Add custom department…"
  const [customDeptMode, setCustomDeptMode] = useState(false);
  const [customDept, setCustomDept] = useState<string>("");

  const [saving, setSaving] = useState(false);

  // --- Unsaved changes tracking ---
  // Snapshot the initial values so we can detect any modification.
  const initialValues = useRef({
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    location: candidate.location ?? "",
    experience: candidate.experience ?? "",
    source: candidate.source,
    appliedDate: candidate.appliedDate.slice(0, 10),
    salaryNum: parseSalary(candidate.expectedSalary),
    stage: candidate.stage,
    domicile: candidate.domicile ?? candidate.location ?? "",
    noticePeriod: candidate.noticePeriod ?? "",
    departmentId: candidate.departmentId ?? "",
    customDeptMode: false,
    customDept: "",
    appliedForSlots: appliedForInit,
    referAsSlots: referAsInit,
  });

  const hasUnsavedChanges =
    name !== initialValues.current.name ||
    email !== initialValues.current.email ||
    phone !== initialValues.current.phone ||
    location !== initialValues.current.location ||
    experience !== initialValues.current.experience ||
    source !== initialValues.current.source ||
    appliedDate !== initialValues.current.appliedDate ||
    salaryNum !== initialValues.current.salaryNum ||
    stage !== initialValues.current.stage ||
    domicile !== initialValues.current.domicile ||
    noticePeriod !== initialValues.current.noticePeriod ||
    departmentId !== initialValues.current.departmentId ||
    customDeptMode !== initialValues.current.customDeptMode ||
    customDept !== initialValues.current.customDept ||
    appliedForSlots.some((s, i) => s !== initialValues.current.appliedForSlots[i]) ||
    referAsSlots.some((s, i) => s !== initialValues.current.referAsSlots[i]);

  // Warn the user if they try to leave with unsaved changes.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const commitAppliedFor = (i: number) => {
    const next = [...appliedForSlots];
    next[i] = appliedForDrafts[i];
    setAppliedForSlots(next);
    showToast("Position staged — click Save to persist", "info");
  };

  const commitReferAs = (i: number) => {
    const next = [...referAsSlots];
    next[i] = referAsDrafts[i];
    setReferAsSlots(next);
    showToast("Refer As staged — click Save to persist", "info");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const appliedForValues = appliedForSlots.filter(Boolean);
      const referAsValues = referAsSlots.filter(Boolean);
      const experienceYears = experience
        ? parseInt(experience.replace(/[^\d]/g, ""), 10) || 0
        : 0;

      const res = await fetch(`/api/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          location,
          experienceYears,
          source,
          appliedDate,
          expectedSalary: salaryNum > 0 ? salaryNum : null,
          stage,
          domicile,
          noticePeriod,
          // Send all slots as newline-joined string so the API can
          // parse and store them as a JSON array (multi-slot support).
          appliedFor: appliedForValues.join("\n"),
          referPosition: referAsValues.join("\n"),
          // When a custom department name is entered, send it so the API
          // can find-or-create the Department record. Otherwise send the
          // selected departmentId (or null to use the vacancy default).
          ...(customDeptMode && customDept.trim()
            ? { departmentId: null, departmentName: customDept.trim() }
            : { departmentId: departmentId || null }),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save changes");
      }

      showToast("Candidate updated successfully");
      router.push(`/candidates/${id}`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save changes";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to leave without saving?",
      );
      if (!confirmed) return;
    }
    router.push(`/candidates/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-16 z-10 -mx-6 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-bold text-slate-900">
            Edit profile
          </h1>
          <span className="text-sm text-slate-400">—</span>
          <span className="text-sm font-medium text-slate-600">
            {candidate.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
            {hasUnsavedChanges && !saving && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-300" aria-label="Unsaved changes" />
            )}
          </Button>
          <button
            type="button"
            onClick={handleCancel}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Card a) Position Information */}
      <Card title="Position Information">
        <div className="space-y-8">
          {/* Applied For — 3 slots */}
          <div>
            <p className="mb-4 text-sm font-semibold text-slate-900">
              Applied For
            </p>
            <div className="space-y-3">
              {appliedForDrafts.map((draft, i) => {
                const committed = appliedForSlots[i];
                const isApplied = draft === committed && committed !== "";
                return (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>Position {i + 1}</Label>
                      <input
                        className={inputClass}
                        value={draft}
                        onChange={(e) => {
                          const next = [...appliedForDrafts];
                          next[i] = e.target.value;
                          setAppliedForDrafts(next);
                        }}
                        placeholder={
                          i === 0
                            ? "e.g. Senior Frontend Engineer"
                            : "Optional"
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => commitAppliedFor(i)}
                      className={`inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
                        isApplied
                          ? "border-[#006b5f]/30 bg-[#e6f5f3] text-[#006b5f]"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Applied
                        </>
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refer As — 3 slots (defaults to Applied For) */}
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-900">
              Refer As
            </p>
            <p className="mb-4 text-xs text-slate-400">
              Defaults to the Applied For position. Override only if referring
              the candidate for a different role.
            </p>
            <div className="space-y-3">
              {referAsDrafts.map((draft, i) => {
                const committed = referAsSlots[i];
                const isApplied = draft === committed && committed !== "";
                return (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>Refer As {i + 1}</Label>
                      <input
                        className={inputClass}
                        value={draft}
                        onChange={(e) => {
                          const next = [...referAsDrafts];
                          next[i] = e.target.value;
                          setReferAsDrafts(next);
                        }}
                        placeholder={
                          i === 0 ? "e.g. Legal Admin" : "Optional"
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => commitReferAs(i)}
                      className={`inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
                        isApplied
                          ? "border-[#006b5f]/30 bg-[#e6f5f3] text-[#006b5f]"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Applied
                        </>
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Department override */}
          <div>
            <Label>Department</Label>
            <select
              className={inputClass}
              value={customDeptMode ? "__custom__" : departmentId}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setCustomDeptMode(true);
                  setCustomDept("");
                  setDepartmentId("");
                } else {
                  setCustomDeptMode(false);
                  setCustomDept("");
                  setDepartmentId(e.target.value);
                }
              }}
            >
              <option value="">
                {currentDeptName
                  ? `Use vacancy default (${currentDeptName})`
                  : "— No department —"}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value="__custom__">+ Add custom department…</option>
            </select>
            {customDeptMode && (
              <input
                className={`${inputClass} mt-2`}
                value={customDept}
                onChange={(e) => setCustomDept(e.target.value)}
                placeholder="e.g. Customer Success"
                autoFocus
              />
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              Override the department shown for this candidate. Leave as default
              to use the vacancy department, or add a custom one.
            </p>
          </div>
        </div>
      </Card>

      {/* Card b) Personal Information */}
      <Card title="Personal Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <Label>Full Name</Label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Email</Label>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <Label>Location</Label>
            <input
              className={inputClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Jakarta, ID"
            />
          </div>
          <div>
            <Label>Experience</Label>
            <input
              className={inputClass}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 7 years"
            />
          </div>
          <div>
            <Label>Source</Label>
            <select
              className={inputClass}
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Applied Date</Label>
            <input
              type="date"
              className={inputClass}
              value={appliedDate}
              onChange={(e) => setAppliedDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Expected Monthly Salary</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                className={`${inputClass} pl-10`}
                value={salaryNum > 0 ? formatIDRInput(String(salaryNum)) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, "");
                  setSalaryNum(digits ? parseInt(digits, 10) : 0);
                }}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Card c) Pipeline & Stage */}
      <Card title="Pipeline & Stage">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <Label>Current Stage</Label>
            <select
              className={inputClass}
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
            >
              {CANDIDATE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Domicile</Label>
            <input
              className={inputClass}
              value={domicile}
              onChange={(e) => setDomicile(e.target.value)}
              placeholder="e.g. Jakarta Selatan"
            />
          </div>
          <div>
            <Label>Availability</Label>
            <input
              className={inputClass}
              value={noticePeriod}
              onChange={(e) => setNoticePeriod(e.target.value)}
              placeholder="e.g. Immediately, 2 weeks notice"
            />
          </div>
        </div>
      </Card>

      {/* Bottom action bar (mirrors header for long forms) */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <Button variant="secondary" size="md" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
          {hasUnsavedChanges && !saving && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-300" aria-label="Unsaved changes" />
          )}
        </Button>
      </div>
    </div>
  );
}
