/**
 * preview-candidates.js
 *
 * Preview candidates by email — shows full details (name, email, ID, source,
 * appliedFor, vacancy title, department, createdAt) for each candidate.
 *
 * This is a READ-ONLY script. It does NOT delete anything.
 *
 * Usage:
 *   npx tsx scripts/preview-candidates.js --emails="a@b.com,c@d.com"
 *
 * If --emails is omitted, uses the 21 default emails from the user's request.
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// 21 emails from the user's BAGIAN 2 deletion request
const DEFAULT_EMAILS = [
  "leandromorang@gmail.com",
  "dea.kimberly29@gmail.com",
  "roy_020387@yahoo.co.id",
  "madedevi88@gmail.com",
  "putriadellia1109@gmail.com",
  "rheifajuliantika09@gmail.com",
  "alexandro.adbl@gmail.com",
  "cokdiva30@gmail.com",
  "mhmadrozi17@gmail.com",
  "helyanawiliyanti@gmail.com",
  "fajrulflch@gmail.com",
  "sjoni8653@gmail.com",
  "anggakoesoema10@gmail.com",
  "wijayasurahman@gmail.com",
  "dizahafnizairin@live.com",
  "haldapurwinarto@gmail.com",
  "niwayanpradnyaandini9@gmail.com",
  "tedy.irawan20@ymail.com",
  "rahmadarif920@gmail.com",
  "rajasakti8787@gmail.com",
  "mustikawidiah@gmail.com",
];

async function main() {
  const args = process.argv.slice(2);
  const emailsArg = args.find((a) => a.startsWith("--emails="));
  const emails = emailsArg
    ? emailsArg
        .replace("--emails=", "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
    : DEFAULT_EMAILS;

  console.log(`\n${"=".repeat(80)}`);
  console.log(`  CANDIDATE PREVIEW (READ-ONLY — no deletion)`);
  console.log(`${"=".repeat(80)}`);
  console.log(`  Requested emails: ${emails.length}`);
  console.log(`${"=".repeat(80)}\n`);

  // 1. Find users by email
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      applications: {
        select: {
          id: true,
          source: true,
          appliedFor: true,
          currentStage: true,
          createdAt: true,
          vacancy: {
            select: {
              id: true,
              title: true,
              code: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`  Found ${users.length} user(s) out of ${emails.length} requested.\n`);

  if (users.length !== emails.length) {
    // Find which emails were NOT found
    const foundEmails = new Set(users.map((u) => u.email.toLowerCase()));
    const missing = emails.filter((e) => !foundEmails.has(e.toLowerCase()));
    console.log(`  ⚠️  MISSING (${missing.length} emails not found in DB):`);
    for (const e of missing) {
      console.log(`     - ${e}`);
    }
    console.log("");
  }

  console.log(`${"─".repeat(80)}`);
  console.log(
    `  ${"Name".padEnd(25)} ${"Email".padEnd(40)} ${"Source".padEnd(10)} ${"Applied For".padEnd(20)}`,
  );
  console.log(
    `  ${"Vacancy Title".padEnd(25)} ${"Department".padEnd(20)} ${"Stage".padEnd(12)} ${"Created At"}`,
  );
  console.log(`${"─".repeat(80)}\n`);

  let bugCount = 0; // candidates with source="upload"/"Direct" + appliedFor="General Application"
  let seekCount = 0;

  for (const u of users) {
    const app = u.applications[0]; // primary application
    const source = app?.source ?? "—";
    const appliedFor = app?.appliedFor ?? "—";
    const vacancyTitle = app?.vacancy?.title ?? "—";
    const department = app?.vacancy?.department?.name ?? "—";
    const stage = app?.currentStage ?? "—";
    const createdAt = u.createdAt.toISOString().split("T")[0];

    console.log(
      `  ${u.name.slice(0, 25).padEnd(25)} ${u.email.slice(0, 40).padEnd(40)} ${source.padEnd(10)} ${appliedFor.slice(0, 20).padEnd(20)}`,
    );
    console.log(
      `  ${vacancyTitle.slice(0, 25).padEnd(25)} ${department.slice(0, 20).padEnd(20)} ${stage.padEnd(12)} ${createdAt}`,
    );
    console.log(`  ID: ${u.id}\n`);

    // Check if this candidate has the bug pattern
    const isBuggy =
      source === "upload" &&
      (vacancyTitle === "General Application" || appliedFor === "General Application" || appliedFor === "—");
    if (isBuggy) {
      bugCount++;
    }
    if (source === "SEEK" || source === "seek") {
      seekCount++;
    }
  }

  console.log(`${"=".repeat(80)}`);
  console.log(`  SUMMARY`);
  console.log(`${"=".repeat(80)}`);
  console.log(`  Total requested:    ${emails.length}`);
  console.log(`  Found in DB:       ${users.length}`);
  console.log(`  Missing from DB:   ${emails.length - users.length}`);
  console.log(`  With bug pattern:  ${bugCount} (source=upload + General Application)`);
  console.log(`  Already SEEK:      ${seekCount}`);
  console.log(`${"=".repeat(80)}\n`);

  if (users.length !== emails.length) {
    console.log("  ⛔ STOP: Count mismatch — not all 21 emails found in DB.");
    console.log("     Do NOT proceed with deletion until all 21 are accounted for.\n");
  } else {
    console.log("  ✅ All 21 emails found in DB. Ready for deletion after confirmation.\n");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
