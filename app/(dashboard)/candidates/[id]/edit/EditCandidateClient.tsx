"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, CreatableSelect, useToast } from "@/components/ui";
import { formatIDRInput } from "@/lib/utils";
import {
  CANDIDATE_STAGES,
  REJECTION_TYPES,
  REJECTION_TYPE_LABELS,
  type Stage,
  type Source,
  type Candidate,
  type RejectionType,
} from "@/lib/mock-data";
import { Check, X } from "lucide-react";

const SOURCES: Source[] = [
  "SEEK",
  "Referral",
  "LinkedIn",
  "Direct",
  "Job Fair",
  "Website",
  "Email Job Nuanu",
  "Social Media",
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
  returnQuery = "",
}: {
  candidate: Candidate;
  departments: { id: string; name: string }[];
  returnQuery?: string;
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
  const appliedForInit = initialAppliedFor.length
    ? initialAppliedFor
    : [""];

  // "Refer As" mirrors "Applied For" by default (matching the real app).
  const initialReferAs = candidate.referAsSlots?.length
    ? [...candidate.referAsSlots]
    : candidate.appliedForSlots?.length
      ? [...candidate.appliedForSlots]
      : candidate.position
        ? [candidate.position]
        : [];
  const referAsInit = initialReferAs.length ? initialReferAs : [""];
  const initialSlotMetadata = (kind: "applied_for" | "refer_as") =>
    Array.from(
      { length: Math.max(kind === "applied_for" ? appliedForInit.length : referAsInit.length, 1) },
      (_, slotIndex) => {
      const slot = candidate.positionSlots?.find(
        (item) => item.kind === kind && item.slotIndex === slotIndex,
      );
      return {
        departmentId: slot?.departmentId ?? candidate.departmentId ?? "",
        appliedDate: (slot?.appliedDate ?? candidate.appliedDate).slice(0, 10),
      };
      },
    );
  const appliedForMetaInit = initialSlotMetadata("applied_for");
  const referAsMetaInit = initialSlotMetadata("refer_as");

  const [appliedForSlots, setAppliedForSlots] = useState<string[]>(appliedForInit);
  const [appliedForDrafts, setAppliedForDrafts] = useState<string[]>(appliedForInit);
  const [referAsSlots, setReferAsSlots] = useState<string[]>(referAsInit);
  const [referAsDrafts, setReferAsDrafts] = useState<string[]>(referAsInit);
  const [appliedForMeta, setAppliedForMeta] = useState(appliedForMetaInit);
  const [referAsMeta, setReferAsMeta] = useState(referAsMetaInit);

  // Department options live in client state so newly created dept/project
  // values (via the creatable combobox) can be appended without a reload.
  // Seeded from the server-rendered list; new entries are persisted to the
  // shared Department table via POST /api/departments, so they become
  // available app-wide (vacancies, users, requisitions) — not just here.
  const [departmentOptions, setDepartmentOptions] = useState(
    departments.map((d) => ({ value: d.id, label: d.name })),
  );

  /**
   * Find-or-create a department by name, then select it for the given slot.
   * Used by the Dept/Project creatable combobox when HR types a value that
   * doesn't exist yet. On failure the selection is left unchanged and a
   * toast reports the error.
   */
  const createAndSelectDepartment = async (
    name: string,
    kind: "appliedFor" | "referAs",
    slotIndex: number,
  ) => {
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add dept/project");
      }
      const { department } = await res.json();
      // Append to the option list (deduped) so it's immediately pickable
      // in every other slot too.
      setDepartmentOptions((current) =>
        current.some((option) => option.value === department.id)
          ? current
          : [...current, { value: department.id, label: department.name }],
      );
      const setter =
        kind === "appliedFor" ? setAppliedForMeta : setReferAsMeta;
      setter((current) =>
        current.map((meta, index) =>
          index === slotIndex ? { ...meta, departmentId: department.id } : meta,
        ),
      );
      showToast(`Dept/project "${department.name}" added`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to add dept/project",
        "error",
      );
    }
  };

  // --- Personal Information ---
  const [name, setName] = useState(candidate.name);
  const [email, setEmail] = useState(candidate.email);
  const [phone, setPhone] = useState(candidate.phone);
  const [location, setLocation] = useState(candidate.location ?? "");
  const [experience, setExperience] = useState(candidate.experience ?? "");
  const [source, setSource] = useState<Source>(candidate.source);
  // "Referred By" — only meaningful when source === "Referral". Persisted to
  // Application.referralName. Kept in state regardless of source so the value
  // survives toggling source away from Referral and back.
  const [referredBy, setReferredBy] = useState(candidate.referredBy ?? "");
  const [appliedDate, setAppliedDate] = useState(
    candidate.appliedDate.slice(0, 10),
  );
  const [salaryNum, setSalaryNum] = useState<number>(
    parseSalary(candidate.expectedSalary),
  );

  // --- Pipeline & Stage ---
  const [stage, setStage] = useState<Stage>(candidate.stage);
  // Rejection sub-type — only meaningful when stage is "Rejected".
  // Defaults to "declined_by_hr" for legacy rejected candidates (null in DB
  // → backfilled) or the candidate's existing rejectionType.
  const [rejectionType, setRejectionType] = useState<RejectionType | "">(
    candidate.rejectionType ?? (candidate.stage === "Rejected" ? "declined_by_hr" : ""),
  );
  // Blacklist — independent from Stage. When "Blacklisted" is selected in the
  // Current Stage dropdown, isBlacklisted flips to true and the underlying
  // stage is preserved so it can be restored if the candidate is later
  // un-blacklisted. A reason is required by the server when blacklisting.
  const [isBlacklisted, setIsBlacklisted] = useState(
    candidate.isBlacklisted ?? false,
  );
  const [blacklistReason, setBlacklistReason] = useState(
    candidate.blacklistReason ?? "",
  );
  const [domicile, setDomicile] = useState(
    candidate.domicile ?? candidate.location ?? "",
  );
  const [noticePeriod, setNoticePeriod] = useState(
    candidate.noticePeriod ?? "",
  );

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
    referredBy: candidate.referredBy ?? "",
    appliedDate: candidate.appliedDate.slice(0, 10),
    salaryNum: parseSalary(candidate.expectedSalary),
    stage: candidate.stage,
    rejectionType: candidate.rejectionType ?? (candidate.stage === "Rejected" ? "declined_by_hr" : ""),
    isBlacklisted: candidate.isBlacklisted ?? false,
    blacklistReason: candidate.blacklistReason ?? "",
    domicile: candidate.domicile ?? candidate.location ?? "",
    noticePeriod: candidate.noticePeriod ?? "",
    appliedForSlots: appliedForInit,
    referAsSlots: referAsInit,
    appliedForMeta: appliedForMetaInit,
    referAsMeta: referAsMetaInit,
  });

  const hasUnsavedChanges =
    name !== initialValues.current.name ||
    email !== initialValues.current.email ||
    phone !== initialValues.current.phone ||
    location !== initialValues.current.location ||
    experience !== initialValues.current.experience ||
    source !== initialValues.current.source ||
    referredBy !== initialValues.current.referredBy ||
    appliedDate !== initialValues.current.appliedDate ||
    salaryNum !== initialValues.current.salaryNum ||
    stage !== initialValues.current.stage ||
    rejectionType !== initialValues.current.rejectionType ||
    isBlacklisted !== initialValues.current.isBlacklisted ||
    blacklistReason !== initialValues.current.blacklistReason ||
    domicile !== initialValues.current.domicile ||
    noticePeriod !== initialValues.current.noticePeriod ||
    // Length checks are required alongside the element-wise .some() checks:
    // deleting a row shrinks the current array, and .some() only iterates the
    // current array — without comparing lengths, a deletion (including
    // deleting every row) would never mark the form as dirty.
    appliedForSlots.length !== initialValues.current.appliedForSlots.length ||
    appliedForSlots.some((s, i) => s !== initialValues.current.appliedForSlots[i]) ||
    referAsSlots.length !== initialValues.current.referAsSlots.length ||
    referAsSlots.some((s, i) => s !== initialValues.current.referAsSlots[i]) ||
    appliedForMeta.length !== initialValues.current.appliedForMeta.length ||
    appliedForMeta.some(
      (meta, i) =>
        meta.departmentId !== initialValues.current.appliedForMeta[i]?.departmentId ||
        meta.appliedDate !== initialValues.current.appliedForMeta[i]?.appliedDate,
    ) ||
    referAsMeta.length !== initialValues.current.referAsMeta.length ||
    referAsMeta.some(
      (meta, i) =>
        meta.departmentId !== initialValues.current.referAsMeta[i]?.departmentId ||
        meta.appliedDate !== initialValues.current.referAsMeta[i]?.appliedDate,
    );

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

  const addAppliedForRow = () => {
    setAppliedForSlots((current) => [...current, ""]);
    setAppliedForDrafts((current) => [...current, ""]);
    setAppliedForMeta((current) => [
      ...current,
      { departmentId: "", appliedDate: appliedDate },
    ]);
  };

  const removeAppliedForRow = (index: number) => {
    // Deleting the last row is allowed — the server clears the candidate's
    // applied-for slots when it receives an empty list, and the "+ Add" button
    // below lets HR re-add a row later.
    setAppliedForSlots((current) => current.filter((_, i) => i !== index));
    setAppliedForDrafts((current) => current.filter((_, i) => i !== index));
    setAppliedForMeta((current) => current.filter((_, i) => i !== index));
  };

  const addReferAsRow = () => {
    setReferAsSlots((current) => [...current, ""]);
    setReferAsDrafts((current) => [...current, ""]);
    setReferAsMeta((current) => [
      ...current,
      { departmentId: "", appliedDate: appliedDate },
    ]);
  };

  const removeReferAsRow = (index: number) => {
    // Deleting the last row is allowed — the server clears the candidate's
    // refer-as slots when it receives an empty list, and the "+ Add" button
    // below lets HR re-add a row later.
    setReferAsSlots((current) => current.filter((_, i) => i !== index));
    setReferAsDrafts((current) => current.filter((_, i) => i !== index));
    setReferAsMeta((current) => current.filter((_, i) => i !== index));
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
          referredBy: source === "Referral" ? referredBy : "",
          appliedDate,
          expectedSalary: salaryNum > 0 ? salaryNum : null,
          stage,
          // Send rejectionType only when the stage is "Rejected".
          ...(stage === "Rejected"
            ? { rejectionType: rejectionType || "declined_by_hr" }
            : {}),
          // Blacklist — always send isBlacklisted so the server knows the
          // intended state. blacklistReason is required when blacklisting.
          isBlacklisted,
          ...(isBlacklisted ? { blacklistReason } : {}),
          domicile,
          noticePeriod,
          // Keep legacy fields in sync while normalized slots carry per-entry metadata.
          appliedFor: appliedForValues.join("\n"),
          referPosition: referAsValues.join("\n"),
          positionSlots: [
            ...appliedForSlots.map((position, slotIndex) => ({
              kind: "applied_for",
              slotIndex,
              position,
              departmentId: appliedForMeta[slotIndex].departmentId || null,
              appliedDate: appliedForMeta[slotIndex].appliedDate || null,
            })),
            ...referAsSlots.map((position, slotIndex) => ({
              kind: "refer_as",
              slotIndex,
              position,
              departmentId: referAsMeta[slotIndex].departmentId || null,
              appliedDate: referAsMeta[slotIndex].appliedDate || null,
            })),
          ],
          // Position rows own their department metadata. The legacy application
          // department is intentionally not overwritten by this form.
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save changes");
      }

      // B7 FIX: Verify the stage write actually landed. The server echoes
      // back the confirmed stage; if it doesn't match what we sent, the
      // write didn't commit and we must NOT navigate away (which would
      // leave the user looking at stale data showing the old stage).
      const data = await res.json().catch(() => ({}));
      if (data.stage && data.stage !== stage) {
        throw new Error(
          `Stage update did not persist (expected "${stage}", server confirmed "${data.stage}"). Please retry.`,
        );
      }

      showToast("Candidate updated successfully");
      // B7 FIX: Order matters. router.refresh() must run BEFORE router.push()
      // so the destination route's cache is purged and re-fetched with the
      // FRESH data. The previous order (push then refresh) refreshed the
      // edit page (the route being left), leaving the destination detail
      // page serving stale cached data — the root cause of "stage reverts
      // to New" after saving in Edit Profile.
      router.refresh();
      router.push(`/candidates/${id}${returnQuery}`);
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
    router.push(`/candidates/${id}${returnQuery}`);
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
                  <div key={i} className="grid gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-[minmax(0,1fr)_180px_160px_auto] md:items-end">
                    <div>
                      <Label>Position {i + 1}</Label>
                      <input
                        className={inputClass}
                        value={draft}
                        onChange={(e) => {
                          const next = [...appliedForDrafts];
                          next[i] = e.target.value;
                          setAppliedForDrafts(next);
                        }}
                        placeholder={i === 0 ? "e.g. Senior Frontend Engineer" : "Optional"}
                      />
                    </div>
                    <div>
                      <Label>Dept/Project</Label>
                      <CreatableSelect
                        options={departmentOptions}
                        value={appliedForMeta[i].departmentId}
                        onChange={(value) => setAppliedForMeta((current) => current.map((meta, index) => index === i ? { ...meta, departmentId: value } : meta))}
                        onCreate={(name) => createAndSelectDepartment(name, "appliedFor", i)}
                        placeholder="Select or type to add…"
                        emptyOptionLabel="No department"
                      />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <input type="date" className={inputClass} value={appliedForMeta[i].appliedDate} onChange={(e) => setAppliedForMeta((current) => current.map((meta, index) => index === i ? { ...meta, appliedDate: e.target.value } : meta))} />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAppliedForRow(i)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-600"
                      aria-label={`Delete Applied For row ${i + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
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
              {appliedForDrafts.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">
                  No positions — click “+ Add Applied For” below to add one.
                </p>
              )}
            </div>
            <button type="button" onClick={addAppliedForRow} className="mt-3 text-sm font-medium text-[#006b5f] hover:underline">
              + Add Applied For
            </button>
          </div>

          {/* Refer As — dynamic rows (defaults to Applied For) */}
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
                  <div key={i} className="grid gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-[minmax(0,1fr)_180px_160px_auto] md:items-end">
                    <div>
                      <Label>Refer As {i + 1}</Label>
                      <input
                        className={inputClass}
                        value={draft}
                        onChange={(e) => {
                          const next = [...referAsDrafts];
                          next[i] = e.target.value;
                          setReferAsDrafts(next);
                        }}
                        placeholder={i === 0 ? "e.g. Legal Admin" : "Optional"}
                      />
                    </div>
                    <div>
                      <Label>Dept/Project</Label>
                      <CreatableSelect
                        options={departmentOptions}
                        value={referAsMeta[i].departmentId}
                        onChange={(value) => setReferAsMeta((current) => current.map((meta, index) => index === i ? { ...meta, departmentId: value } : meta))}
                        onCreate={(name) => createAndSelectDepartment(name, "referAs", i)}
                        placeholder="Select or type to add…"
                        emptyOptionLabel="No department"
                      />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <input type="date" className={inputClass} value={referAsMeta[i].appliedDate} onChange={(e) => setReferAsMeta((current) => current.map((meta, index) => index === i ? { ...meta, appliedDate: e.target.value } : meta))} />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeReferAsRow(i)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-600"
                      aria-label={`Delete Refer As row ${i + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
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
              {referAsDrafts.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">
                  No positions — click “+ Add Refer As” below to add one.
                </p>
              )}
            </div>
            <button type="button" onClick={addReferAsRow} className="mt-3 text-sm font-medium text-[#006b5f] hover:underline">
              + Add Refer As
            </button>
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
          {source === "Referral" && (
            <div>
              <Label>Referred By</Label>
              <input
                className={inputClass}
                value={referredBy}
                onChange={(e) => setReferredBy(e.target.value)}
                placeholder="Name of the referrer"
              />
            </div>
          )}
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
              value={isBlacklisted ? "Blacklisted" : stage}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "Blacklisted") {
                  // Blacklisting is independent from Stage — keep the current
                  // stage so it can be restored if the candidate is later
                  // un-blacklisted by selecting a real stage.
                  setIsBlacklisted(true);
                } else {
                  const newStage = val as Stage;
                  setStage(newStage);
                  setIsBlacklisted(false);
                  // Reset / default the rejection sub-type when toggling the
                  // stage in / out of "Rejected".
                  if (newStage === "Rejected" && !rejectionType) {
                    setRejectionType("declined_by_hr");
                  } else if (newStage !== "Rejected") {
                    setRejectionType("");
                  }
                }
              }}
            >
              {CANDIDATE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option disabled>──────────</option>
              <option value="Blacklisted">Blacklisted</option>
            </select>
            {isBlacklisted && (
              <div className="mt-3">
                <Label>Blacklist Reason</Label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 resize-none"
                  rows={3}
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder="e.g. No-show at 3 scheduled interviews"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  A reason is required when blacklisting a candidate.
                </p>
              </div>
            )}
            {stage === "Rejected" && (
              <div className="mt-3">
                <Label>Rejection Reason</Label>
                <select
                  className={inputClass}
                  value={rejectionType}
                  onChange={(e) => setRejectionType(e.target.value as RejectionType | "")}
                >
                  <option value="">Select a reason...</option>
                  {REJECTION_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {REJECTION_TYPE_LABELS[rt]}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-400">
                  Determines which email template is offered on the compose page.
                  No email is sent automatically — HR reviews it before dispatching.
                </p>
              </div>
            )}
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
