import { fetchVacancies } from "@/lib/data-access";
import { UploadCVClient } from "./UploadCVClient";

export default async function UploadCVPage() {
  // Fetch active vacancies for the "Applied For" dropdown
  const allVacancies = await fetchVacancies();
  const activeVacancies = allVacancies.filter((v) => v.status === "Open");

  return <UploadCVClient vacancies={activeVacancies} />;
}
