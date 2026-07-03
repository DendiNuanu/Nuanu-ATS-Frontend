import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  createCandidateFromUpload,
  findOrCreateGeneralVacancy,
  type ParsedCandidate,
} from "@/lib/data-access";

/**
 * POST /api/candidates/upload
 *
 * Accepts a single CV file (multipart/form-data: `file` + `jobId`), extracts
 * its text (PDF via unpdf, DOC/DOCX via mammoth), sends the text to the
 * Groq AI API to parse structured candidate fields, then creates the candidate
 * (User + CandidateProfile + Application) in the database.
 *
 * Returns: { success, applicationId, candidateName, candidateEmail }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const jobId = formData.get("jobId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { error: "Job/Vacancy is required" },
        { status: 400 },
      );
    }

    // Support custom position: when jobId === "__custom__", the user entered
    // a free-text position. We resolve it to a general vacancy and store the
    // custom text in the Application's `appliedFor` field.
    const customPositionRaw = formData.get("customPosition");
    const isCustom = jobId === "__custom__";
    const customPosition =
      isCustom && typeof customPositionRaw === "string"
        ? customPositionRaw.trim()
        : null;

    if (isCustom && !customPosition) {
      return NextResponse.json(
        { error: "Custom position text is required" },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const ext = path.extname(file.name).toLowerCase();
    const allowedExts = [".pdf", ".doc", ".docx"];
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: "Only PDF, DOC, and DOCX files are allowed" },
        { status: 400 },
      );
    }

    // Validate file size (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 },
      );
    }

    // 1. Save file to backups-resumes/
    const uploadsDir = path.join(process.cwd(), "backups-resumes");
    await fs.mkdir(uploadsDir, { recursive: true });
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // 2. Extract text
    const resumeText = await extractText(filePath, ext);

    if (!resumeText || resumeText.trim().length < 20) {
      return NextResponse.json(
        { error: "Could not extract enough text from the file" },
        { status: 422 },
      );
    }

    // 3. Parse with AI (Groq)
    const parsed = await parseResumeWithAI(resumeText);
    if (!parsed) {
      return NextResponse.json(
        { error: "AI failed to parse the resume" },
        { status: 422 },
      );
    }

    // 4. Resolve vacancy: for custom positions, find/create a general vacancy
    //    and store the custom text in `appliedFor`.
    const vacancyId = isCustom
      ? await findOrCreateGeneralVacancy()
      : jobId;

    // 5. Create candidate in DB
    const result = await createCandidateFromUpload(
      parsed,
      vacancyId,
      `/backups-resumes/${safeName}`,
      resumeText,
      customPosition,
    );

    return NextResponse.json(
      {
        success: true,
        applicationId: result.applicationId,
        candidateName: result.candidateName,
        candidateEmail: result.candidateEmail,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to upload CV:", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload CV";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Extracts plain text from a PDF or DOC/DOCX file.
 *
 * PDF extraction uses `unpdf` — a serverless-safe wrapper around pdfjs-dist
 * that does NOT require browser workers (unlike `pdf-parse` which fails on
 * Node.js servers with "Setting up fake worker" errors).
 */
async function extractText(filePath: string, ext: string): Promise<string> {
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
 * Sends the resume text to the Groq AI API and parses the returned JSON into
 * a ParsedCandidate object. Strips markdown code fences if present.
 */
async function parseResumeWithAI(text: string): Promise<ParsedCandidate | null> {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;

  if (!apiUrl || !apiKey) {
    console.error("Missing AI_API_URL or AI_API_KEY environment variables");
    return null;
  }

  const prompt = `You are a resume parser. Extract the candidate's information from the resume text below and return ONLY valid JSON (no markdown, no code fences, no commentary) with these exact fields:

{
  "name": "full name",
  "email": "email address",
  "phone": "phone number or null",
  "currentTitle": "current job title or null",
  "currentCompany": "current company or null",
  "location": "city, country or null",
  "experienceYears": number or null,
  "education": "highest education or null",
  "skills": ["skill1", "skill2"],
  "summary": "brief professional summary or null",
  "linkedinUrl": "linkedin URL or null"
}

If a field cannot be determined, use null (or empty array for skills). Always include "name" and "email" — if email is not found, return null for email.

Resume text:
${text.slice(0, 8000)}`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a resume parser that returns only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    console.error("AI API error:", res.status, await res.text());
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
    if (!parsed.name || !parsed.email) {
      console.error("AI response missing required fields (name/email)");
      return null;
    }
    return {
      name: String(parsed.name),
      email: String(parsed.email),
      phone: parsed.phone ?? null,
      currentTitle: parsed.currentTitle ?? null,
      currentCompany: parsed.currentCompany ?? null,
      location: parsed.location ?? null,
      experienceYears:
        typeof parsed.experienceYears === "number"
          ? parsed.experienceYears
          : null,
      education: parsed.education ?? null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      summary: parsed.summary ?? null,
      linkedinUrl: parsed.linkedinUrl ?? null,
    };
  } catch (err) {
    console.error("Failed to parse AI JSON response:", err);
    return null;
  }
}
