import { NextRequest, NextResponse } from "next/server";
import { deleteOnboarding } from "@/lib/data-access";
import { revalidatePath } from "next/cache";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Onboarding id is required" },
        { status: 400 },
      );
    }

    await deleteOnboarding(id);

    revalidatePath("/onboarding");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete onboarding record:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete onboarding record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
