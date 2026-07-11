import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  createCandidateFromUpload,
  findOrCreateGeneralVacancy,
  type ParsedCandidate,
} from "@/lib/data-access";
import { extractText, parseResumeWithAI } from "@/lib/cv-parser";

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
