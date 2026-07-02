"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Button, Avatar } from "@/components/ui";
import { mockCandidates } from "@/lib/mock-data";
import { ArrowLeft, Video, Phone, MapPin, Calendar, Clock, Check } from "lucide-react";

const interviewTypes = [
  { id: "video", label: "Video", icon: Video },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "onsite", label: "On-site", icon: MapPin },
];

export default function ScheduleInterviewPage() {
  const [type, setType] = useState("video");
  const [syncCalendar, setSyncCalendar] = useState(true);
  const candidate = mockCandidates[1];

  return (
    <div className="max-w-5xl">
      {/* Sticky header */}
      <div className="sticky top-16 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 mb-6 bg-slate-50/80 backdrop-blur border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/interviews"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-heading">Schedule Interview</h1>
            <p className="text-xs text-slate-500">Set up a new interview slot</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Interview Details">
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Candidate
                </label>
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
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
                  <input
                    type="date"
                    defaultValue="2026-07-10"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Time</label>
                  <input
                    type="time"
                    defaultValue="10:00"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Interview Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {interviewTypes.map((t) => {
                    const Icon = t.icon;
                    const active = type === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setType(t.id)}
                        className={`h-16 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-colors ${
                          active
                            ? "border-[#006b5f] bg-[#e6f5f3] text-[#006b5f]"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {type === "onsite" ? (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Nuanu HQ, Meeting Room 3"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Meeting URL</label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/xxx-yyyy-zzz"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes (optional)</label>
                <textarea
                  rows={3}
                  placeholder="Add any notes for the candidate or interviewer..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setSyncCalendar(!syncCalendar)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${syncCalendar ? "bg-[#006b5f]" : "bg-slate-300"}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${syncCalendar ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </button>
                <span className="text-sm text-slate-700">Sync with Google Calendar</span>
              </label>
            </div>
          </Card>
        </div>

        {/* Right: sticky summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-32">
            <Card title="Summary">
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
                <Avatar name={candidate.name} size="lg" color={candidate.avatarColor} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{candidate.name}</p>
                  <p className="text-xs text-slate-500 truncate">{candidate.position}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Fri, 10 Jul 2026
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  10:00 — 11:00
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  {type === "video" && <Video className="h-4 w-4 text-slate-400" />}
                  {type === "phone" && <Phone className="h-4 w-4 text-slate-400" />}
                  {type === "onsite" && <MapPin className="h-4 w-4 text-slate-400" />}
                  {interviewTypes.find((t) => t.id === type)?.label} interview
                </div>
                {syncCalendar && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Check className="h-4 w-4" />
                    Calendar event will be created
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-2">
                <Button variant="primary" className="w-full" onClick={() => console.log("confirm")}>
                  Confirm Schedule
                </Button>
                <Link href="/interviews">
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
