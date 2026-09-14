import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * External CV link attach/remove endpoint for an EXISTING candidate
 * application (Task 2 "Upload CV via Link").
 *
 * The link is stored verbatim on `CandidateProfile.externalCvUrl` — the URL
 * the candidate shared (Google Drive, Notion, Behance, personal site, …).
 * It is displayed as a clickable link on the candidate detail page's
 * Resume/CV tab. Unlike `resumeUrl`, this is never a local file path, so
 * there is no disk cleanup to do — only the DB field is set/cleared.
 *
 * Endpoints:
 *   PATCH  /api/candidates/[id]/cv-link — set the external CV link
 *                                         (json: { cvUrl: string | null })
 *   DELETE /api/candidates/[id]/cv-link — remove the link (clears the field)
 *
 * The `[id]` param is the Application id (the candidate detail page is keyed
 * by application id). The Application's `candidateId` is the User id, which
 * is also `CandidateProfile.userId` (1:1) — same resolution as the portfolio
 * route.
 */

/** Recursively resolve the Application → User id (CandidateProfile.userId). */
async function resolveUserId(applicationId: string): Promise<string | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidateId: true },
  });
  return app?.candidateId ?? null;
}

/** Revalidate every cache layer that reads externalCvUrl. */
function revalidateCandidatePaths(applicationId: string) {
  revalidatePath(`/candidates/${applicationId}`);
  revalidatePath(`/candidates/${applicationId}/edit`);
  revalidatePath(`/candidates/${applicationId}/compose`);
  revalidatePath(`/candidates/${applicationId}/summary`);
  revalidatePath(`/candidates/${applicationId}/edit-blacklist-reason`);
  revalidatePath("/candidates");
}

/**
 * PATCH — set the external CV link (or clear it by passing null/empty).
 * JSON body: { cvUrl: string | null }
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
    const raw = body.cvUrl;

    // null or empty string → clear the external CV link.
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      await prisma.candidateProfile.upsert({
        where: { userId },
        update: { externalCvUrl: null },
        create: { userId, externalCvUrl: null },
      });
      revalidateCandidatePaths(applicationId);
      return NextResponse.json({ success: true, cvUrl: null });
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
        { error: "CV link must start with http:// or https://" },
        { status: 400 },
      );
    }

    await prisma.candidateProfile.upsert({
      where: { userId },
      update: { externalCvUrl: url },
      create: { userId, externalCvUrl: url },
    });

    revalidateCandidatePaths(applicationId);

    return NextResponse.json({ success: true, cvUrl: url });
  } catch (error) {
    console.error("Failed to set external CV link:", error);
    const message =
      error instanceof Error ? error.message : "Failed to set external CV link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE — remove the external CV link entirely (clears the field).
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

    await prisma.candidateProfile.upsert({
      where: { userId },
      update: { externalCvUrl: null },
      create: { userId, externalCvUrl: null },
    });

    revalidateCandidatePaths(applicationId);

    return NextResponse.json({ success: true, cvUrl: null });
  } catch (error) {
    console.error("Failed to remove external CV link:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to remove external CV link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
