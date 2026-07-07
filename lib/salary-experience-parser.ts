/**
 * Salary & Experience Parser
 *
 * Shared utility for parsing salary and experience values from free-text strings
 * (Indonesian + English) and from SEEK application_questions arrays.
 *
 * Used by:
 *   - app/api/candidates/import-seek/route.ts  (SEEK import path)
 *   - lib/data-access.ts createCandidateFromUpload()  (Upload CV path)
 *   - scripts/backfill-salary-experience.ts  (backfill for existing candidates)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ApplicationQuestionLike {
  question: string | null;
  answer: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Salary Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a free-text salary string into a numeric monthly salary.
 *
 * Handles Indonesian and English formats:
 *   "Rp 8 Jt"           → 8_000_000
 *   "IDR 8.000.000"     → 8_000_000
 *   "8 juta"            → 8_000_000
 *   "8jt"               → 8_000_000
 *   "8,000,000"         → 8_000_000
 *   "5.000.000"         → 5_000_000
 *   "Rp 5.000.000 /bulan" → 5_000_000
 *   "IDR 8.000.000 / month" → 8_000_000
 *
 * Returns null if no numeric value can be extracted.
 */
export function parseSalaryToNumber(
  input: string | null | undefined,
): number | null {
  if (!input || typeof input !== "string") return null;

  const text = input.trim().toLowerCase();
  if (!text) return null;

  // Detect multiplier from Indonesian and English shorthand words.
  let multiplier = 1;
  if (/\b(juta|jt|jtm|million|millions|mln|mio)\b/.test(text)) {
    multiplier = 1_000_000;
  } else if (/\b(ribu|rb|rbt|thousand|thousands|k)\b/.test(text)) {
    multiplier = 1_000;
  } else if (/\b(miliar|milyar|billion|billions|bn)\b/.test(text)) {
    multiplier = 1_000_000_000;
  }

  // Extract the first number-like token (handles "8.000.000", "8,000,000", "8000000", "8.5")
  // Strategy: find a sequence of digits possibly separated by . or ,
  const match = text.match(/[\d][\d.,]*\d|\d/);
  if (!match) return null;

  let numStr = match[0];

  // Determine the decimal separator:
  // - If both . and , present, the last one is the decimal separator
  // - If only one present and it's followed by 1-2 digits, it's a decimal separator
  // - Otherwise, all separators are thousand separators (remove them)
  const hasDot = numStr.includes(".");
  const hasComma = numStr.includes(",");

  if (hasDot && hasComma) {
    // Both present — the last occurring separator is the decimal separator
    const lastDot = numStr.lastIndexOf(".");
    const lastComma = numStr.lastIndexOf(",");
    if (lastDot > lastComma) {
      // Dot is decimal, commas are thousands
      numStr = numStr.replace(/,/g, "").replace(/\./, ".");
    } else {
      // Comma is decimal, dots are thousands
      numStr = numStr.replace(/\./g, "").replace(/,/, ".");
    }
  } else if (hasDot) {
    // Only dots — check if the last dot is a decimal separator (1-2 digits after)
    const parts = numStr.split(".");
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.length <= 2) {
        // Likely decimal: "8.5" → 8.5
        numStr = parts.slice(0, -1).join("") + "." + lastPart;
      } else {
        // All dots are thousand separators: "8.000.000" → "8000000"
        numStr = numStr.replace(/\./g, "");
      }
    }
  } else if (hasComma) {
    // Only commas — check if the last comma is a decimal separator (1-2 digits after)
    const parts = numStr.split(",");
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.length <= 2) {
        // Likely decimal: "8,5" → 8.5
        numStr = parts.slice(0, -1).join("") + "." + lastPart;
      } else {
        // All commas are thousand separators: "8,000,000" → "8000000"
        numStr = numStr.replace(/,/g, "");
      }
    }
  }

  const value = parseFloat(numStr);
  if (isNaN(value) || value <= 0) return null;

  const result = Math.round(value * multiplier);

  // Sanity check: salary should be between 100,000 and 100,000,000 IDR
  if (result < 100_000 || result > 100_000_000) return null;

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Experience Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a free-text experience string into a numeric years value.
 *
 * Handles Indonesian and English formats:
 *   "2 tahun"       → 2
 *   "2 years"       → 2
 *   "5+ years"      → 5
 *   "3-5 years"     → 3  (lower bound)
 *   "lebih dari 2 tahun" → 2
 *   "2 thn"         → 2
 *   "1 tahun"       → 1
 *
 * Returns null if no numeric value can be extracted.
 */
export function parseExperienceToYears(
  input: string | null | undefined,
): number | null {
  if (!input || typeof input !== "string") return null;

  const text = input.trim().toLowerCase();
  if (!text) return null;

  // Look for a number followed by experience keywords (tahun/thn/years/year/yr)
  // Also handle ranges like "3-5 years" (take lower bound)
  const expMatch = text.match(
    /(\d+)\s*(?:[-–to]+\s*(\d+)\s*)?(?:tahun|thn|years?|yrs?)/,
  );
  if (expMatch) {
    const lower = parseInt(expMatch[1], 10);
    if (!isNaN(lower) && lower >= 0 && lower <= 50) {
      return lower;
    }
  }

  // Fallback: if the text contains experience keywords, extract the first number
  if (/(tahun|thn|years?|yrs?|pengalaman|experience)/.test(text)) {
    const numMatch = text.match(/(\d+)/);
    if (numMatch) {
      const value = parseInt(numMatch[1], 10);
      if (!isNaN(value) && value >= 0 && value <= 50) {
        return value;
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application Questions Extraction
// ─────────────────────────────────────────────────────────────────────────────

// Keywords that indicate a salary-related question (Indonesian + English).
const SALARY_KEYWORDS = [
  "gaji",
  "salary",
  "penghasilan",
  "expected salary",
  "expected monthly",
  "monthly salary",
  "gaji bulanan",
  "gaji yang diinginkan",
  "gaji yang diharapkan",
  "kompensasi",
  "compensation",
  "remunerasi",
];

// Keywords that indicate an experience-related question.
const EXPERIENCE_KEYWORDS = [
  "pengalaman",
  "experience",
  "years of experience",
  "lama bekerja",
  "lama pengalaman",
  "pengalaman kerja",
];

// Keywords that indicate a notice period question.
const NOTICE_KEYWORDS = [
  "pemberitahuan",
  "notice",
  "notice period",
  "waktu pemberitahuan",
  "resign",
];

/**
 * Extracts a numeric salary from an array of application questions.
 * Searches for questions containing salary-related keywords and parses
 * the answer.
 *
 * Returns null if no salary can be extracted.
 */
export function extractSalaryFromQuestions(
  questions: ApplicationQuestionLike[] | null | undefined,
): number | null {
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return null;
  }

  for (const qa of questions) {
    const q = (qa.question ?? "").toLowerCase();
    const a = qa.answer ?? "";

    if (!a.trim()) continue;

    if (SALARY_KEYWORDS.some((kw) => q.includes(kw))) {
      const parsed = parseSalaryToNumber(a);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}

/**
 * Extracts a numeric experience (years) from an array of application questions.
 * Searches for questions containing experience-related keywords and parses
 * the answer.
 *
 * Returns null if no experience can be extracted.
 */
export function extractExperienceFromQuestions(
  questions: ApplicationQuestionLike[] | null | undefined,
): number | null {
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return null;
  }

  for (const qa of questions) {
    const q = (qa.question ?? "").toLowerCase();
    const a = qa.answer ?? "";

    if (!a.trim()) continue;

    if (EXPERIENCE_KEYWORDS.some((kw) => q.includes(kw))) {
      const parsed = parseExperienceToYears(a);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}

/**
 * Extracts a notice period string from an array of application questions.
 * Searches for questions containing notice-related keywords.
 *
 * Returns null if no notice period can be extracted.
 */
export function extractNoticePeriodFromQuestions(
  questions: ApplicationQuestionLike[] | null | undefined,
): string | null {
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return null;
  }

  for (const qa of questions) {
    const q = (qa.question ?? "").toLowerCase();
    const a = (qa.answer ?? "").trim();

    if (!a) continue;

    if (NOTICE_KEYWORDS.some((kw) => q.includes(kw))) {
      return a;
    }
  }

  return null;
}

/**
 * Combined extraction: parses application questions for salary, experience,
 * and notice period in one pass.
 */
export function extractAllFromQuestions(questions: ApplicationQuestionLike[] | null | undefined): {
  salary: number | null;
  experienceYears: number | null;
  noticePeriod: string | null;
} {
  return {
    salary: extractSalaryFromQuestions(questions),
    experienceYears: extractExperienceFromQuestions(questions),
    noticePeriod: extractNoticePeriodFromQuestions(questions),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notice Period Sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the given question text matches a notice-period question
 * (e.g. "Waktu pemberitahuan", "Notice period").
 */
export function isNoticePeriodQuestion(
  question: string | null | undefined,
): boolean {
  if (!question) return false;
  const q = question.toLowerCase();
  return NOTICE_KEYWORDS.some((kw) => q.includes(kw));
}

/**
 * Returns a new application-questions array where the notice-period entry's
 * answer is replaced with `noticePeriod` (when set). If no notice-period
 * question exists and `noticePeriod` is set, a new entry is appended.
 *
 * This keeps the "Waktu pemberitahuan" display under Application Questions in
 * sync with the dedicated `noticePeriod` column that the Edit Profile form
 * writes to, so the two never drift apart after a save.
 */
export function applyNoticePeriodOverride<
  T extends { question: string; answer?: string },
>(questions: T[], noticePeriod: string | null | undefined): T[] {
  if (!noticePeriod || !noticePeriod.trim()) return questions;
  const np = noticePeriod.trim();
  let found = false;
  const next = questions.map((qa) => {
    if (isNoticePeriodQuestion(qa.question)) {
      found = true;
      return { ...qa, answer: np };
    }
    return qa;
  });
  if (!found) {
    next.push({ question: "Waktu pemberitahuan", answer: np } as T);
  }
  return next;
}
