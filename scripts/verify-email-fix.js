/**
 * Verification for the "Unique constraint failed on (email)" fix.
 *
 * Run ON THE SERVER (node scripts/verify-email-fix.js) with the app live on
 * http://127.0.0.1:3002. Performs three PATCH /api/candidates/:id tests:
 *
 *   A) Save with the candidate's UNCHANGED email  -> expect 200 (previously
 *      could 500 via prisma.user.update when the email collided with another
 *      user; now the email write is skipped entirely when unchanged).
 *   B) Save with an email owned by ANOTHER user   -> expect 409 + a clear
 *      "already used by another user" message (was: raw 500 P2002).
 *   C) Change email to a free address, then back  -> expect 200 both times,
 *      proving genuine email changes still persist correctly.
 *
 * All touched fields are restored; test B is rejected server-side so it
 * changes nothing.
 */
const fs = require("fs");
const path = require("path");

// Dependency-free env loader (project has no dotenv package).
if (!process.env.DATABASE_URL) {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let value = m[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = process.env[m[1]] ?? value;
    }
  }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";

async function patchCandidate(applicationId, body) {
  const res = await fetch(`${BASE}/api/candidates/${applicationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json };
}

function verdict(label, pass, detail) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

async function main() {
  let allPass = true;

  // Pick a test candidate: any application joined to its user. Prefer a
  // recent one so we exercise the normal edit path.
  const app = await prisma.application.findFirst({
    orderBy: { lastActivityAt: "desc" },
    select: {
      id: true,
      candidateId: true,
      candidate: { select: { name: true, email: true } },
    },
  });
  if (!app) {
    console.error("No application found to test with.");
    process.exitCode = 1;
    return;
  }
  const originalEmail = app.candidate.email;
  const originalName = app.candidate.name;
  console.log(`Test candidate: ${app.candidate.name} <${originalEmail}> (app ${app.id})`);

  // Find a DIFFERENT user's email for the conflict test.
  const other = await prisma.user.findFirst({
    where: { id: { not: app.candidateId }, email: { not: originalEmail } },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  if (!other) {
    console.error("No second user found for the conflict test.");
    process.exitCode = 1;
    return;
  }
  console.log(`Conflict email (owned by another user): ${other.email}\n`);

  // --- Test A: unchanged email (the Edit Profile "always sends email" path)
  {
    const { status, json } = await patchCandidate(app.id, {
      name: originalName,
      email: originalEmail,
    });
    allPass &= verdict(
      "A) Save with UNCHANGED email returns 200",
      status === 200,
      `status=${status}${json?.error ? ` error="${json.error}"` : ""}`,
    );
  }

  // --- Test B: email owned by another user -> expect 409 + clear message
  {
    const { status, json } = await patchCandidate(app.id, { email: other.email });
    const message = typeof json?.error === "string" ? json.error : "";
    allPass &= verdict(
      "B) Email owned by ANOTHER user returns 409",
      status === 409,
      `status=${status} error="${message}"`,
    );
    allPass &= verdict(
      "B) 409 message is user-actionable (no raw Prisma text)",
      /already used by another user/i.test(message),
      message ? `"${message}"` : "no message",
    );
    // Confirm nothing changed.
    const after = await prisma.user.findUnique({
      where: { id: app.candidateId },
      select: { email: true },
    });
    allPass &= verdict(
      "B) Candidate email unchanged after rejected save",
      after?.email === originalEmail,
      `db=${after?.email}`,
    );
  }

  // --- Test C: change to a free email, then revert (round-trip persistence)
  const tempEmail = `zz-email-fix-test-${Date.now()}@test.invalid`;
  {
    const set = await patchCandidate(app.id, { email: tempEmail });
    allPass &= verdict(
      "C1) Changing to a FREE email returns 200",
      set.status === 200,
      `status=${set.status}${set.json?.error ? ` error="${set.json.error}"` : ""}`,
    );
    const dbAfterSet = await prisma.user.findUnique({
      where: { id: app.candidateId },
      select: { email: true },
    });
    allPass &= verdict(
      "C1) New email persisted in DB",
      dbAfterSet?.email === tempEmail,
      `db=${dbAfterSet?.email}`,
    );

    const revert = await patchCandidate(app.id, { email: originalEmail });
    allPass &= verdict(
      "C2) Reverting to original email returns 200",
      revert.status === 200,
      `status=${revert.status}${revert.json?.error ? ` error="${revert.json.error}"` : ""}`,
    );
    const dbAfterRevert = await prisma.user.findUnique({
      where: { id: app.candidateId },
      select: { email: true },
    });
    allPass &= verdict(
      "C2) Original email restored in DB",
      dbAfterRevert?.email === originalEmail,
      `db=${dbAfterRevert?.email}`,
    );
  }

  console.log(`\n${allPass ? "ALL TESTS PASSED ✔" : "SOME TESTS FAILED ✘"}`);
  process.exitCode = allPass ? 0 : 1;
}

main()
  .catch((error) => {
    console.error("Verification crashed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
