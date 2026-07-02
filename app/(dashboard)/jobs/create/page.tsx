import { fetchDepartmentNames } from "@/lib/data-access";
import { CreateVacancyClient } from "./CreateVacancyClient";

export default async function CreateVacancyPage() {
  const departments = await fetchDepartmentNames();
  return <CreateVacancyClient departments={departments} />;
}
