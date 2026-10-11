const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScript(filePath, dependencies = {}) {
  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) =>
    Object.prototype.hasOwnProperty.call(dependencies, specifier)
      ? dependencies[specifier]
      : require(specifier);

  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const calls = { upsert: null };
  const eventTypes = loadTypeScript(
    path.join(root, "lib", "timeline-events.ts"),
  );
  const prisma = {
    application: {
      findUnique: async () => ({
        candidateId: "candidate-1",
        appliedAt: new Date("2025-01-01T00:00:00.000Z"),
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        blacklistedAt: null,
        candidateScore: null,
        pipelineStages: [],
      }),
    },
    candidateProfile: { findUnique: async () => null },
    user: { findFirst: async () => ({ id: "user-1" }) },
    timelineEventOverride: {
      upsert: async ({ create, where }) => {
        calls.upsert = { create, where };
        return {
          id: "override-1",
          ...create,
        };
      },
    },
  };
  const route = loadTypeScript(
    path.join(root, "app", "api", "candidates", "[id]", "timeline-events", "route.ts"),
    {
      "next/server": {
        NextResponse: {
          json: (body, options = {}) => ({
            status: options.status ?? 200,
            body,
          }),
        },
      },
      "@/lib/prisma": { prisma },
      "next/cache": { revalidatePath: () => {} },
      "@/lib/timeline-events": eventTypes,
    },
  );

  const request = (body) => ({ json: async () => body });
  const context = { params: { id: "application-1" } };

  const invalidType = await route.PATCH(
    request({
      eventType: "rejection_email",
      eventKey: "rejection_email",
      displayAt: null,
    }),
    context,
  );
  assert.equal(invalidType.status, 400);

  const futureDate = await route.PATCH(
    request({
      eventType: "application_received",
      eventKey: "application_received",
      displayAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }),
    context,
  );
  assert.equal(futureDate.status, 400);

  const reset = await route.PATCH(
    request({
      eventType: "application_received",
      eventKey: "application_received",
      displayAt: null,
      authorEmail: "staff@example.com",
    }),
    context,
  );
  assert.equal(reset.status, 200);
  assert.equal(calls.upsert.create.displayAt, null);
  assert.equal(calls.upsert.create.updatedById, "user-1");
  assert.equal(
    reset.body.override.key,
    "application_received:application_received",
  );

  console.log("PASS: unsupported event types return HTTP 400");
  console.log("PASS: dates more than 5 minutes ahead return HTTP 400");
  console.log("PASS: null resets the override and stores the actor ID");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
