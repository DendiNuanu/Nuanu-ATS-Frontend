import type { Candidate } from "@/lib/mock-data";

type SortableTimelineEvent = {
  id: string;
  applicationId?: string;
  eventType: string;
  title: string;
  sourceAt: string | null;
  displayAt: string | null;
};

type CandidateContext = Pick<
  Candidate,
  "id" | "appliedDate" | "applicationHistory"
>;

const sortTime = (
  value: string | null | undefined,
): number => {
  if (!value) return -Infinity;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : -Infinity;
};

const phase = (event: SortableTimelineEvent): number => {
  if (
    event.eventType === "pipeline_stage" &&
    event.title.trim().toLowerCase() === "moved to new"
  ) return 0;

  if (event.eventType === "application_received") return 1;
  if (event.eventType === "resume_parsed") return 2;

  return 3;
};

// Shared by Profile Activity Timeline and Candidate Summary.
// PDF uses the rendered Candidate Summary.
export function sortCandidateTimeline<
  T extends SortableTimelineEvent
>(
  entries: readonly T[],
  candidate: CandidateContext,
): T[] {
  const applicationDates = new Map<string, number>();

  applicationDates.set(
    candidate.id,
    sortTime(candidate.appliedDate),
  );

  for (const app of candidate.applicationHistory ?? []) {
    applicationDates.set(
      app.id,
      sortTime(app.appliedDate),
    );
  }

  return [...entries].sort((a, b) => {
    const aApp = a.applicationId ?? candidate.id;
    const bApp = b.applicationId ?? candidate.id;

    if (aApp !== bApp) {
      const aStart = applicationDates.get(aApp) ?? Infinity;
      const bStart = applicationDates.get(bApp) ?? Infinity;

      if (aStart !== bStart) {
        return aStart < bStart ? -1 : 1;
      }

      return aApp.localeCompare(bApp);
    }

    const phaseDiff = phase(a) - phase(b);
    if (phaseDiff) return phaseDiff;

    const aTime = sortTime(a.displayAt ?? a.sourceAt);
    const bTime = sortTime(b.displayAt ?? b.sourceAt);

    if (aTime !== bTime) {
      return aTime < bTime ? -1 : 1;
    }

    return a.id.localeCompare(b.id);
  });
}
