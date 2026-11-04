import {
  NextRequest,
  NextResponse,
} from "next/server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request
      .json()
      .catch(() => ({}));

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Admin credentials required" },
        { status: 401 },
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
        isActive: true,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (
      !user ||
      !(await verifyPassword(password, user.password))
    ) {
      return NextResponse.json(
        { error: "Invalid admin credentials" },
        { status: 401 },
      );
    }

    if (
      !user.userRoles.some(
        (entry) => /admin/i.test(entry.role.name),
      )
    ) {
      return NextResponse.json(
        {
          error: "Only Admin accounts may archive vacancies",
        },
        { status: 403 },
      );
    }

    const archived = await prisma.$transaction(
      async (tx) => {
        const vacancy = await tx.vacancy.findFirst({
          where: {
            id: params.id,
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
          },
        });

        if (!vacancy) return null;

        const result = await tx.vacancy.updateMany({
          where: {
            id: vacancy.id,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
          },
        });

        if (result.count !== 1) {
          throw new Error(
            "Vacancy changed during archive",
          );
        }

        await tx.activityLog.create({
          data: {
            userId: user.id,
            action: "archive",
            resource: "vacancy",
            resourceId: vacancy.id,
            metadata: {
              title: vacancy.title,
              method: "upload_cv_selection",
            },
          },
        });

        return vacancy;
      },
    );

    if (!archived) {
      return NextResponse.json(
        {
          error: "Vacancy not found or already archived",
        },
        { status: 404 },
      );
    }

    revalidatePath("/candidates/upload");
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${params.id}`);

    return NextResponse.json({
      success: true,
      title: archived.title,
    });
  } catch (error) {
    console.error(
      "Archive vacancy failed:",
      error,
    );

    return NextResponse.json(
      { error: "Could not archive vacancy" },
      { status: 500 },
    );
  }
}
