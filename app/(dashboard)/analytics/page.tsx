import { fetchAnalyticsData } from "@/lib/data-access";
import { AnalyticsClient } from "./AnalyticsClient";

export default async function AnalyticsPage() {
  const data = await fetchAnalyticsData();
  return <AnalyticsClient data={data} />;
}
