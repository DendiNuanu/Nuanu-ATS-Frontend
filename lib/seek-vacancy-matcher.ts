export type SeekVacancyAlias = {
  /** Normalized SEEK role variants accepted by this explicit mapping. */
  appliedRoles: readonly string[];
  /** Immutable ATS vacancy identifier; titles are never used as identifiers. */
  vacancyId: string;
  /** Guardrails checked against the current database row before use. */
  expectedVacancyTitle: string;
  expectedDepartment: string;
};

/**
 * Deliberately small, reviewed allow-list for SEEK listings that do not provide
 * vacancyId/vacancyCode/external listing references. Do not replace this with a
 * global substring/fuzzy match: similarly named vacancies can belong to a
 * different department or hiring campaign.
 */
export const SEEK_VACANCY_ALIASES: readonly SeekVacancyAlias[] = [
  {
    appliedRoles: ["Site Manager", "Senior Site Manager"],
    vacancyId: "7b2394c5-457d-478f-98c3-28690f8c0a93",
    expectedVacancyTitle: "Senior Site Manager",
    expectedDepartment: "Operations",
  },
  {
    appliedRoles: ["Marketing Director", "Senior Marketing Manager"],
    vacancyId: "4db5d51e-5f0f-43e0-9eee-2a762c5eed05",
    expectedVacancyTitle: "Marketing Director",
    expectedDepartment: "Marketing",
  },
] as const;

/** Normalizes harmless formatting differences without broadening semantics. */
export function normalizeSeekJobTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type SeekTitleVacancyRecord = {
  id: string;
  title: string;
};

/**
 * Finds exactly one vacancy with the same normalized title. Duplicate titles
 * fail closed; this intentionally does not perform substring or fuzzy matching.
 */
export function findUniqueNormalizedTitleMatch<T extends SeekTitleVacancyRecord>(
  appliedRole: string | null | undefined,
  vacancies: readonly T[],
): T | null {
  if (!appliedRole) return null;

  const normalizedRole = normalizeSeekJobTitle(appliedRole);
  if (!normalizedRole) return null;

  const matches = vacancies.filter(
    (vacancy) => normalizeSeekJobTitle(vacancy.title) === normalizedRole,
  );
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Returns an alias only for an exact normalized allow-list entry. Ambiguous
 * configuration fails closed so a candidate remains in General Application.
 */
export function findSeekVacancyAlias(
  appliedRole: string | null | undefined,
  aliases: readonly SeekVacancyAlias[] = SEEK_VACANCY_ALIASES,
): SeekVacancyAlias | null {
  if (!appliedRole) return null;

  const normalizedRole = normalizeSeekJobTitle(appliedRole);
  if (!normalizedRole) return null;

  const matches = aliases.filter((alias) =>
    alias.appliedRoles.some(
      (candidateRole) => normalizeSeekJobTitle(candidateRole) === normalizedRole,
    ),
  );

  if (matches.length !== 1) return null;
  return matches[0];
}

export type SeekAliasVacancyRecord = {
  id: string;
  title: string;
  status: string;
  deletedAt: Date | null;
  department: { name: string };
};

/** Validates database state before an explicit alias is trusted. */
export function isSeekAliasTargetValid(
  alias: SeekVacancyAlias,
  vacancy: SeekAliasVacancyRecord | null,
): vacancy is SeekAliasVacancyRecord {
  return Boolean(
    vacancy &&
      vacancy.id === alias.vacancyId &&
      vacancy.deletedAt === null &&
      vacancy.status.toLocaleLowerCase("en-US") === "open" &&
      normalizeSeekJobTitle(vacancy.title) ===
        normalizeSeekJobTitle(alias.expectedVacancyTitle) &&
      normalizeSeekJobTitle(vacancy.department.name) ===
        normalizeSeekJobTitle(alias.expectedDepartment),
  );
}
