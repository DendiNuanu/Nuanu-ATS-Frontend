import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Portfolio attach/replace/remove endpoints for a candidate application.
 *
 * The portfolio is stored on `CandidateProfile.portfolioUrl` as a single
 * string. Two kinds of values are supported:
 *
 *   1. LOCAL uploaded file path (e.g. "/backups-resumes/portfolio-<ts>-<name>.pdf")
 *      — the file lives in the `backups-resumes/` directory at the project
 *      root (same convention as Resume/CV uploads) and is served inline by
 *      the existing `/api/proxy-resume` route, so no new storage dir or
 *      proxy is needed.
 *
 *   2. EXTERNAL URL (e.g. "https://behance.net/...") — stored verbatim.
 *
 * Endpoints:
 *   POST   /api/candidates/[id]/portfolio   — upload a file (multipart/form-data: `file`)
 *   PATCH  /api/candidates/[id]/portfolio   — set an external URL (json: { portfolioUrl })
 *   DELETE /api/candidates/[id]/portfolio   — remove the portfolio (clears the field,
 *                                             and deletes the uploaded file from disk
 *                                             when it was a local upload)
 *
 * The `[id]` param is the Application id (the candidate detail page is keyed
 * by application id). The Application's `candidateId` is the User id, which
 * is also `CandidateProfile.userId` (1:1).
 */

// Same upload constraints as the Resume/CV upload route for consistency.
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTS = [".pdf", ".png", ".jpg", ".jpeg"];
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

const UPLOADS_DIR = path.join(process.cwd(), "backups-resumes");
const LOCAL_PREFIX = "/backups-resumes/";

/** True when the stored portfolioUrl points at a locally-uploaded file. */
function isLocalPortfolioUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith(LOCAL_PREFIX);
}

/** Recursively resolve the Application → User id (CandidateProfile.userId). */
async function resolveUserId(applicationId: string): Promise<string | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidateId: true },
  });
  return app?.candidateId ?? null;
}

/** Revalidate every cache layer that reads portfolioUrl. */
function revalidateCandidatePaths(applicationId: string) {
  revalidatePath(`/candidates/${applicationId}`);
  revalidatePath(`/candidates/${applicationId}/edit`);
  revalidatePath(`/candidates/${applicationId}/compose`);
  revalidatePath(`/candidates/${applicationId}/summary`);
  revalidatePath(`/candidates/${applicationId}/edit-blacklist-reason`);
  revalidatePath("/candidates");
}

/**
 * POST — file upload.
 * Multipart body: `file` (PDF/PNG/JPG, ≤5MB).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const applicationId = params.id;
    const userId = await resolveUserId(applicationId);
    if (!userId) {
      return NextResponse.json(
        { error: "Candidate application not found" },
        { status: 404 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    // Validate file type (by both MIME and extension — belt and suspenders).
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, PNG, and JPG files are allowed for portfolios" },
        { status: 400 },
      );
    }
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: "Only PDF, PNG, and JPG files are allowed for portfolios" },
        { status: 400 },
      );
    }

    // Validate file size.
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 },
      );
    }

    // If there's an existing LOCAL portfolio file, delete it from disk so
    // replacing doesn't leave orphaned files. (External URLs are just
    // overwritten in the DB — nothing to delete on disk.)
    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { portfolioUrl: true },
    });
    const existingUrl = existingProfile?.portfolioUrl ?? null;
    if (isLocalPortfolioUrl(existingUrl)) {
      const oldPath = path.join(
        UPLOADS_DIR,
        path.basename(existingUrl as string),
      );
      await fs.rm(oldPath, { force: true }).catch(() => {
        /* ignore — best-effort cleanup */
      });
    }

    // Save the new file to backups-resumes/ (same dir as CVs).
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const safeName = `portfolio-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    const portfolioUrl = `${LOCAL_PREFIX}${safeName}`;

    // Persist to CandidateProfile (upsert in case the profile row doesn't
    // exist yet — mirrors the pattern in updateCandidate).
    await prisma.candidateProfile.upsert({
      where: { userId },
      update: { portfolioUrl },
      create: { userId, portfolioUrl },
    });

    revalidateCandidatePaths(applicationId);

    return NextResponse.json(
      { success: true, portfolioUrl },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to upload portfolio:", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload portfolio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH — set an external URL (or clear it by passing null/empty).
 * JSON body: { portfolioUrl: string | null }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const applicationId = params.id;
    const userId = await resolveUserId(applicationId);
    if (!userId) {
      return NextResponse.json(
        { error: "Candidate application not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const raw = body.portfolioUrl;

    // null or empty string → clear the portfolio.
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      // If clearing a LOCAL file, also remove it from disk.
      const existingProfile = await prisma.candidateProfile.findUnique({
        where: { userId },
        select: { portfolioUrl: true },
      });
      const existingUrl = existingProfile?.portfolioUrl ?? null;
      if (isLocalPortfolioUrl(existingUrl)) {
        const oldPath = path.join(
          UPLOADS_DIR,
          path.basename(existingUrl as string),
        );
        await fs.rm(oldPath, { force: true }).catch(() => {
          /* ignore */
        });
      }
      await prisma.candidateProfile.upsert({
        where: { userId },
        update: { portfolioUrl: null },
        create: { userId, portfolioUrl: null },
      });
      revalidateCandidatePaths(applicationId);
      return NextResponse.json({ success: true, portfolioUrl: null });
    }

    // Validate URL format: must be a valid http(s) URL.
    const url = String(raw).trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "Portfolio URL must start with http:// or https://" },
        { status: 400 },
      );
    }

    // If switching from a LOCAL file to an external URL, delete the old file.
    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { portfolioUrl: true },
    });
    const existingUrl = existingProfile?.portfolioUrl ?? null;
    if (isLocalPortfolioUrl(existingUrl) && existingUrl !== url) {
      const oldPath = path.join(
        UPLOADS_DIR,
        path.basename(existingUrl as string),
      );
      await fs.rm(oldPath, { force: true }).catch(() => {
        /* ignore */
      });
    }

    await prisma.candidateProfile.upsert({
      where: { userId },
      update: { portfolioUrl: url },
      create: { userId, portfolioUrl: url },
    });

    revalidateCandidatePaths(applicationId);

    return NextResponse.json({ success: true, portfolioUrl: url });
  } catch (error) {
    console.error("Failed to set portfolio URL:", error);
    const message =
      error instanceof Error ? error.message : "Failed to set portfolio URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE — remove the portfolio entirely (clears the field and deletes any
 * locally-uploaded file from disk).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const applicationId = params.id;
    const userId = await resolveUserId(applicationId);
    if (!userId) {
      return NextResponse.json(
        { error: "Candidate application not found" },
        { status: 404 },
      );
    }

    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { portfolioUrl: true },
    });
    const existingUrl = existingProfile?.portfolioUrl ?? null;

    if (isLocalPortfolioUrl(existingUrl)) {
      const oldPath = path.join(
        UPLOADS_DIR,
        path.basename(existingUrl as string),
      );
      await fs.rm(oldPath, { force: true }).catch(() => {
        /* ignore */
      });
    }

    await prisma.candidateProfile.upsert({
      where: { userId },
      update: { portfolioUrl: null },
      create: { userId, portfolioUrl: null },
    });

    revalidateCandidatePaths(applicationId);

    return NextResponse.json({ success: true, portfolioUrl: null });
  } catch (error) {
    console.error("Failed to remove portfolio:", error);
    const message =
      error instanceof Error ? error.message : "Failed to remove portfolio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
