import { PrismaClient } from "@prisma/client";
import {
  candidateIdentityKey,
  isApplicationBlacklisted,
} from "../lib/blacklist";

const prisma = new PrismaClient();
const protectedStages = new Set(["hired", "onboarding"]);

function parseMode(args: string[]): "dry-run" | "apply" {
  if (args.length > 1 || (args.length === 1 && !["--dry-run", "--apply"].includes(args[0]))) {
    throw new Error("Usage: npx tsx scripts/propagate-blacklist.ts [--dry-run|--apply]");
  }
  return args[0] === "--apply" ? "apply" : "dry-run";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Makassar",
  }).format(date);
}

function autoReason(
  source: {
    blacklistedAt: Date | null;
    appliedAt: Date;
    position: string;
    blacklistReason: string | null;
  },
): string {
  return `Auto: kandidat sudah di-blacklist pada ${formatDate(
    source.blacklistedAt ?? source.appliedAt,
  )} (posisi ${source.position}): ${
    source.blacklistReason || "alasan tidak tercatat"
  }`;
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const applications = await prisma.application.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      candidateId: true,
      currentStage: true,
      isBlacklisted: true,
      blacklistedAt: true,
      blacklistReason: true,
      appliedAt: true,
      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          employeeRecord: { select: { id: true } },
        },
      },
      vacancy: { select: { title: true } },
      pipelineStages: {
        select: { stage: true, enteredAt: true },
        orderBy: { enteredAt: "desc" },
      },
    },
    orderBy: [{ appliedAt: "asc" }, { id: "asc" }],
  });

  const groups = new Map<string, typeof applications>();
  for (const application of applications) {
    const key = candidateIdentityKey(application.candidate);
    const group = groups.get(key) ?? [];
    group.push(application);
    groups.set(key, group);
  }

  const groupsToPropagate = Array.from(groups.values()).filter((group) =>
    group.some(isApplicationBlacklisted),
  );
  let changeCount = 0;
  let skippedCount = 0;

  console.log(`Mode: ${mode}`);
  console.log(`Blacklisted identity groups: ${groupsToPropagate.length}`);

  for (const group of groupsToPropagate) {
    const source = group
      .filter(isApplicationBlacklisted)
      .sort(
        (left, right) =>
          (right.blacklistedAt?.getTime() ?? right.appliedAt.getTime()) -
          (left.blacklistedAt?.getTime() ?? left.appliedAt.getTime()),
      )[0];
    const sourcePosition =
      source.vacancy.title || source.candidate.name || "Unknown position";
    const reason = autoReason({
      blacklistedAt: source.blacklistedAt,
      appliedAt: source.appliedAt,
      position: sourcePosition,
      blacklistReason: source.blacklistReason,
    });
    const targets = group.filter(
      (application) => !isApplicationBlacklisted(application),
    );
    const skipped = targets.filter(
      (application) =>
        protectedStages.has(application.currentStage.toLowerCase()) ||
        application.candidate.employeeRecord !== null,
    );
    const writable = targets.filter((application) => !skipped.includes(application));
    const identity = group[0].candidate;

    console.log(
      `\nPerson: ${identity.name} <${identity.email}> [${identity.id}]`,
    );
    console.log(
      `Blacklist source: ${source.vacancy.title} | ${formatDate(
        source.blacklistedAt ?? source.appliedAt,
      )} | ${source.blacklistReason || "no reason recorded"}`,
    );
    for (const application of writable) {
      const previousStage =
        application.pipelineStages.find(
          (stage) => stage.stage !== "blacklisted",
        )?.stage ?? application.currentStage;
      console.log(
        `  ${mode === "apply" ? "PROPAGATE" : "WOULD BLACKLIST"} ${application.id} | ${application.vacancy.title} | previous stage: ${previousStage}`,
      );
    }
    for (const application of skipped) {
      console.log(
        `  SKIP ${application.id} | ${application.vacancy.title} | protected stage/employee: ${application.currentStage}`,
      );
    }
    changeCount += writable.length;
    skippedCount += skipped.length;

    if (mode === "apply" && writable.length > 0) {
      const blacklistedAt = new Date();
      await prisma.$transaction(
        writable.map((application) =>
          prisma.application.updateMany({
            where: { id: application.id, deletedAt: null },
            data: {
              isBlacklisted: true,
              blacklistedAt,
              blacklistReason: reason,
              lastActivityAt: blacklistedAt,
            },
          }),
        ),
      );
    }
  }

  console.log(`\nApplications to change/changed: ${changeCount}`);
  console.log(`Protected applications skipped: ${skippedCount}`);
  console.log("Timeline entries are generated from the blacklist fields on each application.");
  if (mode === "dry-run") {
    console.log("No database writes were performed. Use --apply only after reviewing this report.");
  }
}

main()
  .catch((error) => {
    console.error("Blacklist propagation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
