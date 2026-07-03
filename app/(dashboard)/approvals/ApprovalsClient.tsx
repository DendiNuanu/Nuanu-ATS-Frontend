"use client";

import Link from "next/link";
import { PageHeader, Card, StatusPill, Button, Avatar } from "@/components/ui";
import type { RequisitionRow } from "@/lib/data-access";
import { formatDateWita } from "@/lib/format-wita";
import {
  Briefcase,
  MapPin,
  Users,
  DollarSign,
  Calendar,
  Plus,
  ArrowRight,
  CheckCircle2,
  Pencil,
  Trash2,
} from "lucide-react";

export function ApprovalsClient({ pending }: { pending: RequisitionRow[] }) {
  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Review and act on pending hiring requisitions."
        actions={
          <Link href="/approvals/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New Requisition
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        {pending.map((req) => (
          <RequisitionCard key={req.id} req={req} />
        ))}

        {pending.length === 0 && (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f5f3]">
              <CheckCircle2 className="h-6 w-6 text-[#006b5f]" />
            </div>
            <p className="text-sm font-medium text-slate-900">All caught up</p>
            <p className="text-xs text-slate-500 mt-1">
              There are no pending requisitions awaiting your review.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function RequisitionCard({ req }: { req: RequisitionRow }) {
  return (
    <Card className="transition-shadow hover:shadow-md group">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left — title + meta */}
        <div className="flex items-start gap-4 min-w-0">
          <div className="h-12 w-12 rounded-xl bg-[#e6f5f3] flex items-center justify-center flex-shrink-0">
            <Briefcase className="h-6 w-6 text-[#006b5f]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 font-heading">
                {req.title}
              </h2>
              <StatusPill status={req.status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {req.department} · {req.employmentType}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                {req.openings} {req.openings === 1 ? "opening" : "openings"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {req.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                {req.budget}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {formatDateWita(req.postedDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Right — requester + actions */}
        <div className="flex items-center gap-4 flex-shrink-0 lg:flex-col lg:items-end">
          <div className="flex items-center gap-2">
            <Avatar name={req.postedBy} size="sm" />
            <div className="leading-tight">
              <p className="text-xs text-slate-400">Requested by</p>
              <p className="text-sm font-medium text-slate-700">{req.postedBy}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/approvals/${req.id}`}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#006b5f] transition-colors"
              aria-label="Edit requisition"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              type="button"
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              aria-label="Delete requisition"
              onClick={() => {
                if (confirm(`Delete requisition "${req.title}"? This action cannot be undone.`)) {
                  fetch(`/api/requisitions/${req.id}`, { method: "DELETE" }).then(() => {
                    window.location.reload();
                  });
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <Link href={`/approvals/${req.id}`}>
              <Button variant="secondary" size="md">
                Review
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
