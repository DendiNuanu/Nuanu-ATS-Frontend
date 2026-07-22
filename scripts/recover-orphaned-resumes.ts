/**
 * Recovery script: re-processes orphaned resume files that exist on disk in
 * `backups-resumes/` but have NO corresponding database record (no
 * CandidateProfile.resumeUrl pointing to them). These files were lost due to
 * the CV-upload data-loss bug (file saved to disk, then a 422 returned when
 * AI parsing failed, orphaning the file with no DB record).
 *
 * Usage:
 *   npx tsx scripts/recover-orphaned-resumes.ts              # PREVIEW (read-only)
 *   npx tsx scripts/recover-orphaned-resumes.ts --apply       # APPLY (writes to DB)
 *
 * The script:
 *   1. Lists every file in `backups-resumes/`.
 *   2. Queries the DB for all CandidateProfile.resumeUrl values and builds a
 *      set of "known" resume paths.
 *   3. Any file on disk whose `/backups-resumes/<name>` path is NOT in the
 *      known set is an ORPHAN.
 *   4. For each orphan, re-runs the fixed pipeline:
 *        extractText → parseResumeWithFallback → createCandidateFromUpload
 *      If AI parsing fails, falls back to createDraftCandidateFromUpload so
 *      the file is never lost again.
 *   5. PREVIEW mode: prints what WOULD happen for each orphan.
 *      APPLY mode: creates the candidate/application records.
 *
 * Each orphan is processed independently — a failure on one file does not
 * stop the others (mirrors the per-file resilience of the fixed upload route).
 */

import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  createCandidateFromUpload,
  createDraftCandidateFromUpload,
  findOrCreateGeneralVacancy,
} from "@/lib/data-access";
import { extractText, parseResumeWithFallback } from "@/lib/cv-parser";

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

loadEnvLocal();

const APPLY = process.argv.includes("--apply");

const UPLOADS_DIR = path.join(process.cwd(), "backups-resumes");

async function main() {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  Orphaned Resume Recovery  —  ${APPLY ? "APPLY" : "PREVIEW"}`);
  console.log(`${"=".repeat(72)}\n`);

  // 1. List files on disk
  let diskFiles: string[];
  try {
    diskFiles = (await fsp.readdir(UPLOADS_DIR)).filter((f) => !f.startsWith("."));
  } catch (err) {
    console.error(`Could not read uploads dir ${UPLOADS_DIR}:`, err);
    process.exit(1);
  }
  console.log(`Found ${diskFiles.length} files on disk in backups-resumes/`);

  // 2. Build the set of known resumeUrls from the DB
  const profiles = await prisma.candidateProfile.findMany({
    select: { resumeUrl: true },
  });
  const knownUrls = new Set(
    profiles
      .map((p) => p.resumeUrl)
      .filter((u): u is string => typeof u === "string" && u.length > 0),
  );
  console.log(`Found ${knownUrls.size} resumeUrl entries in the database\n`);

  // 3. Identify orphans
  const orphans = diskFiles.filter((f) => {
    const url = `/backups-resumes/${f}`;
    return !knownUrls.has(url);
  });

  console.log(`Orphaned files (on disk, no DB record): ${orphans.length}\n`);
  if (orphans.length === 0) {
    console.log("Nothing to recover. ✅");
    return;
  }

  // 4. Resolve the general vacancy once (orphans have no job context)
  let generalVacancyId: string;
  try {
    generalVacancyId = await findOrCreateGeneralVacancy();
    console.log(`Using general vacancy: ${generalVacancyId}\n`);
  } catch (err) {
    console.error("Could not resolve general vacancy:", err);
    process.exit(1);
  }

  let recovered = 0;
  let drafts = 0;
  let failed = 0;

  for (const filename of orphans) {
    const filePath = path.join(UPLOADS_DIR, filename);
    const resumeUrl = `/backups-resumes/${filename}`;
    const ext = path.extname(filename).toLowerCase();
    const tag = `[orphan ${filename}]`;

    console.log(`\n${"─".repeat(60)}`);
    console.log(`${tag} Processing...`);

    try {
      // Extract text
      let resumeText = "";
      try {
        resumeText = await extractText(filePath, ext);
        console.log(`${tag} extracted ${resumeText.length} chars`);
      } catch (err) {
        console.warn(
          `${tag} extractText failed:`,
          err instanceof Error ? err.message : err,
        );
      }

      if (!APPLY) {
        console.log(`${tag} PREVIEW: would create candidate (draft=${!resumeText || resumeText.trim().length < 20})`);
        continue;
      }

      // If text too short, save as draft
      if (!resumeText || resumeText.trim().length < 20) {
        const draft = await createDraftCandidateFromUpload(
          filename,
          generalVacancyId,
          resumeUrl,
          resumeText,
          null,
        );
        console.log(`${tag} ✅ DRAFT created: ${draft.candidateName} (app ${draft.applicationId})`);
        drafts++;
        continue;
      }

      // Parse with AI
      let parsed = null;
      try {
        parsed = await parseResumeWithFallback(resumeText);
      } catch (err) {
        console.warn(
          `${tag} AI parse threw:`,
          err instanceof Error ? err.message : err,
        );
      }

      if (!parsed) {
        const draft = await createDraftCandidateFromUpload(
          filename,
          generalVacancyId,
          resumeUrl,
          resumeText,
          null,
        );
        console.log(`${tag} ✅ DRAFT created (AI failed): ${draft.candidateName} (app ${draft.applicationId})`);
        drafts++;
        continue;
      }

      // Create full candidate
      try {
        const result = await createCandidateFromUpload(
          parsed,
          generalVacancyId,
          resumeUrl,
          resumeText,
          null,
        );
        console.log(`${tag} ✅ RECOVERED: ${result.candidateName} (app ${result.applicationId})`);
        recovered++;
      } catch (err) {
        // DB write for full candidate failed — fall back to draft
        console.warn(`${tag} full create failed, falling back to draft:`, err);
        const draft = await createDraftCandidateFromUpload(
          filename,
          generalVacancyId,
          resumeUrl,
          resumeText,
          null,
        );
        console.log(`${tag} ✅ DRAFT created (DB fallback): ${draft.candidateName} (app ${draft.applicationId})`);
        drafts++;
      }
    } catch (err) {
      console.error(`${tag} ❌ FAILED:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\n${"=".repeat(72)}`);
  console.log(`  Recovery ${APPLY ? "complete" : "preview"} summary`);
  console.log(`${"=".repeat(72)}`);
  console.log(`  Orphans found:  ${orphans.length}`);
  if (APPLY) {
    console.log(`  Recovered:      ${recovered}`);
    console.log(`  Drafts:         ${drafts}`);
    console.log(`  Failed:         ${failed}`);
  } else {
    console.log(`  (Run with --apply to recover them)`);
  }
  console.log();
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
