import { fetchCandidateById } from "@/lib/data-access";
import { notFound } from "next/navigation";
import { EditBlacklistReasonClient } from "./EditBlacklistReasonClient";

export const dynamic = "force-dynamic";

export default async function EditBlacklistReasonPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const candidate = await fetchCandidateById(id);
  if (!candidate) {
    notFound();
  }
  // Guard: only blacklisted candidates have an editable blacklist reason.
  if (!candidate.isBlacklisted) {
    notFound();
  }
  return <EditBlacklistReasonClient candidate={candidate} />;
}
