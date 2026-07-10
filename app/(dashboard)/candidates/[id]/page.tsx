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
  const fromPage = first(searchParams.fromPage);
  const fromSearch = first(searchParams.fromSearch);
  const fromStage = first(searchParams.fromStage);
  const fromSort = first(searchParams.fromSort);
  const fromDir = first(searchParams.fromDir);

  // `backHref` maps the `from*` params back to the list page's own param names
  // (fromSearch → search, fromPage → page, …) so the "Back to Candidates"
  // button returns to the exact filtered/searched list state.
  const listParams = new URLSearchParams();
  if (fromPage) listParams.set("page", fromPage);
  if (fromSearch) listParams.set("search", fromSearch);
  if (fromStage) listParams.set("stage", fromStage);
  // Preserve the active sort so returning to the list keeps the same ordering.
  if (fromSort) listParams.set("sort", fromSort);
  if (fromDir) listParams.set("dir", fromDir);
  const backHref = `/candidates${listParams.toString() ? `?${listParams.toString()}` : ""}`;

  // `returnQuery` keeps the raw `from*` param names (e.g.
  // "?fromSearch=aditya&fromPage=1") so the list origin can be propagated
  // through the edit/compose/summary navigation chain. Downstream client
  // components read `fromSearch`/`fromPage`/… — NOT the mapped list names —
  // so we must NOT reuse `listParams` here (that would emit `?search=aditya`
  // and break the chain, dropping the search context after Save/Cancel).
  const fromParams = new URLSearchParams();
  if (fromPage) fromParams.set("fromPage", fromPage);
  if (fromSearch) fromParams.set("fromSearch", fromSearch);
  if (fromStage) fromParams.set("fromStage", fromStage);
  if (fromSort) fromParams.set("fromSort", fromSort);
  if (fromDir) fromParams.set("fromDir", fromDir);
  const returnQuery = fromParams.toString() ? `?${fromParams.toString()}` : "";

  return (
    <CandidateDetailClient
      candidate={candidate}
      reviewers={reviewers}
      backHref={backHref}
      returnQuery={returnQuery}
    />
  );
}
