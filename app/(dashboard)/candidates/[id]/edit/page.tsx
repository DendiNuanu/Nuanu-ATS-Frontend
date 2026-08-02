import { fetchCandidateById, fetchDepartmentOptions } from "@/lib/data-access";
import { notFound } from "next/navigation";
import { EditCandidateClient } from "./EditCandidateClient";

export const dynamic = "force-dynamic";

export default async function EditCandidatePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { id } = params;
  const [candidate, departments] = await Promise.all([
    fetchCandidateById(id),
    fetchDepartmentOptions(),
  ]);

  if (!candidate) {
    notFound();
  }

  return (
    <EditCandidateClient
      candidate={candidate}
      departments={departments}
      returnQuery={buildReturnQuery(searchParams)}
    />
  );
}

function buildReturnQuery(
  searchParams: { [key: string]: string | string[] | undefined },
): string {
  const params = new URLSearchParams();
  for (const key of ["fromPage", "fromSearch", "fromStage", "fromSort", "fromDir"]) {
    const value = searchParams[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) params.set(key, first);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
