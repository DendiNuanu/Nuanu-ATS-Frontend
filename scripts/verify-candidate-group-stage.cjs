const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourcePath = path.resolve(
  __dirname,
  "..",
  "lib",
  "candidate-group-stage.ts",
);
const source = fs.readFileSync(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const loadedModule = { exports: {} };
new Function("module", "exports", output)(loadedModule, loadedModule.exports);

const {
  matchesCandidateGroupStage,
  resolveCandidateGroupStage,
} = loadedModule.exports;

const putuDedeGroupStage = resolveCandidateGroupStage("New", true);
assert.equal(putuDedeGroupStage, "Blacklisted");
assert.equal(matchesCandidateGroupStage(putuDedeGroupStage, "All"), true);
assert.equal(matchesCandidateGroupStage(putuDedeGroupStage, "Blacklisted"), true);
assert.equal(matchesCandidateGroupStage(putuDedeGroupStage, "New"), false);
console.log(
  "PASS: I PUTU DEDE LUCKY NEGARA group with Blacklisted + New applications matches All/Blacklisted, not New",
);

const regularGroupStage = resolveCandidateGroupStage("Screening", false);
assert.equal(regularGroupStage, "Screening");
assert.equal(matchesCandidateGroupStage(regularGroupStage, "Screening"), true);
assert.equal(matchesCandidateGroupStage(regularGroupStage, "New"), false);
console.log(
  "PASS: non-blacklisted group with mixed application stages filters by representative stage",
);
