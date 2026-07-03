import { fetchEmployeesWithoutOnboarding } from "@/lib/data-access";
import { StartOnboardingClient } from "./StartOnboardingClient";

export const dynamic = "force-dynamic";

export default async function StartOnboardingPage() {
  const employees = await fetchEmployeesWithoutOnboarding();

  return <StartOnboardingClient employees={employees} />;
}
