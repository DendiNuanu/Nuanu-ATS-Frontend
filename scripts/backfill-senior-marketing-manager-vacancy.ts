import { prisma } from "../lib/prisma";

const CANONICAL_VACANCY_ID = "4db5d51e-5f0f-43e0-9eee-2a762c5eed05";
const POSITION = "Senior Marketing Manager";
const SOURCE = "SEEK";

async function main() {
  const apply = process.argv.includes("--apply");

  const canonical = await prisma.vacancy.findFirst({
    where: { id: CANONICAL_VACANCY_ID, deletedAt: null },
    select: { id: true, title: true, code: true, createdAt: true },
  });
  if (!canonical) {
    throw new Error(`Canonical vacancy ${CANONICAL_VACANCY_ID} was not found or is deleted`);
  }

  const affected = await prisma.application.findMany({
    where: {
      source: { equals: SOURCE, mode: "insensitive" },
      appliedFor: { equals: POSITION, mode: "insensitive" },
      vacancyId: { not: CANONICAL_VACANCY_ID },
      deletedAt: null,
    },
    select: {
      id: true,
      vacancyId: true,
      candidateId: true,
      appliedFor: true,
      candidate: { select: { name: true, email: true } },
      vacancy: { select: { title: true, code: true } },
    },
    orderBy: { appliedAt: "asc" },
  });

  const conflicts = affected.length
    ? await prisma.application.findMany({
        where: {
          vacancyId: CANONICAL_VACANCY_ID,
          candidateId: { in: affected.map((application) => application.candidateId) },
        },
        select: { id: true, candidateId: true },
      })
    : [];

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", canonical, affectedCount: affected.length, conflicts, affected }, null, 2));

  if (!apply) {
    console.log("Dry run only. Re-run with --apply after taking a fresh backup.");
    return;
  }
  if (conflicts.length > 0) {
    throw new Error(`Refusing backfill: ${conflicts.length} candidate(s) already have an application for the canonical vacancy`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.application.updateMany({
      where: {
        id: { in: affected.map((application) => application.id) },
        source: { equals: SOURCE, mode: "insensitive" },
        appliedFor: { equals: POSITION, mode: "insensitive" },
        vacancyId: { not: CANONICAL_VACANCY_ID },
        deletedAt: null,
      },
      data: { vacancyId: CANONICAL_VACANCY_ID },
    });
    if (updated.count !== affected.length) {
      throw new Error(`Concurrent change detected: expected ${affected.length} updates, got ${updated.count}`);
    }
    return updated;
  });

  const confirmed = await prisma.application.count({
    where: {
      vacancyId: CANONICAL_VACANCY_ID,
      source: { equals: SOURCE, mode: "insensitive" },
      appliedFor: { equals: POSITION, mode: "insensitive" },
      deletedAt: null,
    },
  });

  console.log(JSON.stringify({ relinked: result.count, confirmedCanonicalApplications: confirmed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
