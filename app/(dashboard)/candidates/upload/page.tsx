import { fetchDepartmentOptions, fetchVacancies } from "@/lib/data-access";
import { UploadCVClient } from "./UploadCVClient";

export const dynamic = "force-dynamic";

export default async function UploadCVPage() {
  // Every selectable position is now backed by a real Vacancy row.
  // Draft vacancies remain selectable; Closed vacancies do not.
  const [allVacancies, departments] = await Promise.all([
    fetchVacancies(),
    fetchDepartmentOptions(),
  ]);

  const selectableVacancies = allVacancies.filter(
    (v) => v.status !== "Closed",
  );

  return (
    <UploadCVClient
      vacancies={selectableVacancies}
      departments={departments}
      customPositions={[]}
    />
  );
}
