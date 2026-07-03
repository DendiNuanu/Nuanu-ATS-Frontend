import Link from "next/link";
import { PageHeader, Card, Button, Avatar } from "@/components/ui";
import { fetchInterviews } from "@/lib/data-access";
import { Plus, Video, Phone, MapPin, Calendar, Clock, User, ExternalLink, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const typeConfig = {
  Video: { icon: Video, color: "text-blue-600 bg-blue-50" },
  Phone: { icon: Phone, color: "text-purple-600 bg-purple-50" },
  "On-site": { icon: MapPin, color: "text-teal-600 bg-teal-50" },
};

export default async function InterviewsPage() {
  const interviews = await fetchInterviews();

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

      {interviews.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-10 w-10 text-slate-300 mb-3" />
          <h3 className="font-heading text-lg font-semibold text-slate-900">
            No interviews scheduled
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Schedule an interview to see it here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {interviews.map((iv) => {
            const cfg = typeConfig[iv.type] ?? typeConfig["On-site"];
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

                {iv.calendarSynced && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Synced to Google Calendar
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    Reschedule
                  </Button>
                  {iv.meetingUrl ? (
                    <a href={iv.meetingUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="primary" size="sm" className="w-full">
                        Join
                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </a>
                  ) : (
                    <Button variant="primary" size="sm" className="flex-1" disabled>
                      No link
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
