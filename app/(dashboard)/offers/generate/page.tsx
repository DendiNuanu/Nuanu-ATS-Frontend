"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Button, Avatar } from "@/components/ui";
import { mockCandidates } from "@/lib/mock-data";
import { formatIDR } from "@/lib/utils";
import { ArrowLeft, FileCheck2, Calendar } from "lucide-react";

const quickStartDates = [
  { label: "1 week", value: "2026-07-09" },
  { label: "2 weeks", value: "2026-07-16" },
  { label: "1 month", value: "2026-08-02" },
  { label: "Immediate", value: "2026-07-03" },
];

export default function GenerateOfferPage() {
  const [startDate, setStartDate] = useState("2026-07-16");
  const [salary, setSalary] = useState(28000000);
  const [signingBonus, setSigningBonus] = useState(5000000);
  const candidate = mockCandidates[2];

  const totalPackage = salary * 12 + signingBonus;

  return (
    <div className="max-w-5xl">
      {/* Sticky header */}
      <div className="sticky top-16 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 mb-6 bg-slate-50/80 backdrop-blur border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/offers"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-heading">Generate Offer</h1>
            <p className="text-xs text-slate-500">Compose an offer letter for a candidate</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Offer Details">
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Candidate</label>
                <select className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none">
                  {mockCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.position}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Monthly Salary (IDR)</label>
                  <input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(Number(e.target.value))}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Signing Bonus (IDR)</label>
                  <input
                    type="number"
                    value={signingBonus}
                    onChange={(e) => setSigningBonus(Number(e.target.value))}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Equity / Options</label>
                  <input
                    type="text"
                    defaultValue="0.05% vested over 4 years"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Offer Expiry</label>
                  <input
                    type="date"
                    defaultValue="2026-07-10"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Benefits</label>
                <textarea
                  rows={4}
                  defaultValue="Health insurance (family coverage), BPJS Kesehatan & Ketenagakerjaan, 12 days annual leave, flexible working hours, remote-friendly policy, learning & development budget Rp 10M/year."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Start Date</label>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {quickStartDates.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setStartDate(d.value)}
                      className={`h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                        startDate === d.value
                          ? "bg-[#006b5f] text-white"
                          : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Internal Notes</label>
                <textarea
                  rows={3}
                  placeholder="Add any internal notes (not visible to candidate)..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right: sticky summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-32">
            <Card title="Offer Summary">
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
                <Avatar name={candidate.name} size="lg" color={candidate.avatarColor} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{candidate.name}</p>
                  <p className="text-xs text-slate-500 truncate">{candidate.position}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Monthly Salary</span>
                  <span className="font-semibold text-slate-900">{formatIDR(salary)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Signing Bonus</span>
                  <span className="font-semibold text-slate-900">{formatIDR(signingBonus)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Start Date</span>
                  <span className="font-medium text-slate-700">
                    {new Date(startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-slate-500">Annual Package</span>
                  <span className="text-base font-bold text-[#006b5f]">{formatIDR(totalPackage)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Button variant="primary" className="w-full" icon={<FileCheck2 className="h-4 w-4" />} onClick={() => console.log("generate")}>
                  Generate Offer
                </Button>
                <Link href="/offers">
                  <Button variant="secondary" className="w-full">
                    Cancel
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
