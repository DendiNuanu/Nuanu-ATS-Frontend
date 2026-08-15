import assert from "node:assert/strict";
import {
  findSeekVacancyAlias,
  findUniqueNormalizedTitleMatch,
  isSeekAliasTargetValid,
  normalizeSeekJobTitle,
  type SeekAliasVacancyRecord,
} from "../lib/seek-vacancy-matcher";

const target: SeekAliasVacancyRecord = {
  id: "7b2394c5-457d-478f-98c3-28690f8c0a93",
  title: "Senior Site Manager",
  status: "open",
  deletedAt: null,
  department: { name: "Operations" },
};

assert.equal(normalizeSeekJobTitle("  SITE\u00a0MANAGER  "), "site manager");
assert.equal(
  findUniqueNormalizedTitleMatch(" Technical Manager - Adventure Park ", [
    { id: "technical-manager", title: "Technical Manager - Adventure Park" },
    { id: "other", title: "Marketing Director" },
  ])?.id,
  "technical-manager",
);
assert.equal(
  findUniqueNormalizedTitleMatch("Technical Manager - Adventure Park", [
    { id: "duplicate-1", title: "Technical Manager - Adventure Park" },
    { id: "duplicate-2", title: "technical manager adventure park" },
  ]),
  null,
);
assert.equal(
  findUniqueNormalizedTitleMatch("Technical Manager", [
    { id: "near-match", title: "Technical Manager - Adventure Park" },
  ]),
  null,
);
assert.equal(findSeekVacancyAlias("Site Manager")?.vacancyId, target.id);
assert.equal(findSeekVacancyAlias(" senior site manager ")?.vacancyId, target.id);
assert.equal(findSeekVacancyAlias("Assistant Site Manager"), null);
assert.equal(findSeekVacancyAlias("Marketing Director")?.vacancyId, "4db5d51e-5f0f-43e0-9eee-2a762c5eed05");
assert.equal(findSeekVacancyAlias("Senior Marketing Manager")?.vacancyId, "4db5d51e-5f0f-43e0-9eee-2a762c5eed05");
assert.equal(isSeekAliasTargetValid(findSeekVacancyAlias("Site Manager")!, target), true);
assert.equal(
  isSeekAliasTargetValid(findSeekVacancyAlias("Site Manager")!, {
    ...target,
    title: "Site Manager",
  }),
  false,
);
assert.equal(
  isSeekAliasTargetValid(findSeekVacancyAlias("Site Manager")!, {
    ...target,
    department: { name: "Engineering" },
  }),
  false,
);
assert.equal(
  isSeekAliasTargetValid(findSeekVacancyAlias("Site Manager")!, {
    ...target,
    status: "closed",
  }),
  false,
);

console.log("SEEK vacancy matcher tests passed");
