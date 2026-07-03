import { NextRequest, NextResponse } from "next/server";
import { updateRequisitionStatus } from "@/lib/data-access";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const body = await request.json();

    const decision = body.decision;
    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json(
        { error: "Invalid decision. Must be 'approved' or 'rejected'." },
        { status: 400 },
      );
    }

    const comment = typeof body.comment === "string" ? body.comment : "";

    await updateRequisitionStatus(id, decision, comment);

    revalidatePath("/approvals");
    revalidatePath(`/approvals/${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update requisition:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update requisition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    await prisma.approval.deleteMany({ where: { requisitionId: id } });
    await prisma.jobRequisition.delete({ where: { id } });

    revalidatePath("/approvals");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete requisition:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete requisition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
