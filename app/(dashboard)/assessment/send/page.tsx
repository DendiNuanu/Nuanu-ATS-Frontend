"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Button, Avatar } from "@/components/ui";
import { mockCandidates } from "@/lib/mock-data";
import { ArrowLeft, ClipboardList, ChevronDown } from "lucide-react";

const assessmentTypes = ["Technical", "Behavioral", "Cognitive", "Case Study"];

export default function SendAssessmentPage() {
  const [threshold, setThreshold] = useState(70);
  const candidate = mockCandidates[3];

  return (
    <div className="max-w-5xl">
      {/* Sticky header */}
      <div className="sticky top-16 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 mb-6 bg-slate-50/80 backdrop-blur border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/assessment"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-heading">Send Assessment</h1>
            <p className="text-xs text-slate-500">Configure and send a test to a candidate</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Assessment Configuration">
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

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Assessment Title</label>
                <input
                  type="text"
                  defaultValue="Frontend Technical Test"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Type</label>
                  <div className="relative">
                    <select className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none appearance-none">
                      {assessmentTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Max Score</label>
                  <input
                    type="number"
                    defaultValue={100}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Instructions</label>
                <textarea
                  rows={5}
                  defaultValue="Please complete this assessment within 60 minutes. You may use any online resources, but collaboration is not permitted. Good luck!"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Time Limit (minutes)</label>
                <input
                  type="number"
                  defaultValue={60}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right: sticky pass-threshold card */}
        <div className="lg:col-span-1">
          <div className="sticky top-32">
            <Card title="Pass Threshold">
              <div className="flex flex-col items-center text-center py-4">
                <div className="h-32 w-32 rounded-full bg-[#e6f5f3] flex items-center justify-center mb-4">
                  <span className="text-4xl font-bold text-[#006b5f] font-heading">{threshold}%</span>
                </div>
                <p className="text-sm text-slate-500 mb-6">
                  Candidates scoring below this threshold will be flagged for review.
                </p>

                <div className="w-full">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-[#006b5f]"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-5">
                  <Avatar name={candidate.name} size="md" color={candidate.avatarColor} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{candidate.name}</p>
                    <p className="text-xs text-slate-500 truncate">{candidate.position}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button variant="primary" className="w-full" icon={<ClipboardList className="h-4 w-4" />} onClick={() => console.log("send")}>
                    Send Assessment
                  </Button>
                  <Link href="/assessment">
                    <Button variant="secondary" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
