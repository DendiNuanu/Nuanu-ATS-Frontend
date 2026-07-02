import {
  fetchCandidatesPaginated,
  type CandidateFilters,
} from "@/lib/data-access";
import { CandidatesClient } from "./CandidatesClient";

const PAGE_SIZE = 50;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1);
  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  const stage = typeof searchParams.stage === "string" ? searchParams.stage : "All";

  const filters: CandidateFilters = { search, stage };

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
    />
  );
}
