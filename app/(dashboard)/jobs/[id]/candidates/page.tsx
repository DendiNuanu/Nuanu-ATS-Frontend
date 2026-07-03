import { notFound } from "next/navigation";
import {
  fetchVacancyById,
  fetchCandidatesByVacancyPaginated,
  type CandidateFilters,
} from "@/lib/data-access";
import { JobCandidatesClient } from "./JobCandidatesClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function JobCandidatesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { id } = params;
  const vacancy = await fetchVacancyById(id);
  if (!vacancy) notFound();

  const page = Math.max(
    1,
    parseInt(String(searchParams.page ?? "1"), 10) || 1,
  );
  const search =
    typeof searchParams.search === "string" ? searchParams.search : "";
  const stage =
    typeof searchParams.stage === "string" ? searchParams.stage : "All";

  const filters: CandidateFilters = { search, stage };

  const { candidates, total } = await fetchCandidatesByVacancyPaginated(
    id,
    page,
    PAGE_SIZE,
    filters,
  );

  return (
    <JobCandidatesClient
      vacancyId={vacancy.id}
      vacancyTitle={vacancy.title}
      initialCandidates={candidates}
      page={page}
      total={total}
      pageSize={PAGE_SIZE}
      search={search}
      stage={stage}
    />
  );
}
