/**
 * READ-ONLY investigation script for the "Added to Blacklist" timeline bug.
 *
 * Purpose:
 *   1. Confirm whether the `blacklistedAt` column physically exists on the
 *      `applications` table (the Prisma schema declares it, but there is no
 *      migration for it — it may have been added via `prisma db push`).
 *   2. Find ALL currently-blacklisted candidates whose `blacklistedAt` is
 *      null/missing (the records that show "—" on the Activity Timeline).
 *   3. For each such candidate, gather every timestamp that could serve as a
 *      backfill source, in priority order:
 *        (a) ActivityLog rows whose action/resource indicates a blacklist
 *            event — most accurate.
 *        (b) Application.updatedAt — usable if blacklisting was likely the
 *            last action on the record.
 *        (c) Application.appliedAt — last-resort fallback.
 *   4. Print a preview table: candidate name, chosen date, source label.
 *
 * This script performs NO writes. It only SELECTs.
 *
 * Usage:
 *   npx tsx scripts/investigate-blacklist-timestamps.ts
 */
import * as fs from "fs";
import * as path from "path";

// ── Load .env.local manually (no dotenv dependency) ──────────────────────────
// Mirrors scripts/import-gmail-candidates.ts. Next.js loads .env.local
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

import { prisma } from "../lib/prisma";

async function main() {
  console.log("=".repeat(90));
  console.log("READ-ONLY investigation: blacklist timestamps");
  console.log("=".repeat(90));

  // ── 1. Confirm the column physically exists ──────────────────────────────
  // Query information_schema directly so we don't rely on the Prisma client
  // (which would throw if the column were missing).
  const columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }> = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'applications'
      AND column_name IN ('isBlacklisted', 'blacklistReason', 'blacklistedAt')
    ORDER BY column_name;
  `;

  console.log("\n[1] Blacklist-related columns on `applications` table:");
  console.log("-".repeat(90));
  if (columns.length === 0) {
    console.log("  (none found — columns may use snake_case mapping)");
  }
  for (const c of columns) {
    console.log(
      `  ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable}`,
    );
  }

  // Also check snake_case variants in case the DB uses @map naming.
  const snakeColumns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }> = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'applications'
      AND column_name IN ('is_blacklisted', 'blacklist_reason', 'blacklisted_at')
    ORDER BY column_name;
  `;
  if (snakeColumns.length > 0) {
    console.log("  (snake_case variants found:)");
    for (const c of snakeColumns) {
      console.log(
        `  ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable}`,
      );
    }
  }

  const hasBlacklistedAt =
    columns.some((c) => c.column_name === "blacklistedAt") ||
    snakeColumns.some((c) => c.column_name === "blacklisted_at");
  console.log(
    `\n  => blacklistedAt column EXISTS in DB: ${hasBlacklistedAt ? "YES" : "NO"}`,
  );

  // ── 2. Find all blacklisted candidates ────────────────────────────────────
  // Use a raw query that tolerates either camelCase or snake_case column names
  // so the script works regardless of the physical schema. We select the
  // blacklist flag, reason, timestamp, plus the candidate's name/email and the
  // candidate's appliedAt / updatedAt for fallback analysis.
  const blacklistedAtCol = hasBlacklistedAt
    ? columns.some((c) => c.column_name === "blacklistedAt")
      ? '"blacklistedAt"'
      : "blacklisted_at"
    : "NULL";

  const rows: Array<{
    application_id: string;
    candidate_id: string;
    name: string;
    email: string;
    is_blacklisted: boolean;
    blacklist_reason: string | null;
    blacklisted_at: Date | null;
    applied_at: Date;
    updated_at: Date;
    current_stage: string;
    vacancy_title: string | null;
  }> = await prisma.$queryRawUnsafe(`
    SELECT
      a.id AS application_id,
      a."candidateId" AS candidate_id,
      u.name AS name,
      u.email AS email,
      COALESCE(a."isBlacklisted", false) AS is_blacklisted,
      a."blacklistReason" AS blacklist_reason,
      ${blacklistedAtCol} AS blacklisted_at,
      a."appliedAt" AS applied_at,
      a."updatedAt" AS updated_at,
      a."currentStage" AS current_stage,
      v.title AS vacancy_title
    FROM applications a
    JOIN users u ON u.id = a."candidateId"
    LEFT JOIN vacancies v ON v.id = a."vacancyId"
    WHERE COALESCE(a."isBlacklisted", false) = true
      AND a."deletedAt" IS NULL
    ORDER BY a."updatedAt" DESC
  `);

  console.log(
    `\n[2] Total blacklisted candidates in DB: ${rows.length}`,
  );

  const missingTimestamp = rows.filter((r) => !r.blacklisted_at);
  console.log(
    `    Blacklisted candidates with NULL/missing blacklistedAt: ${missingTimestamp.length}`,
  );

  if (missingTimestamp.length === 0) {
    console.log("\nNothing to backfill — every blacklisted candidate already has a timestamp.");
    return;
  }

  // ── 3. For each missing-timestamp candidate, gather backfill sources ─────
  console.log("\n[3] Backfill source analysis per candidate:");
  console.log("-".repeat(90));

  // Check whether an ActivityLog table exists and has blacklist-related rows.
  // The schema defines ActivityLog with action/resource/metadata/createdAt.
  // We look for any log row whose action or resource mentions "blacklist"
  // (case-insensitive) and whose resourceId matches the application id.
  let activityLogExists = false;
  try {
    const tableCheck: Array<{ exists: boolean }> = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'activity_logs'
      ) AS exists;
    `;
    activityLogExists = tableCheck[0]?.exists ?? false;
  } catch {
    activityLogExists = false;
  }
  console.log(`\n  activity_logs table exists: ${activityLogExists}`);

  // Also check pipeline_stages for a "blacklisted" stage entry (some apps log
  // blacklist as a stage transition). This is a secondary source.
  const preview: Array<{
    name: string;
    email: string;
    applicationId: string;
    chosenDate: string;
    source: string;
    details: string;
  }> = [];

  for (const r of missingTimestamp) {
    console.log(
      `\n  Candidate: ${r.name} <${r.email}>  (app ${r.application_id})`,
    );
    console.log(`    currentStage = ${r.current_stage}`);
    console.log(`    appliedAt    = ${r.applied_at.toISOString()}`);
    console.log(`    updatedAt    = ${r.updated_at.toISOString()}`);
    console.log(`    blacklistReason = ${r.blacklist_reason ?? "(null)"}`);

    let chosenDate: Date | null = null;
    let source = "";
    let details = "";

    // (a) ActivityLog blacklist event
    if (activityLogExists) {
      const logs: Array<{
        id: string;
        action: string;
        resource: string;
        created_at: Date;
      }> = await prisma.$queryRaw`
        SELECT id, action, resource, "createdAt" AS created_at
        FROM activity_logs
        WHERE "resourceId" = ${r.application_id}
          AND (action ILIKE '%blacklist%' OR resource ILIKE '%blacklist%')
        ORDER BY "createdAt" ASC
        LIMIT 5;
      `;
      if (logs.length > 0) {
        chosenDate = logs[logs.length - 1].created_at; // last blacklist event
        source = "(a) activity_logs blacklist event";
        details = `matched ${logs.length} log row(s); using last at ${chosenDate.toISOString()}`;
        console.log(`    [source a] FOUND ${logs.length} activity_log blacklist row(s)`);
        for (const l of logs) {
          console.log(`      - ${l.created_at.toISOString()}  action=${l.action} resource=${l.resource}`);
        }
      } else {
        console.log(`    [source a] no activity_log blacklist rows`);
      }
    }

    // (b) updatedAt — only if no activity log found. We treat updatedAt as a
    //     reasonable proxy when blacklisting was the last action. We can't be
    //     100% certain, so we flag it as "approximate".
    if (!chosenDate) {
      // Heuristic: if updatedAt is within a plausible window after appliedAt
      // (i.e. the record was touched after application), use updatedAt.
      // We always prefer updatedAt over appliedAt because blacklisting is an
      // active action that bumps updatedAt.
      chosenDate = r.updated_at;
      source = "(b) applications.updatedAt (approximate)";
      details = `updatedAt=${r.updated_at.toISOString()}`;
      console.log(`    [source b] using updatedAt = ${r.updated_at.toISOString()}`);
    }

    // (c) appliedAt — last resort, only if updatedAt is somehow missing too.
    if (!chosenDate) {
      chosenDate = r.applied_at;
      source = "(c) applications.appliedAt (last-resort fallback — APPROXIMATE)";
      details = `appliedAt=${r.applied_at.toISOString()}`;
      console.log(`    [source c] FALLBACK to appliedAt = ${r.applied_at.toISOString()}`);
    }

    preview.push({
      name: r.name,
      email: r.email,
      applicationId: r.application_id,
      chosenDate: chosenDate.toISOString(),
      source,
      details,
    });
  }

  // ── 4. Summary preview table ─────────────────────────────────────────────
  console.log("\n" + "=".repeat(90));
  console.log("BACKFILL PREVIEW (DRY — nothing written)");
  console.log("=".repeat(90));
  console.log(
    "Name".padEnd(28) +
      "Email".padEnd(34) +
      "Chosen Date (UTC)".padEnd(26) +
      "Source",
  );
  console.log("-".repeat(90));
  for (const p of preview) {
    console.log(
      p.name.padEnd(28) +
        p.email.padEnd(34) +
        p.chosenDate.padEnd(26) +
        p.source,
    );
  }
  console.log("-".repeat(90));
  console.log(`Total candidates to backfill: ${preview.length}`);

  const approxCount = preview.filter((p) =>
    p.source.includes("approximate") || p.source.includes("APPROXIMATE"),
  ).length;
  if (approxCount > 0) {
    console.log(
      `\n⚠  ${approxCount} candidate(s) use an APPROXIMATE date (source b/c).`,
    );
    console.log("   These dates are best-effort and may not be the exact blacklist moment.");
  }
}

main()
  .catch((error) => {
    console.error("Investigation failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
