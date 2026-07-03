import {
  fetchSettingsUsers,
  fetchRoles,
  fetchCurrentUserProfile,
} from "@/lib/data-access";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [users, roles, profile] = await Promise.all([
    fetchSettingsUsers(),
    fetchRoles(),
    fetchCurrentUserProfile(),
  ]);

  return <SettingsClient users={users} roles={roles} profile={profile} />;
}
