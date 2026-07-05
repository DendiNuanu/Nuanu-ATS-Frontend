"use client";

import { useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Card,
  Button,
  Avatar,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  ChevronRight,
  Save,
  FileText,
  Briefcase,
  DollarSign,
  Package,
  Home,
} from "lucide-react";

type EmployeeInfo = {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  position: string;
  department: string;
  startDate: string | null;
};

export function NewHireConfirmationClient({
  employee,
}: {
  employee: EmployeeInfo;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  // ── Employment Details ──
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [reportingTo, setReportingTo] = useState("");
  const [contractStart, setContractStart] = useState(
    employee.startDate ? employee.startDate.split("T")[0] : "",
  );
  const [contractEnd, setContractEnd] = useState("");
  const [isPermanent, setIsPermanent] = useState(false);
  const [workLocation, setWorkLocation] = useState("onsite");
  const [workingHours, setWorkingHours] = useState("09:00 - 18:00 WITA");

  // ── Compensation ──
  const [salaryType, setSalaryType] = useState("gross");
  const [basicSalary, setBasicSalary] = useState("");
  const [mealAllowance, setMealAllowance] = useState("");
  const [transportAllowance, setTransportAllowance] = useState("");
  const [healthAllowance, setHealthAllowance] = useState("");
  const [otherAllowanceLabel, setOtherAllowanceLabel] = useState("");
  const [otherAllowanceAmount, setOtherAllowanceAmount] = useState("");

  // ── Assets & Facilities ──
  const [laptopProvided, setLaptopProvided] = useState(false);
  const [laptopType, setLaptopType] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [nametagRequired, setNametagRequired] = useState(false);
  const [lunchProvided, setLunchProvided] = useState(false);
  const [accessCard, setAccessCard] = useState(false);

  // ── Notes ──
  const [notes, setNotes] = useState("");

  // ── Total Package auto-calculation ──
  const totalPackage = useMemo(() => {
    const basic = parseFloat(basicSalary) || 0;
    const meal = parseFloat(mealAllowance) || 0;
    const transport = parseFloat(transportAllowance) || 0;
    const health = parseFloat(healthAllowance) || 0;
    const other = parseFloat(otherAllowanceAmount) || 0;
    return basic + meal + transport + health + other;
  }, [
    basicSalary,
    mealAllowance,
    transportAllowance,
    healthAllowance,
    otherAllowanceAmount,
  ]);

  const formatIDR = (amount: number) =>
    `Rp ${amount.toLocaleString("id-ID")}`;

  const buildContractPayload = () => ({
    employmentType,
    contractStart: new Date(contractStart).toISOString(),
    contractEnd: isPermanent ? null : contractEnd || null,
    isPermanent,
    workLocation,
    workingHours,
    reportingTo,
    salaryType,
    basicSalary: parseFloat(basicSalary) || 0,
    mealAllowance: parseFloat(mealAllowance) || 0,
    transportAllowance: parseFloat(transportAllowance) || 0,
    healthAllowance: parseFloat(healthAllowance) || 0,
    otherAllowanceLabel: otherAllowanceLabel || null,
    otherAllowanceAmount: parseFloat(otherAllowanceAmount) || 0,
    laptopProvided,
    laptopType: laptopType || null,
    companyEmail: companyEmail || null,
    nametagRequired,
    lunchProvided,
    accessCard,
    notes: notes || null,
  });

  const validateForm = (): string | null => {
    if (!contractStart) return "Contract Start Date is required";
    if (!isPermanent && !contractEnd)
      return "Contract End Date is required (or check Permanent)";
    if (!reportingTo.trim()) return "Reporting To is required";
    if (!basicSalary || parseFloat(basicSalary) <= 0)
      return "Basic Salary is required";
    return null;
  };

  const handleSave = async (status: "draft" | "finalized") => {
    const validationError = validateForm();
    if (validationError && status === "finalized") {
      showToast(validationError, "error");
      return;
    }

    // For draft, allow saving even with incomplete data
    if (status === "draft" && !contractStart) {
      showToast("Contract Start Date is required to save", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          contract: buildContractPayload(),
          status,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save");
      }

      if (status === "finalized") {
        showToast(
          "Contract finalized! Memo Hire generation will be available soon.",
          "success",
        );
      } else {
        showToast("Contract saved as draft", "success");
      }

      router.push("/onboarding");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to save",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
        <Link
          href="/onboarding"
          className="hover:text-slate-900 transition-colors"
        >
          Onboarding
        </Link>
        <ChevronRight className="h-4 w-4 text-slate-300" />
        <Link
          href="/onboarding/start"
          className="hover:text-slate-900 transition-colors"
        >
          Start Onboarding
        </Link>
        <ChevronRight className="h-4 w-4 text-slate-300" />
        <span className="text-slate-900 font-medium">New Hire Confirmation</span>
      </nav>

      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/onboarding/start"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employee Selection
        </Link>
      </div>

      <PageHeader
        title="New Hire Confirmation"
        subtitle="Review and confirm the employment details, compensation, and assets for the new hire."
      />

      {/* Employee Summary Card */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <Avatar name={employee.name} size="lg" />
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900">
              {employee.name}
            </h2>
            <p className="text-sm text-slate-500">{employee.email}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-slate-600">
                <span className="text-slate-400">Position:</span>{" "}
                {employee.position}
              </span>
              <span className="text-slate-600">
                <span className="text-slate-400">Code:</span>{" "}
                {employee.employeeCode}
              </span>
              {employee.department && (
                <span className="text-slate-600">
                  <span className="text-slate-400">Dept:</span>{" "}
                  {employee.department}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Section 1: Employment Details ── */}
      <SectionCard
        icon={<Briefcase className="h-5 w-5 text-[#006b5f]" />}
        title="Employment Details"
        subtitle="Define the employment type, contract period, and reporting structure."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <FormField label="Employment Type" required>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className={inputClass}
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
              <option value="Probation">Probation</option>
            </select>
          </FormField>

          <FormField label="Reporting To" required>
            <input
              type="text"
              value={reportingTo}
              onChange={(e) => setReportingTo(e.target.value)}
              placeholder="e.g. John Doe"
              className={inputClass}
            />
          </FormField>

          <FormField label="Contract Start Date" required>
            <input
              type="date"
              value={contractStart}
              onChange={(e) => setContractStart(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="Contract End Date">
            <input
              type="date"
              value={contractEnd}
              onChange={(e) => setContractEnd(e.target.value)}
              disabled={isPermanent}
              className={`${inputClass} ${
                isPermanent ? "bg-slate-50 text-slate-400" : ""
              }`}
            />
            <label className="flex items-center gap-2 mt-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isPermanent}
                onChange={(e) => setIsPermanent(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#006b5f] focus:ring-[#006b5f]"
              />
              Permanent (no end date)
            </label>
          </FormField>

          <FormField label="Work Location">
            <select
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              className={inputClass}
            >
              <option value="onsite">Onsite</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </FormField>

          <FormField label="Working Hours">
            <input
              type="text"
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              placeholder="e.g. 09:00 - 18:00 WITA"
              className={inputClass}
            />
          </FormField>
        </div>
      </SectionCard>

      {/* ── Section 2: Compensation ── */}
      <SectionCard
        icon={<DollarSign className="h-5 w-5 text-[#006b5f]" />}
        title="Compensation"
        subtitle="Set the salary structure and allowances. Total Package is auto-calculated."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <FormField label="Salary Type">
            <select
              value={salaryType}
              onChange={(e) => setSalaryType(e.target.value)}
              className={inputClass}
            >
              <option value="gross">Gross</option>
              <option value="nett">Nett</option>
            </select>
          </FormField>

          <FormField label="Basic Salary (IDR)" required>
            <input
              type="number"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              placeholder="e.g. 8000000"
              className={inputClass}
            />
          </FormField>

          <FormField label="Meal Allowance (IDR)">
            <input
              type="number"
              value={mealAllowance}
              onChange={(e) => setMealAllowance(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </FormField>

          <FormField label="Transport Allowance (IDR)">
            <input
              type="number"
              value={transportAllowance}
              onChange={(e) => setTransportAllowance(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </FormField>

          <FormField label="Health Allowance (IDR)">
            <input
              type="number"
              value={healthAllowance}
              onChange={(e) => setHealthAllowance(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Other Allowance" className="col-span-2">
              <input
                type="text"
                value={otherAllowanceLabel}
                onChange={(e) => setOtherAllowanceLabel(e.target.value)}
                placeholder="Label (e.g. Communication)"
                className={inputClass}
              />
            </FormField>
            <FormField label="Amount (IDR)">
              <input
                type="number"
                value={otherAllowanceAmount}
                onChange={(e) => setOtherAllowanceAmount(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </FormField>
          </div>
        </div>

        {/* Total Package */}
        <div className="mt-6 p-4 bg-[#e6f5f3] rounded-xl border border-[#006b5f]/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Package (monthly)</p>
              <p className="text-2xl font-bold text-[#006b5f] font-heading">
                {formatIDR(totalPackage)}
              </p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>Basic + All Allowances</p>
              <p className="text-xs">Auto-calculated</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 3: Assets & Facilities ── */}
      <SectionCard
        icon={<Package className="h-5 w-5 text-[#006b5f]" />}
        title="Assets & Facilities"
        subtitle="Configure company assets and facilities provided to the employee."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {/* Laptop */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={laptopProvided}
                onChange={(e) => setLaptopProvided(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#006b5f] focus:ring-[#006b5f]"
              />
              Laptop Provided
            </label>
            {laptopProvided && (
              <input
                type="text"
                value={laptopType}
                onChange={(e) => setLaptopType(e.target.value)}
                placeholder="Laptop type/model (e.g. MacBook Pro 14)"
                className={inputClass}
              />
            )}
          </div>

          {/* Company Email */}
          <FormField label="Company Email">
            <input
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="e.g. firstname.lastname@nuanu.com"
              className={inputClass}
            />
          </FormField>

          {/* Nametag */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={nametagRequired}
                onChange={(e) => setNametagRequired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#006b5f] focus:ring-[#006b5f]"
              />
              Nametag Required
            </label>
          </div>

          {/* Lunch */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={lunchProvided}
                onChange={(e) => setLunchProvided(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#006b5f] focus:ring-[#006b5f]"
              />
              Lunch Provided
            </label>
          </div>

          {/* Access Card */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={accessCard}
                onChange={(e) => setAccessCard(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#006b5f] focus:ring-[#006b5f]"
              />
              Access Card
            </label>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 4: Notes ── */}
      <SectionCard
        icon={<FileText className="h-5 w-5 text-[#006b5f]" />}
        title="Notes"
        subtitle="Additional notes or comments about this hire."
      >
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Enter any additional notes..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#006b5f] focus:outline-none focus:ring-2 focus:ring-[#006b5f]/20 transition-colors resize-none"
        />
      </SectionCard>

      {/* ── Sticky Footer with Action Buttons ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Home className="h-4 w-4" />
            <span>
              Confirming hire for{" "}
              <span className="font-medium text-slate-900">
                {employee.name}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/onboarding/start">
              <Button variant="secondary" type="button" disabled={saving}>
                Cancel
              </Button>
            </Link>
            <Button
              variant="secondary"
              type="button"
              onClick={() => handleSave("draft")}
              disabled={saving}
              icon={<Save className="h-4 w-4" />}
            >
              {saving ? "Saving..." : "Save as Draft"}
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={() => handleSave("finalized")}
              disabled={saving}
              icon={<FileText className="h-4 w-4" />}
            >
              {saving ? "Saving..." : "Save & Generate Memo Hire"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#006b5f] focus:outline-none focus:ring-2 focus:ring-[#006b5f]/20 transition-colors";

function FormField({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className="mb-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 font-heading">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}
