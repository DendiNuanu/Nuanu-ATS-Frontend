/**
 * delete-candidates.js
 *
 * Deletes candidates (Users) and ALL their related data from the database.
 *
 * Usage:
 *   npx tsx scripts/delete-candidates.js                  # DRY RUN (shows what will be deleted)
 *   npx tsx scripts/delete-candidates.js --apply           # EXECUTE deletion
 *   npx tsx scripts/delete-candidates.js --apply --emails "a@b.com,c@d.com"
 *
 * If --emails is omitted, uses the default list below.
 *
 * Deletion order (child → parent) to respect foreign key constraints:
 *   1. ReferenceCheckShare (by applicationId)
 *   2. ReferenceCheck (by candidateId/applicationId)
 *   3. InterviewFeedback (by interview → applicationId)
 *   4. Interview (by applicationId)
 *   5. AssessmentLink (by assessment → applicationId)
 *   6. Assessment (by applicationId)
 *   7. CandidateScore (by applicationId)
 *   8. PipelineStage (by applicationId)
 *   9. ApplicationCustomField (by applicationId)
 *  10. Document (by applicationId)
 *  11. CandidateNote (by applicationId)
 *  12. InterviewComment (by applicationId)
 *  13. Offer → Contract (by applicationId)
 *  14. Application (by candidateId = userId)
 *  15. CandidateProfile (by userId)
 *  16. Notification (by userId)
 *  17. ActivityLog (by userId)
 *  18. CalendarIntegration (by userId)
 *  19. PasswordResetToken (by userId)
 *  20. UserRole (by userId)
 *  21. User (the candidate itself)
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Default emails to delete (from user request)
const DEFAULT_EMAILS = [
  "haldapurwinarto@gmail.com",
  "eimifukadaa.98@gmail.com",
  "dendi@nuanu.com",
  "visualdendy@gmail.com",
  "dendimf2018@gmail.com",
];

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const emailsArg = args.find((a) => a.startsWith("--emails="));
  const emails = emailsArg
    ? emailsArg.replace("--emails=", "").split(",").map((e) => e.trim())
    : DEFAULT_EMAILS;

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  DELETE CANDIDATES — ${apply ? "APPLY MODE" : "DRY RUN"}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  Emails: ${emails.join(", ")}`);
  console.log(`${"=".repeat(70)}\n`);

  // 1. Find users by email
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  if (users.length === 0) {
    console.log("No users found with those emails. Exiting.");
    return;
  }

  console.log(`Found ${users.length} user(s):\n`);
  for (const u of users) {
    console.log(`  • ${u.name} (${u.email}) — ID: ${u.id}`);
  }
  console.log("");

  const userIds = users.map((u) => u.id);

  // 2. Find all applications for these users
  const applications = await prisma.application.findMany({
    where: { candidateId: { in: userIds } },
    select: { id: true, candidateId: true, vacancyId: true, currentStage: true, source: true },
  });

  const applicationIds = applications.map((a) => a.id);
  console.log(`Found ${applications.length} application(s) for these users.\n`);

  // 3. Count all related records
  const counts = {
    referenceCheckShares: applicationIds.length
      ? await prisma.referenceCheckShare.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
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
    candidateProfiles: await prisma.candidateProfile.count({
      where: { userId: { in: userIds } },
    }),
    notifications: await prisma.notification.count({
      where: { userId: { in: userIds } },
    }),
    activityLogs: await prisma.activityLog.count({
      where: { userId: { in: userIds } },
    }),
    calendarIntegrations: await prisma.calendarIntegration.count({
      where: { userId: { in: userIds } },
    }),
    passwordResetTokens: await prisma.passwordResetToken.count({
      where: { userId: { in: userIds } },
    }),
    userRoles: await prisma.userRole.count({
      where: { userId: { in: userIds } },
    }),
  };

  console.log("Records to be deleted:\n");
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
  console.log("\n  Related to Users:");
  console.log(`    • CandidateProfiles    : ${counts.candidateProfiles}`);
  console.log(`    • Notifications        : ${counts.notifications}`);
  console.log(`    • ActivityLogs         : ${counts.activityLogs}`);
  console.log(`    • CalendarIntegrations : ${counts.calendarIntegrations}`);
  console.log(`    • PasswordResetTokens  : ${counts.passwordResetTokens}`);
  console.log(`    • UserRoles            : ${counts.userRoles}`);
  console.log(`    • Users                : ${users.length}`);
  console.log("");

  if (!apply) {
    console.log("DRY RUN — no records were deleted.");
    console.log('To execute, run with: --apply');
    return;
  }

  // ── EXECUTE DELETION ──
  console.log("APPLY MODE — deleting records...\n");

  // Delete in dependency order inside a transaction
  await prisma.$transaction(async (tx) => {
    // 1. ReferenceCheckShare
    if (applicationIds.length) {
      const r = await tx.referenceCheckShare.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} ReferenceCheckShare(s)`);
    }

    // 2. ReferenceCheck
    if (applicationIds.length) {
      const r = await tx.referenceCheck.deleteMany({
        where: { candidateId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} ReferenceCheck(s)`);
    }

    // 3. InterviewFeedback (via Interview)
    if (applicationIds.length) {
      const interviews = await tx.interview.findMany({
        where: { applicationId: { in: applicationIds } },
        select: { id: true },
      });
      const interviewIds = interviews.map((i) => i.id);
      if (interviewIds.length) {
        const r = await tx.interviewFeedback.deleteMany({
          where: { interviewId: { in: interviewIds } },
        });
        console.log(`  ✓ Deleted ${r.count} InterviewFeedback(s)`);
      }
    }

    // 4. Interview
    if (applicationIds.length) {
      const r = await tx.interview.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Interview(s)`);
    }

    // 5. AssessmentLink (via Assessment)
    if (applicationIds.length) {
      const assessments = await tx.assessment.findMany({
        where: { applicationId: { in: applicationIds } },
        select: { id: true },
      });
      const assessmentIds = assessments.map((a) => a.id);
      if (assessmentIds.length) {
        const r = await tx.assessmentLink.deleteMany({
          where: { assessmentId: { in: assessmentIds } },
        });
        console.log(`  ✓ Deleted ${r.count} AssessmentLink(s)`);
      }
    }

    // 6. Assessment
    if (applicationIds.length) {
      const r = await tx.assessment.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Assessment(s)`);
    }

    // 7. CandidateScore
    if (applicationIds.length) {
      const r = await tx.candidateScore.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} CandidateScore(s)`);
    }

    // 8. PipelineStage
    if (applicationIds.length) {
      const r = await tx.pipelineStage.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} PipelineStage(s)`);
    }

    // 9. ApplicationCustomField
    if (applicationIds.length) {
      const r = await tx.applicationCustomField.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} ApplicationCustomField(s)`);
    }

    // 10. Document
    if (applicationIds.length) {
      const r = await tx.document.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Document(s)`);
    }

    // 11. CandidateNote
    if (applicationIds.length) {
      const r = await tx.candidateNote.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} CandidateNote(s)`);
    }

    // 12. InterviewComment
    if (applicationIds.length) {
      const r = await tx.interviewComment.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} InterviewComment(s)`);
    }

    // 13. Contract (via Offer) then Offer
    if (applicationIds.length) {
      const offers = await tx.offer.findMany({
        where: { applicationId: { in: applicationIds } },
        select: { id: true },
      });
      const offerIds = offers.map((o) => o.id);
      if (offerIds.length) {
        const r = await tx.contract.deleteMany({
          where: { offerId: { in: offerIds } },
        });
        console.log(`  ✓ Deleted ${r.count} Contract(s)`);
      }
      const r2 = await tx.offer.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r2.count} Offer(s)`);
    }

    // 14. Application
    if (applicationIds.length) {
      const r = await tx.application.deleteMany({
        where: { candidateId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Application(s)`);
    }

    // 15. CandidateProfile
    {
      const r = await tx.candidateProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} CandidateProfile(s)`);
    }

    // 16. Notification
    {
      const r = await tx.notification.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Notification(s)`);
    }

    // 17. ActivityLog
    {
      const r = await tx.activityLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} ActivityLog(s)`);
    }

    // 18. CalendarIntegration
    {
      const r = await tx.calendarIntegration.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} CalendarIntegration(s)`);
    }

    // 19. PasswordResetToken
    {
      const r = await tx.passwordResetToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} PasswordResetToken(s)`);
    }

    // 20. UserRole
    {
      const r = await tx.userRole.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} UserRole(s)`);
    }

    // 21. User (the candidate itself)
    {
      const r = await tx.user.deleteMany({
        where: { id: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} User(s)`);
    }
  });

  console.log("\n✅ All records deleted successfully in a single transaction.\n");
}

main()
  .catch((e) => {
    console.error("\n❌ ERROR:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
