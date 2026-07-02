"use client";

import {
  FileText,
  Users,
  Briefcase,
  Clock,
  DollarSign,
  Target,
  BarChart3,
  Calendar,
  ChevronRight,
  Inbox,
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
      },
      {
        name: "Pipeline Status Report",
        description: "Current state of all candidates across pipeline stages",
        icon: Briefcase,
      },
      {
        name: "Time to Hire Analysis",
        description: "Average days from application to offer acceptance",
        icon: Clock,
      },
      {
        name: "Source Effectiveness Report",
        description: "Performance breakdown by sourcing channel",
        icon: Target,
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
      },
      {
        name: "Recruitment Budget Tracker",
        description: "Budget allocation vs actual spend by department",
        icon: BarChart3,
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
      },
      {
        name: "Audit Trail Report",
        description: "Complete log of all system actions and changes",
        icon: FileText,
      },
    ],
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
                      Never generated
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

      {/* Recently Generated Reports — honest empty state */}
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Inbox className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="font-heading text-lg font-semibold text-slate-900">
            No reports generated yet
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Generate a report from the categories above to see it listed here for download.
          </p>
        </div>
      </Card>
    </div>
  );
}
