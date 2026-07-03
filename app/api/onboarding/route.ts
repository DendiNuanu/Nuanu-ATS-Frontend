import { NextRequest, NextResponse } from "next/server";
import { startOnboarding } from "@/lib/data-access";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId } = body;

    if (!employeeId || typeof employeeId !== "string") {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 },
      );
    }

    const id = await startOnboarding(employeeId);

    revalidatePath("/onboarding");

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error("Failed to start onboarding:", error);
    const message =
      error instanceof Error ? error.message : "Failed to start onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
