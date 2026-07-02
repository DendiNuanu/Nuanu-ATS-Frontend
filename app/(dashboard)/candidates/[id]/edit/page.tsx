"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui";
import { useCandidateStore } from "@/lib/candidate-store";
import { CANDIDATE_STAGES, type Stage, type Source } from "@/lib/mock-data";
import { Check, X } from "lucide-react";

const SOURCES: Source[] = [
  "SEEK",
  "Referral",
  "LinkedIn",
  "Direct",
  "Job Fair",
  "Website",
];

/** Format a positive integer as Indonesian Rupiah (thousand separators = "."). */
function formatIDR(num: number): string {
  return num.toLocaleString("id-ID");
}

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

export default function EditCandidatePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const { getCandidate, updateCandidate } = useCandidateStore();
  const candidate = getCandidate(id) ?? getCandidate("c1")!;

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

  const initialReferAs = candidate.referAsSlots?.length
    ? [...candidate.referAsSlots]
    : candidate.referAs
      ? [candidate.referAs]
      : [candidate.name.split(" ")[0]];
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
  const [appliedDate, setAppliedDate] = useState(candidate.appliedDate);
  const [salaryNum, setSalaryNum] = useState<number>(
    parseSalary(candidate.expectedSalary),
  );

  // --- Pipeline & Stage ---
  const [stage, setStage] = useState<Stage>(candidate.stage);
  const [domicile, setDomicile] = useState(
    candidate.domicile ?? candidate.location ?? "",
  );

  const commitAppliedFor = (i: number) => {
    const next = [...appliedForSlots];
    next[i] = appliedForDrafts[i];
    setAppliedForSlots(next);
  };

  const commitReferAs = (i: number) => {
    const next = [...referAsSlots];
    next[i] = referAsDrafts[i];
    setReferAsSlots(next);
  };

  const handleSave = () => {
    const appliedForValues = appliedForSlots.filter(Boolean);
    const referAsValues = referAsSlots.filter(Boolean);
    const salaryStr =
      salaryNum > 0 ? `Rp ${formatIDR(salaryNum)} / month` : "";

    updateCandidate(id, {
      name,
      email,
      phone,
      location,
      experience,
      source,
      appliedDate,
      expectedSalary: salaryStr,
      stage,
      domicile,
      appliedForSlots: appliedForValues,
      referAsSlots: referAsValues,
      position: appliedForValues[0] ?? candidate.position,
      referAs: referAsValues[0] ?? candidate.referAs,
    });
    router.push(`/candidates/${id}`);
  };

  const handleCancel = () => {
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
          <Button variant="primary" size="md" onClick={handleSave}>
            Save
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

          {/* Refer As — 3 slots */}
          <div>
            <p className="mb-4 text-sm font-semibold text-slate-900">
              Refer As
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
                          i === 0 ? "e.g. Budi" : "Optional"
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
                value={salaryNum > 0 ? formatIDR(salaryNum) : ""}
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
        </div>
      </Card>

      {/* Bottom action bar (mirrors header for long forms) */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <Button variant="secondary" size="md" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
