import {
  LayoutDashboard,
  Briefcase,
  ClipboardCheck,
  Users,
  KanbanSquare,
  UserCog,
  Sparkles,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  Building2,
  Rocket,
  BarChart3,
  FileBarChart,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Jobs & Vacancies", href: "/jobs", icon: Briefcase },
  { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { label: "Candidates", href: "/candidates", icon: Users },
  { label: "Pipeline", href: "/pipeline", icon: KanbanSquare },
  { label: "Talent Bank", href: "/talent-bank", icon: UserCog },
  { label: "AI Scoring", href: "/ai-scoring", icon: Sparkles },
  { label: "Interviews", href: "/interviews", icon: CalendarClock },
  { label: "Assessment", href: "/assessment", icon: ClipboardList },
  { label: "Offers", href: "/offers", icon: FileCheck2 },
  { label: "Employees", href: "/employees", icon: Building2 },
  { label: "Onboarding", href: "/onboarding", icon: Rocket },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

/**
 * Map a pathname to a human-readable page title + breadcrumb.
 * Falls back to a best-effort title for dynamic routes.
 */
export function getPageMeta(pathname: string): { title: string; breadcrumb: string } {
  const map: Record<string, { title: string; breadcrumb: string }> = {
    "/": { title: "Dashboard", breadcrumb: "Dashboard" },
    "/jobs": { title: "Jobs & Vacancies", breadcrumb: "Jobs & Vacancies" },
    "/approvals": { title: "Approvals", breadcrumb: "Approvals" },
    "/candidates": { title: "Candidates", breadcrumb: "Candidates" },
    "/pipeline": { title: "Pipeline", breadcrumb: "Pipeline" },
    "/talent-bank": { title: "Talent Bank", breadcrumb: "Talent Bank" },
    "/ai-scoring": { title: "AI Scoring", breadcrumb: "AI Scoring" },
    "/interviews": { title: "Interviews", breadcrumb: "Interviews" },
    "/interviews/schedule": { title: "Schedule Interview", breadcrumb: "Interviews / Schedule" },
    "/assessment": { title: "Assessment", breadcrumb: "Assessment" },
    "/assessment/send": { title: "Send Assessment", breadcrumb: "Assessment / Send" },
    "/offers": { title: "Offers", breadcrumb: "Offers" },
    "/offers/generate": { title: "Generate Offer", breadcrumb: "Offers / Generate" },
    "/employees": { title: "Employees", breadcrumb: "Employees" },
    "/onboarding": { title: "Onboarding", breadcrumb: "Onboarding" },
    "/analytics": { title: "Analytics", breadcrumb: "Analytics" },
    "/reports": { title: "Reports", breadcrumb: "Reports" },
    "/notifications": { title: "Notifications", breadcrumb: "Notifications" },
    "/settings": { title: "Settings", breadcrumb: "Settings" },
    "/candidates/compose": { title: "New Message", breadcrumb: "Candidates / Compose" },
  };

  if (map[pathname]) return map[pathname];

  // Dynamic candidate detail
  if (pathname.startsWith("/candidates/")) {
    return { title: "Candidate Profile", breadcrumb: "Candidates / Profile" };
  }

  return { title: "Dashboard", breadcrumb: "Dashboard" };
}
