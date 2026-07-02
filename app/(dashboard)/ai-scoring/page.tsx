import { fetchAIScoringCandidates, fetchVacancyOptions } from "@/lib/data-access";
import { AIScoringClient } from "./AIScoringClient";

export default async function AIScoringPage() {
  const [candidates, vacancyOptions] = await Promise.all([
    fetchAIScoringCandidates(),
    fetchVacancyOptions(),
  ]);
  return <AIScoringClient candidates={candidates} vacancyOptions={vacancyOptions} />;
}
