import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/proxy-resume?url=/backups-resumes/file.pdf
 *
 * Serves a resume/CV file stored outside the `public/` directory (in
 * `backups-resumes/`) so it can be rendered inline in the browser's PDF
 * viewer via an <iframe>/<object> tag on the candidate detail page.
 *
 * Security: the requested path is resolved against `process.cwd()` and
 * verified to stay within the allowed uploads directory, preventing path
 * traversal (e.g. `?url=../../etc/passwd`).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing `url` query parameter" },
      { status: 400 },
    );
  }

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
    console.error("proxy-resume error:", message);
    return NextResponse.json(
      { error: "Resume file not found" },
      { status: 404 },
    );
  }
}
