import { fetchCandidateById, fetchReviewerOptions } from "@/lib/data-access";
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
  const [candidate, reviewers] = await Promise.all([
    fetchCandidateById(id),
    fetchReviewerOptions(),
  ]);

  if (!candidate) {
    notFound();
  }

  // Reconstruct the "Back to Candidates" href from the list state that was
  // passed through as query params (fromPage / fromSearch / fromStage /
  // fromSort / fromDir). `searchParams` values can be `string | string[] |
  // undefined` — normalise to a single string (first value when an array is
  // passed).
  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const listParams = new URLSearchParams();
  const fromPage = first(searchParams.fromPage);
  const fromSearch = first(searchParams.fromSearch);
  const fromStage = first(searchParams.fromStage);
  const fromSort = first(searchParams.fromSort);
  const fromDir = first(searchParams.fromDir);
  if (fromPage) listParams.set("page", fromPage);
  if (fromSearch) listParams.set("search", fromSearch);
  if (fromStage) listParams.set("stage", fromStage);
  // Preserve the active sort so returning to the list keeps the same ordering.
  if (fromSort) listParams.set("sort", fromSort);
  if (fromDir) listParams.set("dir", fromDir);
  const backHref = `/candidates${listParams.toString() ? `?${listParams.toString()}` : ""}`;

  return (
    <CandidateDetailClient
      candidate={candidate}
      reviewers={reviewers}
      backHref={backHref}
    />
  );
}
