import { fetchCandidateById } from "@/lib/data-access";
import { CandidateDetailClient } from "./CandidateDetailClient";
import { notFound } from "next/navigation";

export default async function CandidateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const candidate = await fetchCandidateById(id);

  if (!candidate) {
    notFound();
  }

  return <CandidateDetailClient candidate={candidate} />;
}
