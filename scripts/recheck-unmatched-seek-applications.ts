import { prisma } from "../lib/prisma";
import {
  findSeekVacancyAlias,
  findUniqueNormalizedTitleMatch,
  isSeekAliasTargetValid,
} from "../lib/seek-vacancy-matcher";

type Resolution = {
  vacancyId: string;
  vacancyTitle: string;
  matchedBy: "external-listing" | "reviewed-role-alias" | "normalized-exact-title";
};

async function main() {
  const apply = process.argv.includes("--apply");

  const [applications, openVacancies, postings] = await Promise.all([
    prisma.application.findMany({
      where: { deletedAt: null, jobMatchStatus: "unmatched" },
      select: {
        id: true,
        candidateId: true,
        vacancyId: true,
        appliedFor: true,
        externalJobId: true,
        externalJobUrl: true,
        jobMatchReason: true,
        candidate: { select: { name: true, email: true } },
      },
      orderBy: [{ appliedAt: "asc" }, { id: "asc" }],
    }),
    prisma.vacancy.findMany({
      where: {
        deletedAt: null,
        status: { equals: "open", mode: "insensitive" },
      },
      select: {
        id: true,
        title: true,
        status: true,
        deletedAt: true,
        department: { select: { name: true } },
      },
    }),
    prisma.jobPosting.findMany({
      where: {
        channel: { in: ["seek", "jobstreet"], mode: "insensitive" },
        vacancy: { deletedAt: null },
      },
      select: {
        externalId: true,
        externalUrl: true,
        vacancy: { select: { id: true, title: true } },
      },
    }),
  ]);

  const resolutions = new Map<string, Resolution>();
  const unresolved: Array<{ applicationId: string; candidate: string; appliedFor: string | null; reason: string }> = [];

  for (const application of applications) {
    const stableMatches = postings.filter(
      (posting) =>
        (application.externalJobId && posting.externalId === application.externalJobId) ||
        (application.externalJobUrl && posting.externalUrl === application.externalJobUrl),
    );
    const stableVacancies = Array.from(
      new Map(stableMatches.map((posting) => [posting.vacancy.id, posting.vacancy])).values(),
    );

    let resolution: Resolution | null =
      stableVacancies.length === 1
        ? {
            vacancyId: stableVacancies[0].id,
            vacancyTitle: stableVacancies[0].title,
            matchedBy: "external-listing",
          }
        : null;

    if (!resolution && stableVacancies.length === 0) {
      const alias = findSeekVacancyAlias(application.appliedFor);
      const aliasVacancy = alias
        ? openVacancies.find((vacancy) => vacancy.id === alias.vacancyId) ?? null
        : null;
      if (alias && isSeekAliasTargetValid(alias, aliasVacancy)) {
        resolution = {
          vacancyId: aliasVacancy.id,
          vacancyTitle: aliasVacancy.title,
          matchedBy: "reviewed-role-alias",
        };
      }
    }

    if (!resolution && stableVacancies.length === 0) {
      const titleMatch = findUniqueNormalizedTitleMatch(
        application.appliedFor,
        openVacancies,
      );
      if (titleMatch) {
        resolution = {
          vacancyId: titleMatch.id,
          vacancyTitle: titleMatch.title,
          matchedBy: "normalized-exact-title",
        };
      }
    }

    if (resolution) {
      resolutions.set(application.id, resolution);
    } else {
      unresolved.push({
        applicationId: application.id,
        candidate: application.candidate.name,
        appliedFor: application.appliedFor,
        reason:
          stableVacancies.length > 1
            ? "conflicting stable listing mappings"
            : "no stable mapping, reviewed alias, or unique normalized exact-title match",
      });
    }
  }

  const destinationConflicts = applications.length
    ? await prisma.application.findMany({
        where: {
          OR: applications.flatMap((application) => {
            const resolution = resolutions.get(application.id);
            return resolution
              ? [{ candidateId: application.candidateId, vacancyId: resolution.vacancyId }]
              : [];
          }),
          deletedAt: null,
        },
        select: { id: true, candidateId: true, vacancyId: true },
      })
    : [];
  const conflictKeys = new Set(
    destinationConflicts.map((conflict) => `${conflict.candidateId}:${conflict.vacancyId}`),
  );

  const resolvable = applications.filter((application) => {
    const resolution = resolutions.get(application.id);
    return (
      resolution &&
      application.vacancyId !== resolution.vacancyId &&
      !conflictKeys.has(`${application.candidateId}:${resolution.vacancyId}`)
    );
  });
  const alreadyAtTarget = applications.filter((application) => {
    const resolution = resolutions.get(application.id);
    return resolution && application.vacancyId === resolution.vacancyId;
  });
  const conflicts = applications.filter((application) => {
    const resolution = resolutions.get(application.id);
    return (
      resolution &&
      application.vacancyId !== resolution.vacancyId &&
      conflictKeys.has(`${application.candidateId}:${resolution.vacancyId}`)
    );
  });

  const preview = resolvable.map((application) => ({
    applicationId: application.id,
    candidate: application.candidate.name,
    email: application.candidate.email,
    appliedFor: application.appliedFor,
    fromVacancyId: application.vacancyId,
    ...resolutions.get(application.id)!,
  }));

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        unmatchedBefore: applications.length,
        resolvable: preview.length,
        alreadyAtResolvedVacancy: alreadyAtTarget.length,
        destinationConflicts: conflicts.length,
        stillNeedsManualAssignment: unresolved.length + conflicts.length,
        byMethod: preview.reduce<Record<string, number>>((counts, item) => {
          counts[item.matchedBy] = (counts[item.matchedBy] ?? 0) + 1;
          return counts;
        }, {}),
        preview,
        conflicts: conflicts.map((application) => ({
          applicationId: application.id,
          candidate: application.candidate.name,
          appliedFor: application.appliedFor,
          target: resolutions.get(application.id),
        })),
        unresolved,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry run only. Take a fresh production backup before re-running with --apply.");
    return;
  }

  const updated = await prisma.$transaction(
    resolvable.map((application) => {
      const resolution = resolutions.get(application.id)!;
      return prisma.application.updateMany({
        where: {
          id: application.id,
          vacancyId: application.vacancyId,
          jobMatchStatus: "unmatched",
          deletedAt: null,
        },
        data: {
          vacancyId: resolution.vacancyId,
          jobMatchStatus: "matched",
          jobMatchReason: null,
        },
      });
    }),
  );
  const resolvedCount = updated.reduce((sum, result) => sum + result.count, 0);
  if (resolvedCount !== resolvable.length) {
    throw new Error(
      `Concurrent change detected: expected ${resolvable.length} updates, got ${resolvedCount}`,
    );
  }

  const remainingUnmatched = await prisma.application.count({
    where: { deletedAt: null, jobMatchStatus: "unmatched" },
  });
  console.log(JSON.stringify({ resolvedAutomatically: resolvedCount, remainingUnmatched }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
