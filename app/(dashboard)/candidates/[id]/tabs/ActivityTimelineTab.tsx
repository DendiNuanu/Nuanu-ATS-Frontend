"use client";

import { Card } from "@/components/ui";
import type { Candidate } from "@/lib/mock-data";
import { formatDateWita } from "@/lib/format-wita";
import {
  MailCheck,
  UserPlus,
  FileText,
  Ban,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

type ActivityEntry = {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  timestamp: string;
};

type Props = {
  candidate: Candidate;
};

export function ActivityTimelineTab({ candidate }: Props) {
  // Build a timeline of activities based on candidate data
  const entries: ActivityEntry[] = [];

  // 1. Application received
  entries.push({
    id: "applied",
    icon: <UserPlus className="h-4 w-4" />,
    iconBg: "bg-[#e6f5f3]",
    iconColor: "text-[#006b5f]",
    title: "Application Received",
    description: `Applied via ${candidate.source} for ${candidate.position}`,
    timestamp: formatDateWita(candidate.appliedDate),
  });

  // 2. Resume parsed / profile created
  entries.push({
    id: "resume",
    icon: <FileText className="h-4 w-4" />,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    title: "Resume Parsed",
    description: "Candidate profile created from uploaded resume",
    timestamp: formatDateWita(candidate.appliedDate),
  });

  // 3. AI scoring completed
  entries.push({
    id: "ai-score",
    icon: <Sparkles className="h-4 w-4" />,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    title: "AI Match Analysis Completed",
    description: `AI match score: ${candidate.aiMatch}%`,
    timestamp: formatDateWita(candidate.appliedDate),
  });

  // 4. Stage progression — show current stage
  entries.push({
    id: "stage",
    icon: <CheckCircle2 className="h-4 w-4" />,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    title: `Moved to ${candidate.stage}`,
    description: `Candidate stage updated to ${candidate.stage}`,
    timestamp: formatDateWita(candidate.appliedDate),
  });

  // 5. Rejection email sent (if applicable) — audit trail persists even if moved out of Rejected
  if (candidate.rejectionEmailSent) {
    entries.push({
      id: "rejection-email",
      icon: <MailCheck className="h-4 w-4" />,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
      title: "Rejection Email Sent",
      description: `Automated rejection email sent to ${candidate.name}${
        candidate.rejectionEmailSentAt ? ` · ${candidate.rejectionEmailSentAt}` : ""
      }`,
      timestamp: candidate.rejectionEmailSentAt ?? "—",
    });
  }

  // 6. Blacklisted (if applicable)
  if (candidate.isBlacklisted) {
    entries.push({
      id: "blacklisted",
      icon: <Ban className="h-4 w-4" />,
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
      title: "Added to Blacklist",
      description: candidate.blacklistReason
        ? `Reason: ${candidate.blacklistReason}`
        : "Candidate added to blacklist",
      timestamp: "—",
    });
  }

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-base font-bold text-slate-900 font-heading mb-1">
          Activity Timeline
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          A chronological record of key events for this candidate.
        </p>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />

          <ol className="space-y-6">
            {entries.map((entry) => (
              <li key={entry.id} className="relative flex gap-4">
                {/* Icon */}
                <div
                  className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ring-4 ring-white ${entry.iconBg} ${entry.iconColor}`}
                >
                  {entry.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.title}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {entry.description}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
                      <Clock className="h-3 w-3" />
                      {entry.timestamp}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}
