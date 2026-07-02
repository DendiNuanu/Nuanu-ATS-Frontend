import { prisma } from "@/lib/prisma";
import type { Candidate, Job, Employee, Stage, Source } from "@/lib/mock-data";

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
    const user = app.candidate;
    const profile = profileMap.get(app.candidateId);
    const stage = mapDbStageToUiStage(app.currentStage);
    const position =
      app.vacancy?.title ?? app.appliedFor ?? profile?.currentTitle ?? "—";
    const department = app.vacancy?.department?.name ?? "";

    return {
      id: app.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      source: mapSource(app.source),
      position,
      department,
      stage,
      aiMatch: app.candidateScore
        ? Math.round(app.candidateScore.overallScore)
        : 0,
      appliedDate: app.appliedAt.toISOString(),
      avatarColor: avatarColorFor(user.name),
      location: profile?.location ?? "",
      experience: profile?.experienceYears
        ? `${profile.experienceYears} years`
        : "",
      education: profile?.education ?? "",
      referAs: user.name.split(" ")[0],
      expectedSalary: profile?.expectedSalary
        ? `$${profile.expectedSalary.toLocaleString()}`
        : "",
      appliedForSlots: app.appliedFor
        ? [app.appliedFor]
        : position !== "—"
          ? [position]
          : [],
      referAsSlots: [user.name.split(" ")[0]],
      domicile: profile?.domicile ?? profile?.location ?? "",
      isBlacklisted: false,
      blacklistReason: null,
      rejectionEmailSent: isRejectionEmail(app.emailSentSubject),
      rejectionEmailSentAt: app.emailSentAt
        ? formatEmailTimestamp(app.emailSentAt)
        : null,
      lastEmailSent: buildLastEmailSent(app.emailSentAt, app.emailSentSubject),
    } satisfies Candidate;
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
    const user = app.candidate;
    const profile = profileMap.get(app.candidateId);
    const stage = mapDbStageToUiStage(app.currentStage);
    const position =
      app.vacancy?.title ?? app.appliedFor ?? profile?.currentTitle ?? "—";
    const department = app.vacancy?.department?.name ?? "";

    return {
      id: app.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      source: mapSource(app.source),
      position,
      department,
      stage,
      aiMatch: app.candidateScore
        ? Math.round(app.candidateScore.overallScore)
        : 0,
      appliedDate: app.appliedAt.toISOString(),
      avatarColor: avatarColorFor(user.name),
      location: profile?.location ?? "",
      experience: profile?.experienceYears
        ? `${profile.experienceYears} years`
        : "",
      education: profile?.education ?? "",
      referAs: user.name.split(" ")[0],
      expectedSalary: profile?.expectedSalary
        ? `$${profile.expectedSalary.toLocaleString()}`
        : "",
      appliedForSlots: app.appliedFor
        ? [app.appliedFor]
        : position !== "—"
          ? [position]
          : [],
      referAsSlots: [user.name.split(" ")[0]],
      domicile: profile?.domicile ?? profile?.location ?? "",
      isBlacklisted: false,
      blacklistReason: null,
      rejectionEmailSent: isRejectionEmail(app.emailSentSubject),
      rejectionEmailSentAt: app.emailSentAt
        ? formatEmailTimestamp(app.emailSentAt)
        : null,
      lastEmailSent: buildLastEmailSent(app.emailSentAt, app.emailSentSubject),
    } satisfies Candidate;
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

  const user = app.candidate;
  const stage = mapDbStageToUiStage(app.currentStage);
  const position =
    app.vacancy?.title ?? app.appliedFor ?? profile?.currentTitle ?? "—";
  const department = app.vacancy?.department?.name ?? "";

  return {
    id: app.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    source: mapSource(app.source),
    position,
    department,
    stage,
    aiMatch: app.candidateScore
      ? Math.round(app.candidateScore.overallScore)
      : 0,
    appliedDate: app.appliedAt.toISOString(),
    avatarColor: avatarColorFor(user.name),
    location: profile?.location ?? "",
    experience: profile?.experienceYears
      ? `${profile.experienceYears} years`
      : "",
    education: profile?.education ?? "",
    referAs: user.name.split(" ")[0],
    expectedSalary: profile?.expectedSalary
      ? `$${profile.expectedSalary.toLocaleString()}`
      : "",
    appliedForSlots: app.appliedFor
      ? [app.appliedFor]
      : position !== "—"
        ? [position]
        : [],
    referAsSlots: [user.name.split(" ")[0]],
    domicile: profile?.domicile ?? profile?.location ?? "",
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
