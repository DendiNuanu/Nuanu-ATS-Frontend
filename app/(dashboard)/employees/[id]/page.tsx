import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEmployeeById } from "@/lib/data-access";
import { Card, StatusPill, Avatar } from "@/components/ui";
import { formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Building2,
  FileText,
  Laptop,
  Clock,
  User,
} from "lucide-react";

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const employee = await fetchEmployeeById(params.id);

  if (!employee) notFound();

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const totalAllowances = employee.contract
    ? employee.contract.mealAllowance +
      employee.contract.transportAllowance +
      employee.contract.healthAllowance +
      employee.contract.otherAllowanceAmount
    : 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Link>
      </div>

      {/* Header card */}
      <Card className="mb-6 overflow-hidden" noPadding>
        <div className="relative p-6 bg-gradient-to-br from-[#006b5f] to-[#014239] text-white">
          <div className="flex items-start gap-5">
            <Avatar
              name={employee.name}
              size="xl"
              className="!bg-white/20"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold font-heading">
                {employee.name}
              </h1>
              <p className="text-sm text-white/80 mt-0.5">
                {employee.position}
              </p>
              <p className="text-xs text-white/60 mt-0.5">
                {employee.department}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                  {employee.employeeId}
                </span>
                <StatusPill status={employee.status} />
                <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                  {employee.employmentType}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Profile + Contract + Compensation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <Card title="Profile Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              <ContactField
                icon={Mail}
                label="Email"
                value={employee.email}
              />
              <ContactField
                icon={Phone}
                label="Phone"
                value={employee.phone || "—"}
              />
              <ContactField
                icon={Calendar}
                label="Join Date"
                value={fmtDate(employee.joinDate)}
              />
              <ContactField
                icon={Briefcase}
                label="Position"
                value={employee.position}
              />
              <ContactField
                icon={Building2}
                label="Department"
                value={employee.department || "—"}
              />
              <ContactField
                icon={User}
                label="Entity"
                value={employee.entity}
              />
              {employee.probationPeriod && (
                <ContactField
                  icon={Clock}
                  label="Probation Period"
                  value={employee.probationPeriod}
                />
              )}
              {employee.probationEndDate && (
                <ContactField
                  icon={Calendar}
                  label="Probation End"
                  value={fmtDate(employee.probationEndDate)}
                />
              )}
            </div>
          </Card>

          {/* Contract */}
          {employee.contract ? (
            <Card title="Contract Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <ContactField
                  icon={Briefcase}
                  label="Employment Type"
                  value={employee.contract.employmentType}
                />
                <ContactField
                  icon={Calendar}
                  label="Contract Start"
                  value={fmtDate(employee.contract.contractStart)}
                />
                <ContactField
                  icon={Calendar}
                  label="Contract End"
                  value={
                    employee.contract.contractEnd
                      ? fmtDate(employee.contract.contractEnd)
                      : employee.contract.isPermanent
                        ? "Permanent"
                        : "—"
                  }
                />
                <ContactField
                  icon={MapPin}
                  label="Work Location"
                  value={employee.contract.workLocation}
                />
                <ContactField
                  icon={Clock}
                  label="Working Hours"
                  value={employee.contract.workingHours}
                />
                <ContactField
                  icon={User}
                  label="Reporting To"
                  value={employee.contract.reportingTo}
                />
                {employee.contract.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-slate-400 mb-1">
                      Notes
                    </p>
                    <p className="text-sm text-slate-900">
                      {employee.contract.notes}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card title="Contract Details">
              <p className="text-sm text-slate-400 py-4">
                No contract has been created for this employee yet.
              </p>
            </Card>
          )}

          {/* Compensation */}
          {employee.contract && (
            <Card title="Compensation">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">
                    Basic Salary ({employee.contract.salaryType})
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatIDR(employee.contract.basicSalary)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Meal Allowance</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatIDR(employee.contract.mealAllowance)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">
                    Transport Allowance
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatIDR(employee.contract.transportAllowance)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">
                    Health Allowance
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatIDR(employee.contract.healthAllowance)}
                  </span>
                </div>
                {employee.contract.otherAllowanceLabel &&
                  employee.contract.otherAllowanceAmount > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">
                        {employee.contract.otherAllowanceLabel}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatIDR(employee.contract.otherAllowanceAmount)}
                      </span>
                    </div>
                  )}
                <div className="flex items-center justify-between py-3 bg-slate-50 -mx-6 -mb-6 px-6 rounded-b-xl">
                  <span className="text-sm font-semibold text-slate-900">
                    Total Monthly
                  </span>
                  <span className="text-lg font-bold text-[#006b5f]">
                    {formatIDR(
                      employee.contract.basicSalary + totalAllowances,
                    )}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right column: Assets + Documents */}
        <div className="space-y-6">
          {/* Assets */}
          <Card title="Assets">
            {employee.assets.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">
                No assets assigned.
              </p>
            ) : (
              <div className="space-y-3">
                {employee.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0"
                  >
                    <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <Laptop className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {asset.assetName}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {asset.assetType.replace(/_/g, " ")}
                        {asset.serialNumber && ` · ${asset.serialNumber}`}
                      </p>
                      <span
                        className={`inline-block mt-1 text-xs font-medium capitalize ${
                          asset.status === "assigned"
                            ? "text-green-600"
                            : asset.status === "pending"
                              ? "text-amber-600"
                              : "text-slate-500"
                        }`}
                      >
                        {asset.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Documents */}
          <Card title="Documents">
            {employee.documents.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">
                No documents uploaded.
              </p>
            ) : (
              <div className="space-y-3">
                {employee.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0"
                  >
                    <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {doc.originalFilename}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {doc.documentType.replace(/_/g, " ")}
                      </p>
                      <span
                        className={`inline-block mt-1 text-xs font-medium capitalize ${
                          doc.verificationStatus === "verified"
                            ? "text-green-600"
                            : doc.verificationStatus === "rejected"
                              ? "text-red-600"
                              : "text-amber-600"
                        }`}
                      >
                        {doc.verificationStatus.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContactField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-900 break-words">
          {value}
        </p>
      </div>
    </div>
  );
}
