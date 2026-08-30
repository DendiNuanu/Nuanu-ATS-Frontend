import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { summarizeInterviewTranscript } from "@/lib/interview-transcript-ai";

/**
 * POST /api/interview-transcripts/complete
 *
 * Session-complete signal from the Chrome extension (Stop button, call end,
 * or tab close). Marks the transcript completed and triggers AI
 * summarization via the existing Groq → Gemini → Cerebras chain.
 *
 * Body: { candidateId, sessionId, userEmail, userPassword }
 *
 * Summarization runs inline (awaited) so the response tells the extension
 * whether the summary succeeded. Typical transcripts summarize in a few
 * seconds; the route has no timeout shorter than the platform default.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Internal retry path (from the Interview Results tab UI) ──
    // Regenerates the AI summary for an already-completed transcript.
    // Follows the app's existing no-auth-layer pattern for dashboard UI
    // calls (same as /api/candidates/[id]/notes etc.).
    if (body.retrySummary === true) {
      const transcriptId = typeof body.transcriptId === "string" ? body.transcriptId : "";
      if (!transcriptId) {
        return NextResponse.json({ error: "transcriptId is required" }, { status: 400 });
      }
      const row = await prisma.interviewTranscript.findUnique({
        where: { id: transcriptId },
        select: { id: true, status: true },
      });
      if (!row) {
        return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
      }
      if (row.status !== "completed") {
        return NextResponse.json(
          { error: "Can only retry summary for a completed session" },
          { status: 409 },
        );
      }
      const provider = await summarizeInterviewTranscript(row.id);
      return NextResponse.json({ ok: true, summarized: provider !== null, provider });
    }

    const { candidateId, sessionId, userEmail, userPassword } = body;

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

    const transcript = await prisma.interviewTranscript.findUnique({
      where: { applicationId_sessionId: { applicationId: candidateId, sessionId } },
      select: { id: true, status: true, createdById: true },
    });

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript session not found (no chunks were received)" },
        { status: 404 },
      );
    }

    // Only the session owner may finalize it.
    if (transcript.createdById !== user.id) {
      return NextResponse.json(
        { error: "Only the HR user who started this session can complete it" },
        { status: 403 },
      );
    }

    if (transcript.status === "completed") {
      // Idempotent — extension may send complete on both Stop and tab close.
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    await prisma.interviewTranscript.update({
      where: { id: transcript.id },
      data: { status: "completed", completedAt: new Date() },
    });

    const provider = await summarizeInterviewTranscript(transcript.id);

    return NextResponse.json({
      ok: true,
      summarized: provider !== null,
      provider,
    });
  } catch (error) {
    console.error("[api/interview-transcripts/complete] POST error:", error);
    return NextResponse.json(
      { error: "Failed to complete transcript session" },
      { status: 500 },
    );
  }
}
