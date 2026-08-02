import { fetchCandidateById } from "@/lib/data-access";
import { CandidateSummaryClient } from "./CandidateSummaryClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CandidateSummaryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { id } = params;
  const candidate = await fetchCandidateById(id);

  if (!candidate) {
    notFound();
  }

  const fromParams = new URLSearchParams();
  for (const key of ["fromPage", "fromSearch", "fromStage", "fromSort", "fromDir"]) {
    const value = searchParams[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) fromParams.set(key, first);
  }
  const query = fromParams.toString();

  return (
    <CandidateSummaryClient
      candidate={candidate}
      returnQuery={query ? `?${query}` : ""}
    />
  );
}
