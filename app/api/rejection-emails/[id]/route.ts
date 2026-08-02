import { NextResponse } from "next/server";
import { deliverRejectionEmailJob } from "@/lib/rejection-email-jobs";

/** Starts delivery for an already-persisted rejection job. */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const result = await deliverRejectionEmailJob(params.id);
  if (result === "not_found") {
    return NextResponse.json({ error: "Rejection email job not found" }, { status: 404 });
  }
  return NextResponse.json({ success: result !== "failed", status: result });
}
