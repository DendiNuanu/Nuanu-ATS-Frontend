import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  createCandidateFromUpload,
  createDraftCandidateFromUpload,
  findOrCreateVacancyForPosition,
} from "@/lib/data-access";
import { extractText, parseResumeWithFallback } from "@/lib/cv-parser";
import {
  fetchExternalCv,
  ExternalCvFetchError,
} from "@/lib/external-cv-fetch";
import {
  isPostgresInvalidByteError,
  looksLikeDatabaseError,
} from "@/lib/sanitize";

/**
 * POST /api/candidates/upload-link
 *
 * Task 2 "Upload CV via Link". Accepts a JSON body:
 *   {
 *     cvUrl:        string  (required) — the CV link (Google Drive share link,
 *                                          personal site, …)
 *     portfolioUrl: string  (optional) — an external portfolio link, stored
 *                                          verbatim on the candidate profile
 *     jobId:        string  (required) — vacancy id, or "__custom__"
 *     customPosition: string (when jobId === "__custom__")
 *   }
 *
 * FLOW:
 *   1. Validate the input (URL format, http/https, job present).
 *   2. Try to DOWNLOAD the CV via the SSRF-safe fetcher
 *      (lib/external-cv-fetch.ts): Google Drive links are converted to
 *      direct-download URLs, private/internal IPs are blocked, downloads
 *      time out after 20s and are capped at 5MB, and the content type must
 *      be a real document (not an HTML page).
 *   3a. DOWNLOAD SUCCEEDED → run the file through the exact same pipeline as
 *       a regular upload: extractText → parseResumeWithFallback →
 *       createCandidateFromUpload. The original link is ALSO stored on the
 *       profile (externalCvUrl) so HR can always open the source.
 *   3b. DOWNLOAD FAILED (Notion/Behance/login-walled Drive, timeout, …) →
 *       NEVER fail the request. Create a DRAFT candidate record with the
 *       link stored as externalCvUrl (and portfolioUrl when provided),
 *       flagged needs_manual_review, so HR can review the link by hand.
 *       This is the "data harus masuk" guarantee for link uploads.
 *
 * Returns:
 *   { success, applicationId, candidateName, candidateEmail,
 *     draft?, linkSaved?, warning?, fetchError? }
 */
export async function POST(request: NextRequest) {
  const startedAt = new Date().toISOString();

  try {
    const body = await request.json();
    const cvUrlRaw = typeof body.cvUrl === "string" ? body.cvUrl.trim() : "";
    const portfolioUrlRaw =
      typeof body.portfolioUrl === "string" ? body.portfolioUrl.trim() : "";
    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    const customPosition =
      typeof body.customPosition === "string" ? body.customPosition.trim() : "";

    // ── Validation ─────────────────────────────────────────────────────────
    if (!cvUrlRaw) {
      return NextResponse.json(
        { error: "CV link is required" },
        { status: 400 },
      );
    }
    if (!jobId) {
      return NextResponse.json(
        { error: "Job/Vacancy is required" },
        { status: 400 },
      );
    }
    const isCustom = jobId === "__custom__";
    if (isCustom && !customPosition) {
      return NextResponse.json(
        { error: "Custom position text is required" },
        { status: 400 },
      );
    }

    // Validate URL formats up-front (both links) so a typo never reaches the
    // fetch stage. The CV link must be http(s); same for the portfolio link.
    const validateUrl = (raw: string, label: string): string | null => {
      try {
        const parsed = new URL(raw);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return `${label} must start with http:// or https://`;
        }
        return null;
      } catch {
        return `${label} is not a valid URL`;
      }
    };
    const cvUrlError = validateUrl(cvUrlRaw, "CV link");
    if (cvUrlError) {
      return NextResponse.json({ error: cvUrlError }, { status: 400 });
    }
    if (portfolioUrlRaw) {
      const portfolioUrlError = validateUrl(portfolioUrlRaw, "Portfolio link");
      if (portfolioUrlError) {
        return NextResponse.json({ error: portfolioUrlError }, { status: 400 });
      }
    }

    const externalLinks = {
      cvUrl: cvUrlRaw,
      portfolioUrl: portfolioUrlRaw || null,
    };

    // ── Resolve the vacancy (same logic as the file-upload route) ──────────
    let vacancyId: string;
    try {
      vacancyId = isCustom
        ? await findOrCreateVacancyForPosition(customPosition)
        : jobId;
    } catch (err) {
      console.error(
        `[upload-link ${startedAt}] vacancy resolve failed for "${cvUrlRaw}":`,
        err,
      );
      return NextResponse.json(
        { error: "Could not resolve the target vacancy" },
        { status: 500 },
      );
    }

    // ── Try to download the CV ─────────────────────────────────────────────
    let fetched: Awaited<ReturnType<typeof fetchExternalCv>> | null = null;
    let fetchError: string | null = null;
    try {
      fetched = await fetchExternalCv(cvUrlRaw);
      console.log(
        `[upload-link ${startedAt}] downloaded "${cvUrlRaw}" -> ${fetched.resumeUrl} (${fetched.byteLength} bytes, ${fetched.contentType})`,
      );
    } catch (err) {
      if (err instanceof ExternalCvFetchError) {
        fetchError = err.message;
        console.warn(
          `[upload-link ${startedAt}] fetch failed (${err.code}) for "${cvUrlRaw}": ${err.message}`,
        );
      } else {
        fetchError = "The CV link could not be downloaded";
        console.error(
          `[upload-link ${startedAt}] unexpected fetch error for "${cvUrlRaw}":`,
          err,
        );
      }
    }

    // ── DOWNLOAD FAILED → save the link as a draft (never lose data) ───────
    if (!fetched) {
      const draft = await createDraftCandidateFromUpload(
        "CV via link",
        vacancyId,
        // No local file — the resume "URL" is the external link itself. The
        // detail page renders externalCvUrl as a clickable link.
        cvUrlRaw,
        `CV submitted via link: ${cvUrlRaw}${portfolioUrlRaw ? `\nPortfolio: ${portfolioUrlRaw}` : ""}`,
        customPosition || null,
        "link",
        externalLinks,
      );
      return NextResponse.json(
        {
          success: true,
          applicationId: draft.applicationId,
          candidateName: draft.candidateName,
          candidateEmail: draft.candidateEmail,
          draft: true,
          linkSaved: true,
          fetchError,
          warning:
            "The CV link could not be downloaded automatically (it may require login or is not a direct file). The link has been saved on the candidate record for manual review.",
        },
        { status: 201 },
      );
    }

    // ── DOWNLOAD SUCCEEDED → same pipeline as a regular file upload ────────
    // STEP 1: Extract text from the downloaded file.
    let resumeText = "";
    try {
      const ext = path.extname(fetched.filePath).toLowerCase();
      resumeText = await extractText(fetched.filePath, ext);
      console.log(
        `[upload-link ${startedAt}] extracted ${resumeText.length} chars from "${cvUrlRaw}"`,
      );
    } catch (err) {
      console.error(
        `[upload-link ${startedAt}] extractText failed for "${cvUrlRaw}":`,
        err,
      );
      resumeText = "";
    }

    // STEP 2: Too little text → draft safety net (file + link both saved).
    if (!resumeText || resumeText.trim().length < 20) {
      const draft = await createDraftCandidateFromUpload(
        fetched.filename,
        vacancyId,
        fetched.resumeUrl,
        resumeText,
        customPosition || null,
        "link",
        externalLinks,
      );
      return NextResponse.json(
        {
          success: true,
          applicationId: draft.applicationId,
          candidateName: draft.candidateName,
          candidateEmail: draft.candidateEmail,
          draft: true,
          warning:
            "Could not extract enough text from the downloaded CV. Saved as a draft for manual review.",
        },
        { status: 201 },
      );
    }

    // STEP 3: AI parse (Groq → Gemini → Cerebras fallback chain).
    let parsed = null;
    try {
      parsed = await parseResumeWithFallback(resumeText);
    } catch (err) {
      console.error(
        `[upload-link ${startedAt}] AI parse threw for "${cvUrlRaw}":`,
        err instanceof Error ? err.message : String(err),
      );
      parsed = null;
    }

    if (!parsed) {
      // All AI providers failed — the downloaded file is saved on disk; keep
      // the record as a draft with the original link attached.
      const draft = await createDraftCandidateFromUpload(
        fetched.filename,
        vacancyId,
        fetched.resumeUrl,
        resumeText,
        customPosition || null,
        "link",
        externalLinks,
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

    // STEP 4: Create the full candidate record.
    try {
      const result = await createCandidateFromUpload(
        parsed,
        vacancyId,
        fetched.resumeUrl,
        resumeText,
        customPosition || null,
        "link",
        externalLinks,
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
    } catch (err) {
      if (isPostgresInvalidByteError(err)) {
        console.error(
          `[upload-link ${startedAt}] Postgres 22021 for "${cvUrlRaw}":`,
          err,
        );
        return NextResponse.json(
          {
            error:
              "File CV mengandung karakter tidak valid. Coba re-save atau convert ulang PDF-nya, lalu upload kembali.",
          },
          { status: 422 },
        );
      }

      console.error(
        `[upload-link ${startedAt}] DB write failed for "${cvUrlRaw}":`,
        err,
      );

      if (looksLikeDatabaseError(err)) {
        return NextResponse.json(
          {
            error:
              "Gagal menyimpan kandidat karena masalah database. Tim teknis sudah bisa memeriksa log server untuk detailnya — silakan coba beberapa saat lagi.",
          },
          { status: 500 },
        );
      }

      // Non-DB failure → draft safety net so the record is never lost.
      const draft = await createDraftCandidateFromUpload(
        fetched.filename,
        vacancyId,
        fetched.resumeUrl,
        resumeText,
        customPosition || null,
        "link",
        externalLinks,
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
  } catch (error) {
    console.error(`[upload-link] FATAL:`, error);
    const message = looksLikeDatabaseError(error)
      ? "Gagal memproses upload karena masalah database. Silakan coba beberapa saat lagi — detail error sudah tercatat di log server."
      : error instanceof Error && error.message
        ? error.message
        : "Failed to upload CV via link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
