"use client";

import Link from "next/link";
import { PageHeader, Card, StatusPill, Button, Avatar } from "@/components/ui";
import { mockOffers } from "@/lib/mock-data";
import { formatIDR } from "@/lib/utils";
import { Plus, Eye, MoreHorizontal } from "lucide-react";

export default function OffersPage() {
  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle="Track offer letters and acceptance status."
        actions={
          <Link href="/offers/generate">
            <Button icon={<Plus className="h-4 w-4" />}>Generate Offer</Button>
          </Link>
        }
      />

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th className="text-left font-medium px-6 py-3">Candidate</th>
                <th className="text-left font-medium px-6 py-3">Position</th>
                <th className="text-left font-medium px-6 py-3">Monthly Salary</th>
                <th className="text-left font-medium px-6 py-3">Status</th>
                <th className="text-left font-medium px-6 py-3">Date</th>
                <th className="text-right font-medium px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockOffers.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={o.candidateName} size="md" />
                      <span className="font-medium text-slate-900">{o.candidateName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{o.position}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">{formatIDR(o.salary)}</td>
                  <td className="px-6 py-4">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(o.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="View">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="More">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
