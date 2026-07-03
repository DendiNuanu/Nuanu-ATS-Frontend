import { prisma } from "@/lib/prisma";
import type {
  Candidate,
  Job,
  Employee,
  Stage,
  Source,
} from "@/lib/mock-data";
import { extractCareerHistory, extractEducation } from "@/lib/profile-data";

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
  return new Date(date)
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", " ·");
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
  candidate: { name: string; email: string; phone: string | null };
  vacancy: { title: string; department: { name: string } | null } | null;
  candidateScore: {
    overallScore: number;
    hardSkillsScore: number;
    softSkillsScore: number;
    experienceScore: number;
    educationScore: number;
    formatScore: number;
    breakdown: unknown;
  } | null;
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
  parsedData: unknown;
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
  const department = app.vacancy?.department?.name ?? "";

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
    scoreBreakdown,
    scoreExplanation: null,
    summary: profile?.summary ?? null,
    skills: profile?.skills ?? [],
    resumeUrl: profile?.resumeUrl ?? null,
    resumeText: profile?.resumeText ?? null,
    linkedinUrl: profile?.linkedinUrl ?? null,
    gender: profile?.gender ?? null,
    isBlacklisted: false,
    blacklistReason: null,
    rejectionEmailSent: isRejectionEmail(app.emailSentSubject),
    rejectionEmailSentAt: app.emailSentAt
      ? formatEmailTimestamp(app.emailSentAt)
      : null,
    lastEmailSent: buildLastEmailSent(app.emailSentAt, app.emailSentSubject),
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
 * Parsed candidate data returned by the AI resume parser.
 * Field names mirror the real schema (User + CandidateProfile + Application).
 */
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

  // 2. Upsert the CandidateProfile with parsed resume data
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
        appliedFor: null,
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
      time: dt.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      type: typeMap[iv.type.toLowerCase()] ?? "On-site",
      interviewer: iv.interviewer?.name ?? "—",
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
      ? r.employee.startDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—",
    createdAt: r.createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
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
        orderBy: { role: "asc" },
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
    include: { approvals: { orderBy: { role: "asc" } } },
  });
  if (!requisition) {
    throw new Error("Requisition not found");
  }

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
    where: { deletedAt: null },
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
    role: u.userRoles[0]?.role?.name ?? "Recruiter",
    department: u.department?.name ?? "—",
    status: u.isActive ? "Active" : "Suspended",
    avatarColor: avatarColors[i % avatarColors.length],
  }));
}

export async function fetchRoles(): Promise<RoleRow[]> {
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
  });
  return roles.map((r) => ({
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
      timestamp: n.createdAt.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
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
