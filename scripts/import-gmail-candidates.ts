/**
 * Gmail → ATS candidate import pipeline.
 *
 * Scans the job@nuanu.com inbox for job-application emails with CV attachments,
 * downloads each CV, parses it with the shared Groq AI pipeline, and creates
 * candidates in the ATS via the same `createCandidateFromUpload` write path
 * used by the manual "Upload CV" feature.
 *
 * Dedup is two-layered:
 *   1. ProcessedGmailMessage table — skips messages already processed in a
 *      previous run (the Gmail inbox is NEVER modified; read-only scope).
 *   2. createCandidateFromUpload — upserts User by email + Application by
 *      [vacancyId, candidateId], so re-applying candidates aren't duplicated.
 *
 * Usage:
 *   npx tsx scripts/import-gmail-candidates.ts                 # dry-run, 50 msgs
 *   npx tsx scripts/import-gmail-candidates.ts --dry-run       # explicit dry-run
 *   npx tsx scripts/import-gmail-candidates.ts --limit 5       # real run, 5 msgs
 *   npx tsx scripts/import-gmail-candidates.ts --limit 20 --dry-run
 *
 * Flags:
 *   --dry-run   Scan + filter + report, but do NOT write to the database
 *               (no candidates created, no ProcessedGmailMessage rows).
 *   --limit N   Process at most N matching emails (default 50).
 *
 * Required env (in .env.local):
 *   GMAIL_SA_KEY_PATH=/home/dendy/.secrets/nuanu-ats/gmail-sa.json
 *   GMAIL_IMPERSONATE_EMAIL=job@nuanu.com
 *   AI_API_URL=...   (Groq endpoint)
 *   AI_API_KEY=...   (Groq API key)
 *   DATABASE_URL=...
 *
 * Exit codes:
 *   0 = completed (with or without errors on individual messages)
 *   1 = not configured (missing env vars / key file)
 *   2 = fatal error (Gmail API failure, DB connection failure)
 */

import fs from "fs";
import path from "path";
import os from "os";

// ── Load .env.local manually (no dotenv dependency) ──────────────────────────
// Mirrors scripts/test-gmail-connection.ts. Next.js loads .env.local
// automatically for the app, but standalone tsx scripts do not.
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

import { prisma } from "@/lib/prisma";
import {
  isGmailConfigured,
  getGmailImpersonateEmail,
  listInboxMessages,
  downloadAttachment,
  type GmailMessageSummary,
} from "@/lib/gmail-client";
import { extractText, parseResumeWithFallback, RateLimitError } from "@/lib/cv-parser";
import {
  createCandidateFromUpload,
  findOrCreateGeneralVacancy,
} from "@/lib/data-access";

// ── CLI flag parsing ─────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { dryRun: boolean; limit: number } {
  let dryRun = false;
  let limit = 50;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--limit") {
      const next = argv[i + 1];
      if (next && /^\d+$/.test(next)) {
        limit = parseInt(next, 10);
        i++;
      }
    } else if (arg.startsWith("--limit=")) {
      const val = arg.slice("--limit=".length);
      if (/^\d+$/.test(val)) limit = parseInt(val, 10);
    }
  }
  return { dryRun, limit };
}

// ── Job-application filter ───────────────────────────────────────────────────
//
// Heuristic to decide whether an inbox email is a genuine job application
// (vs. newsletters, notifications, service emails). Designed to prefer FALSE
// POSITIVES over missing real applications — i.e. when in doubt, include.
//
// INCLUDE signals (any one is sufficient):
//   - Has a PDF/DOC/DOCX attachment (the gmail-client already filters to these)
//   - Subject/body contains application keywords:
//       application, applying, apply, resume, cv, lamaran, melamar,
//       position, vacancy, dear hiring manager, dear hr
//   - Subject matches a "Position - Name" pattern (e.g. "Hotel Manager - John")
//
// EXCLUDE signals (any one causes rejection, checked BEFORE include signals):
//   - Sender domain is a known non-application source:
//       no-reply, noreply, mailer-daemon, getcontact.com, brevo.com,
//       chatgpt, openai.com, linkedin.com (notification/invitation emails)
//   - Subject contains newsletter/notification markers:
//       newsletter, notification, digest, unsubscribe, "you have a new
//       connection", "people you may know"

/** Sender patterns that indicate a non-application email. */
const EXCLUDE_SENDER_PATTERNS: RegExp[] = [
  /no-?reply@/i,
  /mailer-?daemon@/i,
  /@getcontact\.com$/i,
  /@brevo\.com$/i,
  /@chatgpt\./i,
  /@openai\.com$/i,
  /@linkedin\.com$/i,
];

/** Subject patterns that indicate a non-application email. */
const EXCLUDE_SUBJECT_PATTERNS: RegExp[] = [
  /\bnewsletter\b/i,
  /\bnotification\b/i,
  /\bdigest\b/i,
  /\bunsubscribe\b/i,
  /you have a new connection/i,
  /people you may know/i,
  /invited you to connect/i,
];

/** Keywords in subject/body that indicate a job application. */
const APPLICATION_KEYWORDS: RegExp[] = [
  /\bapplication\b/i,
  /\bapplying\b/i,
  /\bapply\b/i,
  /\bresume\b/i,
  /\bcv\b/i,
  /\blamaran\b/i,
  /\bmelamar\b/i,
  /\bposition\b/i,
  /\bvacancy\b/i,
  /dear hiring manager/i,
  /dear hr/i,
];

/** "Position - Name" pattern (e.g. "Hotel Manager - Moch Riduwan"). */
const POSITION_DASH_PATTERN = /^.{3,60}\s*[-–—]\s*.{3,60}$/;

/**
 * Decide whether an email is likely a job application.
 *
 * @param msg  The Gmail message summary (subject, from, attachments, snippet).
 * @returns    An object with `isMatch` and a human-readable `reason`.
 */
function isLikelyJobApplication(
  msg: GmailMessageSummary,
): { isMatch: boolean; reason: string } {
  // ── EXCLUDE checks (checked first — a single hit rejects the email) ──
  const fromEmail = msg.fromEmail || "";
  for (const pattern of EXCLUDE_SENDER_PATTERNS) {
    if (pattern.test(fromEmail)) {
      return { isMatch: false, reason: `excluded sender (${fromEmail})` };
    }
  }

  const subject = msg.subject || "";
  for (const pattern of EXCLUDE_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) {
      return { isMatch: false, reason: `excluded subject ("${subject}")` };
    }
  }

  // ── INCLUDE checks (any one is sufficient) ──
  // 1. Has a CV-like attachment (gmail-client already filters to .pdf/.doc/.docx)
  if (msg.attachments.length > 0) {
    return { isMatch: true, reason: `has ${msg.attachments.length} attachment(s)` };
  }

  // 2. Application keywords in subject or snippet
  const haystack = `${subject}\n${msg.snippet || ""}`;
  for (const pattern of APPLICATION_KEYWORDS) {
    if (pattern.test(haystack)) {
      return { isMatch: true, reason: `keyword match (${pattern.source})` };
    }
  }

  // 3. "Position - Name" pattern in subject
  if (subject && POSITION_DASH_PATTERN.test(subject.trim())) {
    return { isMatch: true, reason: "position-dash-name pattern" };
  }

  return { isMatch: false, reason: "no application signals found" };
}

// ── Position extraction ──────────────────────────────────────────────────────

/**
 * Extract the applied-for position from the email subject.
 *
 * Convention observed in the job@nuanu.com inbox: the subject is often
 * "Position - Candidate Name" (e.g. "Hotel Manager - Moch Riduwan").
 * We take the text before the first dash.
 *
 * Returns null if no clear position can be extracted.
 */
function extractPositionFromSubject(subject: string): string | null {
  const trimmed = subject.trim();
  if (!trimmed) return null;

  // "Position - Name" → take the part before the dash
  const dashMatch = trimmed.match(/^(.{3,60}?)\s*[-–—]\s*.{3,60}$/);
  if (dashMatch) {
    const position = dashMatch[1].trim();
    // Avoid treating "Re:" or "Fwd:" prefixes as positions
    if (!/^(re|fwd|fw)\s*:/i.test(position)) {
      return position;
    }
  }

  // "Application for Position" / "Applying for Position"
  const forMatch = trimmed.match(/(?:application|applying)\s+for\s+(.+)/i);
  if (forMatch) {
    return forMatch[1].trim().slice(0, 100);
  }

  return null;
}

// ── Temp file management ─────────────────────────────────────────────────────

/**
 * Write an attachment buffer to a temp file for text extraction.
 * Returns the file path. Caller must delete the file after use.
 */
async function writeTempAttachment(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), "nuanu-gmail-import");
  await fs.promises.mkdir(tmpDir, { recursive: true });
  // Sanitize filename + add a unique prefix to avoid collisions
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const tmpPath = path.join(tmpDir, `${Date.now()}-${safeName}`);
  await fs.promises.writeFile(tmpPath, buffer);
  return tmpPath;
}

/**
 * Pick the best CV attachment from a list. Prefers filenames containing
 * "cv", "resume", or "curriculum" (case-insensitive). Falls back to the
 * largest file if no filename match is found.
 *
 * This avoids picking a large diploma/transcript PDF over the actual CV
 * when an email has multiple attachments.
 */
function pickBestAttachment(
  attachments: { attachmentId: string; filename: string; mimeType: string; size: number }[],
): { attachmentId: string; filename: string; mimeType: string; size: number } {
  const cvMatch = attachments.find((a) =>
    /\b(cv|resume|curriculum)\b/i.test(a.filename),
  );
  if (cvMatch) return cvMatch;
  // Fall back to the largest attachment
  return attachments.reduce((best, current) =>
    current.size > best.size ? current : best,
  );
}

/**
 * Sleep for the given number of milliseconds.
 * Used to throttle Groq API calls and respect the TPM rate limit.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Resume file storage ──────────────────────────────────────────────────────

/**
 * Save a CV attachment to the local backups-resumes/ directory (same location
 * used by the manual Upload CV feature) and return the public-relative URL
 * path that the ATS stores in CandidateProfile.resumeUrl.
 *
 * The file is stored with a timestamped, sanitized name to avoid collisions.
 */
async function saveResumeFile(
  buffer: Buffer,
  filename: string,
): Promise<{ filePath: string; resumeUrl: string }> {
  const uploadsDir = path.join(process.cwd(), "backups-resumes");
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const filePath = path.join(uploadsDir, safeName);
  await fs.promises.writeFile(filePath, buffer);
  return { filePath, resumeUrl: `/backups-resumes/${safeName}` };
}

// ── Main pipeline ────────────────────────────────────────────────────────────

interface ImportStats {
  scanned: number;
  alreadyProcessed: number;
  filteredOut: number;
  noAttachment: number;
  parseFailed: number;
  imported: number;
  duplicates: number;
  failed: number;
  rateLimited: number;
}

async function main(): Promise<void> {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));

  console.log("=== Gmail → ATS Candidate Import ===\n");
  console.log(`Mode:  ${dryRun ? "DRY RUN (no DB writes)" : "LIVE (will create candidates)"}`);
  console.log(`Limit: ${limit} matching emails\n`);

  // ── Pre-flight checks ──
  if (!isGmailConfigured()) {
    console.error(
      "FAIL: Gmail integration is not configured.\n" +
        "Set GMAIL_SA_KEY_PATH and GMAIL_IMPERSONATE_EMAIL in .env.local.",
    );
    process.exit(1);
  }

  const impersonate = getGmailImpersonateEmail();
  console.log(`Impersonating: ${impersonate}`);
  console.log(`Scope:         gmail.readonly (READ-ONLY — inbox is never modified)\n`);

  // ── Fetch inbox messages ──
  // Use "has:attachment" to pre-filter at the Gmail API level — this cuts
  // down API calls significantly since most non-application emails (newsletters,
  // notifications) don't have attachments. We still run the full filter on
  // the results because some attachments may not be CVs.
  console.log(`Fetching up to ${limit} inbox messages with attachments...`);
  let messages: GmailMessageSummary[];
  try {
    messages = await listInboxMessages(limit, "in:inbox has:attachment");
  } catch (err) {
    console.error("\nFATAL: Failed to list inbox messages:", err);
    process.exit(2);
  }
  console.log(`Retrieved ${messages.length} message(s).\n`);

  const stats: ImportStats = {
    scanned: 0,
    alreadyProcessed: 0,
    filteredOut: 0,
    noAttachment: 0,
    parseFailed: 0,
    imported: 0,
    duplicates: 0,
    failed: 0,
    rateLimited: 0,
  };

  // ── Resolve the general vacancy once (for custom positions) ──
  // In dry-run we skip this (no DB writes). In live mode, resolve lazily
  // only when the first matching email needs it.
  let generalVacancyId: string | null = null;
  let dailyLimitHit = false;

  for (const msg of messages) {
    if (dailyLimitHit) break;
    stats.scanned++;
    const subject = msg.subject || "(no subject)";
    const from = msg.from || "(unknown)";
    console.log(`\n[${stats.scanned}/${messages.length}] ${subject}`);
    console.log(`  From: ${from}`);
    console.log(`  Date: ${msg.date || "(unknown)"}`);
    console.log(`  Attachments: ${msg.attachments.length}`);

    // ── Check if already processed (dedup layer 1) ──
    if (!dryRun) {
      const existing = await prisma.processedGmailMessage.findUnique({
        where: { gmailMessageId: msg.id },
      });
      if (existing) {
        stats.alreadyProcessed++;
        console.log(`  → SKIP: already processed on ${existing.processedAt.toISOString()} (status: ${existing.status})`);
        continue;
      }
    }

    // ── Apply the job-application filter ──
    const filterResult = isLikelyJobApplication(msg);
    if (!filterResult.isMatch) {
      stats.filteredOut++;
      console.log(`  → FILTERED OUT: ${filterResult.reason}`);
      // Record the skip so we don't re-evaluate it on every run
      if (!dryRun) {
        await prisma.processedGmailMessage.create({
          data: {
            gmailMessageId: msg.id,
            gmailThreadId: msg.threadId,
            subject: msg.subject || null,
            fromEmail: msg.fromEmail || null,
            status: "skipped",
            errorMessage: filterResult.reason,
          },
        });
      }
      continue;
    }
    console.log(`  → MATCH: ${filterResult.reason}`);

    // ── Pick the best attachment (largest PDF/DOC/DOCX) ──
    if (msg.attachments.length === 0) {
      stats.noAttachment++;
      console.log(`  → SKIP: no CV attachment (matched on keywords only)`);
      if (!dryRun) {
        await prisma.processedGmailMessage.create({
          data: {
            gmailMessageId: msg.id,
            gmailThreadId: msg.threadId,
            subject: msg.subject || null,
            fromEmail: msg.fromEmail || null,
            status: "skipped",
            errorMessage: "matched filter but no attachment",
          },
        });
      }
      continue;
    }

    // Pick the best CV attachment: prefer filenames containing "cv"/"resume"
    // over a large diploma/transcript PDF. Falls back to the largest file.
    const bestAttachment = pickBestAttachment(msg.attachments);
    console.log(`  Downloading: ${bestAttachment.filename} (${bestAttachment.size} bytes)`);

    // ── Download the attachment ──
    let attachmentBuffer: Buffer;
    try {
      attachmentBuffer = await downloadAttachment(msg.id, bestAttachment.attachmentId);
    } catch (err) {
      stats.failed++;
      console.error(`  → FAILED: could not download attachment:`, err);
      if (!dryRun) {
        await prisma.processedGmailMessage.create({
          data: {
            gmailMessageId: msg.id,
            gmailThreadId: msg.threadId,
            subject: msg.subject || null,
            fromEmail: msg.fromEmail || null,
            status: "failed",
            errorMessage: `Attachment download failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        });
      }
      continue;
    }

    // ── Extract text + parse with AI ──
    // Write to a temp file for the extraction libraries (unpdf/mammoth read
    // from disk). Delete after parsing regardless of success/failure.
    let tmpPath: string | null = null;
    let parsed = null;
    let resumeText = "";
    try {
      tmpPath = await writeTempAttachment(attachmentBuffer, bestAttachment.filename);
      const ext = path.extname(bestAttachment.filename).toLowerCase();
      resumeText = await extractText(tmpPath, ext);

      if (!resumeText || resumeText.trim().length < 20) {
        console.error(`  → SKIP: could not extract enough text from ${bestAttachment.filename}`);
        stats.parseFailed++;
        if (!dryRun) {
          await prisma.processedGmailMessage.create({
            data: {
              gmailMessageId: msg.id,
              gmailThreadId: msg.threadId,
              subject: msg.subject || null,
              fromEmail: msg.fromEmail || null,
              status: "skipped",
              errorMessage: "text extraction yielded too little content",
            },
          });
        }
        continue;
      }

      console.log(`  Extracted ${resumeText.length} chars. Parsing with AI (Groq → Gemini fallback)...`);
      // Retry with backoff for rate-limit (429) errors. The fallback function
      // tries Groq first, then Gemini. If BOTH providers return 429 (rare,
      // but possible if both free-tier quotas are exhausted), we wait and
      // retry up to 3 times with increasing delays.
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          parsed = await parseResumeWithFallback(resumeText);
          if (parsed) break;
          // null = both providers returned a response but couldn't parse it
          // (missing name, JSON error, etc.) — NOT transient, don't retry.
          break;
        } catch (err) {
          if (err instanceof RateLimitError) {
            if (err.isDaily) {
              // Both providers' daily quotas exhausted — no point retrying.
              // Stop the entire import; remaining messages will be retried
              // on the next run (NOT recorded in dedup table).
              console.log(`  → DAILY RATE LIMIT HIT (both Groq & Gemini). Stopping import.`);
              console.log(`     Remaining ${messages.length - stats.scanned} message(s) will be retried on the next run.`);
              stats.rateLimited++;
              dailyLimitHit = true;
              break;
            }
            // Per-minute limit on both providers — retry with backoff
            if (attempt < MAX_RETRIES) {
              const delayMs = attempt * 20000; // 20s, 40s
              console.log(`  Parse attempt ${attempt}/${MAX_RETRIES} rate-limited (both providers). Waiting ${delayMs / 1000}s before retry...`);
              await sleep(delayMs);
            }
          } else {
            // Unexpected error — rethrow to outer catch
            throw err;
          }
        }
      }
    } catch (err) {
      stats.failed++;
      console.error(`  → FAILED: extraction/parse error:`, err);
      if (!dryRun) {
        await prisma.processedGmailMessage.create({
          data: {
            gmailMessageId: msg.id,
            gmailThreadId: msg.threadId,
            subject: msg.subject || null,
            fromEmail: msg.fromEmail || null,
            status: "failed",
            errorMessage: `Extraction/parse error: ${err instanceof Error ? err.message : String(err)}`,
          },
        });
      }
      continue;
    } finally {
      if (tmpPath) {
        try {
          await fs.promises.unlink(tmpPath);
        } catch {
          // Non-fatal — temp file cleanup is best-effort
        }
      }
    }

    if (!parsed) {
      stats.parseFailed++;
      if (dailyLimitHit) {
        // Daily rate limit hit — do NOT record in dedup table so this
        // message can be retried on the next run (after quota resets).
        console.error(`  → SKIP: daily rate limit hit (will retry next run)`);
      } else {
        console.error(`  → SKIP: AI failed to parse the resume`);
        if (!dryRun) {
          await prisma.processedGmailMessage.create({
            data: {
              gmailMessageId: msg.id,
              gmailThreadId: msg.threadId,
              subject: msg.subject || null,
              fromEmail: msg.fromEmail || null,
              status: "skipped",
              errorMessage: "AI parse returned null",
            },
          });
        }
      }
      continue;
    }

    console.log(`  Parsed: ${parsed.name} <${parsed.email || "(no email)"}>`);

    // ── Dry-run stops here ──
    if (dryRun) {
      console.log(`  → DRY RUN: would import as "${parsed.name}" <${parsed.email}>`);
      const position = extractPositionFromSubject(msg.subject || "");
      if (position) console.log(`     Applied for: ${position}`);
      // Count as "would import" — we don't know if it's a dup without DB,
      // but we can check if a User with this email exists.
      if (parsed.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: parsed.email },
        });
        if (existingUser) {
          console.log(`     NOTE: User with this email already exists (would be a duplicate)`);
        }
      }
      continue;
    }

    // ── Live mode: save the resume file + create the candidate ──
    try {
      // Save the CV to backups-resumes/ (same as manual upload)
      const { filePath, resumeUrl } = await saveResumeFile(
        attachmentBuffer,
        bestAttachment.filename,
      );

      // Extract the position from the subject (e.g. "Hotel Manager - Name")
      const position = extractPositionFromSubject(msg.subject || "");

      // Resolve vacancy: all Gmail imports go to the general vacancy with
      // the extracted position stored in `appliedFor`. This matches the
      // manual upload "custom position" flow.
      if (!generalVacancyId) {
        generalVacancyId = await findOrCreateGeneralVacancy();
      }

      // Check if this candidate already exists (for accurate dup reporting)
      const existingUser = parsed.email
        ? await prisma.user.findUnique({ where: { email: parsed.email } })
        : null;
      const isDuplicate = !!existingUser;

      // Create/update the candidate via the shared write path
      const result = await createCandidateFromUpload(
        parsed,
        generalVacancyId,
        resumeUrl,
        resumeText,
        position,
        "Email Job Nuanu", // existing Source value (see lib/mock-data.ts)
      );

      if (isDuplicate) {
        stats.duplicates++;
        console.log(`  → DUPLICATE: updated existing candidate ${result.candidateName} (app: ${result.applicationId})`);
      } else {
        stats.imported++;
        console.log(`  → IMPORTED: ${result.candidateName} <${result.candidateEmail}> (app: ${result.applicationId})`);
      }
      if (position) console.log(`     Applied for: ${position}`);

      // Record the processed message (dedup layer 1)
      await prisma.processedGmailMessage.create({
        data: {
          gmailMessageId: msg.id,
          gmailThreadId: msg.threadId,
          subject: msg.subject || null,
          fromEmail: msg.fromEmail || null,
          status: isDuplicate ? "duplicate" : "imported",
          resultingApplicationId: result.applicationId,
          candidateEmail: result.candidateEmail,
          appliedPosition: position,
        },
      });

      // Clean up the temp resume file is not needed — it's now in backups-resumes/
      void filePath;
    } catch (err) {
      stats.failed++;
      console.error(`  → FAILED: could not create candidate:`, err);
      if (!dryRun) {
        await prisma.processedGmailMessage.create({
          data: {
            gmailMessageId: msg.id,
            gmailThreadId: msg.threadId,
            subject: msg.subject || null,
            fromEmail: msg.fromEmail || null,
            status: "failed",
            errorMessage: `Candidate creation failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        });
      }
    }
  }

  // ── Summary ──
  console.log("\n" + "=".repeat(60));
  console.log("IMPORT SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Emails scanned:          ${stats.scanned}`);
  console.log(`  Already processed:       ${stats.alreadyProcessed}`);
  console.log(`  Filtered out:            ${stats.filteredOut}`);
  console.log(`  No attachment:           ${stats.noAttachment}`);
  console.log(`  Parse failures:          ${stats.parseFailed}`);
  if (stats.rateLimited > 0) {
    console.log(`  Rate-limited (deferred): ${stats.rateLimited}`);
  }
  if (dryRun) {
    console.log(`  Would import (new):      ${stats.imported}`);
    console.log(`  Would import (duplicate):${stats.duplicates}`);
  } else {
    console.log(`  New candidates imported: ${stats.imported}`);
    console.log(`  Duplicates updated:      ${stats.duplicates}`);
  }
  console.log(`  Errors:                  ${stats.failed}`);
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("\nThis was a DRY RUN. No changes were made to the database.");
    console.log("To perform a real import, re-run without --dry-run:");
    console.log("  npx tsx scripts/import-gmail-candidates.ts --limit 5");
  } else {
    console.log(`\nDone. ${stats.imported} new candidate(s) imported, ${stats.duplicates} duplicate(s) updated.`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Unexpected fatal error:", err);
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(2);
});
