import { prisma } from "../lib/prisma";

/**
 * Dedupe duplicate Application rows for the same candidate + same role.
 *
 * BACKGROUND (the Radinan Yudistira sorting bug):
 * The SEEK import upsert keyed only on (vacancyId, candidateId). When a
 * candidate's first import landed in the "General Application" holding
 * queue (vacancy matching failed at the time) and a LATER import resolved
 * the real vacancy, a SECOND application row was created for the same
 * person + same role. The duplicate row in the holding queue kept getting
 * its `appliedAt` overwritten by every scraper sync (SEEK only provides
 * relative "X days ago" timestamps), so it drifted to the top of the
 * "Applied Date ↓" candidates list forever.
 *
 * WHAT THIS SCRIPT DOES:
 * 1. Finds groups of non-deleted applications for the same candidate that
 *    reference the SAME ROLE — either via identical `appliedFor` text, or
 *    where one row's `appliedFor` equals another row's vacancy title
 *    (matched imports store the role on the vacancy).
 * 2. Within each group, keeps the row with the EARLIEST original
 *    application date (preferring the row whose appliedAt matches its
 *    createdAt — i.e. never overwritten — and the matched-vacancy row over
 *    a holding-queue row when dates tie).
 * 3. Soft-deletes (sets deletedAt) the duplicate rows so no data is
 *    destroyed and the operation is reversible.
 * 4. Repairs the kept row's `appliedAt` when it is in the future or newer
 *    than the duplicate's original date (evidence of the overwrite bug):
 *    it is reset to the earliest legitimate value in the group.
 *
 * USAGE:
 *   npx tsx scripts/dedupe-duplicate-applications.ts            # dry run
 *   npx tsx scripts/dedupe-duplicate-applications.ts --apply     # apply
 */

type AppRow = {
  id: string;
  candidateId: string;
  vacancyId: string;
  appliedFor: string | null;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  jobMatchStatus: string;
  vacancyCode: string | null;
  vacancyTitle: string | null;
};

const normalizeRole = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

async function main() {
  const apply = process.argv.includes("--apply");

  const rawRows = await prisma.application.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      candidateId: true,
      vacancyId: true,
      appliedFor: true,
      appliedAt: true,
      createdAt: true,
      updatedAt: true,
      jobMatchStatus: true,
      vacancy: { select: { code: true, title: true } },
    },
    orderBy: [{ candidateId: "asc" }, { appliedAt: "asc" }],
  });

  // Flatten the nested vacancy relation into the flat fields AppRow expects.
  const rows: AppRow[] = rawRows.map(({ vacancy, ...rest }) => ({
    ...rest,
    vacancyCode: vacancy?.code ?? null,
    vacancyTitle: vacancy?.title ?? null,
  }));

  // Group rows by (candidateId, normalized role). A row's role is its
  // appliedFor text, or — when appliedFor is null — its vacancy title
  // (matched imports store the role on the vacancy).
  const groups = new Map<string, AppRow[]>();
  for (const row of rows) {
    const role =
      normalizeRole(row.appliedFor) || normalizeRole(row.vacancyTitle);
    if (!role) continue;
    // Skip the General Application holding vacancy's own title as a role.
    if (role === "general application") {
      // Still group by appliedFor for holding-queue rows.
      const key = `${row.candidateId}::${normalizeRole(row.appliedFor)}`;
      if (!normalizeRole(row.appliedFor)) continue;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
      continue;
    }
    const key = `${row.candidateId}::${role}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const actions: Array<{
    keep: AppRow;
    remove: AppRow[];
    repairAppliedAt?: { from: Date; to: Date };
  }> = [];

  for (const [key, list] of Array.from(groups.entries())) {
    if (list.length < 2) continue;

    // Choose the keeper:
    //  1. Prefer rows whose appliedAt was never overwritten (appliedAt is
    //     NOT in the future and NOT newer than createdAt + small margin —
    //     an overwritten row has appliedAt > createdAt because the scraper
    //     kept refreshing it to "now").
    //  2. Among those, earliest appliedAt wins.
    //  3. Prefer a matched-vacancy row over a holding-queue row on ties.
    const isOverwritten = (r: AppRow) =>
      r.appliedAt.getTime() > r.createdAt.getTime() + 60_000; // 1min margin

    const candidates = list.filter((r) => !isOverwritten(r));
    const pool = candidates.length > 0 ? candidates : list;

    const keeper = [...pool].sort((a, b) => {
      // Earliest appliedAt first.
      const byDate = a.appliedAt.getTime() - b.appliedAt.getTime();
      if (byDate !== 0) return byDate;
      // Then prefer matched (non-holding-queue) rows.
      const aHolding = a.vacancyCode === "GENERAL-APPLICATION" ? 1 : 0;
      const bHolding = b.vacancyCode === "GENERAL-APPLICATION" ? 1 : 0;
      if (aHolding !== bHolding) return aHolding - bHolding;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];

    const duplicates = list.filter((r) => r.id !== keeper.id);

    // Repair the keeper's appliedAt if it still carries an overwritten
    // (future / drifting) value while an earlier legitimate value exists
    // among the duplicates.
    let repairAppliedAt: { from: Date; to: Date } | undefined;
    if (isOverwritten(keeper)) {
      const earliestLegit = [...list]
        .filter((r) => !isOverwritten(r))
        .sort(
          (a, b) => a.appliedAt.getTime() - b.appliedAt.getTime(),
        )[0];
      if (earliestLegit) {
        repairAppliedAt = {
          from: keeper.appliedAt,
          to: earliestLegit.appliedAt,
        };
      }
    }

    actions.push({ keep: keeper, remove: duplicates, repairAppliedAt });
    void key;
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        duplicateGroups: actions.length,
        rowsToRemove: actions.reduce((n, a) => n + a.remove.length, 0),
        appliedAtRepairs: actions.filter((a) => a.repairAppliedAt).length,
        actions: actions.map((a) => ({
          candidateId: a.keep.candidateId,
          keep: {
            id: a.keep.id,
            appliedFor: a.keep.appliedFor,
            vacancy: a.keep.vacancyTitle,
            appliedAt: a.keep.appliedAt.toISOString(),
            createdAt: a.keep.createdAt.toISOString(),
          },
          repairAppliedAt: a.repairAppliedAt
            ? {
                from: a.repairAppliedAt.from.toISOString(),
                to: a.repairAppliedAt.to.toISOString(),
              }
            : undefined,
          remove: a.remove.map((r) => ({
            id: r.id,
            appliedFor: r.appliedFor,
            vacancy: r.vacancyTitle,
            appliedAt: r.appliedAt.toISOString(),
            createdAt: r.createdAt.toISOString(),
          })),
        })),
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(
      "Dry run only. Review the output, take a fresh production backup, then re-run with --apply.",
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const action of actions) {
      if (action.repairAppliedAt) {
        await tx.application.update({
          where: { id: action.keep.id },
          data: { appliedAt: action.repairAppliedAt.to },
        });
      }
      for (const dup of action.remove) {
        await tx.application.update({
          where: { id: dup.id },
          data: { deletedAt: new Date() },
        });
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        applied: true,
        softDeleted: actions.reduce((n, a) => n + a.remove.length, 0),
        repairedAppliedAt: actions.filter((a) => a.repairAppliedAt).length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
