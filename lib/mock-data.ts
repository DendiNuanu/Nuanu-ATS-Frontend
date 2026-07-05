// Shared mock data for the Nuanu HR Recruitment ATS prototype.
// All data is fake and for visual preview only.

// Canonical, ordered list of all candidate pipeline stages.
// This is the single source of truth — import from here everywhere.
export const CANDIDATE_STAGES = [
  "New",
  "Talent Bank",
  "Screening",
  "HR Interview",
  "User Interview",
  "Assessment",
  "User Interview II",
  "Offering",
  "Hired",
  "Rejected",
  "Onboarding",
] as const;

export type Stage = (typeof CANDIDATE_STAGES)[number];

// Colored dot used in pipeline column headers (and anywhere else a compact
// stage indicator is needed). Kept in sync with StatusPill stageStyles.
export const STAGE_DOT_COLORS: Record<Stage, string> = {
  "New": "bg-blue-500",
  "Talent Bank": "bg-slate-400",
  "Screening": "bg-purple-500",
  "HR Interview": "bg-amber-500",
  "User Interview": "bg-orange-500",
  "Assessment": "bg-indigo-500",
  "User Interview II": "bg-cyan-500",
  "Offering": "bg-teal-500",
  "Hired": "bg-green-500",
  "Rejected": "bg-red-500",
  "Onboarding": "bg-emerald-500",
};

export type Source = "SEEK" | "Referral" | "LinkedIn" | "Direct" | "Job Fair" | "Website";

/** A single career-history entry parsed from a CV / SEEK profile. */
export type CareerHistoryEntry = {
  role: string;
  company: string;
  period?: string;
  description?: string;
};

/** A single education entry parsed from a CV / SEEK profile. */
export type EducationEntry = {
  degree: string;
  institution?: string;
  period?: string;
  gpa?: string;
};

/** A single licence/certification entry parsed from a CV / SEEK profile. */
export type LicenceCertificationEntry = {
  name: string;
  issuingBody?: string;
  period?: string;
  expiryDate?: string;
};

/** A single application Q&A entry parsed from a CV / SEEK profile. */
export type ApplicationQuestionEntry = {
  question: string;
  answer?: string;
};

export type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: Source;
  position: string;
  department: string;
  /** Optional department override ID (set via Edit page). When null, the vacancy's department is used. */
  departmentId?: string | null;
  stage: Stage;
  aiMatch: number;
  appliedDate: string;
  avatarColor?: string;
  location?: string;
  experience?: string;
  education?: string;
  /** Legacy single refer-as value (kept for backward compat). */
  referAs?: string;
  expectedSalary?: string;
  /** Multi-slot applied-for positions (up to 3). Slot 1 = main applied-for role. */
  appliedForSlots?: string[];
  /** Multi-slot refer-as values (up to 3). Slot 1 = primary preferred name. */
  referAsSlots?: string[];
  /** Domicile (city/region) — distinct from application source location. */
  domicile?: string;
  /**
   * Real career-history entries parsed from the candidate's CV / SEEK profile.
   * Each entry: { role, company, period, description }. Empty when none on file.
   */
  careerHistory?: CareerHistoryEntry[];
  /**
   * Real education entries parsed from the candidate's CV / SEEK profile.
   * Each entry: { degree, institution, period, gpa }. Empty when none on file.
   */
  educationEntries?: EducationEntry[];
  /**
   * AI match breakdown sub-scores (0-100) from CandidateScore, when available.
   * { skills, experience, education, cultureFit }. Null when not scored.
   */
  scoreBreakdown?: {
    skills: number;
    experience: number;
    education: number;
    cultureFit: number;
  } | null;
  /** Natural-language explanation of the AI match score, when available. */
  scoreExplanation?: string | null;
  /** Candidate summary / headline from their profile (for resume tab). */
  summary?: string | null;
  /** Skills list from the candidate profile. */
  skills?: string[];
  /** URL to the candidate's resume file, when uploaded. */
  resumeUrl?: string | null;
  /** Parsed resume text (raw), when available. */
  resumeText?: string | null;
  /** LinkedIn URL, when available. */
  linkedinUrl?: string | null;
  /** Gender, when available (used for diversity reporting). */
  gender?: string | null;
  /** Licences & certifications parsed from the CV / SEEK profile. */
  licencesCertifications?: LicenceCertificationEntry[];
  /** Application-specific Q&A parsed from the CV / SEEK profile. */
  applicationQuestions?: ApplicationQuestionEntry[];
  /** Expected salary string, when stated in the CV. */
  expectedSalaryText?: string | null;
  /** Notice period, when stated in the CV. */
  noticePeriod?: string | null;
  /** Languages with proficiency, when stated in the CV. */
  languages?: string[];
  /**
   * Blacklist flag — independent from Stage. A candidate can be blacklisted
   * regardless of what pipeline stage they're in (e.g. a Rejected candidate
   * who was fraudulent, or an Offering-stage candidate who ghosted).
   * This is NOT a pipeline stage; it's a separate boolean layered on top.
   */
  isBlacklisted?: boolean;
  /** Reason stored when the candidate was blacklisted. Null when not blacklisted. */
  blacklistReason?: string | null;
  /**
   * Auto-set when a candidate's stage is changed to "Rejected" — records that
   * a rejection email was automatically dispatched. Preserved as an audit
   * trail even if the candidate is later moved out of Rejected.
   */
  rejectionEmailSent?: boolean;
  /** Timestamp (formatted "DD/MM/YYYY · HH:mm") of when the rejection email was sent. */
  rejectionEmailSentAt?: string | null;
  /**
   * General email-sent tracking — set for ANY email sent via the compose page
   * (using any of the 5 email templates). `type` is the template label
   * (e.g. "On Hold", "Rejected", "Process Slow"). When the "Rejected" template
   * is used, both `lastEmailSent` and `rejectionEmailSent` are set.
   */
  lastEmailSent?: { type: string; sentAt: string } | null;
  /**
   * Internal notes attached to this candidate's application.
   * Each note: { id, content, authorName, authorEmail, createdAt }.
   * Empty when no notes exist.
   */
  notes?: CandidateNoteEntry[];
  /** Assigned HR reviewer (User) for this candidate's application, when set. */
  hrReviewer?: { id: string; name: string; email: string } | null;
  /** Assigned User 1 reviewer for this candidate's application, when set. */
  user1Reviewer?: { id: string; name: string; email: string } | null;
  /** Assigned User 2 reviewer for this candidate's application, when set. */
  user2Reviewer?: { id: string; name: string; email: string } | null;
};

export type CandidateNoteEntry = {
  id: string;
  content: string;
  authorName: string;
  authorEmail: string | null;
  createdAt: string;
};

export type Job = {
  id: string;
  title: string;
  department: string;
  employmentType: "Full-time" | "Part-time" | "Contract" | "Internship";
  candidateCount: number;
  hiredCount: number;
  openings: number;
  status: "Open" | "On Hold" | "Closed" | "Draft";
  seekBadge?: boolean;
  postedDate: string;
  location: string;
};

export type Employee = {
  id: string;
  name: string;
  position: string;
  department: string;
  status: "Active" | "On Leave" | "Probation" | "Resigned";
  email: string;
  phone: string;
  joinDate: string;
  employeeId: string;
  location: string;
};

export type Notification = {
  id: string;
  type: "candidate" | "interview" | "offer" | "approval" | "system";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
};

export type Interview = {
  id: string;
  candidateName: string;
  position: string;
  date: string;
  time: string;
  type: "Video" | "Phone" | "On-site";
  interviewer: string;
};

export type Offer = {
  id: string;
  candidateName: string;
  position: string;
  salary: number;
  status: "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";
  date: string;
};

export type Assessment = {
  id: string;
  candidateName: string;
  position: string;
  title: string;
  type: "Technical" | "Behavioral" | "Cognitive" | "Case Study";
  score: number | null;
  status: "Sent" | "Pending" | "Completed" | "Expired";
  sentDate: string;
};

export const avatarColors = [
  "bg-[#006b5f]",
  "bg-blue-600",
  "bg-purple-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-cyan-600",
];

export const mockCandidates: Candidate[] = [
  {
    id: "c1",
    name: "Budi Santoso",
    email: "budi.santoso@email.com",
    phone: "+62 812 3456 7890",
    source: "SEEK",
    position: "Senior Frontend Engineer",
    department: "Engineering",
    stage: "Screening",
    aiMatch: 92,
    appliedDate: "2026-06-12",
    avatarColor: avatarColors[0],
    location: "Jakarta, ID",
    experience: "7 years",
    education: "B.Sc. Computer Science, Universitas Indonesia",
    referAs: "Budi",
    expectedSalary: "Rp 25.000.000 / month",
  },
  {
    id: "c2",
    name: "Siti Nurhaliza",
    email: "siti.nurhaliza@email.com",
    phone: "+62 813 2222 1111",
    source: "Referral",
    position: "Product Designer",
    department: "Design",
    stage: "HR Interview",
    aiMatch: 88,
    appliedDate: "2026-06-10",
    avatarColor: avatarColors[1],
    location: "Bandung, ID",
    experience: "5 years",
    education: "B.Des Visual Communication, ITB",
    referAs: "Siti",
    expectedSalary: "Rp 18.000.000 / month",
  },
  {
    id: "c3",
    name: "Andi Wijaya",
    email: "andi.wijaya@email.com",
    phone: "+62 811 9999 0000",
    source: "LinkedIn",
    position: "Backend Engineer",
    department: "Engineering",
    stage: "Offering",
    aiMatch: 95,
    appliedDate: "2026-06-08",
    avatarColor: avatarColors[2],
    location: "Surabaya, ID",
    experience: "8 years",
    education: "B.Sc. Informatics, ITS",
    referAs: "Andi",
    expectedSalary: "Rp 28.000.000 / month",
    isBlacklisted: true,
    blacklistReason: "No-show at 3 scheduled interviews",
  },
  {
    id: "c4",
    name: "Dewi Lestari",
    email: "dewi.lestari@email.com",
    phone: "+62 815 7777 8888",
    source: "SEEK",
    position: "Data Analyst",
    department: "Data",
    stage: "New",
    aiMatch: 76,
    appliedDate: "2026-06-15",
    avatarColor: avatarColors[3],
    location: "Jakarta, ID",
    experience: "3 years",
    education: "B.Sc. Statistics, Universitas Indonesia",
    referAs: "Dewi",
    expectedSalary: "Rp 12.000.000 / month",
  },
  {
    id: "c5",
    name: "Rizki Pratama",
    email: "rizki.pratama@email.com",
    phone: "+62 817 4444 5555",
    source: "Direct",
    position: "DevOps Engineer",
    department: "Engineering",
    stage: "Screening",
    aiMatch: 84,
    appliedDate: "2026-06-14",
    avatarColor: avatarColors[4],
    location: "Yogyakarta, ID",
    experience: "6 years",
    education: "B.Sc. Computer Engineering, UGM",
    referAs: "Rizki",
    expectedSalary: "Rp 22.000.000 / month",
  },
  {
    id: "c6",
    name: "Putri Maharani",
    email: "putri.maharani@email.com",
    phone: "+62 819 3333 2222",
    source: "Job Fair",
    position: "HR Generalist",
    department: "Human Resources",
    stage: "User Interview",
    aiMatch: 81,
    appliedDate: "2026-06-11",
    avatarColor: avatarColors[5],
    location: "Jakarta, ID",
    experience: "4 years",
    education: "B.A. Psychology, Universitas Indonesia",
    referAs: "Putri",
    expectedSalary: "Rp 15.000.000 / month",
    isBlacklisted: true,
    blacklistReason: "Inappropriate conduct during interview",
  },
  {
    id: "c7",
    name: "Agus Setiawan",
    email: "agus.setiawan@email.com",
    phone: "+62 812 1111 3333",
    source: "SEEK",
    position: "Senior Backend Engineer",
    department: "Engineering",
    stage: "Hired",
    aiMatch: 90,
    appliedDate: "2026-05-28",
    avatarColor: avatarColors[6],
    location: "Bekasi, ID",
    experience: "9 years",
    education: "M.Sc. Computer Science, UI",
    referAs: "Agus",
    expectedSalary: "Rp 30.000.000 / month",
  },
  {
    id: "c8",
    name: "Maya Sari",
    email: "maya.sari@email.com",
    phone: "+62 813 5555 6666",
    source: "Referral",
    position: "Marketing Manager",
    department: "Marketing",
    stage: "Rejected",
    aiMatch: 64,
    appliedDate: "2026-06-05",
    avatarColor: avatarColors[7],
    location: "Tangerang, ID",
    experience: "6 years",
    education: "B.Com Marketing, Universitas Padjadjaran",
    isBlacklisted: true,
    blacklistReason: "Falsified employment history",
    rejectionEmailSent: true,
    rejectionEmailSentAt: "18/06/2026 · 14:22",
  },
  {
    id: "c9",
    name: "Fajar Hidayat",
    email: "fajar.hidayat@email.com",
    phone: "+62 811 7777 9999",
    source: "LinkedIn",
    position: "Mobile Engineer",
    department: "Engineering",
    stage: "Talent Bank",
    aiMatch: 79,
    appliedDate: "2026-05-20",
    avatarColor: avatarColors[0],
    location: "Bandung, ID",
    experience: "5 years",
    education: "B.Sc. Informatics, ITB",
  },
  {
    id: "c10",
    name: "Indah Permatasari",
    email: "indah.permatasari@email.com",
    phone: "+62 815 2222 4444",
    source: "Website",
    position: "UX Researcher",
    department: "Design",
    stage: "New",
    aiMatch: 87,
    appliedDate: "2026-06-16",
    avatarColor: avatarColors[1],
    location: "Jakarta, ID",
    experience: "4 years",
    education: "B.A. Psychology, UGM",
  },
  {
    id: "c11",
    name: "Reza Pahlevi",
    email: "reza.pahlevi@email.com",
    phone: "+62 812 8888 1234",
    source: "LinkedIn",
    position: "QA Engineer",
    department: "Engineering",
    stage: "Assessment",
    aiMatch: 83,
    appliedDate: "2026-06-13",
    avatarColor: avatarColors[2],
    location: "Bandung, ID",
    experience: "4 years",
    education: "B.Sc. Informatics, ITB",
    referAs: "Reza",
    expectedSalary: "Rp 14.000.000 / month",
  },
  {
    id: "c12",
    name: "Nadia Kusuma",
    email: "nadia.kusuma@email.com",
    phone: "+62 813 4444 7777",
    source: "Referral",
    position: "Content Strategist",
    department: "Marketing",
    stage: "User Interview II",
    aiMatch: 86,
    appliedDate: "2026-06-09",
    avatarColor: avatarColors[3],
    location: "Jakarta, ID",
    experience: "5 years",
    education: "B.A. Communications, Universitas Indonesia",
    referAs: "Nadia",
    expectedSalary: "Rp 16.000.000 / month",
  },
  {
    id: "c13",
    name: "Bayu Nugroho",
    email: "bayu.nugroho@email.com",
    phone: "+62 811 2222 6666",
    source: "Direct",
    position: "Sales Executive",
    department: "Sales",
    stage: "Onboarding",
    aiMatch: 78,
    appliedDate: "2026-05-25",
    avatarColor: avatarColors[4],
    location: "Surabaya, ID",
    experience: "6 years",
    education: "B.Com Business Administration, Universitas Airlangga",
    referAs: "Bayu",
    expectedSalary: "Rp 13.000.000 / month",
  },
];

export const mockJobs: Job[] = [
  {
    id: "j1",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    candidateCount: 24,
    hiredCount: 0,
    openings: 2,
    status: "Open",
    seekBadge: true,
    postedDate: "2026-06-01",
    location: "Jakarta, ID",
  },
  {
    id: "j2",
    title: "Product Designer",
    department: "Design",
    employmentType: "Full-time",
    candidateCount: 18,
    hiredCount: 0,
    openings: 1,
    status: "Open",
    seekBadge: true,
    postedDate: "2026-06-03",
    location: "Jakarta, ID",
  },
  {
    id: "j3",
    title: "Backend Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    candidateCount: 31,
    hiredCount: 1,
    openings: 3,
    status: "Open",
    seekBadge: true,
    postedDate: "2026-05-28",
    location: "Remote, ID",
  },
  {
    id: "j4",
    title: "Data Analyst",
    department: "Data",
    employmentType: "Contract",
    candidateCount: 12,
    hiredCount: 0,
    openings: 1,
    status: "On Hold",
    seekBadge: false,
    postedDate: "2026-06-10",
    location: "Jakarta, ID",
  },
  {
    id: "j5",
    title: "DevOps Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    candidateCount: 9,
    hiredCount: 0,
    openings: 1,
    status: "Open",
    seekBadge: true,
    postedDate: "2026-06-08",
    location: "Jakarta, ID",
  },
  {
    id: "j6",
    title: "HR Generalist",
    department: "Human Resources",
    employmentType: "Full-time",
    candidateCount: 15,
    hiredCount: 0,
    openings: 1,
    status: "Open",
    seekBadge: false,
    postedDate: "2026-06-05",
    location: "Jakarta, ID",
  },
  {
    id: "j7",
    title: "Marketing Manager",
    department: "Marketing",
    employmentType: "Full-time",
    candidateCount: 7,
    hiredCount: 0,
    openings: 1,
    status: "Draft",
    seekBadge: false,
    postedDate: "2026-06-15",
    location: "Jakarta, ID",
  },
  {
    id: "j8",
    title: "Mobile Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    candidateCount: 21,
    hiredCount: 1,
    openings: 2,
    status: "Closed",
    seekBadge: true,
    postedDate: "2026-05-10",
    location: "Bandung, ID",
  },
  {
    id: "j9",
    title: "UX Researcher",
    department: "Design",
    employmentType: "Full-time",
    candidateCount: 11,
    hiredCount: 0,
    openings: 1,
    status: "Open",
    seekBadge: false,
    postedDate: "2026-06-12",
    location: "Jakarta, ID",
  },
];

export const mockEmployees: Employee[] = [
  {
    id: "e1",
    name: "Agus Setiawan",
    position: "Senior Backend Engineer",
    department: "Engineering",
    status: "Active",
    email: "agus.setiawan@nuanu.com",
    phone: "+62 812 1111 3333",
    joinDate: "2024-03-15",
    employeeId: "NUN-2024-0142",
    location: "Bekasi, ID",
  },
  {
    id: "e2",
    name: "Budi Santoso",
    position: "Engineering Manager",
    department: "Engineering",
    status: "Active",
    email: "budi.santoso@nuanu.com",
    phone: "+62 812 3456 7890",
    joinDate: "2022-08-01",
    employeeId: "NUN-2022-0089",
    location: "Jakarta, ID",
  },
  {
    id: "e3",
    name: "Siti Nurhaliza",
    position: "Lead Product Designer",
    department: "Design",
    status: "Active",
    email: "siti.nurhaliza@nuanu.com",
    phone: "+62 813 2222 1111",
    joinDate: "2023-01-10",
    employeeId: "NUN-2023-0103",
    location: "Bandung, ID",
  },
  {
    id: "e4",
    name: "Dewi Lestari",
    position: "Data Analyst",
    department: "Data",
    status: "On Leave",
    email: "dewi.lestari@nuanu.com",
    phone: "+62 815 7777 8888",
    joinDate: "2023-09-05",
    employeeId: "NUN-2023-0211",
    location: "Jakarta, ID",
  },
  {
    id: "e5",
    name: "Rizki Pratama",
    position: "DevOps Engineer",
    department: "Engineering",
    status: "Probation",
    email: "rizki.pratama@nuanu.com",
    phone: "+62 817 4444 5555",
    joinDate: "2026-05-20",
    employeeId: "NUN-2026-0388",
    location: "Yogyakarta, ID",
  },
  {
    id: "e6",
    name: "Putri Maharani",
    position: "HR Generalist",
    department: "Human Resources",
    status: "Active",
    email: "putri.maharani@nuanu.com",
    phone: "+62 819 3333 2222",
    joinDate: "2024-02-14",
    employeeId: "NUN-2024-0131",
    location: "Jakarta, ID",
  },
  {
    id: "e7",
    name: "Maya Sari",
    position: "Marketing Specialist",
    department: "Marketing",
    status: "Resigned",
    email: "maya.sari@nuanu.com",
    phone: "+62 813 5555 6666",
    joinDate: "2023-06-01",
    employeeId: "NUN-2023-0177",
    location: "Tangerang, ID",
  },
  {
    id: "e8",
    name: "Fajar Hidayat",
    position: "Mobile Engineer",
    department: "Engineering",
    status: "Active",
    email: "fajar.hidayat@nuanu.com",
    phone: "+62 811 7777 9999",
    joinDate: "2024-11-20",
    employeeId: "NUN-2024-0299",
    location: "Bandung, ID",
  },
];

export const mockNotifications: Notification[] = [
  {
    id: "n1",
    type: "candidate",
    title: "New candidate applied",
    description: "Indah Permatasari applied for UX Researcher",
    timestamp: "5 minutes ago",
    read: false,
  },
  {
    id: "n2",
    type: "interview",
    title: "Interview scheduled",
    description: "Siti Nurhaliza — Product Designer interview tomorrow at 10:00",
    timestamp: "1 hour ago",
    read: false,
  },
  {
    id: "n3",
    type: "offer",
    title: "Offer accepted",
    description: "Andi Wijaya accepted the Backend Engineer offer",
    timestamp: "3 hours ago",
    read: false,
  },
  {
    id: "n4",
    type: "approval",
    title: "Approval required",
    description: "Marketing Manager requisition needs Finance approval",
    timestamp: "Yesterday",
    read: true,
  },
  {
    id: "n5",
    type: "system",
    title: "AI scoring complete",
    description: "12 new resumes have been scored by the Intelligence Engine",
    timestamp: "2 days ago",
    read: true,
  },
  {
    id: "n6",
    type: "candidate",
    title: "Candidate moved to Talent Bank",
    description: "Fajar Hidayat was moved to the talent bank",
    timestamp: "3 days ago",
    read: true,
  },
];

export const mockInterviews: Interview[] = [
  {
    id: "i1",
    candidateName: "Siti Nurhaliza",
    position: "Product Designer",
    date: "2026-07-03",
    time: "10:00 - 11:00",
    type: "Video",
    interviewer: "Budi Santoso",
  },
  {
    id: "i2",
    candidateName: "Putri Maharani",
    position: "HR Generalist",
    date: "2026-07-03",
    time: "13:00 - 14:00",
    type: "On-site",
    interviewer: "Putri Maharani",
  },
  {
    id: "i3",
    candidateName: "Rizki Pratama",
    position: "DevOps Engineer",
    date: "2026-07-04",
    time: "09:00 - 10:00",
    type: "Phone",
    interviewer: "Agus Setiawan",
  },
  {
    id: "i4",
    candidateName: "Indah Permatasari",
    position: "UX Researcher",
    date: "2026-07-04",
    time: "15:00 - 16:00",
    type: "Video",
    interviewer: "Siti Nurhaliza",
  },
  {
    id: "i5",
    candidateName: "Dewi Lestari",
    position: "Data Analyst",
    date: "2026-07-05",
    time: "11:00 - 12:00",
    type: "On-site",
    interviewer: "Budi Santoso",
  },
];

export const mockOffers: Offer[] = [
  {
    id: "o1",
    candidateName: "Andi Wijaya",
    position: "Backend Engineer",
    salary: 28000000,
    status: "Accepted",
    date: "2026-06-20",
  },
  {
    id: "o2",
    candidateName: "Agus Setiawan",
    position: "Senior Backend Engineer",
    salary: 35000000,
    status: "Accepted",
    date: "2026-05-30",
  },
  {
    id: "o3",
    candidateName: "Budi Santoso",
    position: "Senior Frontend Engineer",
    salary: 30000000,
    status: "Sent",
    date: "2026-06-25",
  },
  {
    id: "o4",
    candidateName: "Maya Sari",
    position: "Marketing Manager",
    salary: 22000000,
    status: "Rejected",
    date: "2026-06-18",
  },
  {
    id: "o5",
    candidateName: "Siti Nurhaliza",
    position: "Product Designer",
    salary: 26000000,
    status: "Draft",
    date: "2026-06-28",
  },
  {
    id: "o6",
    candidateName: "Rizki Pratama",
    position: "DevOps Engineer",
    salary: 27000000,
    status: "Expired",
    date: "2026-06-10",
  },
];

export const mockAssessments: Assessment[] = [
  {
    id: "a1",
    candidateName: "Budi Santoso",
    position: "Senior Frontend Engineer",
    title: "Frontend Technical Test",
    type: "Technical",
    score: 88,
    status: "Completed",
    sentDate: "2026-06-14",
  },
  {
    id: "a2",
    candidateName: "Siti Nurhaliza",
    position: "Product Designer",
    title: "Design Portfolio Review",
    type: "Case Study",
    score: 92,
    status: "Completed",
    sentDate: "2026-06-12",
  },
  {
    id: "a3",
    candidateName: "Dewi Lestari",
    position: "Data Analyst",
    title: "SQL & Analytics Test",
    type: "Technical",
    score: null,
    status: "Pending",
    sentDate: "2026-06-16",
  },
  {
    id: "a4",
    candidateName: "Rizki Pratama",
    position: "DevOps Engineer",
    title: "Behavioral Assessment",
    type: "Behavioral",
    score: null,
    status: "Sent",
    sentDate: "2026-06-15",
  },
  {
    id: "a5",
    candidateName: "Putri Maharani",
    position: "HR Generalist",
    title: "Cognitive Aptitude Test",
    type: "Cognitive",
    score: 79,
    status: "Completed",
    sentDate: "2026-06-13",
  },
  {
    id: "a6",
    candidateName: "Indah Permatasari",
    position: "UX Researcher",
    title: "UX Case Study",
    type: "Case Study",
    score: null,
    status: "Expired",
    sentDate: "2026-06-01",
  },
];

export const currentUser = {
  name: "Budi Santoso",
  role: "Talent Acquisition Lead",
  email: "budi.santoso@nuanu.com",
};

export type UserRole = "Super Admin" | "Manager" | "HR Staff" | "Finance";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  status: "Active" | "Invited" | "Suspended";
  avatarColor?: string;
};

export const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  "Super Admin": "bg-purple-100 text-purple-700",
  "Manager": "bg-blue-100 text-blue-700",
  "HR Staff": "bg-teal-100 text-teal-800",
  "Finance": "bg-emerald-100 text-emerald-700",
};

export const ALL_ROLES: UserRole[] = [
  "Super Admin",
  "Manager",
  "HR Staff",
  "Finance",
];

export const DEPARTMENTS = [
  "Human Resources",
  "Engineering",
  "Design",
  "Data",
  "Marketing",
  "Sales",
  "Operations",
  "Finance",
];

export const mockUsers: AppUser[] = [
  {
    id: "u1",
    name: "Budi Santoso",
    email: "budi.santoso@nuanu.com",
    role: "Super Admin",
    department: "Human Resources",
    status: "Active",
    avatarColor: avatarColors[0],
  },
  {
    id: "u2",
    name: "Siti Nurhaliza",
    email: "siti.nurhaliza@nuanu.com",
    role: "Manager",
    department: "Operations",
    status: "Active",
    avatarColor: avatarColors[1],
  },
  {
    id: "u3",
    name: "Andi Wijaya",
    email: "andi.wijaya@nuanu.com",
    role: "Manager",
    department: "Operations",
    status: "Active",
    avatarColor: avatarColors[2],
  },
];
