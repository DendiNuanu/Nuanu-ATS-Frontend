"use client";

import Link from "next/link";
import { PageHeader, Card, Button, Avatar } from "@/components/ui";
import { mockInterviews } from "@/lib/mock-data";
import { Plus, Video, Phone, MapPin, Calendar, Clock, User } from "lucide-react";

const typeConfig = {
  Video: { icon: Video, color: "text-blue-600 bg-blue-50" },
  Phone: { icon: Phone, color: "text-purple-600 bg-purple-50" },
  "On-site": { icon: MapPin, color: "text-teal-600 bg-teal-50" },
};

export default function InterviewsPage() {
  return (
    <div>
      <PageHeader
        title="Interviews"
        subtitle="Upcoming and recent interviews across all vacancies."
        actions={
          <Link href="/interviews/schedule">
            <Button icon={<Plus className="h-4 w-4" />}>Schedule Interview</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockInterviews.map((iv) => {
          const cfg = typeConfig[iv.type];
          const Icon = cfg.icon;
          return (
            <Card key={iv.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${cfg.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {iv.type}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Avatar name={iv.candidateName} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {iv.candidateName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{iv.position}</p>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {new Date(iv.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {iv.time}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <User className="h-4 w-4 text-slate-400" />
                  {iv.interviewer}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => console.log("reschedule", iv.id)}>
                  Reschedule
                </Button>
                <Button variant="primary" size="sm" className="flex-1" onClick={() => console.log("join", iv.id)}>
                  Join
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
