import { fetchCandidateOptions } from "@/lib/data-access";
import { ComposeEmailClient } from "./ComposeEmailClient";

export const dynamic = "force-dynamic";

export default async function ComposeEmailPage() {
  const candidates = await fetchCandidateOptions();

  return <ComposeEmailClient candidates={candidates} />;
}
