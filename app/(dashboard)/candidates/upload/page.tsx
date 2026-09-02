import { fetchCustomPositionOptions, fetchVacancies } from "@/lib/data-access";
import { UploadCVClient } from "./UploadCVClient";

export const dynamic = "force-dynamic";

export default async function UploadCVPage() {
  // Fetch ALL non-deleted vacancies for the "Applied For" dropdown — not just
  // "Open" ones. Custom positions created from previous uploads are stored as
  // vacancies with status "Draft", so filtering by "Open" hid them and forced
  // HR to retype the same position every time. Closed vacancies are excluded
  // (no longer accepting candidates), as is the internal "General Application"
  // holding vacancy (a queue for legacy SEEK/custom imports, not a real
  // position HR would deliberately select).
  const allVacancies = await fetchVacancies();
  const selectableVacancies = allVacancies.filter(
    (v) => v.status !== "Closed" && v.title !== "General Application",
  );

  // Historical custom positions (typed by HR on earlier uploads, before custom
  // positions started being persisted as real vacancies) live on
  // Application.appliedFor slots under the GENERAL-APPLICATION holding
  // vacancy. Surface them in the dropdown so HR never has to retype e.g.
  // "Receptionist". Skip titles that already exist as a selectable vacancy
  // above to avoid duplicate options.
  const vacancyTitles = new Set(
    selectableVacancies.map((v) => v.title.trim().toLowerCase()),
  );
  const customPositions = (await fetchCustomPositionOptions()).filter(
    (title) => !vacancyTitles.has(title.trim().toLowerCase()),
  );

  return (
    <UploadCVClient
      vacancies={selectableVacancies}
      customPositions={customPositions}
    />
  );
}
