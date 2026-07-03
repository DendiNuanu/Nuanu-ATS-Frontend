import { fetchNotifications } from "@/lib/data-access";
import { NotificationsClient } from "./NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notifications = await fetchNotifications();
  return <NotificationsClient notifications={notifications} />;
}
