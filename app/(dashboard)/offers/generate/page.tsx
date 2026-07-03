import { fetchCandidateOptions } from "@/lib/data-access";
import { GenerateOfferClient } from "./GenerateOfferClient";

export const dynamic = "force-dynamic";

export default async function GenerateOfferPage() {
  const candidates = await fetchCandidateOptions();

  return <GenerateOfferClient candidates={candidates} />;
}
