import type { Stage } from "@/lib/mock-data";

export type CandidateGroupStage = Stage | "Blacklisted";
export type CandidateGroupStageFilter = CandidateGroupStage | "All";

export function resolveCandidateGroupStage(
  representativeStage: Stage,
  isBlacklisted: boolean,
): CandidateGroupStage {
  return isBlacklisted ? "Blacklisted" : representativeStage;
}

export function matchesCandidateGroupStage(
  groupStage: CandidateGroupStage,
  filter: CandidateGroupStageFilter | string | undefined,
): boolean {
  return !filter || filter === "All" || groupStage === filter;
}
