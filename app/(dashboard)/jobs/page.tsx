import { fetchVacancies } from "@/lib/data-access";
import { JobsClient } from "./JobsClient";

// Always render fresh data — never serve a stale cached list after a
// create/update mutation.
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await fetchVacancies();

  return <JobsClient initialJobs={jobs} />;
}
