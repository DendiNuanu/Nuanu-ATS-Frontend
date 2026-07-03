import { fetchCandidates, fetchVacancyOptions } from "@/lib/data-access";
import { PipelineClient } from "./PipelineClient";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [candidates, vacancyOptions] = await Promise.all([
    fetchCandidates(),
    fetchVacancyOptions(),
  ]);

  return (
    <PipelineClient
      initialCandidates={candidates}
      vacancyOptions={vacancyOptions}
    />
  );
}
