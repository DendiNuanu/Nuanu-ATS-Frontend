import type {
  CareerHistoryEntry,
  EducationEntry,
} from "@/lib/mock-data";

/**
 * Helpers for extracting structured career-history and education data from
 * the various JSON columns stored on `CandidateProfile`:
 *
 *  - `seekCareerHistory` / `seekEducation` — populated by the SEEK import.
 *  - `parsedData` — populated by the AI CV parser (resume upload).
 *
 * These JSON blobs come from different sources with different shapes, so each
 * parser is defensive: it tolerates arrays, objects, or null, and never throws.
 */

type Json = unknown;

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts career-history entries from a SEEK career-history JSON blob.
 *
 * SEEK stores an array of roles, each with fields like:
 * `roleTitle`, `organisation`, `startDate`, `endDate`, `description`.
 */
function parseSeekCareerHistory(raw: Json): CareerHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): CareerHistoryEntry | null => {
      if (!isRecord(item)) return null;
      const role =
        (item.roleTitle as string) ??
        (item.title as string) ??
        (item.role as string) ??
        null;
      const company =
        (item.organisation as string) ??
        (item.company as string) ??
        (item.employer as string) ??
        null;
      if (!role && !company) return null;
      const start = item.startDate as string | undefined;
      const end = item.endDate as string | undefined;
      const period =
        start || end
          ? [start, end].filter(Boolean).join(" — ")
          : undefined;
      const description = (item.description as string) ?? undefined;
      return {
        role: role ?? "—",
        company: company ?? "—",
        period,
        description,
      };
    })
    .filter((x): x is CareerHistoryEntry => x !== null);
}

/**
 * Extracts education entries from a SEEK education JSON blob.
 *
 * SEEK stores an array of qualifications, each with fields like:
 * `qualification`, `institution`, `yearCompleted`, `course`.
 */
function parseSeekEducation(raw: Json): EducationEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): EducationEntry | null => {
      if (!isRecord(item)) return null;
      const degree =
        (item.qualification as string) ??
        (item.degree as string) ??
        (item.course as string) ??
        null;
      const institution =
        (item.institution as string) ??
        (item.organisation as string) ??
        (item.school as string) ??
        null;
      if (!degree && !institution) return null;
      const year = item.yearCompleted as string | undefined;
      const period = year ?? undefined;
      return {
        degree: degree ?? "—",
        institution: institution ?? undefined,
        period,
      };
    })
    .filter((x): x is EducationEntry => x !== null);
}

/**
 * Extracts career-history entries from the AI-parsed CV JSON blob
 * (`CandidateProfile.parsedData`). The parser writes a shape like:
 * `{ experience: [{ title, company, startDate, endDate, description }], ... }`
 */
function parseParsedDataCareer(raw: Json): CareerHistoryEntry[] {
  if (!isRecord(raw)) return [];
  const experience = raw.experience ?? raw.workExperience ?? raw.work_history;
  if (!Array.isArray(experience)) return [];
  return experience
    .map((item): CareerHistoryEntry | null => {
      if (!isRecord(item)) return null;
      const role =
        (item.title as string) ??
        (item.role as string) ??
        (item.position as string) ??
        null;
      const company =
        (item.company as string) ??
        (item.employer as string) ??
        (item.organisation as string) ??
        null;
      if (!role && !company) return null;
      const start =
        (item.startDate as string) ??
        (item.start as string) ??
        (item.from as string) ??
        undefined;
      const end =
        (item.endDate as string) ??
        (item.end as string) ??
        (item.to as string) ??
        undefined;
      const period =
        start || end ? [start, end].filter(Boolean).join(" — ") : undefined;
      const description =
        (item.description as string) ??
        (item.summary as string) ??
        undefined;
      return {
        role: role ?? "—",
        company: company ?? "—",
        period,
        description,
      };
    })
    .filter((x): x is CareerHistoryEntry => x !== null);
}

/**
 * Extracts education entries from the AI-parsed CV JSON blob
 * (`CandidateProfile.parsedData`). The parser writes a shape like:
 * `{ education: [{ degree, institution, startDate, endDate, gpa }] }`
 */
function parseParsedDataEducation(raw: Json): EducationEntry[] {
  if (!isRecord(raw)) return [];
  const education = raw.education ?? raw.qualifications;
  if (!Array.isArray(education)) return [];
  return education
    .map((item): EducationEntry | null => {
      if (!isRecord(item)) return null;
      const degree =
        (item.degree as string) ??
        (item.qualification as string) ??
        (item.title as string) ??
        null;
      const institution =
        (item.institution as string) ??
        (item.school as string) ??
        (item.university as string) ??
        null;
      if (!degree && !institution) return null;
      const start =
        (item.startDate as string) ??
        (item.start as string) ??
        (item.from as string) ??
        undefined;
      const end =
        (item.endDate as string) ??
        (item.end as string) ??
        (item.to as string) ??
        (item.year as string) ??
        undefined;
      const period =
        start || end ? [start, end].filter(Boolean).join(" — ") : undefined;
      const gpa =
        (item.gpa as string) ??
        (item.grade as string) ??
        undefined;
      return {
        degree: degree ?? "—",
        institution: institution ?? undefined,
        period,
        gpa,
      };
    })
    .filter((x): x is EducationEntry => x !== null);
}

/**
 * Returns the candidate's career history, preferring SEEK data, then parsed-CV
 * data. Returns an empty array when neither is present.
 */
export function extractCareerHistory(
  seekCareerHistory: Json,
  parsedData: Json,
): CareerHistoryEntry[] {
  const seek = parseSeekCareerHistory(seekCareerHistory);
  if (seek.length) return seek;
  return parseParsedDataCareer(parsedData);
}

/**
 * Returns the candidate's education entries, preferring SEEK data, then
 * parsed-CV data. Returns an empty array when neither is present.
 */
export function extractEducation(
  seekEducation: Json,
  parsedData: Json,
): EducationEntry[] {
  const seek = parseSeekEducation(seekEducation);
  if (seek.length) return seek;
  return parseParsedDataEducation(parsedData);
}
