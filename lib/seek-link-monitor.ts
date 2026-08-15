import { createNotification } from "@/lib/data-access";
import { prisma } from "@/lib/prisma";

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

export type SeekLinkWarning = {
  vacancyId: string;
  vacancyCode: string;
  vacancyTitle: string;
  matchingAppliedFor: string;
  linkedElsewhereCount: number;
  linkedVacancyId: string;
  similarity: number;
};

export async function findSeekLinkWarnings(): Promise<SeekLinkWarning[]> {
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

  return emptyVacancies.flatMap((vacancy) =>
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
}

/**
 * Diagnostic fuzzy matching is intentionally restricted to alerting. It never
 * assigns candidates; production assignment uses stable JobPosting identifiers.
 */
export async function monitorSeekLinkWarnings(): Promise<SeekLinkWarning[]> {
  const warnings = await findSeekLinkWarnings();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const warning of warnings) {
    const title = `SEEK job-link warning: ${warning.vacancyTitle}`;
    const duplicate = await prisma.notification.findFirst({
      where: { title, isRead: false, createdAt: { gte: oneDayAgo } },
      select: { id: true },
    });
    if (duplicate) continue;

    await createNotification({
      type: "system",
      title,
      message: `${warning.linkedElsewhereCount} applicant(s) labeled "${warning.matchingAppliedFor}" are linked to another job while this open job has 0 candidates.`,
      link: `/jobs/${warning.vacancyId}`,
      metadata: { ...warning, monitor: "seek-job-link" },
    });
  }

  return warnings;
}
