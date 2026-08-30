import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

/**
 * GET /api/interview-transcripts?candidateId=<applicationId>
 *
 * Lists transcript sessions for a candidate (newest first), for the
 * Interview Results tab. Includes the AI summary and live status.
 */
export async function GET(request: NextRequest) {
  try {
    const candidateId = new URL(request.url).searchParams.get("candidateId");
    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId query parameter is required" },
        { status: 400 },
      );
    }

    const transcripts = await prisma.interviewTranscript.findMany({
      where: { applicationId: candidateId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sessionId: true,
        status: true,
        aiSummary: true,
        aiProvider: true,
        aiError: true,
        lines: true,
        createdAt: true,
        completedAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ transcripts });
  } catch (error) {
    console.error("[api/interview-transcripts] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load transcripts" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/interview-transcripts
 *
 * Appends a batch of finalized caption lines from the Chrome extension.
 *
 * Body: {
 *   candidateId, sessionId, userEmail, userPassword,
 *   lines: [{ speaker, text, timestamp }]
 * }
 *
 * Auth: per-request email+password verification against the users table
 * (same verifyPassword path as /api/auth/login). The extension stores the
 * HR user's credentials in chrome.storage.local for the session — each HR
 * user's transcripts are attributable to them, no shared credential exists.
 *
 * The row is created on first chunk (upsert on [applicationId, sessionId]);
 * subsequent chunks append. The extension batches client-side (sends every
 * few seconds), so DB writes stay modest for long calls.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidateId, sessionId, userEmail, userPassword, lines } = body;

    if (
      typeof candidateId !== "string" ||
      !candidateId.trim() ||
      typeof sessionId !== "string" ||
      !sessionId.trim()
    ) {
      return NextResponse.json(
        { error: "candidateId and sessionId are required" },
        { status: 400 },
      );
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ ok: true, appended: 0 });
    }
    if (lines.length > 200) {
      return NextResponse.json(
        { error: "Too many lines in one batch (max 200)" },
        { status: 413 },
      );
    }

    // ── Auth: verify the HR user's credentials ──
    if (typeof userEmail !== "string" || typeof userPassword !== "string") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: userEmail.trim(), mode: "insensitive" },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, password: true },
    });
    if (!user || !verifyPassword(userPassword, user.password)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // ── Validate + normalize incoming lines ──
    const cleanLines = lines
      .filter(
        (l: unknown): l is { speaker: string; text: string; timestamp: number } =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as { text?: unknown }).text === "string" &&
          (l as { text: string }).text.trim().length > 0,
      )
      .slice(0, 200)
      .map((l) => ({
        speaker:
          typeof l.speaker === "string" && l.speaker.trim()
            ? l.speaker.trim().slice(0, 100)
            : "Unknown",
        text: l.text.trim().slice(0, 2000),
        timestamp:
          typeof l.timestamp === "number" && Number.isFinite(l.timestamp)
            ? Math.max(0, Math.floor(l.timestamp))
            : Date.now(),
      }));

    if (cleanLines.length === 0) {
      return NextResponse.json({ ok: true, appended: 0 });
    }

    // ── Append (create on first chunk) ──
    const existing = await prisma.interviewTranscript.findUnique({
      where: { applicationId_sessionId: { applicationId: candidateId, sessionId } },
      select: { id: true, lines: true, status: true },
    });

    if (!existing) {
      await prisma.interviewTranscript.create({
        data: {
          applicationId: candidateId,
          sessionId,
          createdById: user.id,
          lines: cleanLines,
          status: "in_progress",
        },
      });
      return NextResponse.json({ ok: true, appended: cleanLines.length, created: true });
    }

    if (existing.status === "completed") {
      // Session already closed — reject late chunks so a stale tab can't
      // reopen a finalized transcript.
      return NextResponse.json(
        { error: "This transcript session is already completed" },
        { status: 409 },
      );
    }

    const current = Array.isArray(existing.lines) ? existing.lines : [];
    await prisma.interviewTranscript.update({
      where: { id: existing.id },
      data: { lines: [...current, ...cleanLines] },
    });
    return NextResponse.json({ ok: true, appended: cleanLines.length });
  } catch (error) {
    console.error("[api/interview-transcripts] POST error:", error);
    return NextResponse.json(
      { error: "Failed to append transcript lines" },
      { status: 500 },
    );
  }
}
