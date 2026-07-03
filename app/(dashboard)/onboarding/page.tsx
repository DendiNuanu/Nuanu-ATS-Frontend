import { fetchOnboardingStats, fetchOnboardingRecords } from "@/lib/data-access";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [stats, records] = await Promise.all([
    fetchOnboardingStats(),
    fetchOnboardingRecords(),
  ]);

  return <OnboardingClient stats={stats} records={records} />;
}
