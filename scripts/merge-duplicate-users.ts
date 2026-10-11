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
  if (digits.startsWith("62")) return digits.replace(/^62/, "0");
  if (digits.startsWith("8")) return `0${digits}`;
  return digits;
}

function usage() {
  console.log("Usage: npx tsx scripts/merge-duplicate-users.ts --dry-run | --apply");
}

async function main() {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 && args[0] !== "--dry-run" && args[0] !== "--apply")
  ) {
    usage();
    process.exitCode = 1;
    return;
  }
  const mode = args[0] === "--apply" ? "apply" : "dry-run";

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, email: true, phone: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const parent = new Map<string, string>();
  for (const user of users) parent.set(user.id, user.id);

  const findRoot = (id: string): string => {
    const current = parent.get(id);
    if (!current || current === id) return id;
    const root = findRoot(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  const keyOwners = new Map<string, string>();
  for (const user of users) {
    const email = normalizeEmail(user.email);
    const phone = normalizePhone(user.phone);
    const keys = [
      email ? `email:${email}` : null,
      phone ? `phone:${phone}` : null,
    ].filter((key): key is string => key !== null);
    for (const key of keys) {
      const owner = keyOwners.get(key);
      if (owner) union(owner, user.id);
      else keyOwners.set(key, user.id);
    }
  }

  const groupedIds = new Map<string, string[]>();
  for (const user of users) {
    const root = findRoot(user.id);
    const group = groupedIds.get(root) ?? [];
    group.push(user.id);
    groupedIds.set(root, group);
  }
  const duplicateGroups = Array.from(groupedIds.values()).filter(
    (ids) => ids.length > 1,
  );

  console.log(`Mode: ${mode}`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);

  if (duplicateGroups.length === 0) {
    console.log("No duplicate user identities found.");
    return;
  }

  for (const ids of duplicateGroups) {
    const mainId = ids[0];
    const duplicateIds = ids.slice(1);
    const mainUser = users.find((u) => u.id === mainId);
    console.log(`Group: ${mainUser?.email ?? "unknown"} :: ${duplicateIds.length} duplicates`);
    if (mode === "apply") {
      const userReferences = await prisma.$queryRaw<
        Array<{ table_schema: string; table_name: string; column_name: string }>
      >`
        SELECT DISTINCT
          tc.table_schema,
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = current_schema()
          AND ccu.table_name = 'users'
          AND ccu.column_name = 'id'
      `;

      await prisma.$transaction(async (tx) => {
        for (const duplicateId of duplicateIds) {
          for (const reference of userReferences) {
            const quoteIdentifier = (value: string) =>
              `"${value.replace(/"/g, '""')}"`;
            const table = `${quoteIdentifier(reference.table_schema)}.${quoteIdentifier(reference.table_name)}`;
            const column = quoteIdentifier(reference.column_name);
            await tx.$executeRawUnsafe(
              `UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`,
              mainId,
              duplicateId,
            );
          }

          await tx.user.update({
            where: { id: duplicateId },
            data: { deletedAt: new Date(), isActive: false },
          });
        }
      });
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
