import { fetchCandidateOptions } from "@/lib/data-access";
import { ScheduleInterviewClient } from "./ScheduleInterviewClient";

export const dynamic = "force-dynamic";

export default async function ScheduleInterviewPage() {
  const candidates = await fetchCandidateOptions();

  return <ScheduleInterviewClient candidates={candidates} />;
}
