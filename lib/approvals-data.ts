// Shared mock requisition data for the Approvals section.
// All data is fake and for visual preview only.

export type ApprovalStatus = "approved" | "pending" | "rejected";

export type ApprovalStep = {
  role: string;
  name: string;
  title: string;
  status: ApprovalStatus;
  date: string | null;
  comment: string | null;
};

export type Requisition = {
  id: string;
  title: string;
  department: string;
  employmentType: "Full-time" | "Part-time" | "Contract" | "Internship";
  openings: number;
  location: string;
  budget: string;
  postedBy: string;
  postedDate: string;
  justification: string;
  status: "Pending" | "Approved" | "Rejected";
  approvalChain: ApprovalStep[];
};

export const mockRequisitions: Requisition[] = [
  {
    id: "req-001",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    openings: 2,
    location: "Jakarta, ID",
    budget: "Rp 60M / month (total)",
    postedBy: "Budi Santoso",
    postedDate: "2026-06-01",
    justification:
      "Team is scaling the web platform to support the new product launch in Q3. Two additional senior engineers are required to meet delivery commitments.",
    status: "Pending",
    approvalChain: [
      {
        role: "Manager",
        name: "Budi Santoso",
        title: "Engineering Manager",
        status: "approved",
        date: "2026-06-02",
        comment: "Approved — critical hire for Q3 roadmap.",
      },
      {
        role: "HR",
        name: "Putri Maharani",
        title: "HR Generalist",
        status: "approved",
        date: "2026-06-03",
        comment: "Approved — budget confirmed within department allocation.",
      },
      {
        role: "Finance",
        name: "Andi Wijaya",
        title: "Finance Controller",
        status: "pending",
        date: null,
        comment: null,
      },
    ],
  },
  {
    id: "req-002",
    title: "Product Designer",
    department: "Design",
    employmentType: "Full-time",
    openings: 1,
    location: "Bali, ID",
    budget: "Rp 35M / month",
    postedBy: "Sari Wijaya",
    postedDate: "2026-06-10",
    justification:
      "The design team needs an additional product designer to own the end-to-end experience for the mobile app redesign launching next quarter.",
    status: "Pending",
    approvalChain: [
      {
        role: "Manager",
        name: "Sari Wijaya",
        title: "Head of Design",
        status: "approved",
        date: "2026-06-11",
        comment: "Approved — essential for mobile redesign timeline.",
      },
      {
        role: "HR",
        name: "Putri Maharani",
        title: "HR Generalist",
        status: "pending",
        date: null,
        comment: null,
      },
      {
        role: "Finance",
        name: "Andi Wijaya",
        title: "Finance Controller",
        status: "pending",
        date: null,
        comment: null,
      },
    ],
  },
  {
    id: "req-003",
    title: "Data Analyst",
    department: "Analytics",
    employmentType: "Contract",
    openings: 1,
    location: "Remote (ID)",
    budget: "Rp 22M / month",
    postedBy: "Dewi Lestari",
    postedDate: "2026-06-15",
    justification:
      "Require a contract data analyst for a 6-month engagement to build reporting dashboards for the new analytics platform migration.",
    status: "Pending",
    approvalChain: [
      {
        role: "Manager",
        name: "Dewi Lestari",
        title: "Analytics Lead",
        status: "pending",
        date: null,
        comment: null,
      },
      {
        role: "HR",
        name: "Putri Maharani",
        title: "HR Generalist",
        status: "pending",
        date: null,
        comment: null,
      },
      {
        role: "Finance",
        name: "Andi Wijaya",
        title: "Finance Controller",
        status: "pending",
        date: null,
        comment: null,
      },
    ],
  },
];

export const departments = [
  "Engineering",
  "Design",
  "Analytics",
  "Marketing",
  "Sales",
  "Operations",
  "Human Resources",
  "Finance",
];

export const employmentTypes = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
] as const;
