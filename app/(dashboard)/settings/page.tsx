import { fetchSettingsUsers, fetchRoles } from "@/lib/data-access";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const [users, roles] = await Promise.all([
    fetchSettingsUsers(),
    fetchRoles(),
  ]);

  return <SettingsClient users={users} roles={roles} />;
}
