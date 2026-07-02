import { fetchCandidateById } from "@/lib/data-access";
import { notFound } from "next/navigation";
import { CandidateComposeClient } from "./CandidateComposeClient";

export default async function CandidateComposePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const candidate = await fetchCandidateById(id);

  if (!candidate) {
    notFound();
  }

  return <CandidateComposeClient candidate={candidate} />;
}
