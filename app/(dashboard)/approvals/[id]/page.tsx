import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, StatusPill, Avatar } from "@/components/ui";
import { fetchRequisitionById } from "@/lib/data-access";
import { formatDateWita } from "@/lib/format-wita";
import { ApprovalDecisionCard } from "./ApprovalDecisionCard";

export const dynamic = "force-dynamic";

import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Users,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Circle,
  XCircle,
} from "lucide-react";

export default async function ApprovalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const requisition = await fetchRequisitionById(id);
  if (!requisition) notFound();

  return (
    <div>
      {/* Back link */}
      <Link
        href="/approvals"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#006b5f] mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Approvals
      </Link>

      {/* Job info card */}
      <Card className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#e6f5f3] flex items-center justify-center flex-shrink-0">
              <Briefcase className="h-6 w-6 text-[#006b5f]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-heading">
                {requisition.title}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {requisition.department} · {requisition.employmentType}
              </p>
            </div>
          </div>
          <StatusPill status={requisition.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <InfoItem icon={Users} label="Openings" value={String(requisition.openings)} />
          <InfoItem icon={MapPin} label="Location" value={requisition.location} />
          <InfoItem icon={DollarSign} label="Budget" value={requisition.budget} />
          <InfoItem
            icon={Calendar}
            label="Posted"
            value={formatDateWita(requisition.postedDate)}
          />
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
            Justification
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            {requisition.justification}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Avatar name={requisition.postedBy} size="sm" />
          <span>
            Requested by <span className="font-medium text-slate-700">{requisition.postedBy}</span>
          </span>
        </div>
      </Card>

      {/* Approval chain */}
      {requisition.approvalChain.length > 0 && (
        <Card title="Approval Chain" className="mb-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            {requisition.approvalChain.map((step, i) => (
              <div key={step.role} className="flex flex-1 items-center gap-4">
                <div className="flex-1 flex flex-col items-center text-center px-4 py-5 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="mb-3">
                    {step.status === "approved" && (
                      <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-7 w-7 text-green-600" />
                      </div>
                    )}
                    {step.status === "pending" && (
                      <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-amber-600" />
                      </div>
                    )}
                    {step.status === "rejected" && (
                      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircle className="h-7 w-7 text-red-600" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Step {i + 1} · {step.role}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{step.name}</p>
                  <p className="text-xs text-slate-500">{step.title}</p>
                  {step.date && (
                    <p className="text-xs text-slate-400 mt-2">
                      {formatDateWita(step.date)}
                    </p>
                  )}
                  {step.comment && (
                    <p className="text-xs text-slate-500 mt-2 italic max-w-[200px]">
                      &ldquo;{step.comment}&rdquo;
                    </p>
                  )}
                </div>
                {i < requisition.approvalChain.length - 1 && (
                  <div className="hidden md:flex items-center text-slate-300">
                    <Circle className="h-2 w-2 fill-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Decision card */}
      <ApprovalDecisionCard requisition={requisition} />
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
