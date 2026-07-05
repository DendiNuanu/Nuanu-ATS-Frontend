/**
 * Backfill script: Updates existing CandidateProfile records to populate the
 * numeric `expectedSalary` and `experienceYears` fields from existing data
 * sources (SEEK application_questions, salaryExpectation string, parsedData).
 *
 * This script does NOT delete any data. It only UPDATEs the numeric fields
 * that were previously left empty (NULL or 0).
 *
 * Safety features:
 *   - DRY RUN by default (no writes). Use --apply to actually write.
 *   - Only updates fields that are currently empty (NULL expectedSalary or
 *     experienceYears === 0). Does NOT overwrite manually-set values.
 *   - Prints a detailed report of what WOULD be / WAS changed.
 *
 * Usage:
 *   node scripts/backfill-salary-experience.js            # dry run (preview)
 *   node scripts/backfill-salary-experience.js --apply     # apply changes
 *
 * Data sources (in priority order):
 *   1. SEEK application_questions (seek_application_questions JSON column)
 *      - Indonesian keywords: "gaji"/"salary" → expectedSalary
 *      - "pengalaman"/"experience" → experienceYears
 *   2. salaryExpectation string column (e.g. "IDR 8.000.000 / month")
 *   3. parsedData JSON column (from Groq AI CV parsing)
 */
import { prisma } from "../lib/prisma";
import {
  extractAllFromQuestions,
  parseSalaryToNumber,
} from "../lib/salary-experience-parser";

async function main() {
  const apply = process.argv.includes("--apply");

  console.log("=".repeat(80));
  console.log(
    `Backfill: expectedSalary & experienceYears  [mode: ${apply ? "APPLY" : "DRY RUN"}]`,
  );
  console.log("=".repeat(80));

  // Fetch all candidate profiles. CandidateProfile has no Prisma relation
  // back to User (only a plain userId string), so we fetch users separately
  // and merge by userId.
  const profiles = await prisma.candidateProfile.findMany({
    select: {
      userId: true,
      expectedSalary: true,
      experienceYears: true,
      salaryExpectation: true,
      seekApplicationQuestions: true,
      parsedData: true,
    },
  });

  // Fetch all users in one query for name/email lookup
  const userIds = profiles.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  console.log(`\nTotal candidate profiles: ${profiles.length}`);

  const rows = [];
  let salaryUpdated = 0;
  let experienceUpdated = 0;
  let bothUpdated = 0;
  let noChange = 0;

  for (const p of profiles) {
    const currentExpectedSalary = p.expectedSalary;
    const currentExperienceYears = p.experienceYears;

    // Skip if both fields are already populated
    const salaryNeedsUpdate = currentExpectedSalary === null;
    const experienceNeedsUpdate =
      currentExperienceYears === null || currentExperienceYears === 0;

    if (!salaryNeedsUpdate && !experienceNeedsUpdate) {
      noChange++;
      continue;
    }

    // 1. Try SEEK application_questions
    let newSalary = null;
    let newExperience = null;
    let source = "";

    const seekQuestions = p.seekApplicationQuestions;
    if (seekQuestions && typeof seekQuestions === "object") {
      const questions = Array.isArray(seekQuestions) ? seekQuestions : null;

      if (questions && questions.length > 0) {
        const extracted = extractAllFromQuestions(questions);
        if (salaryNeedsUpdate && extracted.salary !== null) {
          newSalary = extracted.salary;
          source = "seek_application_questions";
        }
        if (experienceNeedsUpdate && extracted.experienceYears !== null) {
          newExperience = extracted.experienceYears;
          source = source || "seek_application_questions";
        }
      }
    }

    // 2. Try salaryExpectation string for salary
    if (salaryNeedsUpdate && newSalary === null && p.salaryExpectation) {
      const parsed = parseSalaryToNumber(p.salaryExpectation);
      if (parsed !== null) {
        newSalary = parsed;
        source = "salaryExpectation_string";
      }
    }

    // 3. Try parsedData (Groq AI output) for salary and experience
    if (
      (salaryNeedsUpdate && newSalary === null) ||
      (experienceNeedsUpdate && newExperience === null)
    ) {
      const pd = p.parsedData;
      if (pd && typeof pd === "object" && !Array.isArray(pd)) {
        if (salaryNeedsUpdate && newSalary === null && pd.expectedSalary) {
          const parsed = parseSalaryToNumber(String(pd.expectedSalary));
          if (parsed !== null) {
            newSalary = parsed;
            source = "parsedData";
          }
        }
        if (
          experienceNeedsUpdate &&
          newExperience === null &&
          pd.experienceYears != null
        ) {
          const exp =
            typeof pd.experienceYears === "number"
              ? pd.experienceYears
              : parseInt(String(pd.experienceYears), 10);
          if (!isNaN(exp) && exp >= 0 && exp <= 50) {
            newExperience = exp;
            source = source || "parsedData";
          }
        }
      }
    }

    if (newSalary === null && newExperience === null) {
      noChange++;
      continue;
    }

    const user = userMap.get(p.userId);
    rows.push({
      userId: p.userId,
      userName: user?.name ?? "Unknown",
      userEmail: user?.email ?? "Unknown",
      currentExpectedSalary,
      currentExperienceYears,
      currentSalaryExpectation: p.salaryExpectation,
      newExpectedSalary: newSalary,
      newExperienceYears: newExperience,
      source,
    });

    if (newSalary !== null) salaryUpdated++;
    if (newExperience !== null) experienceUpdated++;
    if (newSalary !== null && newExperience !== null) bothUpdated++;
  }

  // Print report
  console.log("\n" + "─".repeat(80));
  console.log("SUMMARY (candidates that would be updated):");
  console.log(`  Salary updated:      ${salaryUpdated}`);
  console.log(`  Experience updated:  ${experienceUpdated}`);
  console.log(`  Both updated:        ${bothUpdated}`);
  console.log(`  No change needed:    ${noChange}`);
  console.log("─".repeat(80));

  if (rows.length === 0) {
    console.log("\nNo candidates need updating. All fields are already populated.");
    return;
  }

  console.log("\nDETAILS:");
  for (const r of rows) {
    console.log(`\n  ${r.userName} <${r.userEmail}>`);
    console.log(
      `    Current:  salary=${r.currentExpectedSalary ?? "NULL"}, exp=${r.currentExperienceYears ?? "NULL"} years`,
    );
    console.log(`    salaryExpectation: ${r.currentSalaryExpectation ?? "NULL"}`);
    console.log(
      `    NEW:     salary=${r.newExpectedSalary ?? "—"}, exp=${r.newExperienceYears ?? "—"} years`,
    );
    console.log(`    Source:  ${r.source}`);
  }

  if (!apply) {
    console.log("\n" + "=".repeat(80));
    console.log("DRY RUN — no changes were made.");
    console.log(
      "To apply these changes, run: node scripts/backfill-salary-experience.js --apply",
    );
    console.log("=".repeat(80));
    return;
  }

  // Apply changes
  console.log("\n" + "=".repeat(80));
  console.log("APPLYING CHANGES...");
  console.log("=".repeat(80));

  let applied = 0;
  let errors = 0;

  for (const r of rows) {
    try {
      const data = {};
      if (r.newExpectedSalary !== null) {
        data.expectedSalary = r.newExpectedSalary;
      }
      if (r.newExperienceYears !== null) {
        data.experienceYears = r.newExperienceYears;
      }

      await prisma.candidateProfile.update({
        where: { userId: r.userId },
        data,
      });
      applied++;
      console.log(`  ✓ ${r.userName} — updated`);
    } catch (err) {
      errors++;
      console.error(
        `  ✗ ${r.userName} — ERROR: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`DONE: ${applied} updated, ${errors} errors`);
  console.log("=".repeat(80));
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
