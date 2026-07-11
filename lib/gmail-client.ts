import { google, type gmail_v1 } from "googleapis";
import fs from "fs";

/**
 * Gmail API client via a GCP Service Account + Domain-Wide Delegation.
 *
 * This mirrors the auth pattern already used by `lib/google-calendar.ts`:
 * a JWT client backed by the service-account JSON key, impersonating a fixed
 * Workspace user (job@nuanu.com) via the `subject` field (DWD).
 *
 * STRICTLY READ-ONLY: the only scope requested is `gmail.readonly`. This
 * module must NEVER send, delete, label, archive, or mark-as-read any email.
 * All write-back of "processed" state happens locally in the
 * `ProcessedGmailMessage` table, leaving the Gmail inbox completely untouched.
 *
 * Required environment variables (set in .env.local):
 *  - GMAIL_SA_KEY_PATH        → absolute path to the service account JSON key
 *                               (kept OUTSIDE the repo, e.g.
 *                               ~/.secrets/nuanu-ats/gmail-sa.json)
 *  - GMAIL_IMPERSONATE_EMAIL  → the Workspace user to impersonate
 *                               (e.g. job@nuanu.com). Must have DWD authorized
 *                               for the gmail.readonly scope in Google Admin.
 */

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// Module-level cache. The googleapis JWT client manages its own access-token
// lifecycle (auto-refreshes ~1h tokens), so a single long-lived client is
// both efficient and correct.
let cachedGmailClient: gmail_v1.Gmail | null = null;

/**
 * Whether the Gmail service-account integration is fully configured.
 * Returns true only when BOTH the key-file path and the impersonation email
 * are present AND the key file is readable.
 */
export function isGmailConfigured(): boolean {
  const keyPath = process.env.GMAIL_SA_KEY_PATH;
  const impersonate = process.env.GMAIL_IMPERSONATE_EMAIL;
  if (!keyPath || !impersonate) return false;
  try {
    return fs.existsSync(keyPath);
  } catch {
    return false;
  }
}

/**
 * The Workspace email the service account impersonates.
 */
export function getGmailImpersonateEmail(): string | null {
  return process.env.GMAIL_IMPERSONATE_EMAIL ?? null;
}

/**
 * Build (and cache) an authenticated Gmail client backed by a JWT
 * service-account client with Domain-Wide Delegation.
 *
 * Throws a clear error if the integration is not configured or the key file
 * is unreadable — callers are expected to catch this and degrade gracefully.
 */
export function getGmailClient(): gmail_v1.Gmail {
  if (cachedGmailClient) return cachedGmailClient;

  const keyPath = process.env.GMAIL_SA_KEY_PATH;
  const subject = process.env.GMAIL_IMPERSONATE_EMAIL;

  if (!keyPath || !subject) {
    throw new Error(
      "Gmail service account is not configured. Set GMAIL_SA_KEY_PATH and GMAIL_IMPERSONATE_EMAIL.",
    );
  }

  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Gmail service account key file not found at: ${keyPath}. Set GMAIL_SA_KEY_PATH to the absolute path of the JSON key (stored outside the repo, e.g. ~/.secrets/nuanu-ats/gmail-sa.json).`,
    );
  }

  const jwtClient = new google.auth.JWT({
    keyFile: keyPath,
    scopes: [GMAIL_SCOPE],
    // `subject` enables Domain-Wide Delegation: the service account acts AS
    // this Workspace user for all Gmail operations. READ-ONLY scope only.
    subject,
  });

  cachedGmailClient = google.gmail({ version: "v1", auth: jwtClient });
  return cachedGmailClient;
}

// ── Types ───────────────────────────────────────────────────────────────────

/** A minimal representation of a Gmail message relevant to the importer. */
export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  date: string;
  /**
   * Gmail's authoritative "when this message arrived" timestamp, as epoch
   * milliseconds (string). More reliable than the `Date` header (which
   * reflects the sender's client clock). Used to set the candidate's
   * `appliedAt` field during Gmail import.
   */
  internalDate: string;
  snippet: string;
  /** Attachment metadata (id, filename, mimeType, size). Body NOT included. */
  attachments: GmailAttachmentMeta[];
}

export interface GmailAttachmentMeta {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Decode a base64url-encoded Gmail payload part into a UTF-8 string. */
function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

/** Extract the value of a header (case-insensitive) from a message's headers. */
function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  if (!headers) return "";
  const found = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

/** Extract the bare email address from a "From" header value. */
export function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  // No angle brackets — the whole value may be the address
  const trimmed = fromHeader.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return "";
}

/** Extract the display name from a "From" header value (part before <>). */
export function extractDisplayName(fromHeader: string): string {
  const match = fromHeader.match(/^"?([^"<]+?)"?\s*<[^>]+>/);
  if (match) return match[1].trim();
  return "";
}

/**
 * Recursively walk a message's payload parts and collect attachments
 * (PDF/DOC/DOCX) plus the plain-text body.
 */
function walkParts(
  parts: gmail_v1.Schema$MessagePart[] | undefined,
  attachments: GmailAttachmentMeta[],
): string {
  let bodyText = "";
  if (!parts) return bodyText;
  for (const part of parts) {
    const filename = part.filename || "";
    const mimeType = part.mimeType || "";
    // Attachment: has a filename and a body.attachmentId
    if (filename && part.body?.attachmentId) {
      const ext = filename.toLowerCase();
      if (
        ext.endsWith(".pdf") ||
        ext.endsWith(".doc") ||
        ext.endsWith(".docx")
      ) {
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename,
          mimeType,
          size: part.body.size ?? 0,
        });
      }
    }
    // Inline text body
    if (
      !filename &&
      part.body?.data &&
      (mimeType === "text/plain" || mimeType === "text/html")
    ) {
      if (mimeType === "text/plain" && !bodyText) {
        bodyText = decodeBase64Url(part.body.data);
      } else if (mimeType === "text/html" && !bodyText) {
        // Fallback: strip tags crudely if no plain-text part exists
        bodyText = decodeBase64Url(part.body.data).replace(/<[^>]+>/g, " ");
      }
    }
    // Recurse into nested parts (multipart/*)
    if (part.parts) {
      bodyText = walkParts(part.parts, attachments) || bodyText;
    }
  }
  return bodyText;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * List the most recent inbox messages (metadata only — no attachment bodies).
 *
 * @param maxResults Number of messages to fetch (default 10).
 * @param query      Gmail search query (default "in:inbox"). Pass
 *                   "in:inbox has:attachment" to pre-filter for messages with
 *                   attachments, reducing API calls for the import pipeline.
 * @returns Array of message summaries with headers + attachment metadata.
 */
export async function listInboxMessages(
  maxResults = 10,
  query = "in:inbox",
): Promise<GmailMessageSummary[]> {
  const gmail = getGmailClient();

  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: query,
  });

  const messages = listRes.data.messages ?? [];
  const summaries: GmailMessageSummary[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    // Fetch full message (includes headers + payload structure, but attachment
    // bodies are referenced by attachmentId, not downloaded here).
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });

    const headers = full.data.payload?.headers;
    const fromHeader = getHeader(headers, "From");
    const attachments: GmailAttachmentMeta[] = [];
    const bodyText = walkParts(full.data.payload?.parts, attachments);

    summaries.push({
      id: msg.id,
      threadId: msg.threadId ?? "",
      subject: getHeader(headers, "Subject"),
      from: fromHeader,
      fromEmail: extractEmailAddress(fromHeader),
      date: getHeader(headers, "Date"),
      internalDate: full.data.internalDate ?? "",
      snippet: full.data.snippet ?? bodyText.slice(0, 200),
      attachments,
    });
  }

  return summaries;
}

/**
 * Download a single attachment's binary content by its attachmentId.
 *
 * @param messageId The Gmail message ID the attachment belongs to.
 * @param attachmentId The attachment ID from {@link GmailAttachmentMeta}.
 * @returns The raw attachment bytes as a Buffer.
 */
export async function downloadAttachment(
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  const data = res.data.data ?? "";
  // Gmail returns base64url-encoded data
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}
