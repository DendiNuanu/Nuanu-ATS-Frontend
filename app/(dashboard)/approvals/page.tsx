import { fetchPendingRequisitions } from "@/lib/data-access";
import { ApprovalsClient } from "./ApprovalsClient";

export default async function ApprovalsPage() {
  const pending = await fetchPendingRequisitions();
  return <ApprovalsClient pending={pending} />;
}
