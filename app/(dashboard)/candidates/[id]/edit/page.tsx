import { fetchCandidateById, fetchDepartmentOptions } from "@/lib/data-access";
import { notFound } from "next/navigation";
import { EditCandidateClient } from "./EditCandidateClient";

export const dynamic = "force-dynamic";

export default async function EditCandidatePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [candidate, departments] = await Promise.all([
    fetchCandidateById(id),
    fetchDepartmentOptions(),
  ]);

  if (!candidate) {
    notFound();
  }

  return <EditCandidateClient candidate={candidate} departments={departments} />;
}
