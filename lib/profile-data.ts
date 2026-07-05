import type {
  CareerHistoryEntry,
  EducationEntry,
  LicenceCertificationEntry,
  ApplicationQuestionEntry,
} from "@/lib/mock-data";

// Re-export so consumers can import from either module.
export type {
  LicenceCertificationEntry,
  ApplicationQuestionEntry,
};

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
 * `{ educationEntries: [{ degree, institution, startDate, endDate, gpa, honors }] }`
 * (older parsers used `education` / `qualifications`).
 */
function parseParsedDataEducation(raw: Json): EducationEntry[] {
  if (!isRecord(raw)) return [];
  const education =
    raw.educationEntries ?? raw.education ?? raw.qualifications;
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

/**
 * Parses a SEEK licences/certifications JSON blob into the UI type.
 * SEEK stores an array with fields like `name`, `issuingOrganisation`,
 * `startDate`, `endDate`.
 */
function parseSeekLicences(raw: Json): LicenceCertificationEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): LicenceCertificationEntry | null => {
      if (!isRecord(item)) return null;
      const name =
        (item.name as string) ??
        (item.title as string) ??
        (item.licenceName as string) ??
        null;
      if (!name) return null;
      const issuingBody =
        (item.issuingOrganisation as string) ??
        (item.issuingBody as string) ??
        (item.organisation as string) ??
        (item.issuer as string) ??
        null;
      const start = item.startDate as string | undefined;
      const end = item.endDate as string | undefined;
      const expiryDate = item.expiryDate as string | undefined;
      const period =
        start || end
          ? [start, end].filter(Boolean).join(" — ")
          : undefined;
      return {
        name,
        issuingBody: issuingBody ?? undefined,
        period: period ?? expiryDate,
        expiryDate: expiryDate ?? undefined,
      };
    })
    .filter((x): x is LicenceCertificationEntry => x !== null);
}

/**
 * Parses the AI-parsed CV licences/certifications from `parsedData`.
 * The parser writes: `{ licencesCertifications: [{ name, issuingBody, ... }] }`.
 */
function parseParsedDataLicences(raw: Json): LicenceCertificationEntry[] {
  if (!isRecord(raw)) return [];
  const licences =
    raw.licencesCertifications ?? raw.licences ?? raw.certifications;
  if (!Array.isArray(licences)) return [];
  return licences
    .map((item): LicenceCertificationEntry | null => {
      if (!isRecord(item)) return null;
      const name =
        (item.name as string) ??
        (item.title as string) ??
        (item.licenceName as string) ??
        null;
      if (!name) return null;
      const issuingBody =
        (item.issuingBody as string) ??
        (item.issuingOrganisation as string) ??
        (item.organisation as string) ??
        (item.issuer as string) ??
        null;
      const start = item.startDate as string | undefined;
      const end = item.endDate as string | undefined;
      const expiryDate = item.expiryDate as string | undefined;
      const period =
        start || end
          ? [start, end].filter(Boolean).join(" — ")
          : undefined;
      return {
        name,
        issuingBody: issuingBody ?? undefined,
        period: period ?? expiryDate,
        expiryDate: expiryDate ?? undefined,
      };
    })
    .filter((x): x is LicenceCertificationEntry => x !== null);
}

/**
 * Returns the candidate's licences & certifications, preferring SEEK data,
 * then parsed-CV data. Returns an empty array when neither is present.
 */
export function extractLicencesCertifications(
  seekLicences: Json,
  parsedData: Json,
): LicenceCertificationEntry[] {
  const seek = parseSeekLicences(seekLicences);
  if (seek.length) return seek;
  return parseParsedDataLicences(parsedData);
}

/**
 * Parses a SEEK application-questions JSON blob into the UI type.
 * SEEK stores an array of `{ question, answer }` (or keyed objects).
 */
function parseSeekApplicationQuestions(raw: Json): ApplicationQuestionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ApplicationQuestionEntry | null => {
      if (!isRecord(item)) return null;
      const question =
        (item.question as string) ??
        (item.label as string) ??
        (item.fieldName as string) ??
        null;
      const answer =
        (item.answer as string) ??
        (item.value as string) ??
        (item.response as string) ??
        null;
      if (!question && !answer) return null;
      return {
        question: question ?? "—",
        answer: answer ?? undefined,
      };
    })
    .filter((x): x is ApplicationQuestionEntry => x !== null);
}

/**
 * Parses the AI-parsed CV application questions from `parsedData`.
 * The parser writes: `{ applicationQuestions: [{ question, answer }] }`.
 */
function parseParsedDataApplicationQuestions(
  raw: Json,
): ApplicationQuestionEntry[] {
  if (!isRecord(raw)) return [];
  const questions = raw.applicationQuestions ?? raw.questions;
  if (!Array.isArray(questions)) return [];
  return questions
    .map((item): ApplicationQuestionEntry | null => {
      if (!isRecord(item)) return null;
      const question = item.question as string | undefined;
      const answer = item.answer as string | undefined;
      if (!question && !answer) return null;
      return {
        question: question ?? "—",
        answer: answer ?? undefined,
      };
    })
    .filter((x): x is ApplicationQuestionEntry => x !== null);
}

/**
 * Returns the candidate's application questions, preferring SEEK data,
 * then parsed-CV data. Returns an empty array when neither is present.
 */
export function extractApplicationQuestions(
  seekApplicationQuestions: Json,
  parsedData: Json,
): ApplicationQuestionEntry[] {
  const seek = parseSeekApplicationQuestions(seekApplicationQuestions);
  if (seek.length) return seek;
  return parseParsedDataApplicationQuestions(parsedData);
}

/**
 * Returns the candidate's skills as a string array, preferring the dedicated
 * `seekSkills` JSON column, then the `skills` string array column, then the
 * `parsedData.skills` array from the AI parser.
 */
export function extractSkills(
  seekSkills: Json,
  skillsColumn: string[] | null | undefined,
  parsedData: Json,
): string[] {
  // SEEK skills column may be an array of strings or array of objects.
  if (Array.isArray(seekSkills)) {
    const mapped = seekSkills
      .map((s) => {
        if (typeof s === "string") return s.trim();
        if (isRecord(s)) {
          const name =
            (s.name as string) ??
            (s.skill as string) ??
            (s.label as string) ??
            null;
          return name ? name.trim() : null;
        }
        return null;
      })
      .filter((s): s is string => !!s);
    if (mapped.length) return mapped;
  }
  if (Array.isArray(skillsColumn) && skillsColumn.length) {
    return skillsColumn
      .map((s) => (typeof s === "string" ? s.trim() : null))
      .filter((s): s is string => !!s);
  }
  if (isRecord(parsedData) && Array.isArray(parsedData.skills)) {
    return parsedData.skills
      .map((s) => (typeof s === "string" ? s.trim() : null))
      .filter((s): s is string => !!s);
  }
  return [];
}
