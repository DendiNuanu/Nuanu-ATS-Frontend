/**
 * delete-vacancies.js
 *
 * Deletes vacancies (jobs) and ALL their related data from the database.
 *
 * Usage:
 *   npx tsx scripts/delete-vacancies.js --codes="CODE1,CODE2"           # DRY RUN
 *   npx tsx scripts/delete-vacancies.js --codes="CODE1,CODE2" --apply    # EXECUTE
 *   npx tsx scripts/delete-vacancies.js --titles="General Application,Dendy Test" --apply
 *
 * Deletion order (child → parent) to respect foreign key constraints:
 *   1. ReferenceCheckShare (by application → vacancyId)
 *   2. ReferenceCheck (by application → vacancyId)
 *   3. InterviewFeedback (by interview → application → vacancyId)
 *   4. Interview (by application → vacancyId)
 *   5. AssessmentLink (by assessment → application → vacancyId)
 *   6. Assessment (by application → vacancyId)
 *   7. CandidateScore (by application → vacancyId)
 *   8. PipelineStage (by application → vacancyId)
 *   9. ApplicationCustomField (by application → vacancyId)
 *  10. Document (by application → vacancyId)
 *  11. CandidateNote (by application → vacancyId)
 *  12. InterviewComment (by application → vacancyId)
 *  13. Offer → Contract (by application → vacancyId)
 *  14. Application (by vacancyId)
 *  15. JobPosting (by vacancyId)
 *  16. Approval (by vacancyId, via JobRequisition)
 *  17. JobRequisition (by vacancyId)
 *  18. LegacyApproval (by vacancyId)
 *  19. Vacancy (the job itself)
 *
 * NOTE: Candidates (Users) are NOT deleted — only their applications to these
 * vacancies. The candidates remain in the system for other vacancies.
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const codesArg = args.find((a) => a.startsWith("--codes="));
  const titlesArg = args.find((a) => a.startsWith("--titles="));

  let where = {};
  if (codesArg) {
    const codes = codesArg
      .replace("--codes=", "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    where = { code: { in: codes } };
  } else if (titlesArg) {
    const titles = titlesArg
      .replace("--titles=", "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    where = { title: { in: titles } };
  } else {
    console.error("Usage: npx tsx scripts/delete-vacancies.js --codes='CODE1,CODE2' [--apply]");
    console.error("       npx tsx scripts/delete-vacancies.js --titles='Title1,Title2' [--apply]");
    process.exit(1);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  DELETE VACANCIES — ${apply ? "APPLY MODE" : "DRY RUN"}`);
  console.log(`${"=".repeat(70)}`);

  // 1. Find vacancies
  const vacancies = await prisma.vacancy.findMany({
    where,
    select: {
      id: true,
      title: true,
      code: true,
      status: true,
      department: { select: { name: true } },
      createdAt: true,
    },
  });

  if (vacancies.length === 0) {
    console.log("  No vacancies found matching the criteria. Exiting.");
    return;
  }

  console.log(`\n  Found ${vacancies.length} vacancy(s):\n`);
  for (const v of vacancies) {
    console.log(`  • ${v.title} (code: ${v.code}) — ${v.status} — Dept: ${v.department?.name ?? "—"} — ID: ${v.id}`);
  }
  console.log("");

  const vacancyIds = vacancies.map((v) => v.id);

  // 2. Find all applications for these vacancies
  const applications = await prisma.application.findMany({
    where: { vacancyId: { in: vacancyIds } },
    select: { id: true, candidateId: true, vacancyId: true },
  });
  const applicationIds = applications.map((a) => a.id);

  console.log(`  Found ${applications.length} application(s) for these vacancies.\n`);

  // 3. Count all related records
  const counts = {
    referenceCheckShares: applicationIds.length
      ? await prisma.referenceCheckShare.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    // NOTE: ReferenceCheck.candidateId references Application.id (the field is
    // named `candidateId` in the schema, but it points at the Application row).
    referenceChecks: applicationIds.length
      ? await prisma.referenceCheck.count({ where: { candidateId: { in: applicationIds } } })
      : 0,
    interviews: applicationIds.length
      ? await prisma.interview.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    assessments: applicationIds.length
      ? await prisma.assessment.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    candidateScores: applicationIds.length
      ? await prisma.candidateScore.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    pipelineStages: applicationIds.length
      ? await prisma.pipelineStage.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    applicationCustomFields: applicationIds.length
      ? await prisma.applicationCustomField.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    documents: applicationIds.length
      ? await prisma.document.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    candidateNotes: applicationIds.length
      ? await prisma.candidateNote.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    interviewComments: applicationIds.length
      ? await prisma.interviewComment.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    offers: applicationIds.length
      ? await prisma.offer.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    applications: applications.length,
    jobPostings: await prisma.jobPosting.count({ where: { vacancyId: { in: vacancyIds } } }),
    jobRequisitions: await prisma.jobRequisition.count({ where: { vacancyId: { in: vacancyIds } } }),
    legacyApprovals: await prisma.legacyApproval.count({ where: { vacancyId: { in: vacancyIds } } }),
  };

  console.log("  Records to be deleted:\n");
  console.log("  Related to Applications:");
  console.log(`    • ReferenceCheckShares : ${counts.referenceCheckShares}`);
  console.log(`    • ReferenceChecks      : ${counts.referenceChecks}`);
  console.log(`    • Interviews           : ${counts.interviews}`);
  console.log(`    • Assessments          : ${counts.assessments}`);
  console.log(`    • CandidateScores      : ${counts.candidateScores}`);
  console.log(`    • PipelineStages       : ${counts.pipelineStages}`);
  console.log(`    • ApplicationCustomFields: ${counts.applicationCustomFields}`);
  console.log(`    • Documents            : ${counts.documents}`);
  console.log(`    • CandidateNotes       : ${counts.candidateNotes}`);
  console.log(`    • InterviewComments    : ${counts.interviewComments}`);
  console.log(`    • Offers               : ${counts.offers}`);
  console.log(`    • Applications         : ${counts.applications}`);
  console.log("\n  Related to Vacancies:");
  console.log(`    • JobPostings          : ${counts.jobPostings}`);
  console.log(`    • JobRequisitions      : ${counts.jobRequisitions}`);
  console.log(`    • LegacyApprovals      : ${counts.legacyApprovals}`);
  console.log(`    • Vacancies            : ${vacancies.length}`);
  console.log("");

  if (!apply) {
    console.log("  DRY RUN — no records deleted. Run with --apply to execute.\n");
    await prisma.$disconnect();
    return;
  }

  // 4. Execute deletion in a transaction
  console.log("  APPLY MODE — deleting records...\n");

  await prisma.$transaction(async (tx) => {
    // Application-level children
    if (applicationIds.length) {
      await tx.referenceCheckShare.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.referenceCheckShares} ReferenceCheckShare(s)`);
      await tx.referenceCheck.deleteMany({ where: { candidateId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.referenceChecks} ReferenceCheck(s)`);

      // Interview feedbacks (via interview)
      const interviews = await tx.interview.findMany({
        where: { applicationId: { in: applicationIds } },
        select: { id: true },
      });
      if (interviews.length) {
        await tx.interviewFeedback.deleteMany({ where: { interviewId: { in: interviews.map((i) => i.id) } } });
      }
      await tx.interview.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.interviews} Interview(s)`);

      // Assessment links (via assessment)
      const assessments = await tx.assessment.findMany({
        where: { applicationId: { in: applicationIds } },
        select: { id: true },
      });
      if (assessments.length) {
        await tx.assessmentLink.deleteMany({ where: { assessmentId: { in: assessments.map((a) => a.id) } } });
      }
      await tx.assessment.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.assessments} Assessment(s)`);

      await tx.candidateScore.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.candidateScores} CandidateScore(s)`);
      await tx.pipelineStage.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.pipelineStages} PipelineStage(s)`);
      await tx.applicationCustomField.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.applicationCustomFields} ApplicationCustomField(s)`);
      await tx.document.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.documents} Document(s)`);
      await tx.candidateNote.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.candidateNotes} CandidateNote(s)`);
      await tx.interviewComment.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.interviewComments} InterviewComment(s)`);

      // Offers → Contracts
      const offers = await tx.offer.findMany({
        where: { applicationId: { in: applicationIds } },
        select: { id: true },
      });
      if (offers.length) {
        await tx.contract.deleteMany({ where: { offerId: { in: offers.map((o) => o.id) } } });
      }
      await tx.offer.deleteMany({ where: { applicationId: { in: applicationIds } } });
      console.log(`  ✓ Deleted ${counts.offers} Offer(s)`);

      // Applications
      await tx.application.deleteMany({ where: { vacancyId: { in: vacancyIds } } });
      console.log(`  ✓ Deleted ${counts.applications} Application(s)`);
    }

    // Vacancy-level children
    await tx.jobPosting.deleteMany({ where: { vacancyId: { in: vacancyIds } } });
    console.log(`  ✓ Deleted ${counts.jobPostings} JobPosting(s)`);

    // Approvals (via JobRequisition)
    const requisitions = await tx.jobRequisition.findMany({
      where: { vacancyId: { in: vacancyIds } },
      select: { id: true },
    });
    if (requisitions.length) {
      await tx.approval.deleteMany({ where: { requisitionId: { in: requisitions.map((r) => r.id) } } });
    }
    await tx.jobRequisition.deleteMany({ where: { vacancyId: { in: vacancyIds } } });
    console.log(`  ✓ Deleted ${counts.jobRequisitions} JobRequisition(s)`);

    await tx.legacyApproval.deleteMany({ where: { vacancyId: { in: vacancyIds } } });
    console.log(`  ✓ Deleted ${counts.legacyApprovals} LegacyApproval(s)`);

    // Vacancies
    await tx.vacancy.deleteMany({ where: { id: { in: vacancyIds } } });
    console.log(`  ✓ Deleted ${vacancies.length} Vacancy(s)`);
  });

  console.log("\n✅ All records deleted successfully in a single transaction.\n");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
