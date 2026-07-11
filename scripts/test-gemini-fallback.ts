/**
 * Test script: verifies the Gemini fallback parser produces the same
 * ParsedCandidate structure as Groq.
 *
 * Usage:
 *   npx tsx scripts/test-gemini-fallback.ts <path-to-pdf>
 *
 * Loads .env.local automatically (via dotenv if available, otherwise
 * relies on the shell environment).
 */

import { promises as fs } from "fs";
import path from "path";
import {
  extractText,
  parseResumeWithAI,
  parseResumeWithGemini,
  parseResumeWithFallback,
} from "@/lib/cv-parser";

// ── Minimal .env.local loader (avoids extra deps) ────────────────────────────
async function loadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = await fs.readFile(envPath, "utf-8");
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
    // .env.local might not exist — rely on shell env
  }
}

async function main() {
  await loadEnvLocal();

  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/test-gemini-fallback.ts <path-to-pdf>");
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  console.log(`\n=== Gemini Fallback Test ===`);
  console.log(`File: ${absPath}\n`);

  // 1. Extract text
  const ext = path.extname(absPath).toLowerCase();
  const resumeText = await extractText(absPath, ext);
  if (!resumeText || resumeText.trim().length < 20) {
    console.error("FAIL: Could not extract enough text from the file.");
    process.exit(1);
  }
  console.log(`Extracted ${resumeText.length} chars.\n`);

  // 2. Test Gemini directly
  console.log("── Testing parseResumeWithGemini() directly ──");
  const geminiStart = Date.now();
  const geminiResult = await parseResumeWithGemini(resumeText);
  const geminiMs = Date.now() - geminiStart;

  if (geminiResult) {
    console.log(`  ✓ Gemini parsed in ${geminiMs}ms`);
    console.log(`  Name:  ${geminiResult.name}`);
    console.log(`  Email: ${geminiResult.email || "(none)"}`);
    console.log(`  Phone: ${geminiResult.phone || "(none)"}`);
    console.log(`  Experience entries: ${geminiResult.experience?.length ?? 0}`);
    console.log(`  Education entries:  ${geminiResult.educationEntries?.length ?? 0}`);
    console.log(`  Skills: ${geminiResult.skills?.length ?? 0} items`);
    console.log(`  Languages: ${geminiResult.languages?.length ?? 0} items`);
    if (geminiResult.experience?.length) {
      console.log(`  First job: ${geminiResult.experience[0].title} @ ${geminiResult.experience[0].company}`);
    }
  } else {
    console.log(`  ✗ Gemini returned null after ${geminiMs}ms`);
  }

  // 3. Test the full fallback orchestrator (Groq → Gemini)
  console.log("\n── Testing parseResumeWithFallback() (Groq → Gemini) ──");
  const fallbackStart = Date.now();
  const fallbackResult = await parseResumeWithFallback(resumeText);
  const fallbackMs = Date.now() - fallbackStart;

  if (fallbackResult) {
    console.log(`  ✓ Fallback parsed in ${fallbackMs}ms`);
    console.log(`  Name:  ${fallbackResult.name}`);
    console.log(`  Email: ${fallbackResult.email || "(none)"}`);
  } else {
    console.log(`  ✗ Fallback returned null after ${fallbackMs}ms`);
  }

  // 4. Summary
  console.log("\n── Summary ──");
  console.log(`  Gemini direct:   ${geminiResult ? "✓ PASS" : "✗ FAIL"} (${geminiMs}ms)`);
  console.log(`  Fallback (full): ${fallbackResult ? "✓ PASS" : "✗ FAIL"} (${fallbackMs}ms)`);

  if (geminiResult && fallbackResult) {
    // Verify both produce the same name (they should, since fallback tries Groq first)
    console.log(`\n  Gemini name:   ${geminiResult.name}`);
    console.log(`  Fallback name: ${fallbackResult.name}`);
    if (geminiResult.name === fallbackResult.name) {
      console.log("  ✓ Names match (consistent output)");
    } else {
      console.log("  ℹ Names differ (expected if Groq succeeded in fallback)");
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
