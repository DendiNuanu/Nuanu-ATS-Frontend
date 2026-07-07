"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPageMeta } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { GlobalSearchDropdown } from "@/components/layout/GlobalSearchDropdown";
import { Search, Bell, ChevronRight } from "lucide-react";

export function TopBar() {
  const pathname = usePathname();
  const { breadcrumb } = getPageMeta(pathname);
  const { user } = useCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const breadcrumbParts = breadcrumb.split(" / ");

  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      try {
        const res = await fetch("/api/notifications/count", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnreadCount(data.count ?? 0);
      } catch {
        // silently fail — badge just won't show
      }
    }
    loadCount();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 backdrop-blur px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-400">Dashboard</span>
          {breadcrumbParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span
                className={
                  i === breadcrumbParts.length - 1
                    ? "font-medium text-slate-700"
                    : "text-slate-400"
                }
              >
                {part}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className={cn(
              "h-10 w-10 inline-flex items-center justify-center rounded-lg transition-colors",
              searchOpen
                ? "bg-[#006b5f]/10 text-[#006b5f]"
                : "text-slate-500 hover:bg-slate-100",
            )}
            aria-label="Search"
            aria-expanded={searchOpen}
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <GlobalSearchDropdown open={searchOpen} onClose={() => setSearchOpen(false)} />
        </div>

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Link>

        {/* Avatar — name only, no role line (TopBar-specific) */}
        <div className="ml-1 flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <Avatar name={user.name} size="md" />
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {user.name}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
