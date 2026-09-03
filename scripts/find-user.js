/**
 * find-user.js — find users by name/email fragment (case-insensitive)
 *
 * Usage:
 *   node scripts/find-user.js Claudia
 *   node scripts/find-user.js claudiaolmos
 */
const fs = require("fs");
const path = require("path");

if (!process.env.DATABASE_URL) {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        let value = m[2];
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(m[1] in process.env)) process.env[m[1]] = value;
      }
      if (process.env.DATABASE_URL) {
        console.log(`[env] Loaded DATABASE_URL from ${envFile}`);
        break;
      }
    }
  }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const term = process.argv[2];
  if (!term) {
    console.log("Usage: node scripts/find-user.js <name-or-email-fragment>");
    return;
  }
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (users.length === 0) {
    console.log(`No users found matching "${term}".`);
    return;
  }
  console.log(`Found ${users.length} user(s) matching "${term}":\n`);
  for (const u of users) {
    console.log(`  • ${u.name} <${u.email}> — ID: ${u.id} — role: ${u.role} — created: ${u.createdAt.toISOString()}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
