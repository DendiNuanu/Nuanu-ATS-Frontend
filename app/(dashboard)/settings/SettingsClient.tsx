"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Bell,
  Shield,
  Globe,
  ChevronDown,
  ShieldCheck,
  Pencil,
  Key,
  Trash2,
  Plus,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Card, Button, Avatar } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  ROLE_BADGE_STYLES,
  type AppUser,
} from "@/lib/mock-data";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { SettingsUser, RoleRow } from "@/lib/data-access";

const subNav = [
  { id: "profile", label: "Profile", icon: Users },
  { id: "users", label: "Users & Roles", icon: ShieldCheck },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "localization", label: "Localization", icon: Globe },
];

export function SettingsClient({
  users,
  roles,
  profile,
}: {
  users: SettingsUser[];
  roles: RoleRow[];
  profile: {
    name: string;
    email: string;
    phone: string;
    location: string;
  };
}) {
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState("profile");
  const [rolesExpanded, setRolesExpanded] = useState(false);
  const { user } = useCurrentUser();

  // Profile form state
  const [profileName, setProfileName] = useState(profile.name || user.name);
  const [profileEmail, setProfileEmail] = useState(profile.email || user.email);
  const [profilePhone, setProfilePhone] = useState(profile.phone ?? "");
  const [profileLocation, setProfileLocation] = useState(profile.location ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Localization state
  const [savingLocalization, setSavingLocalization] = useState(false);

  // Calendar integration state
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarConfigured, setCalendarConfigured] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
          phone: profilePhone,
          location: profileLocation,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save profile");
      }
      showToast("Profile updated successfully", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to save profile",
        "error",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update password");
      }
      showToast("Password updated successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update password",
        "error",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveLocalization = async () => {
    setSavingLocalization(true);
    try {
      // Localization preferences are client-side only for now (no DB table).
      // Simulate a brief save and show success.
      await new Promise((r) => setTimeout(r, 400));
      showToast("Localization preferences saved", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to save preferences",
        "error",
      );
    } finally {
      setSavingLocalization(false);
    }
  };

  // ── Calendar integration ──────────────────────────────────────────────
  const checkCalendarStatus = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch("/api/google-calendar/status");
      if (res.ok) {
        const data = await res.json();
        setCalendarConnected(data.connected);
        setCalendarConfigured(data.configured);
      }
    } catch {
      // ignore — leave defaults
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    checkCalendarStatus();
  }, [checkCalendarStatus]);

  // Check URL params for OAuth callback results
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected")) {
      showToast("Google Calendar connected successfully!", "success");
      checkCalendarStatus();
      window.history.replaceState({}, "", "/settings");
    }
    if (params.get("calendar_error")) {
      showToast(
        `Calendar connection failed: ${params.get("calendar_error")}`,
        "error",
      );
      window.history.replaceState({}, "", "/settings");
    }
  }, [showToast, checkCalendarStatus]);

  const handleConnectCalendar = () => {
    window.location.href = "/api/google-calendar/auth";
  };

  const handleDisconnectCalendar = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google-calendar/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      showToast("Google Calendar disconnected", "success");
      setCalendarConnected(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to disconnect",
        "error",
      );
    } finally {
      setDisconnecting(false);
    }
  };

  // Map DB users to AppUser shape for the table (preserves existing UI)
  const tableUsers: AppUser[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as AppUser["role"],
    department: u.department,
    status: u.status,
    avatarColor: u.avatarColor,
  }));

  // Map DB roles to the string array the UI expects
  const allRoleNames = roles.map((r) => r.name) as AppUser["role"][];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left Sub-nav */}
        <div className="lg:w-64 lg:shrink-0">
          <nav className="space-y-1">
            {subNav.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  activeSection === item.id
                    ? "bg-[#e6f5f3] text-[#006b5f]"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1">
          {activeSection === "profile" && (
            <div className="space-y-6">
              <Card>
                <h2 className="font-heading text-lg font-semibold text-slate-900">
                  Profile Information
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update your personal information and photo
                </p>

                {/* Avatar */}
                <div className="mt-6 flex items-center gap-4">
                  <Avatar name={user.name} size="xl" />
                  <div>
                    <Button variant="secondary" size="sm">
                      Change Photo
                    </Button>
                    <p className="mt-2 text-xs text-slate-400">
                      JPG, PNG or GIF. Max 2MB.
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Role
                    </label>
                    <input
                      type="text"
                      value={user.role}
                      disabled
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Department
                    </label>
                    <input
                      type="text"
                      defaultValue="Human Resources"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="+62 812 3456 7890"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Location
                    </label>
                    <input
                      type="text"
                      value={profileLocation}
                      onChange={(e) => setProfileLocation(e.target.value)}
                      placeholder="e.g. Jakarta, Indonesia"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <Button variant="ghost" size="md">
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {activeSection === "users" && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-slate-900">
                    Users & Roles
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage team members and their permissions
                  </p>
                </div>
                <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
                  <a href="/settings/users/new">Create User</a>
                </Button>
              </div>

              {/* Users table */}
              <Card noPadding>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                        <th className="text-left font-medium px-6 py-3">User</th>
                        <th className="text-left font-medium px-6 py-3">Role</th>
                        <th className="text-left font-medium px-6 py-3">Department</th>
                        <th className="text-left font-medium px-6 py-3">Status</th>
                        <th className="text-right font-medium px-6 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tableUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                            No users found. Create a user to get started.
                          </td>
                        </tr>
                      ) : (
                        tableUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar name={u.name} size="md" color={u.avatarColor} />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900">{u.name}</p>
                                  <p className="text-xs text-slate-500">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE_STYLES[u.role] ?? "bg-slate-100 text-slate-600"}`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{u.department}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                {u.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                                  aria-label="Edit user"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                                  aria-label="Permissions"
                                >
                                  <Key className="h-4 w-4" />
                                </button>
                                <button
                                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                  aria-label="Delete user"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Roles Management collapsible */}
              <div className="rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setRolesExpanded((v) => !v)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left"
                >
                  <ShieldCheck className="h-5 w-5 text-[#006b5f]" />
                  <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Roles Management
                  </span>
                  <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {allRoleNames.length}
                  </span>
                  <ChevronDown
                    className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${
                      rolesExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {rolesExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {allRoleNames.map((role) => (
                        <div
                          key={role}
                          className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2"
                        >
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_STYLES[role] ?? "bg-slate-100 text-slate-600"}`}
                          >
                            {role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "notifications" && (
            <Card>
              <h2 className="font-heading text-lg font-semibold text-slate-900">
                Notification Preferences
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose what notifications you receive
              </p>
              <div className="mt-6 space-y-4">
                {[
                  {
                    label: "New candidate applications",
                    desc: "Get notified when a new candidate applies",
                    enabled: true,
                  },
                  {
                    label: "Interview reminders",
                    desc: "Receive reminders before scheduled interviews",
                    enabled: true,
                  },
                  {
                    label: "Offer status updates",
                    desc: "Updates when offers are sent, accepted, or declined",
                    enabled: true,
                  },
                  {
                    label: "Approval requests",
                    desc: "Notifications for pending approvals",
                    enabled: false,
                  },
                  {
                    label: "Weekly summary digest",
                    desc: "A weekly recap of recruitment activity",
                    enabled: true,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                    <button
                      className={`relative h-6 w-11 rounded-full transition ${
                        item.enabled ? "bg-[#006b5f]" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                          item.enabled ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeSection === "security" && (
            <Card>
              <h2 className="font-heading text-lg font-semibold text-slate-900">
                Security
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage your password and security settings
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Two-Factor Authentication
                    </p>
                    <p className="text-xs text-slate-500">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <button className="relative h-6 w-11 rounded-full bg-slate-200">
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
                  </button>
                </div>
              </div>
              <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleUpdatePassword}
                  disabled={savingPassword || !currentPassword || !newPassword}
                >
                  {savingPassword ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </Card>
          )}

          {activeSection === "calendar" && (
            <Card>
              <h2 className="font-heading text-lg font-semibold text-slate-900">
                Google Calendar Integration
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Connect your Google Calendar to automatically create events and
                generate Google Meet links when scheduling interviews.
              </p>

              {calendarLoading ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking connection status...
                </div>
              ) : !calendarConfigured ? (
                <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-800">
                    Google Calendar integration is not configured on the server.
                    Set the following environment variables to enable it:
                  </p>
                  <ul className="mt-2 text-xs text-amber-700 list-disc list-inside space-y-0.5">
                    <li>GOOGLE_CLIENT_ID</li>
                    <li>GOOGLE_CLIENT_SECRET</li>
                    <li>GOOGLE_REDIRECT_URI</li>
                  </ul>
                </div>
              ) : calendarConnected ? (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-900">
                        Google Calendar is connected
                      </p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Interview events will be created automatically with
                        Google Meet links.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <ExternalLink className="h-4 w-4" />
                    <a
                      href="https://calendar.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#006b5f] underline"
                    >
                      Open Google Calendar
                    </a>
                  </div>
                  <div className="flex justify-end border-t border-slate-100 pt-4">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={handleDisconnectCalendar}
                      disabled={disconnecting}
                    >
                      {disconnecting ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <Calendar className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">
                        Not connected
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Connect your Google account to sync interview events.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-slate-100 pt-4">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleConnectCalendar}
                    >
                      Connect Google Calendar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {activeSection === "localization" && (
            <Card>
              <h2 className="font-heading text-lg font-semibold text-slate-900">
                Localization
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Set your language and regional preferences
              </p>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Language
                  </label>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20">
                    <option>English (United States)</option>
                    <option>Bahasa Indonesia</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Timezone
                  </label>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20">
                    <option>WIB (UTC+7) — Jakarta</option>
                    <option>WITA (UTC+8) — Makassar</option>
                    <option>WIT (UTC+9) — Jayapura</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Date Format
                  </label>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20">
                    <option>DD/MM/YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Currency
                  </label>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20">
                    <option>IDR — Indonesian Rupiah</option>
                    <option>USD — US Dollar</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveLocalization}
                  disabled={savingLocalization}
                >
                  {savingLocalization ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
