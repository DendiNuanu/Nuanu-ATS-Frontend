import {
  fetchCandidatesPaginated,
  parseCandidateSort,
  type CandidateFilters,
} from "@/lib/data-access";
import { CandidatesClient } from "./CandidatesClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1);
  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  const stage = typeof searchParams.stage === "string" ? searchParams.stage : "All";

  // Parse + validate the sort field/direction from the URL. Falls back to the
  // default (Applied Date desc) for unknown/missing values so the list is
  // always deterministically ordered. Sorting is applied server-side across
  // the FULL filtered dataset (not just the visible page) — consistent with
  // how search/stage filtering already works.
  const sortParam =
    typeof searchParams.sort === "string" ? searchParams.sort : undefined;
  const dirParam =
    typeof searchParams.dir === "string" ? searchParams.dir : undefined;
  const sort = parseCandidateSort(sortParam, dirParam);

  const filters: CandidateFilters = {
    search,
    stage,
    sort: sort.field,
    sortDir: sort.dir,
  };

  const { candidates, total } = await fetchCandidatesPaginated(
    page,
    PAGE_SIZE,
    filters,
  );

  return (
    <CandidatesClient
      initialCandidates={candidates}
      page={page}
      total={total}
      pageSize={PAGE_SIZE}
      search={search}
      stage={stage}
      sort={sort.field}
      sortDir={sort.dir}
    />
  );
}
