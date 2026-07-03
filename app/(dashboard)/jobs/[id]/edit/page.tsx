import { notFound } from "next/navigation";
import { fetchVacancyById, fetchDepartmentNames } from "@/lib/data-access";
import { EditVacancyClient } from "./EditVacancyClient";

export const dynamic = "force-dynamic";

export default async function EditVacancyPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [vacancy, departments] = await Promise.all([
    fetchVacancyById(id),
    fetchDepartmentNames(),
  ]);

  if (!vacancy) notFound();

  return (
    <EditVacancyClient
      vacancy={vacancy}
      departments={departments}
    />
  );
}
