import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  TIMELINE_EVENT_TYPES,
  buildTimelineEventKey,
  isEditableTimelineEventType,
} from "@/lib/timeline-events";

const ALLOWED_EVENT_TYPES = new Set(Object.values(TIMELINE_EVENT_TYPES));

function normalizeAllowedEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function parseDisplayAt(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("displayAt must be a valid ISO date string or null");
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

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

async function resolveAuthorizedUser(request: NextRequest, body: Record<string, unknown>) {
  const candidates: string[] = [];
  const direct = normalizeAllowedEmail(
    typeof body.authorEmail === "string" ? body.authorEmail : null,
  );
  if (direct) candidates.push(direct);

  const headerEmail = normalizeAllowedEmail(
    request.headers.get("x-user-email") ??
      request.headers.get("x-current-user-email") ??
      request.headers.get("x-forwarded-user-email") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      null,
  );
  if (headerEmail) candidates.push(headerEmail);

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = /(?:^|;\s*)(?:nuanu_user_email|user_email|session_user_email|auth_user_email)=([^;]+)/.exec(cookieHeader);
  const cookieEmail = cookieMatch ? normalizeAllowedEmail(decodeURIComponent(cookieMatch[1])) : null;
  if (cookieEmail) candidates.push(cookieEmail);

  const uniqueEmails = Array.from(
    new Set(candidates.filter((value): value is string => Boolean(value))),
  );
  if (uniqueEmails.length === 0) {
    return { user: null, code: 401 };
  }

  for (const email of uniqueEmails) {
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        isActive: true,
        deletedAt: null,
      },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) continue;

    const roleNames = user.userRoles.map((ur) => ur.role.name.toLowerCase());
    const allowed = roleNames.some(
      (role) =>
        role.includes("admin") ||
        role.includes("staff") ||
        role.includes("manager") ||
        role.includes("recruiter"),
    );

    if (allowed && !roleNames.some((role) => role.includes("viewer"))) {
      return { user, code: 200 };
    }
  }

  return { user: null, code: 403 };
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

    const auth = await resolveAuthorizedUser(request, body);
    if (auth.user === null) {
      return NextResponse.json(
        {
          error: auth.code === 403
            ? "Forbidden: only Admin and Staff can edit timeline dates."
            : "Unauthorized: login required.",
        },
        { status: auth.code },
      );
    }

    const displayAt = parseDisplayAt(body.displayAt);
    const sourceAt = await resolveSourceAt(applicationId, eventType, eventKey);

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
        updatedById: auth.user.id,
      },
      create: {
        applicationId,
        eventType,
        eventKey,
        sourceAt,
        displayAt,
        createdById: auth.user.id,
        updatedById: auth.user.id,
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

    const auth = await resolveAuthorizedUser(request, body);
    if (auth.user === null) {
      return NextResponse.json(
        {
          error: auth.code === 403
            ? "Forbidden: only Admin and Staff can edit timeline dates."
            : "Unauthorized: login required.",
        },
        { status: auth.code },
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
