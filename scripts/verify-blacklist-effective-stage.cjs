const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScript(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "./identity-normalization") {
      return loadTypeScript(
        path.resolve(path.dirname(filePath), "identity-normalization.ts"),
      );
    }
    return require(specifier);
  };
  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

const {
  candidateIdentityKey,
  isApplicationBlacklisted,
  matchesEffectiveStage,
  resolveEffectiveStage,
} = loadTypeScript(path.resolve(__dirname, "..", "lib", "blacklist.ts"));

const personApps = [
  {
    currentStage: "Screening",
    isBlacklisted: false,
    blacklistedAt: null,
  },
  {
    currentStage: "New",
    isBlacklisted: false,
    blacklistedAt: null,
  },
];
const blacklistRecord = {
  currentStage: "screening",
  isBlacklisted: false,
  blacklistedAt: new Date("2026-09-15T00:00:00.000Z"),
};
const activePersonApps = [blacklistRecord, personApps[1]];
const putuDedeGroupStage = resolveEffectiveStage(
  personApps[1].currentStage,
  activePersonApps,
);
assert.equal(putuDedeGroupStage, "Blacklisted");
assert.equal(
  resolveEffectiveStage(personApps[0].currentStage, activePersonApps),
  "Blacklisted",
);
assert.equal(isApplicationBlacklisted(blacklistRecord), true);
assert.equal(matchesEffectiveStage(putuDedeGroupStage, "All"), true);
assert.equal(matchesEffectiveStage(putuDedeGroupStage, "Blacklisted"), true);
assert.equal(matchesEffectiveStage(putuDedeGroupStage, "New"), false);
assert.equal(matchesEffectiveStage(putuDedeGroupStage, "Screening"), false);
console.log(
  "PASS: I PUTU DEDE LUCKY NEGARA's Screening + New applications both resolve to Blacklisted",
);

const regularApplications = [
  { currentStage: "Screening", isBlacklisted: false, blacklistedAt: null },
  { currentStage: "New", isBlacklisted: false, blacklistedAt: null },
];
assert.equal(
  resolveEffectiveStage("New", regularApplications),
  "New",
);
assert.equal(
  resolveEffectiveStage("Screening", regularApplications),
  "Screening",
);
assert.equal(matchesEffectiveStage("New", "New"), true);
assert.equal(matchesEffectiveStage("Screening", "Screening"), true);
assert.equal(matchesEffectiveStage("New", "All"), true);
console.log(
  "PASS: non-blacklisted mixed-stage applications retain their own effective stages",
);

assert.equal(
  candidateIdentityKey({
    id: "u1",
    email: " DEDENEGARA370@GMAIL.COM ",
    phone: null,
  }),
  candidateIdentityKey({
    id: "u2",
    email: "dedenegara370@gmail.com",
    phone: "0812",
  }),
);
console.log("PASS: normalized email maps matching User rows to one person identity");
