import { NextRequest, NextResponse } from "next/server";
import { retryDueRejectionEmails } from "@/lib/rejection-email-jobs";

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (
    configuredSecret &&
    request.headers.get("authorization") !== `Bearer ${configuredSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!configuredSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const results = await retryDueRejectionEmails(10);
  return NextResponse.json({
    success: true,
    processed: results.length,
    fulfilled: results.filter((result) => result.status === "fulfilled").length,
    rejected: results.filter((result) => result.status === "rejected").length,
  });
}
