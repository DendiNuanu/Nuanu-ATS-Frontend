import { fetchVacancies } from "@/lib/data-access";
import { JobsClient } from "./JobsClient";

export default async function JobsPage() {
  const jobs = await fetchVacancies();

  return <JobsClient initialJobs={jobs} />;
}
