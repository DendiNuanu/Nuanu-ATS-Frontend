import { fetchPendingRequisitions } from "@/lib/data-access";
import { ApprovalsClient } from "./ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const pending = await fetchPendingRequisitions();
  return <ApprovalsClient pending={pending} />;
}
