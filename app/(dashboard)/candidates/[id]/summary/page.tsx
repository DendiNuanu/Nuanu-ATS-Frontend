import { fetchCandidateById } from "@/lib/data-access";
import { CandidateSummaryClient } from "./CandidateSummaryClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CandidateSummaryPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const candidate = await fetchCandidateById(id);

  if (!candidate) {
    notFound();
  }

  return <CandidateSummaryClient candidate={candidate} />;
}
