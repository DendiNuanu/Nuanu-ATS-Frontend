import { prisma } from "../lib/prisma";

const MIN_SIMILARITY = 0.62;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function similarity(a: string, b: string): number {
  const left = normalize(a);
  const right = normalize(b);
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - levenshtein(left, right) / longest;
}

async function main() {
  const [emptyVacancies, foreignLabels] = await Promise.all([
    prisma.vacancy.findMany({
      where: { deletedAt: null, status: "open", applications: { none: { deletedAt: null } } },
      select: { id: true, code: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.application.groupBy({
      by: ["appliedFor", "vacancyId"],
      where: { deletedAt: null, appliedFor: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const warnings = emptyVacancies.flatMap((vacancy) =>
    foreignLabels
      .filter(
        (label): label is typeof label & { appliedFor: string } =>
          Boolean(label.appliedFor) && label.vacancyId !== vacancy.id,
      )
      .map((label) => ({
        vacancyId: vacancy.id,
        vacancyCode: vacancy.code,
        vacancyTitle: vacancy.title,
        matchingAppliedFor: label.appliedFor,
        linkedElsewhereCount: label._count._all,
        linkedVacancyId: label.vacancyId,
        similarity: Number(similarity(vacancy.title, label.appliedFor).toFixed(3)),
      }))
      .filter((warning) => warning.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity),
  );

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        emptyOpenVacancies: emptyVacancies.length,
        warningCount: warnings.length,
        threshold: MIN_SIMILARITY,
        warnings,
      },
      null,
      2,
    ),
  );
  if (warnings.length > 0) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
