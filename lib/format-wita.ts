/**
 * Centralized date/time formatting utilities for the Nuanu ATS.
 *
 * All timestamps are stored as UTC in the database (Prisma DateTime) — this is
 * best practice and is NOT changed. These utilities convert UTC timestamps to
 * WITA (Waktu Indonesia Tengah / Central Indonesia Time, UTC+8) for display,
 * using the IANA timezone identifier "Asia/Makassar".
 *
 * Using `Intl.DateTimeFormat` with an explicit `timeZone` option is the most
 * reliable way to format in a specific timezone in JavaScript — it works
 * identically on the server (Node.js) and the client (browser), regardless of
 * the runtime's local timezone. No external date library is needed.
 *
 * WITA = UTC+8, no daylight saving. Asia/Makassar is the canonical IANA name.
 */

/** IANA timezone identifier for WITA (UTC+8, Central Indonesia Time). */
export const WITA_TIMEZONE = "Asia/Makassar";

/**
 * Formats a Date/timestamp as "DD/MM/YYYY · HH:MM" in WITA.
 * Used by the email-sent / rejection-sent badges on the candidates list.
 *
 * Example: new Date("2026-07-03T08:18:00Z") → "03/07/2026 · 16:18"
 */
export function formatDateTimeWita(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} · ${get("hour")}:${get("minute")}`;
}

/**
 * Formats a Date/timestamp as "DD Mon YYYY · HH:MM" in WITA.
 * Used by notifications and activity timeline entries.
 *
 * Example: new Date("2026-07-03T08:18:00Z") → "03 Jul 2026 · 16:18"
 */
export function formatDateTimeShortWita(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} · ${get("hour")}:${get("minute")}`;
}

/**
 * Formats a Date/timestamp as "DD Mon YYYY" (date only, no time) in WITA.
 * Used for applied dates, posted dates, start dates, etc.
 *
 * Example: new Date("2026-07-03T08:18:00Z") → "03 Jul 2026"
 */
export function formatDateWita(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Formats a Date/timestamp as "HH:MM" (time only, 24-hour) in WITA.
 * Used for interview times.
 *
 * Example: new Date("2026-07-03T08:18:00Z") → "16:18"
 */
export function formatTimeWita(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Formats a Date/timestamp as "DDD, DD Mon YYYY" (weekday + date) in WITA.
 * Used for interview date headers.
 *
 * Example: new Date("2026-07-03T08:18:00Z") → "Fri, 03 Jul 2026"
 */
export function formatWeekdayDateWita(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: WITA_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
