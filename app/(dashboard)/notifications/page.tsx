import { fetchNotifications } from "@/lib/data-access";
import { NotificationsClient } from "./NotificationsClient";

export default async function NotificationsPage() {
  const notifications = await fetchNotifications();
  return <NotificationsClient notifications={notifications} />;
}
