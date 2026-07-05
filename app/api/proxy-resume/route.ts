import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/proxy-resume?url=<url>
 *
 * Serves a resume/CV file so it can be rendered inline in the browser's PDF
 * viewer via an <iframe>/<object> tag on the candidate detail page.
 *
 * Handles TWO kinds of `url` values:
 *
 * 1. LOCAL paths (e.g. `/backups-resumes/file.pdf`):
 *    Reads the file from the `backups-resumes/` directory at the project root
 *    (outside `public/`, so it can't be served directly by Next.js). Path
 *    traversal is prevented by rejecting `..` segments and verifying the
 *    resolved path stays within the uploads directory.
 *
 * 2. REMOTE URLs (e.g. `https://hr-ats.nuanu.site/uploads/resumes/file.pdf`):
 *    Legacy candidates imported from the old ATS have `resumeUrl` values
 *    pointing at the old domain. The old server is still alive, so we fetch
 *    the file server-side and stream it back to the browser. Only a whitelist
 *    of trusted hosts is allowed to prevent SSRF.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing `url` query parameter" },
      { status: 400 },
    );
  }

  // --- REMOTE URL branch -------------------------------------------------
  if (/^https?:\/\//i.test(url)) {
    return serveRemoteResume(url);
  }

  // --- LOCAL file branch -------------------------------------------------
  return serveLocalResume(url);
}

/**
 * Trusted hosts for remote resume fetching. Only these domains may be
 * proxied through this route to prevent SSRF attacks.
 */
const TRUSTED_HOSTS = [
  "hr-ats.nuanu.site",
  "hr.ats.new.nuanu.site",
];

async function serveRemoteResume(rawUrl: string): Promise<NextResponse> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL" },
      { status: 400 },
    );
  }

  // SSRF guard: only allow trusted hosts.
  if (!TRUSTED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json(
      { error: "Host not allowed" },
      { status: 403 },
    );
  }

  try {
    const upstream = await fetch(rawUrl, { redirect: "follow" });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Resume file not found (upstream ${upstream.status})` },
        { status: 404 },
      );
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const ext = path.extname(parsed.pathname).toLowerCase();

    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".doc"
          ? "application/msword"
          : ext === ".docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : upstream.headers.get("content-type") ?? "application/octet-stream";

    const fileName = path.basename(parsed.pathname) || "resume";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch resume file";
    console.error("proxy-resume remote error:", message);
    return NextResponse.json(
      { error: "Resume file not found" },
      { status: 404 },
    );
  }
}

async function serveLocalResume(url: string): Promise<NextResponse> {
  // Only allow relative paths that point at the resumes directory.
  // Strip a leading slash so we can join safely.
  const normalized = url.startsWith("/") ? url.slice(1) : url;

  // Reject any path containing ".." segments to prevent traversal.
  if (normalized.includes("..")) {
    return NextResponse.json(
      { error: "Invalid path" },
      { status: 400 },
    );
  }

  const uploadsDir = path.join(process.cwd(), "backups-resumes");
  const filePath = path.join(uploadsDir, path.basename(normalized));

  // Final safety check: the resolved path must be inside uploadsDir.
  const resolvedUploads = path.resolve(uploadsDir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedUploads + path.sep)) {
    return NextResponse.json(
      { error: "Invalid path" },
      { status: 400 },
    );
  }

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".doc"
          ? "application/msword"
          : ext === ".docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/octet-stream";

    // `inline` so the browser renders PDFs in the viewer instead of downloading.
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read resume file";
    console.error("proxy-resume local error:", message);
    return NextResponse.json(
      { error: "Resume file not found" },
      { status: 404 },
    );
  }
}
