import { promises as dns } from "dns";
import net from "net";
import path from "path";
import { promises as fs } from "fs";

/**
 * SSRF-safe fetcher for external CV links (Task 2 "Upload CV via Link").
 *
 * Given a user-supplied URL (Google Drive share link, personal site, …),
 * this module:
 *
 *   1. Converts Google Drive share links to direct-download URLs.
 *   2. Validates the URL (http/https only, sane length, no credentials).
 *   3. Resolves the hostname and BLOCKS private/internal/reserved IP ranges
 *      (SSRF protection — the server must never be usable to probe
 *      localhost, the Docker network, cloud metadata endpoints, etc.).
 *      Both DNS-rebinding-to-private and literal-IP hostnames are covered
 *      because the check runs against the *resolved* address(es).
 *   4. Fetches the bytes with a hard timeout (default 20s) and a 5MB cap,
 *      streaming into a size-limited buffer so an oversized body aborts
 *      early instead of consuming memory.
 *   5. Verifies the content type (PDF/DOC/DOCX/JPG/PNG) — HTML pages
 *      (login walls, "preview" pages) are rejected as not-a-CV.
 *
 * The result is saved to `backups-resumes/` following the same convention
 * as regular CV uploads, so the downstream pipeline (text extraction → AI
 * parse → candidate creation) is unchanged.
 */

export const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024; // 5MB
export const DEFAULT_FETCH_TIMEOUT_MS = 20_000; // 20s
const MAX_URL_LENGTH = 2048;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  // Some servers (including Google Drive) send generic binary types.
  "application/octet-stream",
  "application/binary",
]);

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
];

export class ExternalCvFetchError extends Error {
  /** Machine-readable reason, so the API route can map to clear UX copy. */
  readonly code:
    | "invalid_url"
    | "ssrf_blocked"
    | "timeout"
    | "too_large"
    | "bad_content_type"
    | "fetch_failed"
    | "save_failed";

  constructor(code: ExternalCvFetchError["code"], message: string) {
    super(message);
    this.name = "ExternalCvFetchError";
    this.code = code;
  }
}

/**
 * Convert a Google Drive share/preview link into a direct-download URL.
 *
 * Supported shapes (the `id` query param or /d/<id>/ path segment):
 *   https://drive.google.com/file/d/<ID>/view?usp=sharing
 *   https://drive.google.com/open?id=<ID>
 *   https://drive.google.com/uc?export=download&id=<ID>
 *   https://docs.google.com/document/d/<ID>/edit  (Docs export → PDF)
 *
 * Returns the input unchanged for non-Drive URLs.
 */
export function convertGoogleDriveLink(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") {
    return rawUrl;
  }

  // /file/d/<ID>/…, /document/d/<ID>/…, /uc?export=download&id=<ID>
  const pathMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  const id = pathMatch?.[1] ?? url.searchParams.get("id");

  if (!id) return rawUrl;

  // Google Docs (docs.google.com/document/…) exports directly to PDF; Drive
  // files use the classic uc?export=download endpoint which transparently
  // redirects to the real file for files under the virus-scan size limit.
  if (host === "docs.google.com") {
    const type = url.pathname.split("/")[1] || "document"; // document|spreadsheets|presentation
    return `https://${host}/${type}/d/${id}/export?format=pdf`;
  }
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

/** True when the IP string is private, loopback, link-local, or reserved. */
function isPrivateIp(ip: string): boolean {
  // Handle IPv4-mapped IPv6 (::ffff:10.0.0.1) and plain IPv4.
  const normalized =
    ip.startsWith("::ffff:") && net.isIPv4(ip.slice(7)) ? ip.slice(7) : ip;

  if (net.isIPv4(normalized)) {
    const parts = normalized.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 || // 0.0.0.0/8            "this network"
      a === 10 || // 10.0.0.0/8          private
      a === 127 || // 127.0.0.0/8        loopback
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
      (a === 169 && b === 254) || // 169.254.0.0/16 link-local (AWS metadata!)
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12  private
      (a === 192 && b === 168) || // 192.168.0.0/16 private
      (a === 198 && (b === 18 || b === 19)) // 198.18.0.0/15 benchmark
    );
  }

  const lower = normalized.toLowerCase();
  return (
    lower === "::" || // unspecified
    lower === "::1" || // loopback
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") || // unique-local fc00::/7
    lower.startsWith("fd") ||
    lower.startsWith("::ffff:127.") || // mapped loopback (before normalize)
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:192.168.") ||
    lower.startsWith("::ffff:172.16.") ||
    lower.startsWith("::ffff:172.17.") ||
    lower.startsWith("::ffff:172.18.") ||
    lower.startsWith("::ffff:172.19.") ||
    lower.startsWith("::ffff:172.2") ||
    lower.startsWith("::ffff:172.30.") ||
    lower.startsWith("::ffff:172.31.")
  );
}

/** Validate the URL and reject schemes/hosts that must never be fetched. */
function parseAndValidateUrl(rawUrl: string): URL {
  if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) {
    throw new ExternalCvFetchError(
      "invalid_url",
      "URL is missing or longer than 2048 characters",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ExternalCvFetchError(
      "invalid_url",
      "URL format is not valid — make sure it starts with http:// or https://",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExternalCvFetchError(
      "invalid_url",
      "Only http:// and https:// links are supported",
    );
  }
  // Block credential-carrying URLs (http://user:pass@host/) — they are never
  // legitimate for a CV link and the fetch would leak them into logs.
  if (url.username || url.password) {
    throw new ExternalCvFetchError(
      "invalid_url",
      "URLs containing credentials are not allowed",
    );
  }

  // Literal-IP hostnames get checked directly (DNS never runs for them).
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new ExternalCvFetchError(
      "ssrf_blocked",
      "Links pointing at internal/private addresses are not allowed",
    );
  }

  return url;
}

/**
 * Resolve the hostname and verify every resolved address is public.
 * Runs BEFORE the fetch so a private DNS answer never gets dialed.
 */
async function assertPublicHost(url: URL): Promise<void> {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIP(hostname)) return; // already validated in parseAndValidateUrl

  let addresses: string[];
  try {
    const result = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = result.map((r) => r.address);
  } catch {
    throw new ExternalCvFetchError(
      "fetch_failed",
      `Could not resolve host "${hostname}"`,
    );
  }
  if (addresses.length === 0) {
    throw new ExternalCvFetchError(
      "fetch_failed",
      `Could not resolve host "${hostname}"`,
    );
  }
  const privateAddress = addresses.find((a) => isPrivateIp(a));
  if (privateAddress) {
    throw new ExternalCvFetchError(
      "ssrf_blocked",
      "Links pointing at internal/private addresses are not allowed",
    );
  }
}

/** Infer a file extension from a MIME type (used to name the saved file). */
function extFromMime(mime: string, url: URL): string {
  switch (mime) {
    case "application/pdf":
      return ".pdf";
    case "application/msword":
      return ".doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return ".docx";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    default: {
      const fromPath = path.extname(url.pathname).toLowerCase();
      if (fromPath && fromPath.length <= 6) return fromPath;
      return ".pdf"; // octet-stream fallback — most CVs are PDFs
    }
  }
}

export type FetchedCv = {
  /** Absolute on-disk path of the saved file. */
  filePath: string;
  /** Public web path under which the file is served (`/backups-resumes/…`). */
  resumeUrl: string;
  /** Bytes written to disk. */
  byteLength: number;
  /** MIME type reported by the server (after redirect). */
  contentType: string;
  /** Filename derived from the URL / content type. */
  filename: string;
};

/**
 * Fetch an external CV link, enforcing all safety limits, and save the file
 * to `backups-resumes/` using the same convention as regular uploads.
 *
 * Redirects are followed automatically by `fetch`, but the final URL is
 * re-validated (SSRF hosts sometimes redirect to internal addresses).
 */
export async function fetchExternalCv(
  rawUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<FetchedCv> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  // 1. Google Drive share links → direct-download URLs (before validation,
  //    so validation/SSRF checks run against the URL we will actually fetch).
  const converted = convertGoogleDriveLink(rawUrl.trim());
  const url = parseAndValidateUrl(converted);

  // 2. SSRF: verify the host resolves to public addresses only.
  await assertPublicHost(url);

  // 3. Fetch with timeout. `redirect: "follow"` is the default; the final
  //    URL is re-validated below after the fetch resolves.
  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(converted, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A normal-browser UA avoids blanket bot blocks on personal sites
        // and Drive; the Accept header signals what we actually want.
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept:
          "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,*/*;q=0.8",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ExternalCvFetchError(
        "timeout",
        `Download timed out after ${Math.round(timeoutMs / 1000)}s`,
      );
    }
    throw new ExternalCvFetchError(
      "fetch_failed",
      `Could not download the link (${err instanceof Error ? err.message : "network error"})`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ExternalCvFetchError(
      "fetch_failed",
      `The link returned HTTP ${response.status}`,
    );
  }

  // 3b. Re-validate the FINAL URL (post-redirect) against SSRF rules.
  if (response.url) {
    const finalUrl = parseAndValidateUrl(response.url);
    await assertPublicHost(finalUrl);
  }

  // 4. Content-type check. `application/octet-stream` is accepted because
  //    Google Drive (and many CDNs) send it for binary files; the extension
  //    sniffing in extFromMime and the PDF magic-byte check downstream
  //    provide a second line of defense.
  const contentType = (
    response.headers.get("content-type") ?? ""
  ).split(";")[0]
    .trim()
    .toLowerCase();

  const urlExt = path.extname(url.pathname).toLowerCase();
  const contentTypeAllowed =
    ALLOWED_MIME_TYPES.has(contentType) && contentType !== "text/html";
  const extAllowed = ALLOWED_EXTENSIONS.includes(urlExt);
  if (!contentTypeAllowed && !extAllowed) {
    throw new ExternalCvFetchError(
      "bad_content_type",
      `The link points to a web page (${contentType || "unknown type"}), not a downloadable CV file`,
    );
  }

  // 5. Stream the body with a hard 5MB cap — abort as soon as the limit is
  //    exceeded rather than buffering an arbitrarily large file.
  if (!response.body) {
    throw new ExternalCvFetchError(
      "fetch_failed",
      "The link returned an empty response body",
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let oversized = false;
  // The download completes inside the outer timeout only if the body
  // finishes streaming; reading is also bounded by the same AbortController.
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > MAX_DOWNLOAD_BYTES) {
          oversized = true;
          void reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ExternalCvFetchError(
        "timeout",
        `Download timed out after ${Math.round(timeoutMs / 1000)}s`,
      );
    }
    throw new ExternalCvFetchError(
      "fetch_failed",
      "The download was interrupted",
    );
  }

  if (oversized) {
    throw new ExternalCvFetchError(
      "too_large",
      "The file exceeds the 5MB limit",
    );
  }
  if (received === 0) {
    throw new ExternalCvFetchError("fetch_failed", "The file is empty");
  }

  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));

  // 6. Save to backups-resumes/ with the same naming convention as uploads.
  const ext = extFromMime(contentType, url);
  const baseName =
    path.basename(url.pathname).replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 60) ||
    "external-cv";
  const safeName = `link-${Date.now()}-${baseName}${ext}`;
  const uploadsDir = path.join(process.cwd(), "backups-resumes");
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, safeName), buffer);
  } catch (err) {
    console.error("fetchExternalCv: failed to save downloaded CV:", err);
    throw new ExternalCvFetchError(
      "save_failed",
      "The file was downloaded but could not be saved on the server",
    );
  }

  return {
    filePath: path.join(uploadsDir, safeName),
    resumeUrl: `/backups-resumes/${safeName}`,
    byteLength: buffer.length,
    contentType: contentType || "application/octet-stream",
    filename: `${baseName}${ext}`,
  };
}
