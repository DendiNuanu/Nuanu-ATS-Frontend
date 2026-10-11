import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  TIMELINE_EVENT_TYPES,
  buildTimelineEventKey,
  isEditableTimelineEventType,
} from "@/lib/timeline-events";

const ALLOWED_EVENT_TYPES = new Set(Object.values(TIMELINE_EVENT_TYPES));

function parseDisplayAt(value: unknown): Date | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("displayAt must be a valid ISO date string or null");
  }

  const trimmed = value.trim();
  const isoDateTime =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoDateTime.test(trimmed)) {
    throw new Error("displayAt must be a valid ISO date string");
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("displayAt must be a valid ISO date string");
  }

  const now = new Date();
  const futureGraceMs = 5 * 60 * 1000;
  if (parsed.getTime() > now.getTime() + futureGraceMs) {
    throw new Error("displayAt cannot be more than 5 minutes in the future");
  }

  return parsed;
}

async function resolveAuthorId(authorEmail: unknown): Promise<string | null> {
  if (typeof authorEmail === "string" && authorEmail.trim()) {
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: authorEmail.trim(), mode: "insensitive" },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (user) return user.id;
  }

  const fallbackUser = await prisma.user.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return fallbackUser?.id ?? null;
}

async function resolveSourceAt(
  applicationId: string,
  eventType: string,
  eventKey: string,
): Promise<Date> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      appliedAt: true,
      createdAt: true,
      blacklistedAt: true,
      pipelineStages: {
        where: { id: eventKey },
        select: { enteredAt: true },
        take: 1,
      },
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  if (eventType === TIMELINE_EVENT_TYPES.PIPELINE_STAGE) {
    return application.pipelineStages[0]?.enteredAt ?? application.appliedAt;
  }

  if (eventType === TIMELINE_EVENT_TYPES.BLACKLIST) {
    return application.blacklistedAt ?? application.appliedAt;
  }

  if (eventType === TIMELINE_EVENT_TYPES.APPLICATION_RECEIVED) {
    return application.appliedAt;
  }

  if (eventType === TIMELINE_EVENT_TYPES.RESUME_PARSED) {
    return application.createdAt ?? application.appliedAt;
  }

  if (eventType === TIMELINE_EVENT_TYPES.AI_MATCH) {
    return application.createdAt ?? application.appliedAt;
  }

  return application.appliedAt;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json().catch(() => ({}));
    const applicationId = params.id;
    const eventType = typeof body.eventType === "string" ? body.eventType : "";
    const eventKey = typeof body.eventKey === "string" ? body.eventKey : "";

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        { error: "Unsupported timeline event type." },
        { status: 400 },
      );
    }

    if (!isEditableTimelineEventType(eventType)) {
      return NextResponse.json(
        { error: "This timeline event is not editable." },
        { status: 400 },
      );
    }

    if (!eventKey.trim()) {
      return NextResponse.json(
        { error: "eventKey is required." },
        { status: 400 },
      );
    }

    const displayAt = parseDisplayAt(body.displayAt);
    const sourceAt = await resolveSourceAt(applicationId, eventType, eventKey);
    const authorId = await resolveAuthorId(body.authorEmail);
    if (!authorId) {
      return NextResponse.json(
        { error: "No active user found to attribute the timeline edit." },
        { status: 400 },
      );
    }

    const override = await prisma.timelineEventOverride.upsert({
      where: {
        applicationId_eventType_eventKey: {
          applicationId,
          eventType,
          eventKey,
        },
      },
      update: {
        sourceAt,
        displayAt,
        updatedById: authorId,
      },
      create: {
        applicationId,
        eventType,
        eventKey,
        sourceAt,
        displayAt,
        createdById: authorId,
        updatedById: authorId,
      },
    });

    revalidatePath(`/candidates/${applicationId}`);
    revalidatePath("/candidates");

    return NextResponse.json({
      success: true,
      override: {
        id: override.id,
        applicationId: override.applicationId,
        eventType: override.eventType,
        eventKey: override.eventKey,
        sourceAt: override.sourceAt.toISOString(),
        displayAt: override.displayAt ? override.displayAt.toISOString() : null,
        key: buildTimelineEventKey(override.eventType, override.eventKey),
      },
    });
  } catch (error) {
    console.error("Failed to update timeline event override:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update timeline date";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json().catch(() => ({}));
    const applicationId = params.id;
    const eventType = typeof body.eventType === "string" ? body.eventType : "";
    const eventKey = typeof body.eventKey === "string" ? body.eventKey : "";

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        { error: "Unsupported timeline event type." },
        { status: 400 },
      );
    }

    if (!eventKey.trim()) {
      return NextResponse.json(
        { error: "eventKey is required." },
        { status: 400 },
      );
    }

    const existing = await prisma.timelineEventOverride.findUnique({
      where: {
        applicationId_eventType_eventKey: {
          applicationId,
          eventType,
          eventKey,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.timelineEventOverride.delete({
        where: { id: existing.id },
      });
    }

    revalidatePath(`/candidates/${applicationId}`);
    revalidatePath("/candidates");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear timeline event override:", error);
    const message =
      error instanceof Error ? error.message : "Failed to clear timeline date";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
