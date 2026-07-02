"use client";

import {
  FileText,
  Users,
  Briefcase,
  Clock,
  DollarSign,
  Target,
  BarChart3,
  Download,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { Card, Button } from "@/components/ui";

const reportCategories = [
  {
    title: "Recruitment Reports",
    description: "Track hiring pipeline performance and recruitment metrics",
    reports: [
      {
        name: "Hiring Summary Report",
        description: "Overview of all hires, applications, and conversion rates",
        icon: Users,
        lastGenerated: "2 days ago",
      },
      {
        name: "Pipeline Status Report",
        description: "Current state of all candidates across pipeline stages",
        icon: Briefcase,
        lastGenerated: "1 day ago",
      },
      {
        name: "Time to Hire Analysis",
        description: "Average days from application to offer acceptance",
        icon: Clock,
        lastGenerated: "5 days ago",
      },
      {
        name: "Source Effectiveness Report",
        description: "Performance breakdown by sourcing channel",
        icon: Target,
        lastGenerated: "3 days ago",
      },
    ],
  },
  {
    title: "Financial Reports",
    description: "Cost analysis and budget tracking for recruitment",
    reports: [
      {
        name: "Cost per Hire Report",
        description: "Total spend divided by number of hires",
        icon: DollarSign,
        lastGenerated: "1 week ago",
      },
      {
        name: "Recruitment Budget Tracker",
        description: "Budget allocation vs actual spend by department",
        icon: BarChart3,
        lastGenerated: "4 days ago",
      },
    ],
  },
  {
    title: "Compliance & Audit",
    description: "Diversity metrics and regulatory documentation",
    reports: [
      {
        name: "Diversity & Inclusion Report",
        description: "Demographic breakdown of applicant pool and hires",
        icon: Users,
        lastGenerated: "2 weeks ago",
      },
      {
        name: "Audit Trail Report",
        description: "Complete log of all system actions and changes",
        icon: FileText,
        lastGenerated: "Today",
      },
    ],
  },
];

const recentReports = [
  {
    name: "Q2 2026 Hiring Summary",
    type: "Hiring Summary Report",
    generatedBy: "Sari Wijaya",
    date: "Jul 1, 2026",
    size: "2.4 MB",
  },
  {
    name: "Engineering Pipeline Status",
    type: "Pipeline Status Report",
    generatedBy: "Budi Santoso",
    date: "Jun 30, 2026",
    size: "1.8 MB",
  },
  {
    name: "June Cost per Hire Analysis",
    type: "Cost per Hire Report",
    generatedBy: "Made Ayu Pradnya",
    date: "Jun 28, 2026",
    size: "1.2 MB",
  },
  {
    name: "H1 Diversity Report",
    type: "Diversity & Inclusion Report",
    generatedBy: "Rizki Ramadhan",
    date: "Jun 25, 2026",
    size: "3.1 MB",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate and download recruitment reports
          </p>
        </div>
        <Button variant="secondary" size="md">
          <Calendar className="mr-2 h-4 w-4" />
          Schedule Report
        </Button>
      </div>

      {/* Report Categories */}
      {reportCategories.map((category) => (
        <div key={category.title}>
          <div className="mb-3">
            <h2 className="font-heading text-lg font-semibold text-slate-900">
              {category.title}
            </h2>
            <p className="text-sm text-slate-500">{category.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {category.reports.map((report) => (
              <Card
                key={report.name}
                className="group cursor-pointer transition hover:border-[#006b5f] hover:shadow-md"
              >
                <div className="flex h-full flex-col">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6f5f3] text-[#006b5f]">
                    <report.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-base font-semibold text-slate-900">
                    {report.name}
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-slate-500">
                    {report.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">
                      Last: {report.lastGenerated}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#006b5f] group-hover:gap-2 transition-all">
                      Generate
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Recently Generated Reports */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-slate-900">
              Recently Generated Reports
            </h2>
            <p className="text-sm text-slate-500">
              Download previously generated reports
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Report Name
                </th>
                <th className="pb-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>
                <th className="pb-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Generated By
                </th>
                <th className="pb-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>
                <th className="pb-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Size
                </th>
                <th className="pb-3 pl-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentReports.map((report) => (
                <tr key={report.name} className="hover:bg-slate-50">
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-slate-900">
                        {report.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-sm text-slate-600">
                    {report.type}
                  </td>
                  <td className="py-3.5 px-4 text-sm text-slate-600">
                    {report.generatedBy}
                  </td>
                  <td className="py-3.5 px-4 text-sm text-slate-600">
                    {report.date}
                  </td>
                  <td className="py-3.5 px-4 text-sm text-slate-600">
                    {report.size}
                  </td>
                  <td className="py-3.5 pl-4 text-right">
                    <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#006b5f] hover:text-[#006b5f]">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
