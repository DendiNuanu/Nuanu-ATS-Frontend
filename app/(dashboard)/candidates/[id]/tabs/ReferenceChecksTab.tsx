"use client";

import { useState } from "react";
import { Card, Button, StatusPill } from "@/components/ui";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Send,
  Download,
  Star,
  Check,
  Trash2,
} from "lucide-react";

type RefStatus = "Not Started" | "In Progress" | "Completed";

type ReferenceEntry = {
  id: string;
  label: string;
  expanded: boolean;
  status: RefStatus;
  // Section I
  agency: string;
  telephone: string;
  cityState: string;
  jobTitle: string;
  empFrom: string;
  empTo: string;
  reasonLeaving: string;
  eligibleRehire: string;
  remarks: string;
  personName: string;
  personTitle: string;
  // Section II
  workPerformance: string;
  keyStrengths: string;
  areasImprovement: string;
  additionalNotes: string;
  overallRating: number;
  hrRecommendation: "" | "Recommend" | "With Reservation" | "Do Not Recommend";
  saved: boolean;
};

const createEmptyReference = (n: number): ReferenceEntry => ({
  id: `ref-${Date.now()}-${n}`,
  label: `Reference ${n}`,
  expanded: n === 1,
  status: "Not Started",
  agency: "",
  telephone: "",
  cityState: "",
  jobTitle: "",
  empFrom: "",
  empTo: "",
  reasonLeaving: "",
  eligibleRehire: "",
  remarks: "",
  personName: "",
  personTitle: "",
  workPerformance: "",
  keyStrengths: "",
  areasImprovement: "",
  additionalNotes: "",
  overallRating: 0,
  hrRecommendation: "",
  saved: false,
});

const MAX_REFERENCES = 5;

export function ReferenceChecksTab({
  candidateName,
  candidatePosition,
}: {
  candidateName: string;
  candidatePosition: string;
}) {
  const [references, setReferences] = useState<ReferenceEntry[]>([
    createEmptyReference(1),
    { ...createEmptyReference(2), expanded: false },
    { ...createEmptyReference(3), expanded: false },
  ]);

  const updateReference = (id: string, patch: Partial<ReferenceEntry>) => {
    setReferences((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const toggleExpand = (id: string) => {
    setReferences((prev) =>
      prev.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)),
    );
  };

  const addReference = () => {
    if (references.length >= MAX_REFERENCES) return;
    const n = references.length + 1;
    setReferences((prev) => [...prev, { ...createEmptyReference(n), expanded: true }]);
  };

  const removeReference = (id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id));
  };

  const computeStatus = (r: ReferenceEntry): RefStatus => {
    if (r.saved) return "Completed";
    const hasData =
      r.agency || r.telephone || r.jobTitle || r.personName || r.workPerformance;
    return hasData ? "In Progress" : "Not Started";
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 font-heading">
              Reference Check & Employment Verification
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {candidateName} · {candidatePosition}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="md" icon={<Save className="h-4 w-4" />} onClick={() => console.log("save-reference-check")}>
              Save Reference Check
            </Button>
            <Button variant="secondary" size="md" icon={<Send className="h-4 w-4" />} onClick={() => console.log("send-to-user")}>
              Send to User
            </Button>
            <Button variant="secondary" size="md" icon={<Download className="h-4 w-4" />} onClick={() => console.log("export-pdf")}>
              Export PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Reference entries */}
      {references.map((ref) => {
        const status = computeStatus(ref);
        return (
          <Card key={ref.id}>
            {/* Entry header */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => toggleExpand(ref.id)}
                className="flex items-center gap-2 text-left"
              >
                {ref.expanded ? (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                )}
                <span className="text-base font-semibold text-slate-900 font-heading">
                  {ref.label}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <StatusPill status={status} />
                {references.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeReference(ref.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${ref.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Entry body */}
            {ref.expanded && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Section I — Employment History Verification */}
                <div className="rounded-xl border border-slate-200 p-5">
                  <h4 className="text-sm font-bold text-slate-900 mb-4">
                    Section I — Employment History Verification
                  </h4>
                  <div className="space-y-4">
                    <FieldInput
                      label="Agency / Organization"
                      value={ref.agency}
                      onChange={(v) => updateReference(ref.id, { agency: v, status: computeStatus({ ...ref, agency: v }) })}
                      placeholder="e.g. PT Maju Bersama"
                    />
                    <FieldInput
                      label="Telephone"
                      value={ref.telephone}
                      onChange={(v) => updateReference(ref.id, { telephone: v })}
                      placeholder="+62 ..."
                    />
                    <FieldInput
                      label="City / State"
                      value={ref.cityState}
                      onChange={(v) => updateReference(ref.id, { cityState: v })}
                      placeholder="e.g. Jakarta, ID"
                    />
                    <FieldInput
                      label="Job Title"
                      value={ref.jobTitle}
                      onChange={(v) => updateReference(ref.id, { jobTitle: v })}
                      placeholder="e.g. Software Engineer"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldInput
                        label="Employment From"
                        type="date"
                        value={ref.empFrom}
                        onChange={(v) => updateReference(ref.id, { empFrom: v })}
                      />
                      <FieldInput
                        label="Employment To"
                        type="date"
                        value={ref.empTo}
                        onChange={(v) => updateReference(ref.id, { empTo: v })}
                      />
                    </div>
                    <FieldInput
                      label="Reason(s) for Leaving"
                      value={ref.reasonLeaving}
                      onChange={(v) => updateReference(ref.id, { reasonLeaving: v })}
                      placeholder="e.g. Career growth"
                    />
                    <div>
                      <Label>Eligible for Rehire</Label>
                      <select
                        value={ref.eligibleRehire}
                        onChange={(e) => updateReference(ref.id, { eligibleRehire: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none transition bg-white"
                      >
                        <option value="">Select...</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="Unsure">Unsure</option>
                      </select>
                    </div>
                    <FieldTextarea
                      label="Remarks"
                      value={ref.remarks}
                      onChange={(v) => updateReference(ref.id, { remarks: v })}
                      placeholder="Additional remarks..."
                    />
                    <FieldInput
                      label="Person Providing Information"
                      value={ref.personName}
                      onChange={(v) => updateReference(ref.id, { personName: v })}
                      placeholder="Full name"
                    />
                    <FieldInput
                      label="Title"
                      value={ref.personTitle}
                      onChange={(v) => updateReference(ref.id, { personTitle: v })}
                      placeholder="e.g. HR Manager"
                    />
                  </div>
                </div>

                {/* Section II — Additional Notes (HR Internal) */}
                <div className="rounded-xl border border-slate-200 p-5">
                  <h4 className="text-sm font-bold text-slate-900 mb-4">
                    Section II — Additional Notes (HR Internal)
                  </h4>
                  <div className="space-y-4">
                    <FieldTextarea
                      label="How would you describe their work performance?"
                      value={ref.workPerformance}
                      onChange={(v) => updateReference(ref.id, { workPerformance: v })}
                      placeholder="Describe work performance..."
                    />
                    <FieldTextarea
                      label="Key strengths"
                      value={ref.keyStrengths}
                      onChange={(v) => updateReference(ref.id, { keyStrengths: v })}
                      placeholder="List key strengths..."
                    />
                    <FieldTextarea
                      label="Areas for improvement"
                      value={ref.areasImprovement}
                      onChange={(v) => updateReference(ref.id, { areasImprovement: v })}
                      placeholder="Areas for improvement..."
                    />
                    <FieldTextarea
                      label="Additional notes"
                      value={ref.additionalNotes}
                      onChange={(v) => updateReference(ref.id, { additionalNotes: v })}
                      placeholder="Any additional notes..."
                    />

                    {/* Overall Rating */}
                    <div>
                      <Label>Overall Rating</Label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => updateReference(ref.id, { overallRating: star })}
                            className="p-0.5 transition-transform hover:scale-110"
                            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                          >
                            <Star
                              className={`h-6 w-6 ${
                                star <= ref.overallRating
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-slate-100 text-slate-300"
                              }`}
                            />
                          </button>
                        ))}
                        {ref.overallRating > 0 && (
                          <span className="ml-2 text-sm font-medium text-slate-600">
                            {ref.overallRating} / 5
                          </span>
                        )}
                      </div>
                    </div>

                    {/* HR Recommendation */}
                    <div>
                      <Label>HR Recommendation</Label>
                      <div className="flex flex-wrap gap-2">
                        {(["Recommend", "With Reservation", "Do Not Recommend"] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => updateReference(ref.id, { hrRecommendation: opt })}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                              ref.hrRecommendation === opt
                                ? "border-[#006b5f] bg-[#e6f5f3] text-[#006b5f]"
                                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save button for this entry */}
                <div className="lg:col-span-2 flex items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    icon={<Save className="h-4 w-4" />}
                    onClick={() => {
                      updateReference(ref.id, { saved: true, status: "Completed" });
                      setTimeout(() => updateReference(ref.id, { saved: false }), 2500);
                    }}
                  >
                    Save {ref.label}
                  </Button>
                  {ref.saved && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#006b5f]">
                      <Check className="h-4 w-4" />
                      {ref.label} saved
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* Add reference button */}
      {references.length < MAX_REFERENCES && (
        <button
          type="button"
          onClick={addReference}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-4 text-sm font-medium text-slate-500 transition hover:border-[#006b5f] hover:bg-[#e6f5f3]/30 hover:text-[#006b5f]"
        >
          <Plus className="h-4 w-4" />
          Add Reference
        </button>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
      {children}
    </label>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none transition"
      />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none transition"
      />
    </div>
  );
}
