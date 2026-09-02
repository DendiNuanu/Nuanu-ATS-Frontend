/**
 * delete-candidates.js
 *
 * Deletes candidates (Users) and ALL their related data from the database.
 *
 * Usage:
 *   node scripts/delete-candidates.js                            # DRY RUN (shows what will be deleted)
 *   node scripts/delete-candidates.js --apply                   # EXECUTE deletion
 *   node scripts/delete-candidates.js --apply --emails="a@b.com,c@d.com"
 *   node scripts/delete-candidates.js --apply --force           # skip cross-reference guard
 *
 * If --emails is omitted, uses the default list below.
 *
 * SAFETY: the script first checks whether the user is referenced by records
 * that do NOT belong to them (e.g. as interviewer, reviewer, note author,
 * employee verifier). If any such cross-references exist, it ABORTS unless
 * --force is passed. This prevents accidentally deleting HR staff or
 * breaking FK constraints.
 *
 * Deletion order (child → parent) to respect foreign key constraints:
 *   Application children:
 *     1. InterviewTranscript        (by applicationId)
 *     2. InterviewLink              (by applicationId)
 *     3. RejectionEmailJob          (by applicationId)
 *     4. CandidatePositionSlot      (by applicationId)
 *     5. ReferenceCheckShare        (by applicationId)
 *     6. ReferenceCheck             (by candidateId = applicationId)
 *     7. InterviewFeedback          (via interview → applicationId)
 *     8. Interview                  (by applicationId)
 *     9. AssessmentLink             (via assessment → applicationId)
 *    10. Assessment                 (by applicationId)
 *    11. CandidateScore             (by applicationId)
 *    12. PipelineStage              (by applicationId)
 *    13. ApplicationCustomField     (by applicationId)
 *    14. Document                   (by applicationId)
 *    15. CandidateNote              (by applicationId)
 *    16. InterviewComment           (by applicationId)
 *    17. Contract → Offer           (by applicationId)
 *    18. Application                (by candidateId = userId)
 *   Employee chain (only if the candidate was hired):
 *    19. ProbationEvaluation/Extension → ProbationRecord
 *    20. MemoHire, EmployeeDocument, EmployeeAsset, EmployeeContract, Onboarding
 *    21. Employee                   (by userId)
 *   User children:
 *    22. OnboardingTask             (by employeeId = userId)
 *    23. CandidateProfile           (by userId)
 *    24. Notification               (by userId)
 *    25. NotificationPreferences    (by userId)
 *    26. ActivityLog                (by userId)
 *    27. CalendarIntegration        (by userId)
 *    28. PasswordResetToken         (by userId)
 *    29. UserRole                   (by userId)
 *    30. User                       (the candidate itself)
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Default emails to delete (from user request)
const DEFAULT_EMAILS = [
  "radinanyudistira@gmail.com",
];

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const force = args.includes("--force");
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

  // 3. Cross-reference guard — is this user referenced by records NOT being deleted?
  const crossRefs = {
    asHrReviewer: await prisma.application.count({
      where: { hrReviewerId: { in: userIds }, candidateId: { notIn: userIds } },
    }),
    asUser1Reviewer: await prisma.application.count({
      where: { user1ReviewerId: { in: userIds }, candidateId: { notIn: userIds } },
    }),
    asUser2Reviewer: await prisma.application.count({
      where: { user2ReviewerId: { in: userIds }, candidateId: { notIn: userIds } },
    }),
    asInterviewer: await prisma.interview.count({
      where: { interviewerId: { in: userIds }, applicationId: { notIn: applicationIds } },
    }),
    asFeedbackInterviewer: await prisma.interviewFeedback.count({
      where: { interviewerId: { in: userIds } },
    }),
    asNoteAuthor: await prisma.candidateNote.count({
      where: { authorId: { in: userIds }, applicationId: { notIn: applicationIds } },
    }),
    asCommentAuthor: await prisma.interviewComment.count({
      where: { authorId: { in: userIds }, applicationId: { notIn: applicationIds } },
    }),
    asInterviewLinkReviewer: await prisma.interviewLink.count({
      where: { reviewerId: { in: userIds }, applicationId: { notIn: applicationIds } },
    }),
    asVacancyCreator: await prisma.vacancy.count({
      where: { creatorId: { in: userIds } },
    }),
    asVacancyRecruiter: await prisma.vacancy.count({
      where: { recruiterId: { in: userIds } },
    }),
    asRefCheckConductor: await prisma.referenceCheck.count({
      where: { conductedBy: { in: userIds }, candidateId: { notIn: applicationIds } },
    }),
    asRefCheckSharedWith: await prisma.referenceCheckShare.count({
      where: { sharedWithId: { in: userIds }, applicationId: { notIn: applicationIds } },
    }),
    asRefCheckSharedBy: await prisma.referenceCheckShare.count({
      where: { sharedById: { in: userIds }, applicationId: { notIn: applicationIds } },
    }),
    asLegacyApprover: await prisma.legacyApproval.count({
      where: { approverId: { in: userIds } },
    }),
    asLegacyRequester: await prisma.legacyApproval.count({
      where: { requesterId: { in: userIds } },
    }),
    asApprover: await prisma.approval.count({
      where: { approverId: { in: userIds } },
    }),
    asDocVerifier: await prisma.employeeDocument.count({
      where: { verifiedBy: { in: userIds } },
    }),
    asAssetAssigner: await prisma.employeeAsset.count({
      where: { assignedBy: { in: userIds } },
    }),
    asProbationExtender: await prisma.probationExtension.count({
      where: { extendedBy: { in: userIds } },
    }),
    asTranscriptCreator: await prisma.interviewTranscript.count({
      where: { createdById: { in: userIds }, applicationId: { notIn: applicationIds } },
    }),
  };

  const blockingRefs = Object.entries(crossRefs).filter(([, n]) => n > 0);
  if (blockingRefs.length > 0) {
    console.log("⚠️  CROSS-REFERENCE GUARD — this user is referenced by other records:");
    for (const [ref, n] of blockingRefs) {
      console.log(`    • ${ref}: ${n}`);
    }
    if (!force) {
      console.log("\n❌ ABORTED. These references would break FK constraints or remove");
      console.log("   data belonging to other records. Re-run with --force to delete anyway");
      console.log("   (the script will still fail if the DB enforces the FK).");
      return;
    }
    console.log("\n  --force passed — continuing anyway.\n");
  } else {
    console.log("Cross-reference guard: OK (no external references).\n");
  }

  // 4. Employee records (candidate was hired?)
  const employees = await prisma.employee.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, employeeCode: true, position: true, status: true },
  });
  if (employees.length > 0) {
    console.log("⚠️  EMPLOYEE RECORDS FOUND — this candidate was hired:");
    for (const e of employees) {
      console.log(`    • ${e.employeeCode} — ${e.position} (${e.status}) — ID: ${e.id}`);
    }
    if (!force) {
      console.log("\n❌ ABORTED. Deleting an Employee record removes employment history");
      console.log("   (contracts, memos, documents, assets, probation).");
      console.log("   Re-run with --force if you really want to delete the employee too.");
      return;
    }
    console.log("\n  --force passed — the employee chain will be deleted too.\n");
  }

  // 5. Count all related records
  const counts = {
    interviewTranscripts: applicationIds.length
      ? await prisma.interviewTranscript.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    interviewLinks: applicationIds.length
      ? await prisma.interviewLink.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    rejectionEmailJobs: applicationIds.length
      ? await prisma.rejectionEmailJob.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
    candidatePositionSlots: applicationIds.length
      ? await prisma.candidatePositionSlot.count({ where: { applicationId: { in: applicationIds } } })
      : 0,
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
    onboardingTasks: await prisma.onboardingTask.count({
      where: { employeeId: { in: userIds } },
    }),
    candidateProfiles: await prisma.candidateProfile.count({
      where: { userId: { in: userIds } },
    }),
    notifications: await prisma.notification.count({
      where: { userId: { in: userIds } },
    }),
    notificationPreferences: await prisma.notificationPreferences.count({
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
  console.log(`    • InterviewTranscripts  : ${counts.interviewTranscripts}`);
  console.log(`    • InterviewLinks        : ${counts.interviewLinks}`);
  console.log(`    • RejectionEmailJobs    : ${counts.rejectionEmailJobs}`);
  console.log(`    • CandidatePositionSlots: ${counts.candidatePositionSlots}`);
  console.log(`    • ReferenceCheckShares  : ${counts.referenceCheckShares}`);
  console.log(`    • ReferenceChecks       : ${counts.referenceChecks}`);
  console.log(`    • Interviews            : ${counts.interviews}`);
  console.log(`    • Assessments           : ${counts.assessments}`);
  console.log(`    • CandidateScores       : ${counts.candidateScores}`);
  console.log(`    • PipelineStages        : ${counts.pipelineStages}`);
  console.log(`    • ApplicationCustomFields: ${counts.applicationCustomFields}`);
  console.log(`    • Documents             : ${counts.documents}`);
  console.log(`    • CandidateNotes        : ${counts.candidateNotes}`);
  console.log(`    • InterviewComments     : ${counts.interviewComments}`);
  console.log(`    • Offers                : ${counts.offers}`);
  console.log(`    • Applications          : ${counts.applications}`);
  console.log("\n  Related to Users:");
  console.log(`    • OnboardingTasks       : ${counts.onboardingTasks}`);
  console.log(`    • CandidateProfiles     : ${counts.candidateProfiles}`);
  console.log(`    • Notifications         : ${counts.notifications}`);
  console.log(`    • NotificationPreferences: ${counts.notificationPreferences}`);
  console.log(`    • ActivityLogs          : ${counts.activityLogs}`);
  console.log(`    • CalendarIntegrations  : ${counts.calendarIntegrations}`);
  console.log(`    • PasswordResetTokens   : ${counts.passwordResetTokens}`);
  console.log(`    • UserRoles             : ${counts.userRoles}`);
  if (employees.length > 0) {
    console.log(`    • Employees (+ chain)   : ${employees.length}`);
  }
  console.log(`    • Users                 : ${users.length}`);
  console.log("");

  if (!apply) {
    console.log("DRY RUN — no records were deleted.");
    console.log("To execute, run with: --apply");
    return;
  }

  // ── EXECUTE DELETION ──
  console.log("APPLY MODE — deleting records...\n");

  // Delete in dependency order inside a transaction
  await prisma.$transaction(async (tx) => {
    // 1. InterviewTranscript
    if (applicationIds.length) {
      const r = await tx.interviewTranscript.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} InterviewTranscript(s)`);
    }

    // 2. InterviewLink
    if (applicationIds.length) {
      const r = await tx.interviewLink.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} InterviewLink(s)`);
    }

    // 3. RejectionEmailJob
    if (applicationIds.length) {
      const r = await tx.rejectionEmailJob.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} RejectionEmailJob(s)`);
    }

    // 4. CandidatePositionSlot
    if (applicationIds.length) {
      const r = await tx.candidatePositionSlot.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} CandidatePositionSlot(s)`);
    }

    // 5. ReferenceCheckShare
    if (applicationIds.length) {
      const r = await tx.referenceCheckShare.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} ReferenceCheckShare(s)`);
    }

    // 6. ReferenceCheck
    if (applicationIds.length) {
      const r = await tx.referenceCheck.deleteMany({
        where: { candidateId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} ReferenceCheck(s)`);
    }

    // 7. InterviewFeedback (via Interview)
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

    // 8. Interview
    if (applicationIds.length) {
      const r = await tx.interview.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Interview(s)`);
    }

    // 9. AssessmentLink (via Assessment)
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

    // 10. Assessment
    if (applicationIds.length) {
      const r = await tx.assessment.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Assessment(s)`);
    }

    // 11. CandidateScore
    if (applicationIds.length) {
      const r = await tx.candidateScore.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} CandidateScore(s)`);
    }

    // 12. PipelineStage
    if (applicationIds.length) {
      const r = await tx.pipelineStage.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} PipelineStage(s)`);
    }

    // 13. ApplicationCustomField
    if (applicationIds.length) {
      const r = await tx.applicationCustomField.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} ApplicationCustomField(s)`);
    }

    // 14. Document
    if (applicationIds.length) {
      const r = await tx.document.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Document(s)`);
    }

    // 15. CandidateNote
    if (applicationIds.length) {
      const r = await tx.candidateNote.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} CandidateNote(s)`);
    }

    // 16. InterviewComment
    if (applicationIds.length) {
      const r = await tx.interviewComment.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      console.log(`  ✓ Deleted ${r.count} InterviewComment(s)`);
    }

    // 17. Contract (via Offer) then Offer
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

    // 18. Application
    if (applicationIds.length) {
      const r = await tx.application.deleteMany({
        where: { candidateId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Application(s)`);
    }

    // 19-21. Employee chain (only if the candidate has an Employee record)
    if (employees.length > 0) {
      const employeeIds = employees.map((e) => e.id);

      // Probation children first
      const probationRecords = await tx.probationRecord.findMany({
        where: { employeeId: { in: employeeIds } },
        select: { id: true },
      });
      const probationRecordIds = probationRecords.map((p) => p.id);
      if (probationRecordIds.length) {
        const re = await tx.probationEvaluation.deleteMany({
          where: { probationRecordId: { in: probationRecordIds } },
        });
        console.log(`  ✓ Deleted ${re.count} ProbationEvaluation(s)`);
        const rx = await tx.probationExtension.deleteMany({
          where: { probationRecordId: { in: probationRecordIds } },
        });
        console.log(`  ✓ Deleted ${rx.count} ProbationExtension(s)`);
        const rp = await tx.probationRecord.deleteMany({
          where: { id: { in: probationRecordIds } },
        });
        console.log(`  ✓ Deleted ${rp.count} ProbationRecord(s)`);
      }

      const rm = await tx.memoHire.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      console.log(`  ✓ Deleted ${rm.count} MemoHire(s)`);

      const rd = await tx.employeeDocument.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      console.log(`  ✓ Deleted ${rd.count} EmployeeDocument(s)`);

      const ra = await tx.employeeAsset.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      console.log(`  ✓ Deleted ${ra.count} EmployeeAsset(s)`);

      const rc = await tx.employeeContract.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      console.log(`  ✓ Deleted ${rc.count} EmployeeContract(s)`);

      const ro = await tx.onboarding.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      console.log(`  ✓ Deleted ${ro.count} Onboarding(s)`);

      const remp = await tx.employee.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${remp.count} Employee(s)`);
    }

    // 22. OnboardingTask
    {
      const r = await tx.onboardingTask.deleteMany({
        where: { employeeId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} OnboardingTask(s)`);
    }

    // 23. CandidateProfile
    {
      const r = await tx.candidateProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} CandidateProfile(s)`);
    }

    // 24. Notification
    {
      const r = await tx.notification.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} Notification(s)`);
    }

    // 25. NotificationPreferences
    {
      const r = await tx.notificationPreferences.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} NotificationPreferences(s)`);
    }

    // 26. ActivityLog
    {
      const r = await tx.activityLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} ActivityLog(s)`);
    }

    // 27. CalendarIntegration
    {
      const r = await tx.calendarIntegration.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} CalendarIntegration(s)`);
    }

    // 28. PasswordResetToken
    {
      const r = await tx.passwordResetToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} PasswordResetToken(s)`);
    }

    // 29. UserRole
    {
      const r = await tx.userRole.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  ✓ Deleted ${r.count} UserRole(s)`);
    }

    // 30. User (the candidate itself)
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
