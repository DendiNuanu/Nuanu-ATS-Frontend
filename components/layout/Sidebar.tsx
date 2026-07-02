"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { currentUser } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/Avatar";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Use the logged-in mock user when available; fall back to a default
  // so existing pages don't break if someone navigates directly.
  const displayName = user?.name ?? currentUser.name;
  const displayRole = user?.role ?? currentUser.role;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-white">
      {/* Logo — stacked lockup */}
      <div className="flex flex-col items-start gap-2 px-5 py-4 border-b border-slate-200">
        <Image
          src="https://www.nuanu.com/images/logo.svg"
          alt="Nuanu"
          width={120}
          height={28}
          className="h-7 w-auto"
          unoptimized
        />
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 whitespace-nowrap">
          HR Recruitment ATS
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-[#e6f5f3] text-[#006b5f] font-medium"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User profile card */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2">
          <Avatar name={displayName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {displayName}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {displayRole}
            </p>
          </div>
          <button
            className="text-slate-500 hover:text-slate-900 p-1.5 rounded-md hover:bg-slate-200 transition-colors"
            aria-label="Sign out"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
