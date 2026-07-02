"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Card, Button, Avatar } from "@/components/ui";
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
  { id: "localization", label: "Localization", icon: Globe },
];

export function SettingsClient({
  users,
  roles,
}: {
  users: SettingsUser[];
  roles: RoleRow[];
}) {
  const [activeSection, setActiveSection] = useState("profile");
  const [rolesExpanded, setRolesExpanded] = useState(false);
  const { user } = useCurrentUser();

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
                      defaultValue={user.name}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      defaultValue={user.email}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Role
                    </label>
                    <input
                      type="text"
                      defaultValue={user.role}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
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
                      defaultValue="+62 812 3456 7890"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Location
                    </label>
                    <input
                      type="text"
                      defaultValue="Jakarta, Indonesia"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <Button variant="ghost" size="md">
                    Cancel
                  </Button>
                  <Button variant="primary" size="md">
                    Save Changes
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
                <Button variant="primary" size="md">
                  Update Password
                </Button>
              </div>
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
                <Button variant="primary" size="md">
                  Save Preferences
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
