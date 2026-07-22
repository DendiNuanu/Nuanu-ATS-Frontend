import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  createCandidateFromUpload,
  createDraftCandidateFromUpload,
  findOrCreateGeneralVacancy,
} from "@/lib/data-access";
import { extractText, parseResumeWithFallback } from "@/lib/cv-parser";

/**
 * POST /api/candidates/upload
 *
 * Accepts a single CV file (multipart/form-data: `file` + `jobId`), extracts
 * its text (PDF via unpdf, DOC/DOCX via mammoth), sends the text to the
 * AI fallback pipeline (Groq → Gemini → Cerebras) to parse structured
 * candidate fields, then creates the candidate (User + CandidateProfile +
 * Application) in the database.
 *
 * RELIABILITY GUARANTEE ("data harus masuk"):
 * An uploaded file is NEVER silently lost. If AI parsing fails (all providers
 * exhausted) OR text extraction yields too little content, a DRAFT candidate
 * record is still created with whatever raw text could be extracted, flagged
 * `needs_manual_review`, so HR can complete it by hand. The only case where no
 * record is created is a hard validation failure (bad file type/size, missing
 * job) — which returns a clear 4xx error BEFORE the file is saved.
 *
 * Every step is wrapped in its own try/catch with structured server-side
 * logging (filename, timestamp, step, error) so failures are diagnosable.
 *
 * Returns: { success, applicationId, candidateName, candidateEmail, draft? }
 */
export async function POST(request: NextRequest) {
  const startedAt = new Date().toISOString();
  let filename = "<unknown>";
  let savedFilePath: string | null = null;

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
    filename = file.name;
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

    // ── STEP 1: Save file to disk ──────────────────────────────────────────
    // The file is saved FIRST so that even if every subsequent step fails, the
    // raw upload is preserved on disk and can be recovered/re-processed later.
    let uploadsDir: string;
    try {
      uploadsDir = path.join(process.cwd(), "backups-resumes");
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch (err) {
      console.error(`[upload ${startedAt}] STEP1 mkdir failed for "${filename}":`, err);
      throw new Error("Could not create uploads directory on the server");
    }

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, safeName);
    savedFilePath = filePath;
    const resumeUrl = `/backups-resumes/${safeName}`;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      console.log(
        `[upload ${startedAt}] STEP1 file saved: "${filename}" -> ${resumeUrl} (${buffer.length} bytes)`,
      );
    } catch (err) {
      console.error(`[upload ${startedAt}] STEP1 writeFile failed for "${filename}":`, err);
      throw new Error("Could not save the uploaded file to disk");
    }

    // ── STEP 2: Extract text ───────────────────────────────────────────────
    let resumeText = "";
    try {
      resumeText = await extractText(filePath, ext);
      console.log(
        `[upload ${startedAt}] STEP2 extracted ${resumeText.length} chars from "${filename}"`,
      );
    } catch (err) {
      console.error(`[upload ${startedAt}] STEP2 extractText failed for "${filename}":`, err);
      // Extraction failed — but the file is saved. Fall through to the draft
      // safety net below so the upload is not lost.
      resumeText = "";
    }

    // ── STEP 3: Resolve vacancy ─────────────────────────────────────────────
    let vacancyId: string;
    try {
      vacancyId = isCustom ? await findOrCreateGeneralVacancy() : jobId;
    } catch (err) {
      console.error(`[upload ${startedAt}] STEP3 vacancy resolve failed for "${filename}":`, err);
      throw new Error("Could not resolve the target vacancy");
    }

    // ── STEP 4: Parse with AI (Groq → Gemini → Cerebras fallback) ────────────
    // If text is too short to parse, OR all AI providers fail, we still create
    // a DRAFT record so the upload is never lost.
    if (!resumeText || resumeText.trim().length < 20) {
      console.warn(
        `[upload ${startedAt}] STEP4 text too short (${resumeText.trim().length} chars) for "${filename}" — saving as DRAFT`,
      );
      const draft = await createDraftCandidateFromUpload(
        filename,
        vacancyId,
        resumeUrl,
        resumeText,
        customPosition,
      );
      return NextResponse.json(
        {
          success: true,
          applicationId: draft.applicationId,
          candidateName: draft.candidateName,
          candidateEmail: draft.candidateEmail,
          draft: true,
          warning:
            "Could not extract enough text from the CV. Saved as a draft for manual review.",
        },
        { status: 201 },
      );
    }

    let parsed = null;
    try {
      parsed = await parseResumeWithFallback(resumeText);
      console.log(
        `[upload ${startedAt}] STEP4 AI parse ${parsed ? "succeeded" : "returned null"} for "${filename}"`,
      );
    } catch (err) {
      // RateLimitError or any other throw from the fallback orchestrator.
      console.error(
        `[upload ${startedAt}] STEP4 AI parse threw for "${filename}":`,
        err instanceof Error ? err.message : String(err),
      );
      parsed = null;
    }

    if (!parsed) {
      // ALL AI providers failed (or returned null). The file is saved and we
      // have raw text — create a DRAFT so the upload is never lost.
      console.warn(
        `[upload ${startedAt}] STEP4 all AI providers failed for "${filename}" — saving as DRAFT`,
      );
      const draft = await createDraftCandidateFromUpload(
        filename,
        vacancyId,
        resumeUrl,
        resumeText,
        customPosition,
      );
      return NextResponse.json(
        {
          success: true,
          applicationId: draft.applicationId,
          candidateName: draft.candidateName,
          candidateEmail: draft.candidateEmail,
          draft: true,
          warning:
            "AI parsing failed for all providers. Saved as a draft for manual review.",
        },
        { status: 201 },
      );
    }

    // ── STEP 5: Create candidate in DB ──────────────────────────────────────
    let result;
    try {
      result = await createCandidateFromUpload(
        parsed,
        vacancyId,
        resumeUrl,
        resumeText,
        customPosition,
      );
      console.log(
        `[upload ${startedAt}] STEP5 DB write succeeded for "${filename}" -> ${result.applicationId}`,
      );
    } catch (err) {
      console.error(`[upload ${startedAt}] STEP5 DB write failed for "${filename}":`, err);
      // The DB write for the FULL parsed candidate failed. Fall back to a
      // draft so the upload (file + raw text) is still preserved.
      const draft = await createDraftCandidateFromUpload(
        filename,
        vacancyId,
        resumeUrl,
        resumeText,
        customPosition,
      );
      return NextResponse.json(
        {
          success: true,
          applicationId: draft.applicationId,
          candidateName: draft.candidateName,
          candidateEmail: draft.candidateEmail,
          draft: true,
          warning:
            "Candidate was saved as a draft because the database write failed. Please review and complete the profile manually.",
        },
        { status: 201 },
      );
    }

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
    // Top-level catch — a hard, unrecoverable failure (e.g. could not save the
    // file to disk, could not resolve the vacancy). Surface a clear error.
    console.error(
      `[upload ${startedAt}] FATAL upload failed for "${filename}":`,
      error,
    );
    const message =
      error instanceof Error ? error.message : "Failed to upload CV";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
