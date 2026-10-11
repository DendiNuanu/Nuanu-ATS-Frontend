import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeEmail(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizePhone(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D+/g, "");
  if (!digits) return null;
  const withoutCountryCode = digits.startsWith("62") ? digits.replace(/^62/, "0") : digits;
  return withoutCountryCode.startsWith("0") ? withoutCountryCode : `0${withoutCountryCode}`;
}

function usage() {
  console.log("Usage: npx tsx scripts/merge-duplicate-users.ts --dry-run | --apply");
}

async function main() {
  const mode = process.argv[2] === "--apply" ? "apply" : "dry-run";

  if (!process.argv[2]) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (mode !== "dry-run" && mode !== "apply") {
    usage();
    process.exitCode = 1;
    return;
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, email: true, phone: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, { ids: string[]; email?: string; phone?: string }>();
  for (const user of users) {
    const email = normalizeEmail(user.email);
    const phone = normalizePhone(user.phone);
    const keys = [email ? `email:${email}` : null, phone ? `phone:${phone}` : null].filter(Boolean) as string[];
    for (const key of keys) {
      const bucket = map.get(key) ?? { ids: [] };
      bucket.ids.push(user.id);
      if (!bucket.email && email) bucket.email = email;
      if (!bucket.phone && phone) bucket.phone = phone;
      map.set(key, bucket);
    }
  }

  const duplicateBuckets = Array.from(map.values()).filter(
    (bucket) => bucket.ids.length > 1,
  );
  console.log(`Mode: ${mode}`);
  console.log(`Duplicate groups: ${duplicateBuckets.length}`);

  if (duplicateBuckets.length === 0) {
    console.log("No duplicate user identities found.");
    return;
  }

  for (const bucket of duplicateBuckets) {
    const mainId = bucket.ids[0];
    const duplicateIds = bucket.ids.slice(1);
    const mainUser = users.find((u) => u.id === mainId);
    console.log(`Group: ${mainUser?.email ?? "unknown"} :: ${duplicateIds.length} duplicates`);
    if (mode === "apply") {
      for (const duplicateId of duplicateIds) {
        const duplicateUser = users.find((u) => u.id === duplicateId);
        await prisma.$transaction(async (tx) => {
          await tx.application.updateMany({
            where: { candidateId: duplicateId },
            data: { candidateId: mainId },
          });
          await tx.candidateProfile.updateMany({
            where: { userId: duplicateId },
            data: { userId: mainId },
          });
          await tx.notification.updateMany({
            where: { userId: duplicateId },
            data: { userId: mainId },
          });
          await tx.user.update({
            where: { id: duplicateId },
            data: { deletedAt: new Date(), email: `${duplicateUser?.email ?? "duplicate"}-${Date.now()}@archived.local` },
          });
        });
      }
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
