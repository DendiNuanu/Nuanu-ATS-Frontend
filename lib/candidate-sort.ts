/**
 * Candidate sort types and the default sort constant.
 *
 * This is a lightweight, dependency-free module so it can be safely imported
 * from client components without pulling in Prisma / googleapis (which live in
 * `lib/data-access.ts` and are server-only). `data-access.ts` re-exports these
 * for backward compatibility with server-side callers.
 */

/** Column to sort the candidates list by. */
export type CandidateSortField = "appliedDate" | "aiMatch" | "stage" | "name";

/** Sort direction for the candidates list. */
export type CandidateSortDir = "asc" | "desc";

/** A parsed sort selection (field + direction). */
export type CandidateSort = {
  field: CandidateSortField;
  dir: CandidateSortDir;
};

/** The default sort for the candidates list: Applied Date, newest first. */
export const DEFAULT_CANDIDATE_SORT: CandidateSort = {
  field: "appliedDate",
  dir: "desc",
};
