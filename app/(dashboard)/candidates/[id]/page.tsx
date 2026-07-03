import { fetchCandidateById } from "@/lib/data-access";
import { CandidateDetailClient } from "./CandidateDetailClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
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

  // Reconstruct the "Back to Candidates" href from the list state that was
  // passed through as query params (fromPage / fromSearch / fromStage).
  // `searchParams` values can be `string | string[] | undefined` — normalise
  // to a single string (first value when an array is passed).
  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const listParams = new URLSearchParams();
  const fromPage = first(searchParams.fromPage);
  const fromSearch = first(searchParams.fromSearch);
  const fromStage = first(searchParams.fromStage);
  if (fromPage) listParams.set("page", fromPage);
  if (fromSearch) listParams.set("search", fromSearch);
  if (fromStage) listParams.set("stage", fromStage);
  const backHref = `/candidates${listParams.toString() ? `?${listParams.toString()}` : ""}`;

  return <CandidateDetailClient candidate={candidate} backHref={backHref} />;
}
