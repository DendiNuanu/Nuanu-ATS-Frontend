import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * POST /api/candidates/[id]/notes
 *
 * Creates a new internal note attached to a candidate's application.
 *
 * Body: { content: string }
 *
 * The note's author is resolved from the request body `authorEmail` when
 * provided (sent from the client's auth context). When absent, falls back
 * to the first active user — matching the project's existing no-auth-layer
 * pattern used by /api/settings/profile and /api/requisitions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const applicationId = params.id;
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 },
      );
    }

    // Resolve the author. Prefer the client-provided email (from auth
    // context); fall back to the first active user.
    let authorId: string | undefined;
    const authorEmail =
      typeof body.authorEmail === "string" ? body.authorEmail.trim() : null;

    if (authorEmail) {
      const user = await prisma.user.findFirst({
        where: {
          email: { equals: authorEmail, mode: "insensitive" },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (user) {
        authorId = user.id;
      }
    }

    if (!authorId) {
      const user = await prisma.user.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json(
          { error: "No active user found to attribute the note" },
          { status: 400 },
        );
      }
      authorId = user.id;
    }

    // Verify the application exists before creating the note.
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    const note = await prisma.candidateNote.create({
      data: {
        applicationId,
        content,
        authorId,
      },
      include: {
        author: { select: { name: true, email: true } },
      },
    });

    // Revalidate the candidate detail page so fresh notes show on refresh.
    revalidatePath(`/candidates/${applicationId}`);

    return NextResponse.json({
      success: true,
      note: {
        id: note.id,
        content: note.content,
        authorName: note.author?.name ?? "Unknown",
        authorEmail: note.author?.email ?? null,
        createdAt: note.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to create note:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
