/**
 * Postgres string sanitization utilities.
 *
 * WHY THIS EXISTS:
 * PostgreSQL `text`/`varchar` columns REJECT strings containing the null byte
 * (0x00 / \u0000) with error code 22021:
 *
 *   PostgresError: invalid byte sequence for encoding "UTF8": 0x00
 *
 * This is NOT an ordinary UTF-8 encoding problem — a string can be perfectly
 * valid UTF-8 and still contain \u0000, which JavaScript/JSON happily carry
 * but Postgres refuses to store. AI CV parsing providers (Groq / Gemini /
 * Cerebras / GLM-OCR) occasionally emit these garbage bytes inside parsed
 * fields (especially OCR'd text from scanned PDFs), and they propagate
 * untouched through JSON.parse into Prisma writes, crashing the upsert.
 *
 * Postgres has ZERO tolerance for this byte — it cannot be escaped or quoted,
 * only stripped. Beyond \u0000, control characters in the ranges
 * 0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F are also invalid/unsafe for `text`
 * columns; only \n (0x0A), \r (0x0D), and \t (0x09) are accepted.
 *
 * USAGE:
 * - `sanitizeForPostgres(value)`  — single string, strip invalid control chars.
 * - `sanitizeObjectDeep(obj)`     — recursively sanitize EVERY string value in
 *                                   a nested object/array (e.g. a parsed CV).
 * - `logIfUnsanitizable(value, label)` — audit log when garbage bytes are
 *                                   detected (server-side only, never sent to
 *                                   the client).
 */

/**
 * Control characters invalid in Postgres text columns:
 * 0x00–0x08 (null, SOH..BS), 0x0B (VT), 0x0C (FF), 0x0E–0x1F (SO..US).
 * Valid and therefore PRESERVED: \t (0x09), \n (0x0A), \r (0x0D).
 */
const INVALID_POSTGRES_CONTROL_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Fast pre-check: does this string contain any byte we would strip? */
const HAS_INVALID_CONTROL_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/**
 * Strips all characters that PostgreSQL text/varchar columns reject.
 *
 * - Removes null bytes (\u0000) — Postgres error 22021 "invalid byte sequence
 *   for encoding UTF8: 0x00" — and other invalid control characters.
 * - PRESERVES \n, \r, and \t (valid in Postgres text, and meaningful in CV
 *   descriptions with preserved line breaks).
 * - Passes through null/undefined unchanged (they stay null/undefined, never
 *   coerced to an empty string).
 */
export function sanitizeForPostgres<T extends string | null | undefined>(
  value: T,
): T {
  if (value == null) return value;
  if (!HAS_INVALID_CONTROL_CHARS.test(value)) return value;
  return value.replace(INVALID_POSTGRES_CONTROL_CHARS, "") as T;
}

/** Quick check without modifying the value. */
export function hasInvalidPostgresCharacters(
  value: string | null | undefined,
): boolean {
  if (value == null) return false;
  return HAS_INVALID_CONTROL_CHARS.test(value);
}

/**
 * Recursively sanitizes EVERY string value inside an arbitrarily nested
 * object or array, returning a new structure with the same shape.
 *
 * Use this on the raw output of AI CV parsing (Groq / Gemini / Cerebras /
 * GLM-OCR) before it reaches any `prisma.*.create/upsert` call — parsed CVs
 * are nested objects (personalInfo, skills[], experience[], ...) and the
 * garbage bytes can hide in any of them.
 *
 * Semantics:
 * - Strings are passed through {@link sanitizeForPostgres}.
 * - Plain objects and arrays are walked recursively (new instances are
 *   created; the input is never mutated).
 * - null / undefined / numbers / booleans / Dates / class instances other
 *   than plain object/array are returned as-is (re-used by reference in the
 *   returned structure when their subtree contained no changes).
 */
export function sanitizeObjectDeep<T>(obj: T): T {
  if (obj == null) return obj;
  if (typeof obj === "string") return sanitizeForPostgres(obj) as unknown as T;

  if (Array.isArray(obj)) {
    let changed = false;
    const out = obj.map((item) => {
      const sanitized = sanitizeObjectDeep(item);
      if (sanitized !== item) changed = true;
      return sanitized;
    });
    return (changed ? out : obj) as T;
  }

  if (obj instanceof Date) return obj;

  if (typeof obj === "object") {
    // Plain objects only (not Prisma model instances, class instances, etc.)
    const proto = Object.getPrototypeOf(obj) as object | null;
    if (proto !== Object.prototype && proto !== null) {
      return obj;
    }
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const sanitized = sanitizeObjectDeep(value);
      if (sanitized !== value) changed = true;
      out[key] = sanitized;
    }
    return (changed ? out : obj) as T;
  }

  return obj;
}

// ── Error detection ─────────────────────────────────────────────────────────

/**
 * Detects PostgreSQL error 22021 ("invalid byte sequence for encoding
 * \"UTF8\": 0x00") anywhere in a Prisma error chain. Prisma wraps the driver
 * error (PostgresError) inside a ConnectorError inside a PrismaClient...
 * invocation error, so the code/message must be checked recursively.
 */
export function isPostgresInvalidByteError(error: unknown): boolean {
  let current: unknown = error;
  // Bounded walk of the .cause chain — avoids infinite loops on cyclic causes.
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const err = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (err.code === "22021") return true;
    if (
      typeof err.message === "string" &&
      /invalid byte sequence for encoding/i.test(err.message)
    ) {
      return true;
    }
    current = err.cause;
  }
  return false;
}

/**
 * Heuristic: does this look like a raw database/driver error whose message
 * must NEVER be sent to the client (Prisma invocation dumps, ConnectorError
 * stack traces, SQL details)? Controlled application errors ("Could not save
 * the uploaded file to disk") pass through untouched.
 */
export function looksLikeDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; message?: unknown; clientVersion?: unknown };
  // Prisma known errors carry P-codes (P2002, P2025, ...) and clientVersion.
  if (typeof err.code === "string" && /^P\d{4}$/.test(err.code)) return true;
  if (err.clientVersion !== undefined) return true;
  if (isPostgresInvalidByteError(error)) return true;
  const message = typeof err.message === "string" ? err.message : "";
  return /prisma|connectorError|postgreserror|database|relation "|column "|syntax error at or near/i.test(
    message,
  );
}

// ── Audit logging (server-side only — never exposed to the client) ──────────

/**
 * Structure of the audit log emitted when an AI provider returns garbage
 * bytes. Logged server-side (PM2 logs) so we can monitor WHICH provider in
 * the fallback chain most often produces null bytes.
 */
export interface SanitizationAuditEntry {
  /** Where the dirty data came from, e.g. "groq" / "gemini" / "cerebras" / "glm-ocr". */
  provider: string;
  /** Identifying context, e.g. the CV filename or resume text length. */
  source?: string;
  /** Human path of the offending field, e.g. "experience[2].description". */
  field: string;
  /** The string BEFORE sanitization (raw AI output) for audit. */
  rawValue: string;
  /** Detected offending byte(s), e.g. "0x00". */
  offendingBytes: string[];
}

/**
 * Walks a nested structure and returns audit entries for every string that
 * contains invalid Postgres control characters, WITHOUT modifying anything.
 */
export function findInvalidPostgresStrings(
  obj: unknown,
  path: string = "",
): Array<{ field: string; value: string; offendingBytes: string[] }> {
  const results: Array<{ field: string; value: string; offendingBytes: string[] }> = [];

  const visit = (node: unknown, currentPath: string): void => {
    if (node == null) return;

    if (typeof node === "string") {
      if (HAS_INVALID_CONTROL_CHARS.test(node)) {
        const bytes = new Set<string>();
        for (const ch of node) {
          const code = ch.charCodeAt(0);
          if (code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f)) {
            bytes.add(`0x${code.toString(16).padStart(2, "0").toUpperCase()}`);
          }
        }
        results.push({
          field: currentPath || "<root>",
          value: node,
          offendingBytes: Array.from(bytes),
        });
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${currentPath}[${i}]`));
      return;
    }

    if (typeof node === "object" && !(node instanceof Date)) {
      const proto = Object.getPrototypeOf(node) as object | null;
      if (proto === Object.prototype || proto === null) {
        for (const [key, value] of Object.entries(node)) {
          visit(value, currentPath ? `${currentPath}.${key}` : key);
        }
      }
    }
  };

  visit(obj, path);
  return results;
}

/**
 * Logs (server-side console, captured by PM2) the raw parsed AI output that
 * contained invalid Postgres bytes, so the fallback-chain quality can be
 * audited per provider. MUST NOT be called on data returned to a client.
 *
 * @returns true if dirty data was found and logged.
 */
export function logSanitizationAudit(
  provider: string,
  raw: unknown,
  source?: string,
): boolean {
  const findings = findInvalidPostgresStrings(raw);
  if (!findings.length) return false;

  const entries: SanitizationAuditEntry[] = findings.map((f) => ({
    provider,
    source,
    field: f.field,
    // Cap the logged raw value so a huge CV description doesn't flood PM2 logs.
    rawValue: f.value.slice(0, 500),
    offendingBytes: f.offendingBytes,
  }));

  console.warn(
    `[sanitizer] AI provider "${provider}" returned invalid Postgres bytes ` +
      `(${findings.length} field${findings.length === 1 ? "" : "s"})` +
      `${source ? ` — source: ${source}` : ""}. ` +
      `Stripping before Prisma write. Details:`,
    JSON.stringify(entries),
  );
  return true;
}
