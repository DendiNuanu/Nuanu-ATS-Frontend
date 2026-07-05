import { notFound } from "next/navigation";
import { fetchEmployeeForConfirmation } from "@/lib/data-access";
import { NewHireConfirmationClient } from "./NewHireConfirmationClient";

export const dynamic = "force-dynamic";

export default async function NewHireConfirmationPage({
  params,
}: {
  params: { employeeId: string };
}) {
  const employee = await fetchEmployeeForConfirmation(params.employeeId);

  if (!employee) {
    notFound();
  }

  return <NewHireConfirmationClient employee={employee} />;
}
