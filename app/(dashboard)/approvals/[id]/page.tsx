"use client";

import Link from "next/link";
import { Card, StatusPill, Button, Avatar } from "@/components/ui";
import { mockRequisitions } from "@/lib/approvals-data";
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

export default function ApprovalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const requisition =
    mockRequisitions.find((r) => r.id === id) ?? mockRequisitions[0];

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
            value={new Date(requisition.postedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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
                    {new Date(step.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                )}
                {step.comment && (
                  <p className="text-xs text-slate-500 mt-2 italic max-w-[200px]">
                    “{step.comment}”
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

      {/* Decision card */}
      <Card title="Decision" subtitle="Provide your rationale and approve or reject.">
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Rationale
          </label>
          <textarea
            rows={4}
            placeholder="Add your comments for this decision..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button variant="destructive" icon={<XCircle className="h-4 w-4" />} onClick={() => console.log("reject", id)}>
            Reject
          </Button>
          <Button variant="primary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => console.log("approve", id)}>
            Approve
          </Button>
        </div>
      </Card>
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
