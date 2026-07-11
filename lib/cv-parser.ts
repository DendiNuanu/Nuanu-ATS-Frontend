import { promises as fs } from "fs";
import path from "path";
import type { ParsedCandidate } from "@/lib/data-access";

/**
 * Shared CV/resume parsing pipeline.
 *
 * This module is the SINGLE source of truth for extracting text from a CV file
 * and parsing it into a structured {@link ParsedCandidate} via AI. It supports
 * two AI providers with automatic fallback:
 *
 *   1. Groq (llama-3.3-70b-versatile) — primary, fast, but free tier has a
 *      100,000 tokens/day limit that gets exhausted quickly.
 *   2. Google Gemini (gemini-2.5-flash) — fallback, triggered automatically
 *      when Groq hits a rate limit (429) or fails for any other reason.
 *
 * It is reused by:
 *   - app/api/candidates/upload/route.ts  (manual "Upload CV" feature)
 *   - scripts/import-gmail-candidates.ts  (Gmail inbox → ATS import)
 *
 * Extracted from the upload route so both code paths use identical parsing
 * logic — there is no second, divergent CV parser anywhere in the codebase.
 */

// ── Type helpers for safe JSON field extraction ──────────────────────────────

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === "string" ? x.trim() : null))
        .filter((x): x is string => !!x)
    : [];

/**
 * Maps a raw parsed JSON object (from either Groq or Gemini) into the
 * {@link ParsedCandidate} shape expected by `createCandidateFromUpload`.
 *
 * This is the SINGLE mapping function used by both providers, guaranteeing
 * identical output structure regardless of which AI parsed the resume.
 */
function mapToParsedCandidate(parsed: Record<string, unknown>): ParsedCandidate | null {
  if (!parsed.name) {
    console.error("AI response missing required field (name)");
    return null;
  }
  return {
    name: String(parsed.name),
    email: asString(parsed.email) ?? "",
    phone: asString(parsed.phone),
    currentTitle: asString(parsed.currentTitle),
    currentCompany: asString(parsed.currentCompany),
    location: asString(parsed.location),
    experienceYears:
      typeof parsed.experienceYears === "number"
        ? parsed.experienceYears
        : null,
    education: asString(parsed.education),
    skills: asStringArray(parsed.skills),
    summary: asString(parsed.summary),
    linkedinUrl: asString(parsed.linkedinUrl),
    experience: Array.isArray(parsed.experience)
      ? parsed.experience.map((e: Record<string, unknown>) => ({
          title: asString(e.title),
          company: asString(e.company),
          startDate: asString(e.startDate),
          endDate: asString(e.endDate),
          description: asString(e.description),
        }))
      : [],
    educationEntries: Array.isArray(parsed.educationEntries)
      ? parsed.educationEntries.map((e: Record<string, unknown>) => ({
          degree: asString(e.degree),
          institution: asString(e.institution),
          startDate: asString(e.startDate),
          endDate: asString(e.endDate),
          year: asString(e.year),
          gpa: asString(e.gpa),
          honors: asString(e.honors),
        }))
      : [],
    licencesCertifications: Array.isArray(parsed.licencesCertifications)
      ? parsed.licencesCertifications.map((l: Record<string, unknown>) => ({
          name: asString(l.name),
          issuingBody: asString(l.issuingBody),
          startDate: asString(l.startDate),
          endDate: asString(l.endDate),
          expiryDate: asString(l.expiryDate),
        }))
      : [],
    applicationQuestions: Array.isArray(parsed.applicationQuestions)
      ? parsed.applicationQuestions.map((q: Record<string, unknown>) => ({
          question: asString(q.question),
          answer: asString(q.answer),
        }))
      : [],
    expectedSalary: asString(parsed.expectedSalary),
    noticePeriod: asString(parsed.noticePeriod),
    languages: asStringArray(parsed.languages),
  };
}

/**
 * The shared prompt text sent to both Groq and Gemini. Requests a single
 * JSON object with EXACTLY the fields defined below — every job entry,
 * every education entry, all licences/certifications, all skills, and any
 * application-specific fields (expected salary, notice period, languages).
 */
function buildResumePrompt(text: string): string {
  return `You are a precise resume/CV parser. Extract ALL of the candidate's information from the resume text below and return ONLY a single valid JSON object (no markdown, no code fences, no commentary) with EXACTLY these fields:

{
  "name": "full name of the candidate",
  "email": "email address, or null if not found",
  "phone": "phone number, or null",
  "currentTitle": "current/most recent job title, or null",
  "currentCompany": "current/most recent company, or null",
  "location": "city, country, or null",
  "experienceYears": <number of total years of professional experience, or null>,
  "education": "short label of the highest qualification (e.g. 'B.Sc. Computer Science'), or null",
  "skills": ["skill1", "skill2", "..."],
  "summary": "brief 1-2 sentence professional summary, or null",
  "linkedinUrl": "LinkedIn URL, or null",
  "experience": [
    {
      "title": "job title",
      "company": "company/organisation name",
      "startDate": "start date or month-year (e.g. 'Jan 2020') or null",
      "endDate": "end date, month-year, or 'Present', or null",
      "description": "the FULL description of responsibilities and achievements for this role (preserve all bullet points and details, do not truncate)"
    }
  ],
  "educationEntries": [
    {
      "degree": "degree/qualification name (e.g. 'Bachelor of Science in Computer Science')",
      "institution": "school/university name",
      "startDate": "start year or null",
      "endDate": "end/graduation year or null",
      "year": "graduation year as a string, or null",
      "gpa": "GPA/grade if stated, or null",
      "honors": "honors, achievements, or distinctions if stated, or null"
    }
  ],
  "licencesCertifications": [
    {
      "name": "licence/certification name",
      "issuingBody": "issuing organisation/body, or null",
      "startDate": "issue date or null",
      "endDate": "expiry date or null",
      "expiryDate": "expiry date if explicitly stated, or null"
    }
  ],
  "applicationQuestions": [
    {
      "question": "the question asked (e.g. 'Expected salary', 'Notice period', 'Right to work')",
      "answer": "the candidate's answer"
    }
  ],
  "expectedSalary": "expected salary as a string if stated in the CV, or null",
  "noticePeriod": "notice period as a string if stated, or null",
  "languages": ["English (Fluent)", "Indonesian (Native)", "..."]
}

CRITICAL INSTRUCTIONS:
1. Extract EVERY job/position entry found in the resume into the "experience" array — do NOT stop after the first one. Include the full description for each role (all bullet points and achievements), never truncate.
2. Extract EVERY education/qualification entry into "educationEntries" — do NOT stop after the first one.
3. Extract ALL licences and certifications into "licencesCertifications".
4. Extract ALL skills as individual tags in the "skills" array (e.g. "JavaScript", "Project Management", "Excel") — not a single comma-separated string.
5. If the CV contains application-form answers (expected salary, notice period, right to work, language proficiency, visa status, etc.), capture each as a {question, answer} object in "applicationQuestions".
6. If a field cannot be determined, use null (or an empty array [] for array fields).
7. "name" and "email" are REQUIRED. If email is genuinely not in the document, set email to null — but still return the rest of the parsed data.
8. Return ONLY the JSON object. No explanations, no markdown, no code fences.

Resume text:
${text.slice(0, 12000)}`;
}

const SYSTEM_PROMPT =
  "You are a precise resume parser that returns only valid JSON. You extract every job, education, and certification entry found in the document, never truncating or stopping after the first.";

/**
 * Strips markdown code fences (```json ... ```) if present, then parses JSON.
 * Returns the parsed object or null if JSON parsing fails.
 */
function parseJsonResponse(content: string): Record<string, unknown> | null {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch (err) {
    console.error("Failed to parse AI JSON response:", err);
    return null;
  }
}

// ── Extract text from CV files ───────────────────────────────────────────────

/**
 * Extracts plain text from a PDF or DOC/DOCX file.
 *
 * PDF extraction uses `unpdf` — a serverless-safe wrapper around pdfjs-dist
 * that does NOT require browser workers (unlike `pdf-parse` which fails on
 * Node.js servers with "Setting up fake worker" errors).
 *
 * DOC/DOCX extraction uses `mammoth`.
 *
 * @param filePath Absolute path to the file on disk.
 * @param ext      Lowercased file extension including the dot (e.g. ".pdf").
 */
export async function extractText(
  filePath: string,
  ext: string,
): Promise<string> {
  if (ext === ".pdf") {
    const { extractText: unpdfExtractText } = await import("unpdf");
    const dataBuffer = await fs.readFile(filePath);
    const { text } = await unpdfExtractText(new Uint8Array(dataBuffer), {
      mergePages: true,
    });
    return text;
  }
  if (ext === ".doc" || ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  return "";
}

// ── Rate limit error ──────────────────────────────────────────────────────────

/**
 * Thrown when the Groq API returns a 429 rate-limit error. Callers can catch
 * this to distinguish "transient rate limit — retry later" from "the AI could
 * not parse this resume" (which returns `null`).
 *
 * The `isDaily` flag is set when the error message contains "per day" (TPD),
 * indicating the daily quota is exhausted and no amount of waiting will help
 * until the quota resets.
 */
export class RateLimitError extends Error {
  readonly isDaily: boolean;
  constructor(message: string, isDaily: boolean) {
    super(message);
    this.name = "RateLimitError";
    this.isDaily = isDaily;
  }
}

// ── Groq parser ──────────────────────────────────────────────────────────────

/**
 * Sends the resume text to the Groq AI API and parses the returned JSON into
 * a {@link ParsedCandidate} object.
 *
 * @returns The parsed candidate, or `null` if the AI call fails or the
 *          response is missing the required `name` field.
 * @throws {RateLimitError} When the Groq API returns a 429 rate-limit error.
 */
export async function parseResumeWithAI(
  text: string,
): Promise<ParsedCandidate | null> {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;

  if (!apiUrl || !apiKey) {
    console.error("Missing AI_API_URL or AI_API_KEY environment variables");
    return null;
  }

  const prompt = buildResumePrompt(text);

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Groq API error:", res.status, errorBody);
    if (res.status === 429) {
      const isDaily = /per day/i.test(errorBody);
      throw new RateLimitError(
        `Groq rate limit exceeded (429)${isDaily ? " — daily quota" : ""}`,
        isDaily,
      );
    }
    return null;
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(content);
  if (!parsed) return null;
  return mapToParsedCandidate(parsed);
}

// ── Gemini parser (fallback) ─────────────────────────────────────────────────

/**
 * Sends the resume text to the Google Gemini API and parses the returned JSON
 * into a {@link ParsedCandidate} object. Uses the EXACT SAME prompt and output
 * mapping as {@link parseResumeWithAI} so downstream code sees no difference.
 *
 * Uses Gemini's REST API directly (no SDK dependency) with
 * `responseMimeType: "application/json"` for reliable JSON output.
 *
 * Model: `gemini-2.5-flash` (free tier, high daily quota).
 *
 * @returns The parsed candidate, or `null` if the AI call fails or the
 *          response is missing the required `name` field.
 */
export async function parseResumeWithGemini(
  text: string,
): Promise<ParsedCandidate | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable");
    return null;
  }

  const prompt = buildResumePrompt(text);
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = JSON.stringify({
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
    },
  });

  // Retry on transient errors (502/503/504) — Gemini occasionally returns
  // 503 "high demand" which is temporary. Up to 3 attempts with backoff.
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    if (res.ok) {
      const data = await res.json();
      // Gemini response structure: data.candidates[0].content.parts[0].text
      const content: string =
        data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const parsed = parseJsonResponse(content);
      if (!parsed) return null;
      return mapToParsedCandidate(parsed);
    }

    const errorBody = await res.text();

    // Rate limit — throw so the fallback orchestrator can propagate it
    if (res.status === 429) {
      const isDaily = /per day/i.test(errorBody);
      throw new RateLimitError(
        `Gemini rate limit exceeded (429)${isDaily ? " — daily quota" : ""}`,
        isDaily,
      );
    }

    // Transient server errors — retry with backoff
    if ([502, 503, 504].includes(res.status) && attempt < MAX_RETRIES) {
      const delayMs = attempt * 5000; // 5s, 10s
      console.error(
        `  Gemini ${res.status} (transient), retry ${attempt}/${MAX_RETRIES} in ${delayMs / 1000}s...`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    // Non-retryable error
    console.error("Gemini API error:", res.status, errorBody);
    return null;
  }

  // All retries exhausted
  console.error("Gemini API: all retry attempts exhausted");
  return null;
}

// ── Fallback orchestrator ────────────────────────────────────────────────────

/**
 * Parses a resume using Groq first, with automatic fallback to Google Gemini
 * if Groq fails for ANY reason (rate limit, network error, malformed response).
 *
 * This is the recommended entry point for all CV parsing — it maximises
 * resilience by leveraging Gemini's higher free-tier quota as a safety net.
 *
 * Logs which provider ultimately succeeded so operators can monitor how often
 * the fallback is used.
 *
 * @returns The parsed candidate, or `null` if BOTH providers fail.
 * @throws {RateLimitError} Only if BOTH Groq and Gemini return 429 rate-limit
 *         errors (extremely unlikely given Gemini's generous free tier).
 */
export async function parseResumeWithFallback(
  text: string,
): Promise<ParsedCandidate | null> {
  // ── Attempt 1: Groq ──
  try {
    const result = await parseResumeWithAI(text);
    if (result) {
      console.log("  Parsed via Groq");
      return result;
    }
    // Groq returned null (non-rate-limit failure) — try Gemini
    console.log("  Groq returned null, falling back to Gemini...");
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.log(
        `  Groq rate-limited${err.isDaily ? " (daily quota)" : ""}, falling back to Gemini...`,
      );
    } else {
      console.log(`  Groq error: ${err instanceof Error ? err.message : String(err)}, falling back to Gemini...`);
    }
  }

  // ── Attempt 2: Gemini fallback ──
  try {
    const geminiResult = await parseResumeWithGemini(text);
    if (geminiResult) {
      console.log("  Parsed via Gemini fallback");
      return geminiResult;
    }
    // Gemini returned null (non-rate-limit failure) — both providers failed
    console.error("  Both Groq and Gemini failed to parse the resume");
    return null;
  } catch (err) {
    if (err instanceof RateLimitError) {
      // Both providers are rate-limited — propagate so callers can decide
      // whether to stop the batch (daily quota) or retry (per-minute).
      console.error(
        `  Gemini also rate-limited${err.isDaily ? " (daily quota)" : ""}. Both providers exhausted.`,
      );
      throw err;
    }
    // Unexpected Gemini error — treat as parse failure
    console.error(
      `  Gemini error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

// ── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * Convenience wrapper: extract text from a file on disk, then parse it with
 * the AI fallback pipeline (Groq → Gemini). Returns `{ resumeText, parsed }`
 * so callers can persist both the raw text (for search/debugging) and the
 * structured candidate data.
 *
 * @param filePath Absolute path to the CV file.
 * @returns `null` for `parsed` if text extraction yielded too little content
 *          or the AI failed to parse.
 */
export async function extractAndParseCv(
  filePath: string,
): Promise<{ resumeText: string; parsed: ParsedCandidate | null }> {
  const ext = path.extname(filePath).toLowerCase();
  const resumeText = await extractText(filePath, ext);
  if (!resumeText || resumeText.trim().length < 20) {
    return { resumeText, parsed: null };
  }
  const parsed = await parseResumeWithFallback(resumeText);
  return { resumeText, parsed };
}
