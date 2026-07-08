/**
 * Backfill script: Sets `rejectionType` on existing Application records where
 * `currentStage = "rejected"` but `rejectionType` is NULL.
 *
 * All existing rejected candidates are assigned `rejectionType = "declined_by_hr"`
 * (the default sub-type, which uses the existing "Rejected" email template).
 * This does NOT reclassify or lose any data — it only fills in the new sub-type
 * field with the safe default.
 *
 * Safety features:
 *   - DRY RUN by default (no writes). Use --apply to actually write.
 *   - Only updates records where rejectionType IS NULL (does NOT overwrite
 *     manually-set values).
 *   - Prints a detailed report of what WOULD be / WAS changed.
 *
 * Prerequisites:
 *   1. The `rejectionType` column must exist in the database. Run
 *      `npx prisma db push` first to apply the schema change (adds the
 *      nullable `rejectionType` column to the `applications` table).
 *   2. Then run this script to backfill existing rejected candidates.
 *
 * Usage:
 *   node scripts/backfill-rejection-type.js            # dry run (preview)
 *   node scripts/backfill-rejection-type.js --apply     # apply changes
 */
import { prisma } from "../lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");

  console.log("=".repeat(80));
  console.log(
    `Backfill: rejectionType for rejected candidates  [mode: ${apply ? "APPLY" : "DRY RUN"}]`,
  );
  console.log("=".repeat(80));

  // Find all rejected applications with a NULL rejectionType.
  const rejectedApps = await prisma.application.findMany({
    where: {
      currentStage: "rejected",
      rejectionType: null,
    },
    select: {
      id: true,
      currentStage: true,
      rejectionType: true,
      candidate: { select: { name: true, email: true } },
    },
  });

  console.log(`\nFound ${rejectedApps.length} rejected candidate(s) with NULL rejectionType.\n`);

  if (rejectedApps.length === 0) {
    console.log("Nothing to backfill — all rejected candidates already have a rejectionType.");
    return;
  }

  // Print a preview of what will change.
  console.log("Candidates to update (all → declined_by_hr):");
  console.log("-".repeat(80));
  for (const app of rejectedApps) {
    console.log(
      `  ${app.id}  ${app.candidate.name}  <${app.candidate.email}>  ` +
        `[stage=${app.currentStage}, rejectionType=${app.rejectionType ?? "NULL"}]`,
    );
  }
  console.log("-".repeat(80));
  console.log(`Total: ${rejectedApps.length} record(s).\n`);

  if (!apply) {
    console.log("DRY RUN — no changes written. Run with --apply to update these records.");
    return;
  }

  // Apply: batch-update all rejected candidates to declined_by_hr.
  const result = await prisma.application.updateMany({
    where: {
      currentStage: "rejected",
      rejectionType: null,
    },
    data: {
      rejectionType: "declined_by_hr",
    },
  });

  console.log(`✓ Updated ${result.count} record(s) to rejectionType = "declined_by_hr".`);
  console.log("\nBackfill complete. All existing rejected candidates now default to");
  console.log('"Declined by HR" (uses the existing "Rejected" email template).');
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
