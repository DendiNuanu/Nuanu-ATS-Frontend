import { fetchCandidateOptions } from "@/lib/data-access";
import { SendAssessmentClient } from "./SendAssessmentClient";

export const dynamic = "force-dynamic";

export default async function SendAssessmentPage() {
  const candidates = await fetchCandidateOptions();

  return <SendAssessmentClient candidates={candidates} />;
}
