import { findSeekLinkWarnings } from "../lib/seek-link-monitor";
import { prisma } from "../lib/prisma";

async function main() {
  const warnings = await findSeekLinkWarnings();
  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        warningCount: warnings.length,
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
