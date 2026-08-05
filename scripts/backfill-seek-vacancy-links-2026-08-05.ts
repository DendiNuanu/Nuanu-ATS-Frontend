import { prisma } from "../lib/prisma";

const GENERAL_VACANCY_ID = "58be3d3b-cbba-46c0-b871-d010f45052ac";
const SITE_VACANCY_ID = "7b2394c5-457d-478f-98c3-28690f8c0a93";
const MARKETING_VACANCY_ID = "4db5d51e-5f0f-43e0-9eee-2a762c5eed05";
const IMPORT_WINDOW_START = new Date("2026-08-04T16:00:00.000Z");
const EXPECTED_SITE_COUNT = 52;
const EXPECTED_MARKETING_COUNT = 20;

const siteTitles = ["Site Manager", "Senior Site Manager"];

async function main() {
  const apply = process.argv.includes("--apply");
  const applications = await prisma.application.findMany({
    where: {
      vacancyId: GENERAL_VACANCY_ID,
      deletedAt: null,
      source: { equals: "SEEK", mode: "insensitive" },
      appliedAt: { gte: IMPORT_WINDOW_START },
      appliedFor: { in: [...siteTitles, "Marketing Director"] },
    },
    select: {
      id: true,
      candidateId: true,
      appliedFor: true,
      appliedAt: true,
      candidate: { select: { name: true, email: true } },
    },
    orderBy: [{ appliedAt: "asc" }, { id: "asc" }],
  });

  const site = applications.filter((application) =>
    siteTitles.includes(application.appliedFor ?? ""),
  );
  const marketing = applications.filter(
    (application) => application.appliedFor === "Marketing Director",
  );

  if (site.length !== EXPECTED_SITE_COUNT || marketing.length !== EXPECTED_MARKETING_COUNT) {
    throw new Error(
      `Refusing backfill: expected ${EXPECTED_SITE_COUNT} Site and ${EXPECTED_MARKETING_COUNT} Marketing rows, found ${site.length} and ${marketing.length}`,
    );
  }

  const conflicts = await prisma.application.findMany({
    where: {
      OR: [
        { vacancyId: SITE_VACANCY_ID, candidateId: { in: site.map((row) => row.candidateId) } },
        {
          vacancyId: MARKETING_VACANCY_ID,
          candidateId: { in: marketing.map((row) => row.candidateId) },
        },
      ],
    },
    select: { id: true, candidateId: true, vacancyId: true },
  });
  if (conflicts.length > 0) {
    throw new Error(`Refusing backfill: ${conflicts.length} destination application conflict(s)`);
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        counts: { site: site.length, marketing: marketing.length },
        destinations: { site: SITE_VACANCY_ID, marketing: MARKETING_VACANCY_ID },
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

  await prisma.$transaction(async (tx) => {
    const movedSite = await tx.application.updateMany({
      where: { id: { in: site.map((row) => row.id) }, vacancyId: GENERAL_VACANCY_ID },
      data: { vacancyId: SITE_VACANCY_ID },
    });
    const movedMarketing = await tx.application.updateMany({
      where: { id: { in: marketing.map((row) => row.id) }, vacancyId: GENERAL_VACANCY_ID },
      data: { vacancyId: MARKETING_VACANCY_ID },
    });
    if (movedSite.count !== site.length || movedMarketing.count !== marketing.length) {
      throw new Error(
        `Concurrent change detected: moved ${movedSite.count}/${site.length} Site and ${movedMarketing.count}/${marketing.length} Marketing rows`,
      );
    }
  });

  const [siteCount, marketingCount] = await Promise.all([
    prisma.application.count({ where: { vacancyId: SITE_VACANCY_ID, deletedAt: null } }),
    prisma.application.count({ where: { vacancyId: MARKETING_VACANCY_ID, deletedAt: null } }),
  ]);
  console.log(JSON.stringify({ relinked: applications.length, siteCount, marketingCount }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
