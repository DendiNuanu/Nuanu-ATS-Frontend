import { NextRequest, NextResponse } from "next/server";
import {
  startOnboarding,
  startOnboardingWithContract,
  type ContractInput,
} from "@/lib/data-access";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, contract, status } = body;

    if (!employeeId || typeof employeeId !== "string") {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 },
      );
    }

    // If contract data is provided, use the new flow that creates both
    // Onboarding + EmployeeContract records.
    if (contract && typeof contract === "object") {
      // Validate required contract fields
      const required: (keyof ContractInput)[] = [
        "employmentType",
        "contractStart",
        "workLocation",
        "workingHours",
        "reportingTo",
        "salaryType",
        "basicSalary",
      ];
      for (const field of required) {
        if (contract[field] == null || contract[field] === "") {
          return NextResponse.json(
            { error: `Contract field "${field}" is required` },
            { status: 400 },
          );
        }
      }

      const contractStatus: "draft" | "finalized" =
        status === "finalized" ? "finalized" : "draft";

      const result = await startOnboardingWithContract(
        employeeId,
        contract as ContractInput,
        contractStatus,
      );

      revalidatePath("/onboarding");
      revalidatePath(`/employees/${employeeId}`);

      return NextResponse.json(
        {
          success: true,
          onboardingId: result.onboardingId,
          contractId: result.contractId,
          status: contractStatus,
        },
        { status: 201 },
      );
    }

    // Legacy flow: just create onboarding record (no contract)
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
