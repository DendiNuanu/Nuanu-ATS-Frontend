/**
 * Gmail connectivity test.
 *
 * Verifies that the service-account + Domain-Wide Delegation setup actually
 * works BEFORE building the full import pipeline. Authenticates as the
 * impersonated Workspace user and lists the 5 most recent inbox messages'
 * subjects + senders. STRICTLY READ-ONLY — never sends or modifies email.
 *
 * Run with:
 *   npx tsx scripts/test-gmail-connection.ts
 *
 * Required env (in .env.local):
 *   GMAIL_SA_KEY_PATH=/home/dendy/.secrets/nuanu-ats/gmail-sa.json
 *   GMAIL_IMPERSONATE_EMAIL=job@nuanu.com
 *
 * Exit codes:
 *   0 = success (auth works, listed recent messages)
 *   1 = not configured (missing env vars / key file)
 *   2 = auth/API failure (DWD not set up, key invalid, etc.)
 */

import fs from "fs";
import path from "path";

// Load .env.local manually (no dotenv dependency). Next.js loads this file
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
    // Strip surrounding quotes
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

import { isGmailConfigured, getGmailImpersonateEmail, listInboxMessages } from "@/lib/gmail-client";

async function main(): Promise<void> {
  console.log("=== Gmail Connectivity Test ===\n");

  if (!isGmailConfigured()) {
    console.error(
      "FAIL: Gmail integration is not configured.\n" +
        "Set GMAIL_SA_KEY_PATH and GMAIL_IMPERSONATE_EMAIL in .env.local.\n" +
        "  GMAIL_SA_KEY_PATH=/home/dendy/.secrets/nuanu-ats/gmail-sa.json\n" +
        "  GMAIL_IMPERSONATE_EMAIL=job@nuanu.com",
    );
    process.exit(1);
  }

  const impersonate = getGmailImpersonateEmail();
  console.log(`Impersonating: ${impersonate}`);
  console.log(`Key path:      ${process.env.GMAIL_SA_KEY_PATH}`);
  console.log(`Scope:         https://www.googleapis.com/auth/gmail.readonly (READ-ONLY)\n`);

  console.log("Authenticating + listing 5 most recent inbox messages...\n");
  try {
    const messages = await listInboxMessages(5);

    if (messages.length === 0) {
      console.log("Inbox is empty (auth succeeded, but no messages found).");
    } else {
      console.log(`Found ${messages.length} recent message(s):\n`);
      messages.forEach((m, i) => {
        console.log(`  ${i + 1}. Subject: ${m.subject || "(no subject)"}`);
        console.log(`     From:    ${m.from || "(unknown)"}`);
        console.log(`     Date:    ${m.date || "(unknown)"}`);
        console.log(`     Attach:  ${m.attachments.length} CV-like attachment(s)`);
        if (m.attachments.length > 0) {
          m.attachments.forEach((a) => {
            console.log(`              - ${a.filename} (${a.mimeType}, ${a.size} bytes)`);
          });
        }
        console.log("");
      });
    }

    console.log("=== SUCCESS: Domain-Wide Delegation is working. ===");
    process.exit(0);
  } catch (err) {
    console.error("\n=== FAIL: Gmail API call failed ===");
    console.error(err);
    console.error(
      "\nCommon causes:\n" +
        "  - Domain-Wide Delegation not yet authorized in Google Admin Console\n" +
        "    (Admin → Security → API Controls → Manage Domain Wide Delegation →\n" +
        "     add the service account's Client ID with scope\n" +
        "     https://www.googleapis.com/auth/gmail.readonly)\n" +
        "  - The impersonated email is not a Workspace user\n" +
        "  - The key file is invalid or the wrong key",
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(2);
});
