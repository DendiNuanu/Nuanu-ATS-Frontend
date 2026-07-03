import { fetchDepartmentNames } from "@/lib/data-access";
import { CreateVacancyClient } from "./CreateVacancyClient";

export const dynamic = "force-dynamic";

export default async function CreateVacancyPage() {
  const departments = await fetchDepartmentNames();
  return <CreateVacancyClient departments={departments} />;
}
