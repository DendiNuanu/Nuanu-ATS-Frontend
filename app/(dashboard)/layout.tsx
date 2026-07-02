"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { collapsed } = useSidebar();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show a brief loading spinner while the auth check runs,
  // or while redirecting to /login — avoids a flash of dashboard content.
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#006b5f]" />
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div
        className={cn(
          "transition-[padding] duration-200 ease-in-out",
          collapsed ? "pl-[76px]" : "pl-[260px]",
        )}
      >
        <TopBar />
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
