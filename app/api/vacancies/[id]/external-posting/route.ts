import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SEEK_API_KEY = process.env.SEEK_API_KEY || "nuanu-seek-secret-2026";

/**
 * Registers SEEK's immutable listing identifier against an existing ATS job.
 * Candidate imports subsequently resolve through JobPosting, never job titles.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (request.headers.get("x-api-key") !== SEEK_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const channel = String(body.channel ?? "seek").trim().toLowerCase();
    const externalId = String(body.seekJobId ?? body.externalJobId ?? "").trim();
    const externalUrl = String(body.seekJobUrl ?? body.externalJobUrl ?? "").trim();
    if (!externalId && !externalUrl) {
      return NextResponse.json(
        { error: "seekJobId/externalJobId or seekJobUrl/externalJobUrl is required" },
        { status: 400 },
      );
    }

    const vacancy = await prisma.vacancy.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true },
    });
    if (!vacancy) {
      return NextResponse.json({ error: "Active vacancy not found" }, { status: 404 });
    }

    const existing = await prisma.jobPosting.findFirst({
      where: {
        channel: { equals: channel, mode: "insensitive" },
        OR: [
          ...(externalId ? [{ externalId }] : []),
          ...(externalUrl ? [{ externalUrl }] : []),
        ],
      },
      select: { id: true, vacancyId: true },
    });
    if (existing && existing.vacancyId !== vacancy.id) {
      return NextResponse.json(
        {
          error: "External listing is already mapped to another vacancy",
          mappedVacancyId: existing.vacancyId,
        },
        { status: 409 },
      );
    }

    const posting = existing
      ? await prisma.jobPosting.update({
          where: { id: existing.id },
          data: {
            externalId: externalId || undefined,
            externalUrl: externalUrl || undefined,
            status: "active",
          },
        })
      : await prisma.jobPosting.create({
          data: {
            vacancyId: vacancy.id,
            channel,
            externalId: externalId || null,
            externalUrl: externalUrl || null,
            status: "active",
          },
        });

    revalidatePath(`/jobs/${vacancy.id}`);
    return NextResponse.json({ success: true, posting }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "External listing identifier or URL is already mapped" },
        { status: 409 },
      );
    }
    console.error("Failed to register external vacancy mapping:", error);
    return NextResponse.json({ error: "Failed to register external vacancy mapping" }, { status: 500 });
  }
}
