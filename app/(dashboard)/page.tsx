import {
  fetchDashboardData,
  fetchVacancyFilterOptions,
  type DashboardDateRange,
} from "@/lib/data-access";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

const VALID_RANGES: DashboardDateRange[] = ["7d", "30d", "90d", "year", "all"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Parse filter values from the URL query string.
  const rawRange = typeof searchParams.range === "string" ? searchParams.range : "all";
  const dateRange: DashboardDateRange = VALID_RANGES.includes(rawRange as DashboardDateRange)
    ? (rawRange as DashboardDateRange)
    : "all";
  const vacancyId = typeof searchParams.vacancy === "string" ? searchParams.vacancy : "";

  const [data, vacancyOptions] = await Promise.all([
    fetchDashboardData({ dateRange, vacancyId: vacancyId || null }),
    fetchVacancyFilterOptions(),
  ]);

  return (
    <DashboardClient
      data={data}
      vacancyOptions={vacancyOptions}
      initialDateRange={dateRange}
      initialVacancyId={vacancyId}
    />
  );
}
