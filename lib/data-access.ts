import { prisma } from "@/lib/prisma";
import {
  formatDateTimeWita,
  formatDateTimeShortWita,
  formatDateWita,
  formatTimeWita,
} from "@/lib/format-wita";
import type {
  Candidate,
  Job,
  Employee,
  Stage,
  Source,
} from "@/lib/mock-data";
import {
  extractCareerHistory,
  extractEducation,
  extractLicencesCertifications,
  extractApplicationQuestions,
  extractSkills,
} from "@/lib/profile-data";

/**
 * Maps a snake_case stage from the database (e.g. "hr_interview")
 * to the Title Case stage the UI expects (e.g. "HR Interview").
 * Falls back to "New" if the stage is unknown.
 */
export function mapDbStageToUiStage(dbStage: string | null | undefined): Stage {
  if (!dbStage) return "New";
  const stageMap: Record<string, Stage> = {
    new: "New",
    talent_bank: "Talent Bank",
    screening: "Screening",
    hr_interview: "HR Interview",
    user_interview: "User Interview",
    assessment: "Assessment",
    user_interview_ii: "User Interview II",
    offering: "Offering",
    hired: "Hired",
    rejected: "Rejected",
    onboarding: "Onboarding",
  };
  return stageMap[dbStage] ?? "New";
}

/**
 * Maps a source string from the DB to the UI's Source type.
 */
export function mapSource(raw: string | null | undefined): Source {
  if (!raw) return "Direct";
  const lower = raw.toLowerCase();
  if (lower === "seek") return "SEEK";
  if (lower === "referral") return "Referral";
  if (lower === "linkedin") return "LinkedIn";
  if (lower === "direct") return "Direct";
  if (lower === "job fair") return "Job Fair";
  if (lower === "website") return "Website";
  return "Direct";
}

/**
 * Deterministic avatar color based on a name string.
 */
const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
];

export function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Formats a DateTime into "DD/MM/YYYY · HH:mm" for email timestamps.
 */
function formatEmailTimestamp(date: Date): string {
  // Format in WITA (Asia/Makassar, UTC+8) — the database stores UTC, but the
  // badge must display Bali/Central Indonesia time. Using the centralized
  // utility ensures the server (which may run in UTC) formats correctly.
  return formatDateTimeWita(date);
}

/**
 * Maps a DB email subject to the corresponding email template label.
 * Used to populate `lastEmailSent.type` for the general email badge.
 */
function emailSubjectToTemplateLabel(subject: string | null): string | null {
  if (!subject) return null;
  const lower = subject.toLowerCase();
  if (lower.includes("patience") && lower.includes("process")) return "Process Slow";
  if (lower.includes("thank you for applying")) return "Rejected";
  if (lower.includes("patience")) return "On Hold";
  if (lower.includes("not open") || lower.includes("interest in nuanu")) return "Not Open";
  if (lower.includes("fulfilled") || lower.includes("filled")) return "Been Fulfilled";
  return "Email";
}

/**
 * Returns true only when the email subject indicates a rejection email
 * (i.e. the "Rejected" template was used). All other email subjects
 * (Process Slow, On Hold, etc.) are general emails, NOT rejections.
 */
function isRejectionEmail(subject: string | null): boolean {
  if (!subject) return false;
  return subject.toLowerCase().includes("thank you for applying");
}

/**
 * Builds the `lastEmailSent` object from the application's email fields.
 * Returns null if no email was ever sent.
 */
function buildLastEmailSent(
  emailSentAt: Date | null,
  emailSentSubject: string | null,
): { type: string; sentAt: string } | null {
  if (!emailSentAt) return null;
  const type = emailSubjectToTemplateLabel(emailSentSubject) ?? "Email";
  return { type, sentAt: formatEmailTimestamp(emailSentAt) };
}

/**
 * Shape of a Prisma application row with the relations we need to map a
 * candidate. Kept loose (Record-based) so it works for both the list and
 * single-fetch queries without fighting Prisma's generated types.
 */
type ApplicationWithRelations = {
  id: string;
  source: string | null;
  currentStage: string | null;
  appliedFor: string | null;
  appliedAt: Date;
  emailSentAt: Date | null;
  emailSentSubject: string | null;
  isBlacklisted?: boolean;
  blacklistReason?: string | null;
  hrReviewerId?: string | null;
  user1ReviewerId?: string | null;
  user2ReviewerId?: string | null;
  departmentId?: string | null;
  candidate: { name: string; email: string; phone: string | null };
  vacancy: { title: string; code: string; department: { name: string } | null } | null;
  department?: { id: string; name: string } | null;
  candidateScore: {
    overallScore: number;
    hardSkillsScore: number;
    softSkillsScore: number;
    experienceScore: number;
    educationScore: number;
    formatScore: number;
    breakdown: unknown;
  } | null;
  notes?: {
    id: string;
    content: string;
    createdAt: Date;
    author: { name: string; email: string | null } | null;
  }[];
  hrReviewer?: { id: string; name: string; email: string } | null;
  user1Reviewer?: { id: string; name: string; email: string } | null;
  user2Reviewer?: { id: string; name: string; email: string } | null;
};

type CandidateProfileRow = {
  location: string | null;
  experienceYears: number;
  currentTitle: string | null;
  currentCompany: string | null;
  education: string | null;
  summary: string | null;
  skills: string[];
  resumeUrl: string | null;
  resumeText: string | null;
  linkedinUrl: string | null;
  expectedSalary: number | null;
  domicile: string | null;
  referPosition: string | null;
  gender: string | null;
  seekCareerHistory: unknown;
  seekEducation: unknown;
  seekLicencesAndCertifications: unknown;
  seekApplicationQuestions: unknown;
  seekSkills: unknown;
  parsedData: unknown;
  salaryExpectation: string | null;
  noticePeriod: string | null;
} | null;

/**
 * Maps a Prisma application row (+ optional candidate profile) to the UI
 * `Candidate` type. This is the single source of truth for the mapping — used
 * by `fetchCandidates`, `fetchCandidatesPaginated`, and `fetchCandidateById`
 * so they all produce identical field values.
 *
 * Notable behaviour:
 *  - "Refer As" mirrors "Applied For" (the position) unless the profile has
 *    an explicit `referPosition` override — matching the real production app.
 *  - Career history / education come from the real SEEK / parsed-CV JSON
 *    columns (empty array when none on file — never mock data).
 *  - AI match breakdown comes from `CandidateScore` when present.
 */
function mapApplicationToCandidate(
  app: ApplicationWithRelations,
  profile: CandidateProfileRow | undefined | null,
): Candidate {
  const user = app.candidate;
  const stage = mapDbStageToUiStage(app.currentStage);
  const position =
    app.vacancy?.title ?? app.appliedFor ?? profile?.currentTitle ?? "—";
  // Department resolution order:
  //   1. Application.department (manual override set via Edit page)
  //   2. Vacancy.department (normal case)
  //   3. "" (empty) for the General Application (custom position) vacancy —
  //      its department is an internal placeholder, not meaningful for the
  //      candidate's actual role.
  const isGeneralApplication = app.vacancy?.code === "GENERAL-APPLICATION";
  const department = app.department?.name
    ?? (isGeneralApplication ? "" : (app.vacancy?.department?.name ?? ""));

  // "Refer As" mirrors "Applied For" unless the profile has an explicit
  // `referPosition` override (the real schema field for this).
  const referAsValue =
    profile?.referPosition?.trim() ||
    app.appliedFor?.trim() ||
    app.vacancy?.title?.trim() ||
    "";

  const appliedForSlots = app.appliedFor
    ? [app.appliedFor]
    : position !== "—"
      ? [position]
      : [];
  const referAsSlots = referAsValue ? [referAsValue] : [];

  // Real career history / education from SEEK or parsed-CV JSON columns.
  const careerHistory = extractCareerHistory(
    profile?.seekCareerHistory,
    profile?.parsedData,
  );
  const educationEntries = extractEducation(
    profile?.seekEducation,
    profile?.parsedData,
  );
  const licencesCertifications = extractLicencesCertifications(
    profile?.seekLicencesAndCertifications,
    profile?.parsedData,
  );
  const applicationQuestions = extractApplicationQuestions(
    profile?.seekApplicationQuestions,
    profile?.parsedData,
  );
  const skills = extractSkills(
    profile?.seekSkills,
    profile?.skills,
    profile?.parsedData,
  );
  // Languages live inside parsedData (AI parser output).
  const languages = (() => {
    const pd = profile?.parsedData;
    if (
      pd &&
      typeof pd === "object" &&
      !Array.isArray(pd) &&
      Array.isArray((pd as Record<string, unknown>).languages)
    ) {
      return ((pd as Record<string, unknown>).languages as unknown[])
        .map((l) => (typeof l === "string" ? l.trim() : null))
        .filter((l): l is string => !!l);
    }
    return [];
  })();

  // AI match breakdown from CandidateScore (0-100 per sub-metric).
  const score = app.candidateScore;
  const scoreBreakdown = score
    ? {
        skills: Math.round(score.hardSkillsScore),
        experience: Math.round(score.experienceScore),
        education: Math.round(score.educationScore),
        cultureFit: Math.round(score.softSkillsScore),
      }
    : null;

  return {
    id: app.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    source: mapSource(app.source),
    position,
    department,
    stage,
    aiMatch: score ? Math.round(score.overallScore) : 0,
    appliedDate: app.appliedAt.toISOString(),
    avatarColor: avatarColorFor(user.name),
    location: profile?.location ?? "",
    experience: profile?.experienceYears
      ? `${profile.experienceYears} years`
      : "",
    education: profile?.education ?? "",
    referAs: referAsValue || (position !== "—" ? position : ""),
    expectedSalary: profile?.expectedSalary
      ? `Rp ${profile.expectedSalary.toLocaleString("id-ID")}`
      : "",
    appliedForSlots,
    referAsSlots,
    domicile: profile?.domicile ?? profile?.location ?? "",
    careerHistory,
    educationEntries,
    licencesCertifications,
    applicationQuestions,
    languages,
    scoreBreakdown,
    scoreExplanation: null,
    summary: profile?.summary ?? null,
    skills,
    resumeUrl: profile?.resumeUrl ?? null,
    resumeText: profile?.resumeText ?? null,
    linkedinUrl: profile?.linkedinUrl ?? null,
    gender: profile?.gender ?? null,
    expectedSalaryText: profile?.salaryExpectation ?? null,
    noticePeriod: profile?.noticePeriod ?? null,
    isBlacklisted: app.isBlacklisted ?? false,
    blacklistReason: app.blacklistReason ?? null,
    hrReviewer: app.hrReviewer
      ? { id: app.hrReviewer.id, name: app.hrReviewer.name, email: app.hrReviewer.email }
      : null,
    user1Reviewer: app.user1Reviewer
      ? { id: app.user1Reviewer.id, name: app.user1Reviewer.name, email: app.user1Reviewer.email }
      : null,
    user2Reviewer: app.user2Reviewer
      ? { id: app.user2Reviewer.id, name: app.user2Reviewer.name, email: app.user2Reviewer.email }
      : null,
    departmentId: app.departmentId ?? null,
    rejectionEmailSent: isRejectionEmail(app.emailSentSubject),
    rejectionEmailSentAt: app.emailSentAt
      ? formatEmailTimestamp(app.emailSentAt)
      : null,
    lastEmailSent: buildLastEmailSent(app.emailSentAt, app.emailSentSubject),
    notes: (app.notes ?? []).map((n) => ({
      id: n.id,
      content: n.content,
      authorName: n.author?.name ?? "Unknown",
      authorEmail: n.author?.email ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  } satisfies Candidate;
}

/**
 * Fetches all candidates (applications joined with users + candidate profiles)
 * and maps them to the UI Candidate type.
 *
 * NOTE: CandidateProfile has `userId` but no Prisma relation back to User,
 * so we fetch profiles separately and merge by userId.
 */
export async function fetchCandidates(): Promise<Candidate[]> {
  const applications = await prisma.application.findMany({
    where: { deletedAt: null },
    include: {
      candidate: true,
      vacancy: { include: { department: true } },
      department: true,
      candidateScore: true,
    },
    orderBy: { appliedAt: "desc" },
  });

  // CandidateProfile has no Prisma relation to User — fetch separately
  const userIds = applications.map((app) => app.candidateId);
  const profiles = await prisma.candidateProfile.findMany({
    where: { userId: { in: userIds } },
  });
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  return applications.map((app) => {
    const profile = profileMap.get(app.candidateId);
    return mapApplicationToCandidate(app, profile);
  });
}

/**
 * Filter options for paginated candidate queries.
 * `stage` accepts the UI Title Case form (e.g. "Screening") or "All".
 * `search` matches candidate name, email, or position.
 */
export type CandidateFilters = {
  search?: string;
  stage?: string; // UI Title Case stage, or "All"
  /** When true, only return Talent Bank candidates. */
  talentBankOnly?: boolean;
};

/**
 * Builds a Prisma `where` clause from the given filters.
 */
function buildCandidateWhere(filters: CandidateFilters = {}) {
  const where: {
    deletedAt: null;
    currentStage?: string;
    OR?: Array<Record<string, unknown>>;
  } = { deletedAt: null };

  if (filters.talentBankOnly) {
    where.currentStage = "talent_bank";
  } else if (filters.stage && filters.stage !== "All") {
    // Map UI stage back to DB snake_case
    const uiToDb: Record<string, string> = {
      New: "new",
      "Talent Bank": "talent_bank",
      Screening: "screening",
      "HR Interview": "hr_interview",
      "User Interview": "user_interview",
      Assessment: "assessment",
      "User Interview II": "user_interview_ii",
      Offering: "offering",
      Hired: "hired",
      Rejected: "rejected",
      Onboarding: "onboarding",
    };
    const dbStage = uiToDb[filters.stage];
    if (dbStage) where.currentStage = dbStage;
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { candidate: { name: { contains: q, mode: "insensitive" } } },
      { candidate: { email: { contains: q, mode: "insensitive" } } },
      { vacancy: { title: { contains: q, mode: "insensitive" } } },
      { appliedFor: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

/**
 * Fetches a paginated slice of candidates for the /candidates and /talent-bank pages.
 * Returns the candidates for the requested page plus the total count (respecting filters).
 */
export async function fetchCandidatesPaginated(
  page: number,
  pageSize: number,
  filters: CandidateFilters = {},
): Promise<{ candidates: Candidate[]; total: number }> {
  const where = buildCandidateWhere(filters);
  const skip = (page - 1) * pageSize;

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        candidate: true,
        vacancy: { include: { department: true } },
        department: true,
        candidateScore: true,
      },
      orderBy: { appliedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  // CandidateProfile has no Prisma relation to User — fetch separately
  const userIds = applications.map((app) => app.candidateId);
  const profiles = userIds.length
    ? await prisma.candidateProfile.findMany({
        where: { userId: { in: userIds } },
      })
    : [];
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  const candidates = applications.map((app) => {
    const profile = profileMap.get(app.candidateId);
    return mapApplicationToCandidate(app, profile);
  });

  return { candidates, total };
}

/**
 * Fetches a single candidate by application ID.
 *
 * NOTE: CandidateProfile has `userId` but no Prisma relation back to User,
 * so we fetch the profile separately and merge by userId.
 */
export async function fetchCandidateById(
  id: string,
): Promise<Candidate | null> {
  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      candidate: true,
      vacancy: {
        include: { department: true },
      },
      department: true,
      candidateScore: true,
      interviews: {
        include: {
          interviewer: true,
          feedback: true,
        },
        orderBy: { scheduledAt: "desc" },
      },
      offer: true,
      notes: {
        include: { author: true },
        orderBy: { createdAt: "desc" },
      },
      hrReviewer: { select: { id: true, name: true, email: true } },
      user1Reviewer: { select: { id: true, name: true, email: true } },
      user2Reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!app) return null;

  // CandidateProfile has no Prisma relation to User — fetch separately
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: app.candidateId },
  });

  return mapApplicationToCandidate(app, profile);
}

/**
 * Records that an email was sent to a candidate by updating the application's
 * `emailSentAt` and `emailSentSubject` fields. This powers the email-sent
 * badges on the candidate profile (general + rejection).
 *
 * NOTE: This is a WRITE operation — the first external-write action in the
 * project (alongside the Brevo SMTP send in /api/send-email).
 */
export async function recordEmailSent(
  applicationId: string,
  subject: string,
): Promise<void> {
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      emailSentAt: new Date(),
      emailSentSubject: subject,
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Input for updating a candidate (application + user + profile).
 * All fields optional except those needed to identify the records.
 */
export type UpdateCandidateInput = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  experienceYears?: number;
  source?: string;
  appliedDate?: string;
  expectedSalary?: number | null;
  stage?: string; // UI Title Case
  domicile?: string;
  appliedFor?: string;
  referPosition?: string;
  isStarred?: boolean;
  isBlacklisted?: boolean;
  blacklistReason?: string | null;
  hrReviewerId?: string | null;
  user1ReviewerId?: string | null;
  user2ReviewerId?: string | null;
  departmentId?: string | null;
};

/**
 * Maps a UI Title Case stage back to the DB snake_case stage.
 */
function mapUiStageToDbStage(uiStage: string): string | undefined {
  const uiToDb: Record<string, string> = {
    New: "new",
    "Talent Bank": "talent_bank",
    Screening: "screening",
    "HR Interview": "hr_interview",
    "User Interview": "user_interview",
    Assessment: "assessment",
    "User Interview II": "user_interview_ii",
    Offering: "offering",
    Hired: "hired",
    Rejected: "rejected",
    Onboarding: "onboarding",
  };
  return uiToDb[uiStage];
}

/**
 * Updates a candidate's application, user, and profile records in the database.
 * This is the write path for the Edit Candidate page.
 *
 * - Updates the Application (appliedFor, currentStage, source, appliedAt).
 * - Updates the User (name, email, phone).
 * - Updates the CandidateProfile (location, experienceYears, expectedSalary,
 *   domicile, referPosition).
 */
export async function updateCandidate(
  applicationId: string,
  input: UpdateCandidateInput,
): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidateId: true },
  });
  if (!app) {
    throw new Error("Application not found");
  }
  const userId = app.candidateId;

  // Build application updates
  const appData: Record<string, unknown> = { lastActivityAt: new Date() };
  if (input.appliedFor !== undefined) {
    appData.appliedFor = input.appliedFor || null;
  }
  if (input.source !== undefined) {
    appData.source = input.source.toLowerCase();
  }
  if (input.stage !== undefined) {
    const dbStage = mapUiStageToDbStage(input.stage);
    if (dbStage) appData.currentStage = dbStage;
  }
  if (input.appliedDate !== undefined) {
    appData.appliedAt = new Date(input.appliedDate);
  }
  if (input.isStarred !== undefined) {
    appData.isStarred = input.isStarred;
  }
  if (input.isBlacklisted !== undefined) {
    appData.isBlacklisted = input.isBlacklisted;
    // Clear the reason when un-blacklisting; set it when blacklisting.
    if (input.blacklistReason !== undefined) {
      appData.blacklistReason = input.blacklistReason || null;
    } else if (!input.isBlacklisted) {
      appData.blacklistReason = null;
    }
  }
  if (input.hrReviewerId !== undefined) {
    appData.hrReviewerId = input.hrReviewerId || null;
  }
  if (input.user1ReviewerId !== undefined) {
    appData.user1ReviewerId = input.user1ReviewerId || null;
  }
  if (input.user2ReviewerId !== undefined) {
    appData.user2ReviewerId = input.user2ReviewerId || null;
  }
  if (input.departmentId !== undefined) {
    appData.departmentId = input.departmentId || null;
  }

  // Build user updates
  const userData: Record<string, unknown> = {};
  if (input.name !== undefined) userData.name = input.name;
  if (input.email !== undefined) userData.email = input.email;
  if (input.phone !== undefined) userData.phone = input.phone || null;

  // Build profile updates
  const profileData: Record<string, unknown> = {};
  if (input.location !== undefined) profileData.location = input.location || null;
  if (input.experienceYears !== undefined) {
    profileData.experienceYears = input.experienceYears;
  }
  if (input.expectedSalary !== undefined) {
    profileData.expectedSalary = input.expectedSalary;
  }
  if (input.domicile !== undefined) {
    profileData.domicile = input.domicile || null;
  }
  if (input.referPosition !== undefined) {
    profileData.referPosition = input.referPosition || null;
  }

  await prisma.$transaction([
    prisma.application.update({ where: { id: applicationId }, data: appData }),
    Object.keys(userData).length
      ? prisma.user.update({ where: { id: userId }, data: userData })
      : prisma.$queryRaw`SELECT 1`,
    Object.keys(profileData).length
      ? prisma.candidateProfile.upsert({
          where: { userId },
          update: profileData,
          create: { userId, ...profileData },
        })
      : prisma.$queryRaw`SELECT 1`,
  ]);
}

/**
 * Lightweight candidate option for dropdowns (offers, assessments).
 * Returns id, name, and position for every non-deleted application.
 */
export type CandidateOption = {
  id: string;
  name: string;
  email: string;
  position: string;
};

/**
 * Fetches a lightweight list of candidates for populating dropdowns
 * (e.g. the Offer Generate and Assessment Send pages). Sorted by most
 * recent application date.
 */
export async function fetchCandidateOptions(): Promise<CandidateOption[]> {
  const applications = await prisma.application.findMany({
    where: { deletedAt: null },
    include: {
      candidate: true,
      vacancy: true,
    },
    orderBy: { appliedAt: "desc" },
  });

  return applications.map((app) => ({
    id: app.id,
    name: app.candidate.name,
    email: app.candidate.email,
    position:
      app.vacancy?.title ?? app.appliedFor ?? "—",
  }));
}

/**
 * Lightweight reviewer option for the "Assign Interview Reviewers" dropdowns
 * on the candidate detail page. Returns active internal staff users (those
 * with at least one UserRole record), excluding SEEK-imported candidates.
 */
export type ReviewerOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function fetchReviewerOptions(): Promise<ReviewerOption[]> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      userRoles: { some: {} },
      NOT: {
        OR: [
          { email: { startsWith: "seek+", mode: "insensitive" } },
          { email: { endsWith: "@import.nuanu.local", mode: "insensitive" } },
        ],
      },
    },
    include: {
      userRoles: { include: { role: true } },
    },
    orderBy: { name: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.userRoles[0]?.role?.name ?? "Staff",
  }));
}

/**
 * Parsed candidate data returned by the AI resume parser.
 * Field names mirror the real schema (User + CandidateProfile + Application).
 *
 * The `experience`, `educationEntries`, `licencesCertifications`, and
 * `applicationQuestions` arrays are written into the `parsedData` JSON column
 * on `CandidateProfile` and read back by `lib/profile-data.ts` to populate the
 * Career History / Education / Licences & Certifications sections on the
 * candidate detail page.
 */
export type ParsedExperienceEntry = {
  title?: string | null;
  company?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
};

export type ParsedEducationEntry = {
  degree?: string | null;
  institution?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  year?: string | null;
  gpa?: string | null;
  honors?: string | null;
};

export type ParsedLicenceCertification = {
  name?: string | null;
  issuingBody?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  expiryDate?: string | null;
};

export type ParsedApplicationQuestion = {
  question?: string | null;
  answer?: string | null;
};

export type ParsedCandidate = {
  name: string;
  email: string;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  location?: string | null;
  experienceYears?: number | null;
  education?: string | null;
  skills?: string[];
  summary?: string | null;
  linkedinUrl?: string | null;
  /** Full career history — every job entry found in the CV. */
  experience?: ParsedExperienceEntry[];
  /** Full education entries — every degree/qualification found. */
  educationEntries?: ParsedEducationEntry[];
  /** Licences & certifications found in the CV. */
  licencesCertifications?: ParsedLicenceCertification[];
  /** Application-specific Q&A found in the CV (expected salary, notice, etc.). */
  applicationQuestions?: ParsedApplicationQuestion[];
  /** Expected salary string, if present in the CV. */
  expectedSalary?: string | null;
  /** Notice period, if present in the CV. */
  noticePeriod?: string | null;
  /** Languages with proficiency, if present in the CV. */
  languages?: string[];
};

/**
 * Result of creating a candidate from an uploaded CV.
 */
export type CreateCandidateResult = {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
};

/**
 * Finds or creates a "General Application" vacancy used when a candidate
 * applies for a custom/other position that doesn't map to an existing vacancy.
 *
 * The vacancy is created with status "draft" (internal-only) and a unique
 * code so it doesn't appear on the public careers page but can still receive
 * applications. The custom position text is stored on the Application's
 * `appliedFor` field.
 */
export async function findOrCreateGeneralVacancy(): Promise<string> {
  const code = "GENERAL-APPLICATION";
  const existing = await prisma.vacancy.findUnique({ where: { code } });
  if (existing) return existing.id;

  // Need a department + creator. Use a neutral "General" department (created
  // if necessary) so custom-position candidates don't inherit an arbitrary
  // department like "Engineering" from findFirst().
  // NOTE: The role is "Super Admin" (not "Admin") — see the roles table.
  let department = await prisma.department.findFirst({
    where: { name: { equals: "General", mode: "insensitive" } },
  });
  if (!department) {
    department = await prisma.department.create({
      data: { name: "General", code: "GENERAL", isActive: true },
    });
  }
  const adminUser = await prisma.user.findFirst({
    where: {
      userRoles: {
        some: {
          role: {
            name: {
              in: ["Super Admin", "Manager", "HR Manager"],
              mode: "insensitive",
            },
          },
        },
      },
      isActive: true,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!department) {
    throw new Error("No department found — cannot create general application vacancy");
  }
  if (!adminUser) {
    throw new Error("No admin user found — cannot create general application vacancy");
  }

  const vacancy = await prisma.vacancy.create({
    data: {
      title: "General Application",
      code,
      departmentId: department.id,
      creatorId: adminUser.id,
      description: "Used for candidates applying for custom/other positions.",
      status: "draft",
    },
  });
  return vacancy.id;
}

/**
 * Creates a candidate (User + CandidateProfile + Application) from an uploaded
 * and AI-parsed CV. This is the write path for the Upload CV feature.
 *
 * - Reuses an existing User by email if one already exists (so a candidate
 *   isn't duplicated if they re-apply), otherwise creates a new User.
 * - Creates/updates a CandidateProfile with the parsed resume data + file URL.
 * - Creates an Application linking the candidate to the selected vacancy
 *   (source = "upload", currentStage = "new"). If an application already
 *   exists for this (vacancy, candidate) pair, returns it instead of failing
 *   (the schema has @@unique([vacancyId, candidateId])).
 */
export async function createCandidateFromUpload(
  parsed: ParsedCandidate,
  vacancyId: string,
  resumeUrl: string,
  resumeText: string,
  appliedFor?: string | null,
): Promise<CreateCandidateResult> {
  // 1. Find or create the User (candidate) by email
  let user = await prisma.user.findUnique({
    where: { email: parsed.email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        phone: parsed.phone ?? null,
        password: "", // candidates don't log in; password is required by schema
        isActive: true,
      },
    });
  } else {
    // Update name/phone if the parse provided richer data
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.name || user.name,
        phone: parsed.phone ?? user.phone,
      },
    });
  }

  // 2. Upsert the CandidateProfile with parsed resume data.
  //    The structured arrays (experience, education, licences, application
  //    questions) are written into the SEEK-style JSON columns so the existing
  //    extractors in lib/profile-data.ts pick them up on the detail page.
  //    `parsedData` keeps the full raw AI output for debugging/fallback.
  const seekCareerHistory =
    parsed.experience && parsed.experience.length
      ? (parsed.experience as unknown as object)
      : undefined;
  const seekEducation =
    parsed.educationEntries && parsed.educationEntries.length
      ? (parsed.educationEntries as unknown as object)
      : undefined;
  const seekLicences =
    parsed.licencesCertifications && parsed.licencesCertifications.length
      ? (parsed.licencesCertifications as unknown as object)
      : undefined;
  const seekSkills =
    parsed.skills && parsed.skills.length
      ? (parsed.skills as unknown as object)
      : undefined;
  const seekAppQuestions =
    parsed.applicationQuestions && parsed.applicationQuestions.length
      ? (parsed.applicationQuestions as unknown as object)
      : undefined;

  await prisma.candidateProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      currentTitle: parsed.currentTitle ?? null,
      currentCompany: parsed.currentCompany ?? null,
      location: parsed.location ?? null,
      experienceYears: parsed.experienceYears ?? 0,
      education: parsed.education ?? null,
      skills: parsed.skills ?? [],
      summary: parsed.summary ?? null,
      linkedinUrl: parsed.linkedinUrl ?? null,
      resumeUrl,
      resumeText,
      parsedData: parsed as unknown as object,
      seekCareerHistory: seekCareerHistory ?? undefined,
      seekEducation: seekEducation ?? undefined,
      seekLicencesAndCertifications: seekLicences ?? undefined,
      seekSkills: seekSkills ?? undefined,
      seekApplicationQuestions: seekAppQuestions ?? undefined,
      salaryExpectation: parsed.expectedSalary ?? null,
      noticePeriod: parsed.noticePeriod ?? null,
    },
    update: {
      currentTitle: parsed.currentTitle ?? undefined,
      currentCompany: parsed.currentCompany ?? undefined,
      location: parsed.location ?? undefined,
      experienceYears: parsed.experienceYears ?? undefined,
      education: parsed.education ?? undefined,
      skills: parsed.skills ?? undefined,
      summary: parsed.summary ?? undefined,
      linkedinUrl: parsed.linkedinUrl ?? undefined,
      resumeUrl,
      resumeText,
      parsedData: parsed as unknown as object,
      seekCareerHistory: seekCareerHistory ?? undefined,
      seekEducation: seekEducation ?? undefined,
      seekLicencesAndCertifications: seekLicences ?? undefined,
      seekSkills: seekSkills ?? undefined,
      seekApplicationQuestions: seekAppQuestions ?? undefined,
      salaryExpectation: parsed.expectedSalary ?? undefined,
      noticePeriod: parsed.noticePeriod ?? undefined,
    },
  });

  // 3. Find or create the Application (vacancy + candidate pair is unique)
  const existing = await prisma.application.findUnique({
    where: {
      vacancyId_candidateId: { vacancyId, candidateId: user.id },
    },
  });

  let application;
  if (existing) {
    application = existing;
  } else {
    application = await prisma.application.create({
      data: {
        vacancyId,
        candidateId: user.id,
        source: "upload",
        currentStage: "new",
        appliedFor: appliedFor ?? null,
      },
    });
  }

  return {
    applicationId: application.id,
    candidateName: user.name,
    candidateEmail: user.email,
  };
}

/**
 * Maps a DB employment type (e.g. "full-time") to the UI's Title Case form.
 */
function mapEmploymentType(raw: string): Job["employmentType"] {
  const lower = raw.toLowerCase();
  if (lower === "full-time" || lower === "full_time") return "Full-time";
  if (lower === "part-time" || lower === "part_time") return "Part-time";
  if (lower === "contract") return "Contract";
  if (lower === "internship") return "Internship";
  return "Full-time";
}

/**
 * Maps a DB vacancy status (e.g. "open") to the UI's Title Case form.
 */
function mapVacancyStatus(raw: string): Job["status"] {
  const lower = raw.toLowerCase();
  if (lower === "open") return "Open";
  if (lower === "on_hold" || lower === "on hold") return "On Hold";
  if (lower === "closed") return "Closed";
  if (lower === "draft") return "Draft";
  return "Draft";
}

/**
 * Fetches all vacancies (jobs) for the /jobs page, mapped to the UI Job type.
 */
export async function fetchVacancies(): Promise<Job[]> {
  const vacancies = await prisma.vacancy.findMany({
    where: { deletedAt: null },
    include: {
      department: true,
      creator: true,
      recruiter: true,
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return vacancies.map(
    (v) =>
      ({
        id: v.id,
        title: v.title,
        department: v.department?.name ?? "—",
        employmentType: mapEmploymentType(v.employmentType),
        candidateCount: v._count.applications,
        hiredCount: v.filledCount,
        openings: v.headcount,
        status: mapVacancyStatus(v.status),
        postedDate: (v.publishedAt ?? v.createdAt).toISOString(),
        location: v.location ?? "",
      }) satisfies Job,
  );
}

/**
 * Fetches published vacancies for the public careers page.
 * Only returns vacancies with status "open" or "on_hold".
 */
export async function fetchPublicVacancies(): Promise<VacancyDetail[]> {
  const vacancies = await prisma.vacancy.findMany({
    where: {
      deletedAt: null,
      status: { in: ["open", "on_hold"] },
    },
    include: {
      department: true,
      _count: { select: { applications: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  return vacancies.map((v) => ({
    id: v.id,
    title: v.title,
    code: v.code,
    departmentId: v.departmentId,
    departmentName: v.department?.name ?? "—",
    description: v.description ?? "",
    requirements: v.requirements ?? "",
    employmentType: v.employmentType,
    locationType: v.locationType,
    location: v.location ?? "",
    salaryMin: v.salaryMin,
    salaryMax: v.salaryMax,
    currency: v.currency,
    headcount: v.headcount,
    filledCount: v.filledCount,
    status: v.status,
    postedDate: (v.publishedAt ?? v.createdAt).toISOString(),
    candidateCount: v._count.applications,
  }));
}

/**
 * Fetches vacancy titles for the pipeline dropdown.
 */
export async function fetchVacancyOptions(): Promise<string[]> {
  const vacancies = await prisma.vacancy.findMany({
    where: { deletedAt: null },
    select: { title: true },
    orderBy: { title: "asc" },
  });
  return ["All Vacancies", ...vacancies.map((v) => v.title)];
}

/**
 * Maps a DB employee status (e.g. "active") to the UI's Title Case form.
 */
function mapEmployeeStatus(raw: string): Employee["status"] {
  const lower = raw.toLowerCase();
  if (lower === "active") return "Active";
  if (lower === "on_leave" || lower === "on leave") return "On Leave";
  if (lower === "probation") return "Probation";
  if (lower === "resigned") return "Resigned";
  return "Active";
}

/**
 * Fetches all employees for the /employees page, mapped to the UI Employee type.
 */
export async function fetchEmployees(): Promise<Employee[]> {
  const employees = await prisma.employee.findMany({
    include: {
      user: true,
    },
    orderBy: { startDate: "desc" },
  });

  return employees.map(
    (e) =>
      ({
        id: e.id,
        name: e.user.name,
        position: e.position,
        department: e.department ?? "",
        status: mapEmployeeStatus(e.status),
        email: e.user.email,
        phone: e.user.phone ?? "",
        joinDate: e.startDate.toISOString(),
        employeeId: e.employeeCode,
        location: "",
      }) satisfies Employee,
  );
}

export type EmployeeContractDetail = {
  id: string;
  employmentType: string;
  contractStart: string;
  contractEnd: string | null;
  isPermanent: boolean;
  workLocation: string;
  workingHours: string;
  reportingTo: string;
  salaryType: string;
  basicSalary: number;
  mealAllowance: number;
  transportAllowance: number;
  healthAllowance: number;
  otherAllowanceLabel: string | null;
  otherAllowanceAmount: number;
  laptopProvided: boolean;
  laptopType: string | null;
  companyEmail: string | null;
  nametagRequired: boolean;
  lunchProvided: boolean;
  accessCard: boolean;
  notes: string | null;
  status: string;
};

export type EmployeeDocumentRow = {
  id: string;
  documentType: string;
  originalFilename: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  verificationStatus: string;
  rejectionReason: string | null;
  uploadedAt: string;
};

export type EmployeeAssetRow = {
  id: string;
  assetType: string;
  assetName: string;
  serialNumber: string | null;
  status: string;
  assignedDate: string | null;
  receivedDate: string | null;
  notes: string | null;
};

export type EmployeeDetail = Employee & {
  entity: string;
  employmentType: string;
  probationPeriod: string | null;
  probationEndDate: string | null;
  contract: EmployeeContractDetail | null;
  documents: EmployeeDocumentRow[];
  assets: EmployeeAssetRow[];
};

export async function fetchEmployeeById(
  id: string,
): Promise<EmployeeDetail | null> {
  const e = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: true,
      employeeContract: true,
      employeeDocuments: {
        orderBy: { uploadedAt: "desc" },
      },
      employeeAssets: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!e) return null;

  const contract = e.employeeContract
    ? {
        id: e.employeeContract.id,
        employmentType: e.employeeContract.employmentType,
        contractStart: e.employeeContract.contractStart.toISOString(),
        contractEnd: e.employeeContract.contractEnd?.toISOString() ?? null,
        isPermanent: e.employeeContract.isPermanent,
        workLocation: e.employeeContract.workLocation,
        workingHours: e.employeeContract.workingHours,
        reportingTo: e.employeeContract.reportingTo,
        salaryType: e.employeeContract.salaryType,
        basicSalary: Number(e.employeeContract.basicSalary),
        mealAllowance: Number(e.employeeContract.mealAllowance),
        transportAllowance: Number(e.employeeContract.transportAllowance),
        healthAllowance: Number(e.employeeContract.healthAllowance),
        otherAllowanceLabel: e.employeeContract.otherAllowanceLabel,
        otherAllowanceAmount: Number(e.employeeContract.otherAllowanceAmount),
        laptopProvided: e.employeeContract.laptopProvided,
        laptopType: e.employeeContract.laptopType,
        companyEmail: e.employeeContract.companyEmail,
        nametagRequired: e.employeeContract.nametagRequired,
        lunchProvided: e.employeeContract.lunchProvided,
        accessCard: e.employeeContract.accessCard,
        notes: e.employeeContract.notes,
        status: e.employeeContract.status,
      }
    : null;

  const documents: EmployeeDocumentRow[] = e.employeeDocuments.map((d) => ({
    id: d.id,
    documentType: d.documentType,
    originalFilename: d.originalFilename,
    fileUrl: d.fileUrl,
    fileSize: d.fileSize,
    mimeType: d.mimeType,
    verificationStatus: d.verificationStatus,
    rejectionReason: d.rejectionReason,
    uploadedAt: d.uploadedAt.toISOString(),
  }));

  const assets: EmployeeAssetRow[] = e.employeeAssets.map((a) => ({
    id: a.id,
    assetType: a.assetType,
    assetName: a.assetName,
    serialNumber: a.serialNumber,
    status: a.status,
    assignedDate: a.assignedDate?.toISOString() ?? null,
    receivedDate: a.receivedDate?.toISOString() ?? null,
    notes: a.notes,
  }));

  return {
    id: e.id,
    name: e.user.name,
    position: e.position,
    department: e.department ?? "",
    status: mapEmployeeStatus(e.status),
    email: e.user.email,
    phone: e.user.phone ?? "",
    joinDate: e.startDate.toISOString(),
    employeeId: e.employeeCode,
    location: "",
    entity: e.entity,
    employmentType: e.employmentType,
    probationPeriod: e.probationPeriod,
    probationEndDate: e.probationEndDate?.toISOString() ?? null,
    contract,
    documents,
    assets,
  };
}

/**
 * Fetches all active department names for the Create Vacancy dropdown.
 */
export async function fetchDepartmentNames(): Promise<string[]> {
  const departments = await prisma.department.findMany({
    where: { deletedAt: null, isActive: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return departments.map((d) => d.name);
}

/**
 * Fetches all active departments with their IDs for the Edit Candidate
 * department-override dropdown.
 */
export async function fetchDepartmentOptions(): Promise<
  { id: string; name: string }[]
> {
  const departments = await prisma.department.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return departments;
}

/**
 * Input for creating a new vacancy via the Create Vacancy form.
 */
export type CreateVacancyInput = {
  title: string;
  departmentName: string;
  employmentType: string; // "full-time" | "part-time" | "contract" | "internship"
  headcount: number;
  location: string;
  locationType: string; // "onsite" | "remote" | "hybrid"
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  requirements: string;
  status: string; // "draft" | "open"
};

/**
 * Creates a new vacancy in the database.
 * This is the first WRITE operation in the project.
 *
 * Required fields per schema: title, code (unique), departmentId, creatorId.
 * We generate a unique code from the title + timestamp.
 */
export async function createVacancy(input: CreateVacancyInput): Promise<string> {
  // Look up the department by name
  const department = await prisma.department.findFirst({
    where: { name: input.departmentName, deletedAt: null },
    select: { id: true },
  });
  if (!department) {
    throw new Error(`Department "${input.departmentName}" not found`);
  }

  // Use the first available user as the creator (prototype — no auth yet)
  const creator = await prisma.user.findFirst({
    where: { deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!creator) {
    throw new Error("No user found to assign as vacancy creator");
  }

  // Generate a unique vacancy code from title + timestamp
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const code = `${slug}-${Date.now().toString(36)}`;

  const vacancy = await prisma.vacancy.create({
    data: {
      title: input.title,
      code,
      departmentId: department.id,
      creatorId: creator.id,
      description: input.description || null,
      requirements: input.requirements || null,
      employmentType: input.employmentType,
      locationType: input.locationType,
      location: input.location || null,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      currency: "IDR",
      headcount: input.headcount,
      status: input.status,
      publishedAt: input.status === "open" ? new Date() : null,
    },
    select: { id: true },
  });

  return vacancy.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vacancy detail & update
// ─────────────────────────────────────────────────────────────────────────────

export type VacancyDetail = {
  id: string;
  title: string;
  code: string;
  departmentId: string;
  departmentName: string;
  description: string;
  requirements: string;
  employmentType: string;
  locationType: string;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  headcount: number;
  filledCount: number;
  status: string;
  postedDate: string;
  candidateCount: number;
};

export async function fetchVacancyById(id: string): Promise<VacancyDetail | null> {
  const v = await prisma.vacancy.findFirst({
    where: { id, deletedAt: null },
    include: {
      department: true,
      _count: { select: { applications: true } },
    },
  });
  if (!v) return null;
  return {
    id: v.id,
    title: v.title,
    code: v.code,
    departmentId: v.departmentId,
    departmentName: v.department?.name ?? "—",
    description: v.description ?? "",
    requirements: v.requirements ?? "",
    employmentType: v.employmentType,
    locationType: v.locationType,
    location: v.location ?? "",
    salaryMin: v.salaryMin,
    salaryMax: v.salaryMax,
    currency: v.currency,
    headcount: v.headcount,
    filledCount: v.filledCount,
    status: v.status,
    postedDate: (v.publishedAt ?? v.createdAt).toISOString(),
    candidateCount: v._count.applications,
  };
}

/**
 * Fetches all candidates (applications) for a specific vacancy, mapped to the
 * UI `Candidate` type. Used by the `/jobs/[id]` page to show the full candidate
 * list filtered to only those who applied for this specific vacancy.
 */
export async function fetchCandidatesByVacancy(
  vacancyId: string,
): Promise<Candidate[]> {
  const applications = await prisma.application.findMany({
    where: { vacancyId, deletedAt: null },
    include: {
      candidate: true,
      vacancy: { include: { department: true } },
      department: true,
      candidateScore: true,
    },
    orderBy: { appliedAt: "desc" },
  });

  // CandidateProfile has no Prisma relation to User — fetch separately
  const userIds = applications.map((app) => app.candidateId);
  const profiles = userIds.length
    ? await prisma.candidateProfile.findMany({
        where: { userId: { in: userIds } },
      })
    : [];
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  return applications.map((app) => {
    const profile = profileMap.get(app.candidateId);
    return mapApplicationToCandidate(app, profile);
  });
}

/**
 * Fetches a paginated slice of candidates (applications) for a specific
 * vacancy, mapped to the UI `Candidate` type. Used by the
 * `/jobs/[id]/candidates` page so that vacancies with hundreds of candidates
 * (e.g. 461) are not rendered all at once.
 *
 * Supports the same `search` / `stage` filters as the global candidates list,
 * scoped to the given vacancy.
 */
export async function fetchCandidatesByVacancyPaginated(
  vacancyId: string,
  page: number,
  pageSize: number,
  filters: CandidateFilters = {},
): Promise<{ candidates: Candidate[]; total: number }> {
  const where: {
    vacancyId: string;
    deletedAt: null;
    currentStage?: string;
    OR?: Array<Record<string, unknown>>;
  } = { vacancyId, deletedAt: null };

  if (filters.stage && filters.stage !== "All") {
    const uiToDb: Record<string, string> = {
      New: "new",
      "Talent Bank": "talent_bank",
      Screening: "screening",
      "HR Interview": "hr_interview",
      "User Interview": "user_interview",
      Assessment: "assessment",
      "User Interview II": "user_interview_ii",
      Offering: "offering",
      Hired: "hired",
      Rejected: "rejected",
      Onboarding: "onboarding",
    };
    const dbStage = uiToDb[filters.stage];
    if (dbStage) where.currentStage = dbStage;
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { candidate: { name: { contains: q, mode: "insensitive" } } },
      { candidate: { email: { contains: q, mode: "insensitive" } } },
      { appliedFor: { contains: q, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * pageSize;

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        candidate: true,
        vacancy: { include: { department: true } },
        department: true,
        candidateScore: true,
      },
      orderBy: { appliedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  // CandidateProfile has no Prisma relation to User — fetch separately
  const userIds = applications.map((app) => app.candidateId);
  const profiles = userIds.length
    ? await prisma.candidateProfile.findMany({
        where: { userId: { in: userIds } },
      })
    : [];
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  const candidates = applications.map((app) => {
    const profile = profileMap.get(app.candidateId);
    return mapApplicationToCandidate(app, profile);
  });

  return { candidates, total };
}

export type UpdateVacancyInput = {
  title?: string;
  departmentName?: string;
  employmentType?: string;
  headcount?: number;
  location?: string;
  locationType?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  description?: string;
  requirements?: string;
  status?: string;
};

export async function updateVacancy(
  id: string,
  input: UpdateVacancyInput,
): Promise<void> {
  const data: Record<string, unknown> = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.employmentType !== undefined) data.employmentType = input.employmentType;
  if (input.headcount !== undefined) data.headcount = input.headcount;
  if (input.location !== undefined) data.location = input.location || null;
  if (input.locationType !== undefined) data.locationType = input.locationType;
  if (input.salaryMin !== undefined) data.salaryMin = input.salaryMin;
  if (input.salaryMax !== undefined) data.salaryMax = input.salaryMax;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.requirements !== undefined) data.requirements = input.requirements || null;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "open") {
      data.publishedAt = data.publishedAt ?? new Date();
    }
  }

  if (input.departmentName !== undefined) {
    const dept = await prisma.department.findFirst({
      where: { name: input.departmentName, deletedAt: null },
      select: { id: true },
    });
    if (dept) data.departmentId = dept.id;
  }

  await prisma.vacancy.update({
    where: { id },
    data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Overview — real aggregate queries
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardData = {
  metrics: {
    activeVacancies: number;
    totalCandidates: number;
    avgTimeToHire: string;
    offerAcceptRate: string;
    avgAiMatchScore: string;
    costPerHire: string;
  };
  sourcingData: { channel: string; candidates: number; hires: number }[];
  funnel: { stage: string; count: number; pct: number }[];
  domicileSplit: { region: string; count: number; pct: number }[];
  genderSplit: { label: string; pct: number }[];
};

export async function fetchDashboardData(): Promise<DashboardData> {
  const [activeVacancies, totalCandidates, hiredApps, allApps, scores, offers] =
    await Promise.all([
      prisma.vacancy.count({ where: { deletedAt: null, status: "open" } }),
      prisma.application.count({ where: { deletedAt: null } }),
      prisma.application.findMany({
        where: { deletedAt: null, currentStage: "hired" },
        select: { appliedAt: true, lastActivityAt: true },
      }),
      prisma.application.findMany({
        where: { deletedAt: null },
        select: { source: true, currentStage: true },
      }),
      prisma.candidateScore.findMany({
        select: { overallScore: true },
      }),
      prisma.offer.findMany({ select: { status: true } }),
    ]);

  // Avg time to hire (days between appliedAt and lastActivityAt for hired)
  let avgDays = 0;
  if (hiredApps.length > 0) {
    const totalDays = hiredApps.reduce((sum, app) => {
      const diff =
        (app.lastActivityAt.getTime() - app.appliedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      return sum + Math.max(0, Math.round(diff));
    }, 0);
    avgDays = Math.round(totalDays / hiredApps.length);
  }

  // Offer accept rate
  const acceptedOffers = offers.filter(
    (o) => o.status === "accepted",
  ).length;
  const respondedOffers = offers.filter((o) =>
    ["accepted", "rejected", "expired"].includes(o.status),
  ).length;
  const acceptRate =
    respondedOffers > 0
      ? Math.round((acceptedOffers / respondedOffers) * 100)
      : 0;

  // Avg AI match score
  const avgScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length,
        )
      : 0;

  // Sourcing data — group by source
  const sourceMap = new Map<string, { candidates: number; hires: number }>();
  for (const app of allApps) {
    const channel = mapSource(app.source);
    const entry = sourceMap.get(channel) ?? { candidates: 0, hires: 0 };
    entry.candidates++;
    if (app.currentStage === "hired") entry.hires++;
    sourceMap.set(channel, entry);
  }
  const sourcingData = Array.from(sourceMap.entries())
    .map(([channel, data]) => ({ channel, ...data }))
    .sort((a, b) => b.candidates - a.candidates);

  // Funnel — count by stage
  const stageCounts: Record<string, number> = {};
  for (const app of allApps) {
    const uiStage = mapDbStageToUiStage(app.currentStage);
    stageCounts[uiStage] = (stageCounts[uiStage] ?? 0) + 1;
  }
  const funnelStages = [
    "New",
    "Screening",
    "HR Interview",
    "User Interview",
    "Offering",
    "Hired",
  ];
  const maxCount = Math.max(1, ...Object.values(stageCounts));
  const funnel = funnelStages.map((stage) => ({
    stage,
    count: stageCounts[stage] ?? 0,
    pct: Math.round(((stageCounts[stage] ?? 0) / maxCount) * 100),
  }));

  // Domicile + gender from candidate profiles
  const profiles = await prisma.candidateProfile.findMany({
    select: { domicile: true, location: true, gender: true },
  });
  const domicileMap = new Map<string, number>();
  for (const p of profiles) {
    const region = (p.domicile ?? p.location ?? "Unknown").trim() || "Unknown";
    domicileMap.set(region, (domicileMap.get(region) ?? 0) + 1);
  }
  const totalProfiles = profiles.length || 1;
  const domicileSplit = Array.from(domicileMap.entries())
    .map(([region, count]) => ({
      region,
      count,
      pct: Math.round((count / totalProfiles) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const genderCounts: Record<string, number> = {};
  for (const p of profiles) {
    const g = (p.gender ?? "Prefer not to say").trim() || "Prefer not to say";
    const label =
      g.toLowerCase() === "male"
        ? "Male"
        : g.toLowerCase() === "female"
          ? "Female"
          : "Prefer not to say";
    genderCounts[label] = (genderCounts[label] ?? 0) + 1;
  }
  const genderSplit = (["Male", "Female", "Prefer not to say"] as const).map(
    (label) => ({
      label,
      pct: Math.round(((genderCounts[label] ?? 0) / totalProfiles) * 100),
    }),
  );

  return {
    metrics: {
      activeVacancies,
      totalCandidates,
      avgTimeToHire: `${avgDays} days`,
      offerAcceptRate: `${acceptRate}%`,
      avgAiMatchScore: `${avgScore}`,
      costPerHire: "Rp 0",
    },
    sourcingData,
    funnel,
    domicileSplit,
    genderSplit,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Scoring — candidates with scores
// ─────────────────────────────────────────────────────────────────────────────

export type AIScoringCandidate = {
  id: string;
  name: string;
  position: string;
  department: string;
  stage: Stage;
  aiMatch: number;
  avatarColor: string;
  hardSkillsScore: number;
  experienceScore: number;
  educationScore: number;
};

export async function fetchAIScoringCandidates(): Promise<
  AIScoringCandidate[]
> {
  const applications = await prisma.application.findMany({
    where: {
      deletedAt: null,
      candidateScore: { isNot: null },
    },
    include: {
      candidate: true,
      vacancy: { include: { department: true } },
      department: true,
      candidateScore: true,
    },
    orderBy: { appliedAt: "desc" },
  });

  return applications.map((app) => {
    const score = app.candidateScore!;
    return {
      id: app.id,
      name: app.candidate.name,
      position:
        app.vacancy?.title ?? app.appliedFor ?? "—",
      department: app.vacancy?.department?.name ?? "",
      stage: mapDbStageToUiStage(app.currentStage),
      aiMatch: Math.round(score.overallScore),
      avatarColor: avatarColorFor(app.candidate.name),
      hardSkillsScore: Math.round(score.hardSkillsScore),
      experienceScore: Math.round(score.experienceScore),
      educationScore: Math.round(score.educationScore),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessments
// ─────────────────────────────────────────────────────────────────────────────

export type AssessmentRow = {
  id: string;
  candidateName: string;
  position: string;
  title: string;
  type: string;
  score: number | null;
  status: string;
  sentDate: string;
};

export type AssessmentStats = {
  totalSent: number;
  pending: number;
  completed: number;
  avgScore: string;
};

export async function fetchAssessments(): Promise<{
  assessments: AssessmentRow[];
  stats: AssessmentStats;
}> {
  const assessments = await prisma.assessment.findMany({
    include: {
      application: {
        include: {
          candidate: true,
          vacancy: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: AssessmentRow[] = assessments.map((a) => ({
    id: a.id,
    candidateName: a.application?.candidate?.name ?? "Unknown",
    position:
      a.application?.vacancy?.title ??
      a.application?.appliedFor ??
      "—",
    title: a.title,
    type: a.type,
    score: a.score !== null ? Math.round(a.score) : null,
    status:
      a.status.charAt(0).toUpperCase() + a.status.slice(1),
    sentDate: a.createdAt.toISOString(),
  }));

  const totalSent = assessments.length;
  const pending = assessments.filter((a) => a.status === "pending").length;
  const completed = assessments.filter(
    (a) => a.status === "completed",
  ).length;
  const scored = assessments.filter((a) => a.score !== null);
  const avgScore =
    scored.length > 0
      ? `${Math.round(
          scored.reduce((sum, a) => sum + (a.score ?? 0), 0) / scored.length,
        )}%`
      : "—";

  return {
    assessments: rows,
    stats: { totalSent, pending, completed, avgScore },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Interviews
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewRow = {
  id: string;
  candidateName: string;
  position: string;
  date: string;
  time: string;
  type: "Video" | "Phone" | "On-site";
  interviewer: string;
  meetingUrl: string | null;
  calendarSynced: boolean;
};

export async function fetchInterviews(): Promise<InterviewRow[]> {
  const interviews = await prisma.interview.findMany({
    include: {
      application: {
        include: {
          candidate: true,
          vacancy: true,
        },
      },
      interviewer: true,
    },
    orderBy: { scheduledAt: "desc" },
  });

  return interviews.map((iv) => {
    const dt = new Date(iv.scheduledAt);
    const typeMap: Record<string, "Video" | "Phone" | "On-site"> = {
      video: "Video",
      phone: "Phone",
      onsite: "On-site",
      "on-site": "On-site",
    };
    return {
      id: iv.id,
      candidateName: iv.application?.candidate?.name ?? "Unknown",
      position:
        iv.application?.vacancy?.title ??
        iv.application?.appliedFor ??
        "—",
      date: dt.toISOString(),
      time: formatTimeWita(dt),
      type: typeMap[iv.type.toLowerCase()] ?? "On-site",
      interviewer: iv.interviewer?.name ?? "—",
      meetingUrl: iv.meetingUrl ?? null,
      calendarSynced: iv.calendarSynced,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Offers
// ─────────────────────────────────────────────────────────────────────────────

export type OfferRow = {
  id: string;
  candidateName: string;
  position: string;
  salary: number;
  status: "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";
  date: string;
};

export async function fetchOffers(): Promise<OfferRow[]> {
  const offers = await prisma.offer.findMany({
    include: {
      application: {
        include: {
          candidate: true,
          vacancy: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusMap: Record<string, OfferRow["status"]> = {
    draft: "Draft",
    sent: "Sent",
    accepted: "Accepted",
    rejected: "Rejected",
    expired: "Expired",
  };

  return offers.map((o) => ({
    id: o.id,
    candidateName: o.application?.candidate?.name ?? "Unknown",
    position:
      o.application?.vacancy?.title ??
      o.application?.appliedFor ??
      "—",
    salary: o.salary,
    status: statusMap[o.status.toLowerCase()] ?? "Draft",
    date: (o.sentAt ?? o.createdAt).toISOString(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding
// ─────────────────────────────────────────────────────────────────────────────

export type OnboardingStats = {
  newHires: number;
  inProgress: number;
  completed: number;
  avgDays: string;
};

export type OnboardingRecord = {
  id: string;
  employeeName: string;
  position: string;
  employeeCode: string;
  status: "In Progress" | "Completed" | "Pending";
  startDate: string;
  createdAt: string;
};

function mapOnboardingStatus(status: string): OnboardingRecord["status"] {
  const s = status.toLowerCase();
  if (s === "completed") return "Completed";
  if (s === "document_collection" || s === "pending") return "Pending";
  return "In Progress";
}

export async function fetchOnboardingStats(): Promise<OnboardingStats> {
  const records = await prisma.onboarding.findMany({
    select: {
      onboardingStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const total = records.length;
  const completedRecords = records.filter(
    (r) => r.onboardingStatus.toLowerCase() === "completed",
  );
  const completed = completedRecords.length;
  const inProgress = total - completed;

  let avgDays = "—";
  if (completedRecords.length > 0) {
    const totalDays = completedRecords.reduce((sum, r) => {
      const diff = r.updatedAt.getTime() - r.createdAt.getTime();
      return sum + Math.round(diff / (1000 * 60 * 60 * 24));
    }, 0);
    const avg = Math.round(totalDays / completedRecords.length);
    avgDays = `${avg} days`;
  }

  return { newHires: total, inProgress, completed, avgDays };
}

export async function fetchOnboardingRecords(): Promise<OnboardingRecord[]> {
  const records = await prisma.onboarding.findMany({
    include: {
      employee: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return records.map((r) => ({
    id: r.id,
    employeeName: r.employee?.user?.name ?? "Unknown",
    position: r.employee?.position ?? "—",
    employeeCode: r.employee?.employeeCode ?? "—",
    status: mapOnboardingStatus(r.onboardingStatus),
    startDate: r.employee?.startDate
      ? formatDateWita(r.employee.startDate)
      : "—",
    createdAt: formatDateWita(r.createdAt),
  }));
}

export async function fetchEmployeesWithoutOnboarding(): Promise<
  { id: string; name: string; employeeCode: string; position: string }[]
> {
  const employees = await prisma.employee.findMany({
    where: {
      onboarding: null,
    },
    include: {
      user: true,
    },
    orderBy: { startDate: "desc" },
  });

  return employees.map((e) => ({
    id: e.id,
    name: e.user.name,
    employeeCode: e.employeeCode,
    position: e.position,
  }));
}

export async function startOnboarding(employeeId: string): Promise<string> {
  const onboarding = await prisma.onboarding.create({
    data: {
      employeeId,
      onboardingStatus: "document_collection",
    },
  });
  return onboarding.id;
}

export async function deleteOnboarding(id: string): Promise<void> {
  // EmployeeDocument records cascade-delete with the Onboarding record.
  // EmployeeAsset records have a nullable onboardingId and will be set to
  // null automatically (default SetNull referential action).
  await prisma.onboarding.delete({
    where: { id },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Approvals — Pending Requisitions
// ─────────────────────────────────────────────────────────────────────────────

export type RequisitionRow = {
  id: string;
  title: string;
  department: string;
  employmentType: string;
  openings: number;
  location: string;
  budget: string;
  postedBy: string;
  postedDate: string;
  status: "Pending" | "Approved" | "Rejected";
};

export async function fetchPendingRequisitions(): Promise<RequisitionRow[]> {
  const requisitions = await prisma.jobRequisition.findMany({
    where: { status: { equals: "PENDING", mode: "insensitive" } },
    include: {
      vacancy: {
        include: {
          department: true,
          creator: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requisitions.map((r) => {
    const v = r.vacancy;
    const budgetParts: string[] = [];
    if (v.salaryMin != null) {
      const currency = v.currency === "USD" ? "$" : "Rp ";
      budgetParts.push(
        `${currency}${v.salaryMin.toLocaleString()}${v.salaryMax != null ? `–${currency}${v.salaryMax.toLocaleString()}` : ""}`,
      );
    }
    if (v.headcount > 1) {
      budgetParts.push(`(${v.headcount} openings)`);
    }

    return {
      id: r.id,
      title: v.title,
      department: v.department?.name ?? "—",
      employmentType: v.employmentType,
      openings: v.headcount,
      location: v.location ?? "—",
      budget: budgetParts.length > 0 ? budgetParts.join(" ") : "—",
      postedBy: v.creator?.name ?? "Unknown",
      postedDate: r.createdAt.toISOString(),
      status: "Pending",
    };
  });
}

export type RequisitionDetail = RequisitionRow & {
  justification: string;
  approvalChain: {
    role: string;
    name: string;
    title: string;
    status: "approved" | "pending" | "rejected";
    date: string | null;
    comment: string | null;
  }[];
};

/**
 * Canonical approval-chain order: Manager → HR → Finance.
 * Used to sort Approval records (which have no explicit `step` field)
 * into the correct real-world sequence regardless of DB insertion order.
 */
const APPROVAL_ROLE_ORDER: Record<string, number> = {
  MANAGER: 1,
  HR: 2,
  FINANCE: 3,
};

export async function fetchRequisitionById(
  id: string,
): Promise<RequisitionDetail | null> {
  const r = await prisma.jobRequisition.findFirst({
    where: { id },
    include: {
      vacancy: {
        include: {
          department: true,
          creator: true,
        },
      },
      approvals: {
        include: {
          approver: true,
        },
      },
    },
  });
  if (!r) return null;

  const v = r.vacancy;
  const budgetParts: string[] = [];
  if (v.salaryMin != null) {
    const currency = v.currency === "USD" ? "$" : "Rp ";
    budgetParts.push(
      `${currency}${v.salaryMin.toLocaleString()}${v.salaryMax != null ? `–${currency}${v.salaryMax.toLocaleString()}` : ""}`,
    );
  }
  if (v.headcount > 1) {
    budgetParts.push(`(${v.headcount} openings)`);
  }

  const roleLabel: Record<string, string> = {
    MANAGER: "Manager",
    HR: "HR",
    FINANCE: "Finance",
  };

  const approvalChain = r.approvals.map((a) => {
    const s = a.status.toLowerCase();
    const roleLabelValue = roleLabel[a.role] ?? a.role;
    return {
      role: roleLabelValue,
      name: a.approver?.name ?? "Unknown",
      // The User model has no `role` field — use the approval's role label
      // as the approver's title instead.
      title: roleLabelValue,
      status: (s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending") as
        | "approved"
        | "pending"
        | "rejected",
      date: a.approvedAt?.toISOString() ?? null,
      comment: a.comment,
    };
  });

  // Sort by canonical approval-chain order: Manager → HR → Finance
  approvalChain.sort(
    (a, b) =>
      (APPROVAL_ROLE_ORDER[a.role.toUpperCase()] ?? 99) -
      (APPROVAL_ROLE_ORDER[b.role.toUpperCase()] ?? 99),
  );

  return {
    id: r.id,
    title: v.title,
    department: v.department?.name ?? "—",
    employmentType: v.employmentType,
    openings: v.headcount,
    location: v.location ?? "—",
    budget: budgetParts.length > 0 ? budgetParts.join(" ") : "—",
    postedBy: v.creator?.name ?? "Unknown",
    postedDate: r.createdAt.toISOString(),
    status:
      r.status.toLowerCase() === "approved"
        ? "Approved"
        : r.status.toLowerCase() === "rejected"
          ? "Rejected"
          : "Pending",
    justification: v.description ?? "No justification provided.",
    approvalChain,
  };
}

export type CreateRequisitionInput = {
  title: string;
  departmentName: string;
  employmentType: string;
  headcount: number;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  justification: string;
  requestedById: string;
};

/**
 * Creates a new hiring requisition. This first creates a Vacancy (in "draft"
 * status) to hold the job details, then creates a JobRequisition linked to it,
 * and seeds the default approval chain (Manager → HR → Finance).
 *
 * Returns the new requisition ID.
 */
export async function createRequisition(
  input: CreateRequisitionInput,
): Promise<string> {
  // Resolve or create the department by name.
  let department = await prisma.department.findFirst({
    where: { name: { equals: input.departmentName, mode: "insensitive" } },
  });
  if (!department) {
    const deptSlug = input.departmentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20);
    department = await prisma.department.create({
      data: {
        name: input.departmentName,
        code: `${deptSlug}-${Date.now().toString(36)}`,
      },
    });
  }

  // Generate a unique vacancy code from title + timestamp.
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const code = `${slug}-${Date.now().toString(36)}`;

  // Create the vacancy in draft status.
  const vacancy = await prisma.vacancy.create({
    data: {
      title: input.title,
      code,
      departmentId: department.id,
      creatorId: input.requestedById,
      employmentType: input.employmentType,
      headcount: input.headcount,
      location: input.location,
      locationType: "onsite",
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      currency: "IDR",
      description: input.justification,
      status: "draft",
    },
  });

  // Create the requisition.
  const requisition = await prisma.jobRequisition.create({
    data: {
      vacancyId: vacancy.id,
      requestedById: input.requestedById,
      status: "PENDING",
      currentStep: 1,
    },
  });

  // Seed the default approval chain: Manager → HR → Finance.
  // Use the requesting user as the first approver fallback if no other
  // users exist. In production these would be assigned by org structure.
  const approvers = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    take: 3,
    orderBy: { createdAt: "asc" },
  });

  const roles = ["MANAGER", "HR", "FINANCE"];
  for (let i = 0; i < roles.length && i < approvers.length; i++) {
    await prisma.approval.create({
      data: {
        requisitionId: requisition.id,
        approverId: approvers[i].id,
        role: roles[i],
        status: "PENDING",
      },
    });
  }

  // If no approvers were found, create a self-approval entry so the
  // requisition is not stuck without an approval chain.
  if (approvers.length === 0) {
    await prisma.approval.create({
      data: {
        requisitionId: requisition.id,
        approverId: input.requestedById,
        role: "MANAGER",
        status: "PENDING",
      },
    });
  }

  return requisition.id;
}

export async function updateRequisitionStatus(
  id: string,
  decision: "approved" | "rejected",
  comment: string,
): Promise<void> {
  const requisition = await prisma.jobRequisition.findFirst({
    where: { id },
    include: { approvals: true },
  });
  if (!requisition) {
    throw new Error("Requisition not found");
  }

  // Sort approvals by canonical chain order: Manager → HR → Finance
  // so the "first pending" is the next approver in the correct sequence.
  requisition.approvals.sort(
    (a, b) =>
      (APPROVAL_ROLE_ORDER[a.role] ?? 99) -
      (APPROVAL_ROLE_ORDER[b.role] ?? 99),
  );

  // Find the first pending approval and update it
  const pendingApproval = requisition.approvals.find(
    (a) => a.status.toLowerCase() === "pending",
  );

  if (pendingApproval) {
    await prisma.approval.update({
      where: { id: pendingApproval.id },
      data: {
        status: decision.toUpperCase(),
        comment: comment || null,
        approvedAt: new Date(),
      },
    });
  }

  // Check if all approvals are done or if any is rejected
  const updatedApprovals = await prisma.approval.findMany({
    where: { requisitionId: id },
  });

  const allDecided = updatedApprovals.every(
    (a) => a.status.toLowerCase() === "approved" || a.status.toLowerCase() === "rejected",
  );
  const anyRejected = updatedApprovals.some(
    (a) => a.status.toLowerCase() === "rejected",
  );

  if (allDecided) {
    await prisma.jobRequisition.update({
      where: { id },
      data: {
        status: anyRejected ? "REJECTED" : "APPROVED",
        currentStep: updatedApprovals.length,
      },
    });

    // If approved, mark the vacancy as approved and published
    if (!anyRejected) {
      await prisma.vacancy.update({
        where: { id: requisition.vacancyId },
        data: {
          isApproved: true,
          status: "open",
          publishedAt: new Date(),
        },
      });
    }
  } else {
    // Advance to next step
    const approvedCount = updatedApprovals.filter(
      (a) => a.status.toLowerCase() === "approved",
    ).length;
    await prisma.jobRequisition.update({
      where: { id },
      data: { currentStep: approvedCount + 1 },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings — Users & Roles
// ─────────────────────────────────────────────────────────────────────────────

export type SettingsUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: "Active" | "Invited" | "Suspended";
  avatarColor?: string;
};

export type RoleRow = {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
};

const avatarColors = [
  "bg-[#006b5f]",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-violet-500",
];

export async function fetchSettingsUsers(): Promise<SettingsUser[]> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      // Only show users who have at least one UserRole record.
      // Candidates created via CV upload / SEEK import are stored in the same
      // User table but do NOT have UserRole records — this filter excludes them
      // from the Settings > Users view WITHOUT deleting any data.
      userRoles: { some: {} },
      // Defensive view-only guard: even if a SEEK-imported candidate somehow
      // received a UserRole record (observed in the live environment), exclude
      // it from the Settings > Users view by its import email pattern. This
      // only hides the row from this SELECT — the underlying data is untouched.
      NOT: {
        OR: [
          { email: { startsWith: "seek+", mode: "insensitive" } },
          { email: { endsWith: "@import.nuanu.local", mode: "insensitive" } },
        ],
      },
    },
    include: {
      userRoles: { include: { role: true } },
      department: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((u, i) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.userRoles[0]?.role?.name ?? "HR Staff",
    department: u.department?.name ?? "—",
    status: u.isActive ? "Active" : "Suspended",
    avatarColor: avatarColors[i % avatarColors.length],
  }));
}

export async function fetchRoles(): Promise<RoleRow[]> {
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
  });
  return roles
    .filter(
      (r) =>
        !["interviewer", "recruiter"].includes(r.slug?.toLowerCase() ?? "") &&
        !["interviewer", "recruiter"].includes(r.name.toLowerCase()),
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      isSystem: r.isSystem,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationRow = {
  id: string;
  type: "candidate" | "interview" | "offer" | "approval" | "system";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
};

export async function fetchNotifications(): Promise<NotificationRow[]> {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return notifications.map((n) => {
    const typeMap: Record<string, NotificationRow["type"]> = {
      candidate: "candidate",
      interview: "interview",
      offer: "offer",
      approval: "approval",
      system: "system",
    };
    return {
      id: n.id,
      type: typeMap[n.type] ?? "system",
      title: n.title,
      description: n.message,
      timestamp: formatDateTimeShortWita(n.createdAt),
      read: n.isRead,
    };
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function deleteNotification(id: string): Promise<void> {
  await prisma.notification.delete({ where: { id } });
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  return prisma.notification.count({ where: { isRead: false } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────────

export type AnalyticsData = {
  metrics: {
    totalApplications: number;
    hireConversionRate: string;
    avgTimeToHire: string;
    costPerHire: string;
  };
  sourcingData: {
    channel: string;
    applications: number;
    interviews: number;
    hires: number;
  }[];
  trendData: { month: string; applications: number; hires: number }[];
  funnelRates: { label: string; value: number; color: string }[];
};

export async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const [allApps, interviews, hiredApps] = await Promise.all([
    prisma.application.findMany({
      where: { deletedAt: null },
      select: { id: true, source: true, currentStage: true, appliedAt: true },
    }),
    prisma.interview.findMany({
      select: { applicationId: true },
    }),
    prisma.application.findMany({
      where: { deletedAt: null, currentStage: "hired" },
      select: { appliedAt: true, lastActivityAt: true },
    }),
  ]);

  // Metrics
  const totalApplications = allApps.length;
  const hiredCount = hiredApps.length;
  const hireRate =
    totalApplications > 0
      ? ((hiredCount / totalApplications) * 100).toFixed(1)
      : "0";

  let avgDays = 0;
  if (hiredApps.length > 0) {
    const totalDays = hiredApps.reduce((sum, app) => {
      const diff =
        (app.lastActivityAt.getTime() - app.appliedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      return sum + Math.max(0, Math.round(diff));
    }, 0);
    avgDays = Math.round(totalDays / hiredApps.length);
  }

  // Sourcing data with interviews + hires per channel
  const sourceMap = new Map<
    string,
    { applications: number; interviews: number; hires: number }
  >();
  const interviewAppIds = new Set(interviews.map((i) => i.applicationId));
  for (const app of allApps) {
    const channel = mapSource(app.source);
    const entry = sourceMap.get(channel) ?? {
      applications: 0,
      interviews: 0,
      hires: 0,
    };
    entry.applications++;
    if (interviewAppIds.has(app.id)) entry.interviews++;
    if (app.currentStage === "hired") entry.hires++;
    sourceMap.set(channel, entry);
  }
  const sourcingData = Array.from(sourceMap.entries())
    .map(([channel, data]) => ({ channel, ...data }))
    .sort((a, b) => b.applications - a.applications);

  // Monthly trend (last 12 months)
  const now = new Date();
  const months: { month: string; applications: number; hires: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleString("en-US", { month: "short" });
    const monthApps = allApps.filter((a) => {
      const ad = new Date(a.appliedAt);
      return (
        ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth()
      );
    });
    months.push({
      month: monthLabel,
      applications: monthApps.length,
      hires: monthApps.filter((a) => a.currentStage === "hired").length,
    });
  }

  // Funnel conversion rates
  const stageCount = (stage: string) =>
    allApps.filter((a) => a.currentStage === stage).length;
  const screeningCount = allApps.filter((a) =>
    ["screening", "hr_interview", "user_interview", "assessment", "offering", "hired"].includes(
      a.currentStage,
    ),
  ).length;
  const interviewCount = allApps.filter((a) =>
    ["hr_interview", "user_interview", "assessment", "offering", "hired"].includes(
      a.currentStage,
    ),
  ).length;
  const offerCount = stageCount("offering") + stageCount("hired");
  const funnelRates = [
    {
      label: "Application → Screen",
      value:
        totalApplications > 0
          ? Math.round((screeningCount / totalApplications) * 100)
          : 0,
      color: "bg-teal-600",
    },
    {
      label: "Screen → Interview",
      value:
        screeningCount > 0
          ? Math.round((interviewCount / screeningCount) * 100)
          : 0,
      color: "bg-indigo-500",
    },
    {
      label: "Interview → Offer",
      value:
        interviewCount > 0
          ? Math.round((offerCount / interviewCount) * 100)
          : 0,
      color: "bg-amber-500",
    },
  ];

  return {
    metrics: {
      totalApplications,
      hireConversionRate: `${hireRate}%`,
      avgTimeToHire: `${avgDays} days`,
      costPerHire: "Rp 0",
    },
    sourcingData,
    trendData: months,
    funnelRates,
  };
}

/**
 * Fetches the current user's profile (name, email, phone, location) for
 * the Settings > Profile form. Falls back to the first active user.
 */
export async function fetchCurrentUserProfile(): Promise<{
  name: string;
  email: string;
  phone: string;
  location: string;
}> {
  const user = await prisma.user.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      name: true,
      email: true,
      phone: true,
      location: true,
    },
  });
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    location: user?.location ?? "",
  };
}

/**
 * Returns whether Google Calendar sync is available.
 *
 * With the Service Account + Domain-Wide Delegation approach, "connected"
 * simply means the service account key file and impersonation email are
 * configured on the server — there is no per-user OAuth token to look up.
 */
export async function fetchCalendarConnected(): Promise<boolean> {
  // Imported lazily to avoid pulling googleapis into client bundles.
  const { isGoogleCalendarConfigured } = await import("@/lib/google-calendar");
  return isGoogleCalendarConfigured();
}
