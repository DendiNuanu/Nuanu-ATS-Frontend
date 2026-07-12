/**
 * Backfill script: sets `blacklistedAt` on Application rows that are
 * `isBlacklisted = true` but have a NULL `blacklistedAt` timestamp.
 *
 * Context:
 *   The "Added to Blacklist" Activity Timeline entry shows "—" for candidates
 *   blacklisted before the timestamp-recording code was deployed. This script
 *   fills in the missing timestamp using the best available approximation.
 *
 * Source priority (per candidate):
 *   (a) activity_logs blacklist event — most accurate (none exist for the
 *       affected candidates, so this path is effectively unused here).
 *   (b) applications.updatedAt — used when it is the latest timestamp on the
 *       record (i.e. blacklisting was the last action). Verified per-candidate
 *       against notes/comments/interviews.
 *   (c) applications.appliedAt — last-resort fallback (clearly flagged as
 *       approximate).
 *
 * Safety:
 *   - DRY RUN by default (no writes). Use --apply to actually write.
 *   - Only updates `blacklistedAt` where it is currently NULL — does NOT
 *     overwrite any existing timestamp.
 *   - Touches ONLY the `blacklistedAt` column — no other field is modified.
 *
 * Usage:
 *   npx tsx scripts/backfill-blacklist-timestamps.ts            # dry run (preview)
 *   npx tsx scripts/backfill-blacklist-timestamps.ts --apply     # apply changes
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

type BackfillRow = {
  applicationId: string;
  name: string;
  email: string;
  blacklistedAt: Date | null;
  appliedAt: Date;
  updatedAt: Date;
  latestNote: Date | null;
  latestComment: Date | null;
  latestInterview: Date | null;
};

async function main() {
  const apply = process.argv.includes("--apply");

  console.log("=".repeat(90));
  console.log(
    `Backfill: blacklistedAt for blacklisted candidates  [mode: ${apply ? "APPLY" : "DRY RUN"}]`,
  );
  console.log("=".repeat(90));

  // Find all blacklisted applications with a NULL blacklistedAt.
  // We select the related timestamps needed to choose + validate the source.
  const rows: BackfillRow[] = await prisma.$queryRaw`
    SELECT
      a.id AS "applicationId",
      u.name AS name,
      u.email AS email,
      a."blacklistedAt" AS "blacklistedAt",
      a."appliedAt" AS "appliedAt",
      a."updatedAt" AS "updatedAt",
      (SELECT max(n."createdAt") FROM candidate_notes n WHERE n."applicationId" = a.id) AS "latestNote",
      (SELECT max(c."createdAt") FROM interview_comments c WHERE c."applicationId" = a.id) AS "latestComment",
      (SELECT max(i."updatedAt") FROM interviews i WHERE i."applicationId" = a.id) AS "latestInterview"
    FROM applications a
    JOIN users u ON u.id = a."candidateId"
    WHERE a."isBlacklisted" = true
      AND a."deletedAt" IS NULL
      AND a."blacklistedAt" IS NULL
    ORDER BY a."updatedAt" DESC
  `;

  console.log(
    `\nFound ${rows.length} blacklisted candidate(s) with NULL blacklistedAt.\n`,
  );

  if (rows.length === 0) {
    console.log("Nothing to backfill — every blacklisted candidate already has a timestamp.");
    return;
  }

  // Build the preview: choose source per candidate.
  type Preview = {
    applicationId: string;
    name: string;
    email: string;
    chosenDate: Date;
    source: string;
    approximate: boolean;
  };
  const preview: Preview[] = [];
  const approximateRows: string[] = [];

  for (const r of rows) {
    // (a) activity_logs — check for a blacklist event. (None expected for the
    //     affected candidates, but included for completeness / future use.)
    const logs: Array<{ created_at: Date; action: string }> = await prisma.$queryRaw`
      SELECT "createdAt" AS created_at, action
      FROM activity_logs
      WHERE "resourceId" = ${r.applicationId}
        AND (action ILIKE '%blacklist%' OR resource ILIKE '%blacklist%')
      ORDER BY "createdAt" ASC
      LIMIT 5
    `;

    let chosenDate: Date;
    let source: string;
    let approximate = false;

    if (logs.length > 0) {
      chosenDate = logs[logs.length - 1].created_at;
      source = "(a) activity_logs blacklist event";
    } else {
      // (b) updatedAt — valid proxy when it is the latest timestamp on the
      //     record (no note/comment/interview happened after it). We verify
      //     this per-candidate; if a later activity exists, we still use
      //     updatedAt but flag it as approximate.
      const latestOther = [r.latestNote, r.latestComment, r.latestInterview]
        .filter((d): d is Date => d !== null)
        .reduce<Date | null>((max, d) => (max && d.getTime() > max.getTime() ? d : max), null);

      chosenDate = r.updatedAt;
      if (latestOther && latestOther.getTime() > r.updatedAt.getTime()) {
        // A note/comment/interview happened AFTER updatedAt — updatedAt is NOT
        // a reliable proxy. Fall back to appliedAt (source c) and flag it.
        source = "(c) appliedAt (updatedAt invalidated by later activity — APPROXIMATE)";
        chosenDate = r.appliedAt;
        approximate = true;
        approximateRows.push(`${r.name} <${r.email}>`);
      } else {
        source = "(b) updatedAt (verified latest action on record)";
      }
    }

    preview.push({
      applicationId: r.applicationId,
      name: r.name,
      email: r.email,
      chosenDate,
      source,
      approximate,
    });
  }

  // Print the preview table.
  console.log("Backfill preview (chosen date shown in UTC; UI displays in WITA):");
  console.log("-".repeat(90));
  console.log(
    "Name".padEnd(28) +
      "Email".padEnd(34) +
      "Chosen Date (UTC)".padEnd(27) +
      "Source",
  );
  console.log("-".repeat(90));
  for (const p of preview) {
    console.log(
      p.name.padEnd(28) +
        p.email.padEnd(34) +
        p.chosenDate.toISOString().padEnd(27) +
        p.source,
    );
  }
  console.log("-".repeat(90));
  console.log(`Total candidates to backfill: ${preview.length}`);

  if (approximateRows.length > 0) {
    console.log(
      `\n⚠  ${approximateRows.length} candidate(s) use an APPROXIMATE date (source c):`,
    );
    for (const a of approximateRows) console.log(`   - ${a}`);
  }

  if (!apply) {
    console.log(
      "\nDRY RUN — no changes written. Run with --apply to set these timestamps.",
    );
    console.log("Only the `blacklistedAt` column will be touched; no other field changes.");
    return;
  }

  // Apply: update each candidate's blacklistedAt individually (small set).
  // We use updateMany with a per-id guard so we ONLY touch rows where
  // blacklistedAt IS NULL (defensive — in case another process wrote one
  // between the preview and now).
  let updated = 0;
  for (const p of preview) {
    const result = await prisma.application.updateMany({
      where: {
        id: p.applicationId,
        blacklistedAt: null,
      },
      data: {
        blacklistedAt: p.chosenDate,
      },
    });
    updated += result.count;
    console.log(`  ✓ ${p.name} <${p.email}> → blacklistedAt = ${p.chosenDate.toISOString()}  [${p.source}]`);
  }

  console.log(`\n✓ Updated ${updated} record(s).`);
  console.log("Backfill complete. The 'Added to Blacklist' timeline entry will now show a real date.");
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
