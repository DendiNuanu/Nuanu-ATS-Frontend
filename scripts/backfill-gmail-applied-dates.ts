/**
 * Backfill script: corrects the `appliedAt` field on Gmail-imported
 * candidates to use the actual email-received date (Gmail internalDate)
 * instead of the import script's runtime timestamp.
 *
 * Usage:
 *   npx tsx scripts/backfill-gmail-applied-dates.ts              # PREVIEW (read-only)
 *   npx tsx scripts/backfill-gmail-applied-dates.ts --apply       # APPLY (writes to DB)
 *
 * The script:
 *   1. Queries the `processed_gmail_messages` table for all records
 *      with status "imported" or "duplicate" that have a
 *      `resultingApplicationId`.
 *   2. For each, fetches the Gmail message's `internalDate` via the
 *      Gmail API (the authoritative "when this message arrived" timestamp).
 *   3. Compares the current `Application.appliedAt` with the correct date.
 *   4. PREVIEW mode: prints old date → new date for each record.
 *      APPLY mode: updates only the `appliedAt` field on each Application
 *      (no other fields are touched).
 */

import fs from "fs";
import path from "path";
import { google, type gmail_v1 } from "googleapis";
import { prisma } from "@/lib/prisma";

// ── Minimal .env.local loader ────────────────────────────────────────────────
function loadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env.local might not exist
  }
}

// ── Gmail client (mirrors lib/gmail-client.ts exactly) ───────────────────────
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

function getGmailClient(): gmail_v1.Gmail {
  const keyPath = process.env.GMAIL_SA_KEY_PATH;
  const subject = process.env.GMAIL_IMPERSONATE_EMAIL;

  if (!keyPath || !subject) {
    throw new Error(
      "GMAIL_SA_KEY_PATH and GMAIL_IMPERSONATE_EMAIL must be set in .env.local",
    );
  }

  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Gmail service account key file not found at: ${keyPath}`,
    );
  }

  // Same pattern as lib/gmail-client.ts: google.auth.JWT accepts keyFile
  // directly (it reads/parses the JSON internally), and the resulting client
  // type is fully compatible with google.gmail({ auth }).
  const jwtClient = new google.auth.JWT({
    keyFile: keyPath,
    scopes: [GMAIL_SCOPE],
    subject,
  });

  return google.gmail({ version: "v1", auth: jwtClient });
}

async function getMessageInternalDate(
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<string | null> {
  try {
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "minimal", // we only need internalDate, not the full payload
    });
    return res.data.internalDate ?? null;
  } catch (err) {
    console.error(`  Failed to fetch Gmail message ${messageId}:`, err);
    return null;
  }
}

async function main() {
  await loadEnvLocal();

  const applyMode = process.argv.includes("--apply");
  console.log("=== Backfill Gmail Applied Dates ===\n");
  console.log(`Mode: ${applyMode ? "APPLY (will update DB)" : "PREVIEW (read-only)"}\n`);

  // 1. Get all processed Gmail messages that resulted in an application
  const processedMessages = await prisma.processedGmailMessage.findMany({
    where: {
      resultingApplicationId: { not: null },
      status: { in: ["imported", "duplicate"] },
    },
    orderBy: { processedAt: "asc" },
  });

  console.log(`Found ${processedMessages.length} processed Gmail message(s) with applications.\n`);

  if (processedMessages.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  // 2. Get the Gmail client
  const gmail = getGmailClient();

  // 3. For each, fetch the internalDate and compare with current appliedAt
  const updates: Array<{
    applicationId: string;
    candidateEmail: string | null;
    subject: string | null;
    oldDate: Date;
    newDate: Date;
    gmailMessageId: string;
  }> = [];

  for (const pm of processedMessages) {
    if (!pm.resultingApplicationId) continue;

    // Fetch the current application
    const app = await prisma.application.findUnique({
      where: { id: pm.resultingApplicationId },
      select: { id: true, appliedAt: true, candidateId: true },
    });

    if (!app) {
      console.log(`  SKIP: Application ${pm.resultingApplicationId} not found (may have been deleted)`);
      continue;
    }

    // Get candidate email for display
    const candidate = await prisma.user.findUnique({
      where: { id: app.candidateId },
      select: { email: true, name: true },
    });

    // Fetch the Gmail internalDate
    const internalDateStr = await getMessageInternalDate(gmail, pm.gmailMessageId);
    if (!internalDateStr) {
      console.log(`  SKIP: Could not fetch internalDate for ${pm.gmailMessageId} (${pm.subject})`);
      continue;
    }

    const newDate = new Date(Number(internalDateStr));
    const oldDate = app.appliedAt;

    const needsUpdate = Math.abs(oldDate.getTime() - newDate.getTime()) > 1000;

    console.log(`  ${candidate?.name ?? candidate?.email ?? pm.resultingApplicationId}`);
    console.log(`    Subject:    ${pm.subject}`);
    console.log(`    Email:      ${candidate?.email ?? "(unknown)"}`);
    console.log(`    Old date:   ${oldDate.toISOString()}`);
    console.log(`    New date:   ${newDate.toISOString()} (Gmail internalDate)`);
    console.log(`    Status:     ${needsUpdate ? "⚠️  NEEDS UPDATE" : "✓ already correct"}`);
    console.log("");

    if (needsUpdate) {
      updates.push({
        applicationId: app.id,
        candidateEmail: candidate?.email ?? null,
        subject: pm.subject,
        oldDate,
        newDate,
        gmailMessageId: pm.gmailMessageId,
      });
    }
  }

  // 4. Summary
  console.log("=== Summary ===");
  console.log(`  Total processed:  ${processedMessages.length}`);
  console.log(`  Needs update:     ${updates.length}`);
  console.log(`  Already correct:  ${processedMessages.length - updates.length}`);

  if (updates.length === 0) {
    console.log("\nAll dates are already correct. Nothing to do.");
    return;
  }

  if (!applyMode) {
    console.log("\nThis was a PREVIEW. To apply the updates, re-run with --apply:");
    console.log("  npx tsx scripts/backfill-gmail-applied-dates.ts --apply");
    return;
  }

  // 5. Apply updates (only appliedAt, no other fields)
  console.log(`\nApplying ${updates.length} update(s)...\n`);
  for (const u of updates) {
    await prisma.application.update({
      where: { id: u.applicationId },
      data: { appliedAt: u.newDate },
    });
    console.log(`  ✓ Updated ${u.candidateEmail ?? u.applicationId}: ${u.oldDate.toISOString()} → ${u.newDate.toISOString()}`);
  }

  console.log(`\nDone. ${updates.length} application(s) updated.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
