import { NextRequest, NextResponse } from "next/server";
import { createInterviewLink } from "@/lib/interview-links";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json().catch(() => ({}));
    const reviewerRole = body.reviewerRole;
    if (!["USER_1", "USER_2", "HR"].includes(reviewerRole)) {
      return NextResponse.json({ error: "Invalid reviewer role" }, { status: 400 });
    }
    const round = Number(body.round ?? 1);
    if (!Number.isInteger(round) || round < 1 || round > 50) {
      return NextResponse.json({ error: "Round must be a positive integer" }, { status: 400 });
    }

    const application = await prisma.application.findUnique({
      where: { id: params.id },
      select: { id: true, hrReviewerId: true, user1ReviewerId: true, user2ReviewerId: true },
    });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const reviewerId =
      reviewerRole === "HR"
        ? application.hrReviewerId
        : reviewerRole === "USER_1"
          ? application.user1ReviewerId
          : application.user2ReviewerId;
    if (!reviewerId) return NextResponse.json({ error: "Assign this reviewer first" }, { status: 400 });

    const { token, expiresAt } = await createInterviewLink({
      applicationId: params.id,
      reviewerId,
      reviewerRole,
      round,
    });

    // Prefer the configured public domain, then the reverse-proxy host. Never
    // publish an internal/local origin when this endpoint is reached through
    // the production proxy.
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      .trim();
    const forwardedProto =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
    const requestOrigin = request.nextUrl.origin;
    const isLocalOrigin = (origin: string) =>
      /:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    const baseUrl =
      (configuredOrigin && !isLocalOrigin(configuredOrigin)
        ? configuredOrigin
        : forwardedHost
          ? `${forwardedProto}://${forwardedHost}`
          : requestOrigin) || configuredOrigin || requestOrigin;

    return NextResponse.json({
      url: `${baseUrl}/interview-result/${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to create interview link:", error);
    return NextResponse.json({ error: "Failed to create interview link" }, { status: 500 });
  }
}
