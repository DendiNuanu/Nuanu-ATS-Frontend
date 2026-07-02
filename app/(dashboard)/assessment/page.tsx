import { fetchAssessments } from "@/lib/data-access";
import { AssessmentClient } from "./AssessmentClient";

export default async function AssessmentPage() {
  const { assessments, stats } = await fetchAssessments();
  return <AssessmentClient assessments={assessments} stats={stats} />;
}
