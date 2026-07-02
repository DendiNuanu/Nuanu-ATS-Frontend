import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names intelligently (clsx + tailwind-merge).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Derive initials from a full name.
 * - "Budi Santoso" -> "BS"
 * - "Enrico"        -> "EN"
 * - "" / null       -> "" (caller should show a fallback icon)
 */
export function initials(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Deterministic avatar color from a string (name or id).
 * Same input always yields the same color across renders.
 */
const AVATAR_COLOR_PALETTE = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
];

export function avatarColorFromString(str: string): string {
  const s = str || "unknown";
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLOR_PALETTE[Math.abs(hash) % AVATAR_COLOR_PALETTE.length];
}

/**
 * Format a number as IDR currency (for display only).
 */
export function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
