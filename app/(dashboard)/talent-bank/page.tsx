import {
  fetchCandidatesPaginated,
  type CandidateFilters,
} from "@/lib/data-access";
import { TalentBankClient } from "./TalentBankClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function TalentBankPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1);
  const search = typeof searchParams.search === "string" ? searchParams.search : "";

  const filters: CandidateFilters = { search, talentBankOnly: true };

  const { candidates, total } = await fetchCandidatesPaginated(
    page,
    PAGE_SIZE,
    filters,
  );

  return (
    <TalentBankClient
      initialCandidates={candidates}
      page={page}
      total={total}
      pageSize={PAGE_SIZE}
      search={search}
    />
  );
}
