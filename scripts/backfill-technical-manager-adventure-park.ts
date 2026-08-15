import { prisma } from "../lib/prisma";

const GENERAL_VACANCY_ID = "58be3d3b-cbba-46c0-b871-d010f45052ac";
const TARGET_VACANCY_ID = "e93e14fb-452e-4192-8bb3-0d599a7dd20e";
const APPLIED_FOR = "Technical Manager - Adventure Park";
const EXPECTED_COUNT = 8;

async function main() {
  const apply = process.argv.includes("--apply");
  const [target, applications] = await Promise.all([
    prisma.vacancy.findFirst({
      where: { id: TARGET_VACANCY_ID, deletedAt: null, status: "open" },
      select: { id: true, code: true, title: true, status: true },
    }),
    prisma.application.findMany({
      where: {
        vacancyId: GENERAL_VACANCY_ID,
        deletedAt: null,
        source: { equals: "SEEK", mode: "insensitive" },
        appliedFor: { equals: APPLIED_FOR, mode: "insensitive" },
      },
      select: {
        id: true,
        candidateId: true,
        appliedFor: true,
        appliedAt: true,
        candidate: { select: { name: true, email: true } },
      },
      orderBy: [{ appliedAt: "asc" }, { id: "asc" }],
    }),
  ]);

  if (!target || target.title !== APPLIED_FOR) {
    throw new Error("Refusing backfill: canonical open Technical Manager vacancy was not found");
  }
  if (applications.length !== EXPECTED_COUNT) {
    throw new Error(
      `Refusing backfill: expected ${EXPECTED_COUNT} holding-queue applications, found ${applications.length}`,
    );
  }

  const conflicts = await prisma.application.findMany({
    where: {
      vacancyId: TARGET_VACANCY_ID,
      candidateId: { in: applications.map((application) => application.candidateId) },
    },
    select: { id: true, candidateId: true },
  });
  if (conflicts.length > 0) {
    throw new Error(`Refusing backfill: ${conflicts.length} destination conflict(s)`);
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        target,
        affectedCount: applications.length,
        applications,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry run only. Take a fresh production backup before re-running with --apply.");
    return;
  }

  const updated = await prisma.application.updateMany({
    where: {
      id: { in: applications.map((application) => application.id) },
      vacancyId: GENERAL_VACANCY_ID,
      deletedAt: null,
      source: { equals: "SEEK", mode: "insensitive" },
      appliedFor: { equals: APPLIED_FOR, mode: "insensitive" },
    },
    data: {
      vacancyId: TARGET_VACANCY_ID,
      jobMatchStatus: "matched",
      jobMatchReason: null,
    },
  });
  if (updated.count !== applications.length) {
    throw new Error(
      `Concurrent change detected: expected ${applications.length} updates, got ${updated.count}`,
    );
  }

  const confirmed = await prisma.application.count({
    where: { vacancyId: TARGET_VACANCY_ID, deletedAt: null },
  });
  console.log(JSON.stringify({ relinked: updated.count, targetCandidateCount: confirmed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
