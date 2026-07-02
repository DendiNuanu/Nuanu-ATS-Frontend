"use client";

import { useState } from "react";
import {
  Bell,
  CheckCircle2,
  UserPlus,
  Calendar,
  FileText,
  AlertCircle,
  Mail,
  Check,
  Trash2,
  Settings,
} from "lucide-react";
import { Card, Button } from "@/components/ui";
import { mockNotifications } from "@/lib/mock-data";

const tabs = ["All", "Unread"];

const iconMap: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  candidate: { icon: UserPlus, color: "text-[#006b5f]", bg: "bg-[#e6f5f3]" },
  interview: { icon: Calendar, color: "text-indigo-600", bg: "bg-indigo-50" },
  offer: { icon: FileText, color: "text-amber-600", bg: "bg-amber-50" },
  system: { icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50" },
  message: { icon: Mail, color: "text-sky-600", bg: "bg-sky-50" },
  approval: { icon: CheckCircle2, color: "text-violet-600", bg: "bg-violet-50" },
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("All");

  const filtered =
    activeTab === "Unread"
      ? mockNotifications.filter((n) => !n.read)
      : mockNotifications;

  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {unreadCount} unread of {mockNotifications.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="md">
            <Check className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
          <Button variant="secondary" size="md">
            <Settings className="mr-2 h-4 w-4" />
            Preferences
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab
                ? "text-[#006b5f]"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
            {tab === "Unread" && unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-[#006b5f] px-2 py-0.5 text-xs font-semibold text-white">
                {unreadCount}
              </span>
            )}
            {activeTab === tab && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#006b5f]" />
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f5f3]">
              <Bell className="h-7 w-7 text-[#006b5f]" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-slate-900">
              You are all caught up
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              No unread notifications to display.
            </p>
          </Card>
        ) : (
          filtered.map((notification) => {
            const config = iconMap[notification.type] || iconMap.system;
            const Icon = config.icon;
            return (
              <Card
                key={notification.id}
                className={`flex items-start gap-4 transition hover:shadow-md ${
                  !notification.read ? "border-l-4 border-l-[#006b5f]" : ""
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bg}`}
                >
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900">
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-[#006b5f]" />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {notification.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {notification.timestamp}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2">
                    {!notification.read && (
                      <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300">
                        <Check className="h-3.5 w-3.5" />
                        Mark read
                      </button>
                    )}
                    <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
