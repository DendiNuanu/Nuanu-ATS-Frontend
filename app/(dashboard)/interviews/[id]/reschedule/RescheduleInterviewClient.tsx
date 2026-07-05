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
import { formatWeekdayDateWita, formatTimeWita } from "@/lib/format-wita";

const interviewTypes = [
  { id: "video", label: "Video", icon: Video },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "onsite", label: "On-site", icon: MapPin },
];

export interface RescheduleInterviewData {
  id: string;
  scheduledAt: string; // ISO
  duration: number;
  type: string;
  location: string;
  meetingUrl: string;
  notes: string;
  calendarSynced: boolean;
  calendarEventId: string | null;
  candidateName: string;
  candidateEmail: string | null;
  position: string;
  interviewerName: string;
}

export function RescheduleInterviewClient({
  interview,
  calendarConnected,
}: {
  interview: RescheduleInterviewData;
  calendarConnected: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  // Pre-fill the form with the existing interview data.
  // scheduledAt is stored as UTC; we need to display the WITA date/time
  // for the input fields. We use Intl to extract WITA components.
  const initialDate = formatWitaDateInput(interview.scheduledAt);
  const initialTime = formatWitaTimeInput(interview.scheduledAt);

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(interview.duration);
  const [type, setType] = useState(interview.type);
  const [location, setLocation] = useState(interview.location);
  const [meetingUrl, setMeetingUrl] = useState(interview.meetingUrl);
  const [notes, setNotes] = useState(interview.notes);
  const [submitting, setSubmitting] = useState(false);

  // Default date to today if empty
  const effectiveDate = date || new Date().toISOString().slice(0, 10);

  const handleSubmit = async () => {
    if (!date) {
      showToast("Please select a date", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/interviews?id=${interview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: effectiveDate,
          time,
          duration,
          type,
          location: type === "onsite" ? location : undefined,
          meetingUrl: type !== "onsite" ? meetingUrl : undefined,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to reschedule interview");
      }

      // Build a success message reflecting email + calendar status.
      let message = "Interview rescheduled successfully!";
      if (data.emailSent && data.candidateEmail) {
        message = `Interview rescheduled. Notification email sent to ${data.candidateEmail}.`;
      } else if (data.emailSent) {
        message = "Interview rescheduled. Notification email sent to the candidate.";
      } else if (data.emailError) {
        message = `Interview rescheduled, but the notification email could not be sent (${data.emailError}).`;
      }

      if (data.calendarSynced) {
        message += " Google Calendar event updated.";
      }

      showToast(message, "success");

      router.push("/interviews");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reschedule";
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
            <h1 className="text-xl font-bold text-slate-900 font-heading">Reschedule Interview</h1>
            <p className="text-xs text-slate-500">Update the interview details for {interview.candidateName}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Interview Details">
            <div className="space-y-5">
              {/* Read-only candidate info */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                <Avatar name={interview.candidateName} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {interview.candidateName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{interview.position}</p>
                </div>
                <span className="ml-auto text-xs text-slate-400">
                  Interviewer: {interview.interviewerName}
                </span>
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
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Time (WITA)</label>
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
                    Meeting URL
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

              {/* Calendar sync status (read-only on reschedule) */}
              {interview.calendarSynced && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700">
                    This interview is synced to Google Calendar. The calendar event will be updated automatically.
                  </span>
                </div>
              )}
              {!interview.calendarSynced && calendarConnected && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    Not synced to Google Calendar. Only the interview record will be updated.
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: sticky summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-32">
            <Card title="Summary">
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
                <Avatar name={interview.candidateName} size="lg" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{interview.candidateName}</p>
                  <p className="text-xs text-slate-500 truncate">{interview.position}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {date
                    ? formatWeekdayDateWita(new Date(`${effectiveDate}T${time}:00+08:00`))
                    : "Select a date"}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {time} —{" "}
                  {formatTimeWita(
                    new Date(
                      new Date(`${effectiveDate}T${time}:00+08:00`).getTime() + duration * 60000,
                    ),
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  {type === "video" && <Video className="h-4 w-4 text-slate-400" />}
                  {type === "phone" && <Phone className="h-4 w-4 text-slate-400" />}
                  {type === "onsite" && <MapPin className="h-4 w-4 text-slate-400" />}
                  {interviewTypes.find((t) => t.id === type)?.label} interview
                </div>
                {interview.calendarSynced && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Check className="h-4 w-4" />
                    Calendar event will be updated
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
                      Rescheduling...
                    </>
                  ) : (
                    "Confirm Reschedule"
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

// ---------------------------------------------------------------------------
// Helpers: extract WITA date/time strings from an ISO timestamp for the
// <input type="date"> / <input type="time"> default values.
// ---------------------------------------------------------------------------

const WITA_TZ = "Asia/Makassar";

function formatWitaDateInput(iso: string): string {
  // Returns YYYY-MM-DD in WITA.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WITA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

function formatWitaTimeInput(iso: string): string {
  // Returns HH:MM in WITA (24-hour).
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === "hour")?.value ?? "10";
  const min = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${min}`;
}
