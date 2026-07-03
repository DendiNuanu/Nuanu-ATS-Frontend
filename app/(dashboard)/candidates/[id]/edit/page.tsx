import { fetchCandidateById } from "@/lib/data-access";
import { notFound } from "next/navigation";
import { EditCandidateClient } from "./EditCandidateClient";

export const dynamic = "force-dynamic";

export default async function EditCandidatePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const candidate = await fetchCandidateById(id);

  if (!candidate) {
    notFound();
  }

  return <EditCandidateClient candidate={candidate} />;
}
