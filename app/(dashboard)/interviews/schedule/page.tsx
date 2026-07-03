import { fetchCandidateOptions } from "@/lib/data-access";
import { fetchCalendarConnected } from "@/lib/data-access";
import { ScheduleInterviewClient } from "./ScheduleInterviewClient";

export const dynamic = "force-dynamic";

export default async function ScheduleInterviewPage() {
  const [candidates, calendarConnected] = await Promise.all([
    fetchCandidateOptions(),
    fetchCalendarConnected(),
  ]);

  return (
    <ScheduleInterviewClient
      candidates={candidates}
      calendarConnected={calendarConnected}
    />
  );
}
