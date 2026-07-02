"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { collapsed, toggleCollapsed } = useSidebar();
  const { user } = useCurrentUser();

  const displayName = user.name;
  const displayRole = user.role;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[76px]" : "w-[260px]",
      )}
    >
      {/* Logo — stacked lockup */}
      <div
        className={cn(
          "flex items-center border-b border-slate-200 py-4",
          collapsed ? "justify-center px-3" : "flex-col items-start gap-2 px-5",
        )}
      >
        <Image
          src="https://www.nuanu.com/images/logo.svg"
          alt="Nuanu"
          width={120}
          height={28}
          className={cn("h-7 w-auto", collapsed && "h-8")}
          unoptimized
        />
        {!collapsed && (
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 whitespace-nowrap">
            HR Recruitment ATS
          </p>
        )}
      </div>

      {/* Collapse toggle button */}
      <button
        onClick={toggleCollapsed}
        className={cn(
          "flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors py-2",
          collapsed ? "justify-center px-3" : "px-5",
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4" />
            <span>Collapse</span>
          </>
        )}
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Menu
          </p>
        )}
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="relative group">
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg text-sm transition-colors",
                    collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                    active
                      ? "bg-[#e6f5f3] text-[#006b5f] font-medium"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User profile card */}
      <div className="border-t border-slate-200 p-3">
        <div
          className={cn(
            "flex items-center rounded-lg bg-slate-50 p-2",
            collapsed ? "justify-center" : "gap-3",
          )}
        >
          <Avatar name={displayName} size="md" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {displayRole}
              </p>
            </div>
          )}
          {!collapsed && (
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
          )}
        </div>
        {collapsed && (
          <button
            className="mt-2 flex w-full items-center justify-center text-slate-500 hover:text-slate-900 p-1.5 rounded-md hover:bg-slate-200 transition-colors"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
