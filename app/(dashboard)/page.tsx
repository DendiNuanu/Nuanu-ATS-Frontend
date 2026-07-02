import { fetchDashboardData } from "@/lib/data-access";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const data = await fetchDashboardData();
  return <DashboardClient data={data} />;
}
