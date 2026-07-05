"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button, Avatar } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  Video,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Check,
  Loader2,
} from "lucide-react";
import type { CandidateOption } from "@/lib/data-access";
import { formatWeekdayDateWita, formatTimeWita } from "@/lib/format-wita";

const interviewTypes = [
  { id: "video", label: "Video", icon: Video },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "onsite", label: "On-site", icon: MapPin },
];

export function ScheduleInterviewClient({
  candidates,
  calendarConnected,
}: {
  candidates: CandidateOption[];
  calendarConnected: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [type, setType] = useState("video");
  const [syncCalendar, setSyncCalendar] = useState(calendarConnected);
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const candidate = candidates.find((c) => c.id === selectedId) ?? candidates[0];

  // Default date to tomorrow if empty
  const effectiveDate = date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const handleSubmit = async () => {
    if (!selectedId) {
      showToast("Please select a candidate", "error");
      return;
    }
    if (!date) {
      showToast("Please select a date", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: selectedId,
          type,
          date: effectiveDate,
          time,
          duration,
          location: type === "onsite" ? location : undefined,
          meetingUrl: type !== "onsite" ? meetingUrl : undefined,
          notes,
          syncCalendar,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to schedule interview");
      }

      // Build a success message that reflects both the interview creation
      // and the email invitation send status.
      let message = "Interview scheduled successfully!";
      if (data.emailSent && data.candidateEmail) {
        message = `Interview scheduled. Invitation email sent to ${data.candidateEmail}.`;
      } else if (data.emailSent) {
        message = "Interview scheduled. Invitation email sent to the candidate.";
      } else if (data.emailError) {
        // Partial success: interview was created but email failed.
        message = `Interview scheduled, but the invitation email could not be sent (${data.emailError}).`;
      }

      if (data.calendarSynced) {
        message += " Synced to Google Calendar.";
      } else if (syncCalendar && !data.calendarSynced) {
        message += " (Calendar sync skipped — connect Google Calendar in Settings)";
      }

      showToast(message, "success");

      router.push("/interviews");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to schedule";
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

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
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                >
                  {candidates.length === 0 ? (
                    <option value="">No candidates available</option>
                  ) : (
                    candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.position}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Duration (minutes)
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={120}>120 minutes</option>
                </select>
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
                        type="button"
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
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Nuanu HQ, Meeting Room 3"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Meeting URL {syncCalendar && calendarConnected && "(auto-generated if left blank)"}
                  </label>
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/xxx-yyyy-zzz"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes for the candidate or interviewer..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none"
                />
              </div>

              {/* Google Calendar sync toggle */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={syncCalendar}
                    onClick={() => setSyncCalendar(!syncCalendar)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#006b5f]/20 focus:ring-offset-2 ${
                      syncCalendar ? "bg-[#006b5f]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        syncCalendar ? "translate-x-5" : "translate-x-0.5"
                      } mt-0.5`}
                    />
                  </button>
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      Sync with Google Calendar
                    </span>
                    {!calendarConnected && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Not connected —{" "}
                        <Link href="/settings" className="underline hover:text-amber-700">
                          connect in Settings
                        </Link>
                      </p>
                    )}
                    {calendarConnected && syncCalendar && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        A Google Meet link will be auto-generated
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: sticky summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-32">
            <Card title="Summary">
              {candidate ? (
                <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
                  <Avatar name={candidate.name} size="lg" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{candidate.name}</p>
                    <p className="text-xs text-slate-500 truncate">{candidate.position}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 mb-5 pb-5 border-b border-slate-100">
                  No candidate selected
                </p>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {date
                    ? formatWeekdayDateWita(new Date(`${effectiveDate}T${time}:00`))
                    : "Select a date"}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {time} —{" "}
                  {formatTimeWita(
                    new Date(
                      new Date(`${effectiveDate}T${time}:00`).getTime() + duration * 60000,
                    ),
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  {type === "video" && <Video className="h-4 w-4 text-slate-400" />}
                  {type === "phone" && <Phone className="h-4 w-4 text-slate-400" />}
                  {type === "onsite" && <MapPin className="h-4 w-4 text-slate-400" />}
                  {interviewTypes.find((t) => t.id === type)?.label} interview
                </div>
                {syncCalendar && calendarConnected && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Check className="h-4 w-4" />
                    Calendar event + Meet link will be created
                  </div>
                )}
                {syncCalendar && !calendarConnected && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Clock className="h-4 w-4" />
                    Calendar not connected
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    "Confirm Schedule"
                  )}
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
