import { promises as fs } from "fs";
import path from "path";
import type { ParsedCandidate } from "@/lib/data-access";

/**
 * Shared CV/resume parsing pipeline.
 *
 * This module is the SINGLE source of truth for extracting text from a CV file
 * and parsing it into a structured {@link ParsedCandidate} via the Groq AI API.
 * It is reused by:
 *   - app/api/candidates/upload/route.ts  (manual "Upload CV" feature)
 *   - scripts/import-gmail-candidates.ts  (Gmail inbox → ATS import)
 *
 * Extracted from the upload route so both code paths use identical parsing
 * logic — there is no second, divergent CV parser anywhere in the codebase.
 */

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

/**
 * Sends the resume text to the Groq AI API and parses the returned JSON into
 * a {@link ParsedCandidate} object. Strips markdown code fences if present.
 *
 * The prompt explicitly requests COMPLETE structured data — every job entry,
 * every education entry, all licences/certifications, all skills, and any
 * application-specific fields (expected salary, notice period, languages) —
 * as structured JSON arrays, not a single freeform summary.
 *
 * @returns The parsed candidate, or `null` if the AI call fails or the
 *          response is missing the required `name` field.
 * @throws {RateLimitError} When the Groq API returns a 429 rate-limit error.
 *         Callers should catch this to allow retry on a subsequent run.
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

  const prompt = `You are a precise resume/CV parser. Extract ALL of the candidate's information from the resume text below and return ONLY a single valid JSON object (no markdown, no code fences, no commentary) with EXACTLY these fields:

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

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a precise resume parser that returns only valid JSON. You extract every job, education, and certification entry found in the document, never truncating or stopping after the first." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("AI API error:", res.status, errorBody);
    // 429 = rate limit. Throw a typed error so callers can distinguish
    // "transient rate limit — retry later" from "AI couldn't parse this".
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

  // Strip markdown code fences if present
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    // Validate required fields
    if (!parsed.name) {
      console.error("AI response missing required field (name)");
      return null;
    }
    const asString = (v: unknown): string | null =>
      typeof v === "string" && v.trim() ? v.trim() : null;
    const asStringArray = (v: unknown): string[] =>
      Array.isArray(v)
        ? v
            .map((x) => (typeof x === "string" ? x.trim() : null))
            .filter((x): x is string => !!x)
        : [];
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
  } catch (err) {
    console.error("Failed to parse AI JSON response:", err);
    return null;
  }
}

/**
 * Convenience wrapper: extract text from a file on disk, then parse it with
 * the Groq AI. Returns `{ resumeText, parsed }` so callers can persist both
 * the raw text (for search/debugging) and the structured candidate data.
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
  const parsed = await parseResumeWithAI(resumeText);
  return { resumeText, parsed };
}
