"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  Users,
  Briefcase,
  Clock,
  DollarSign,
  Target,
  BarChart3,
  ChevronRight,
  Inbox,
  Download,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { formatDateTimeShortWita } from "@/lib/format-wita";

type ReportItem = {
  name: string;
  description: string;
  icon: typeof Users;
  type: string;
};

type ReportCategory = {
  title: string;
  description: string;
  reports: ReportItem[];
};

const reportCategories: ReportCategory[] = [
  {
    title: "Recruitment Reports",
    description: "Track hiring pipeline performance and recruitment metrics",
    reports: [
      {
        name: "Hiring Summary Report",
        description:
          "Overview of all hires, applications, and conversion rates",
        icon: Users,
        type: "hiring_summary",
      },
      {
        name: "Pipeline Status Report",
        description: "Current state of all candidates across pipeline stages",
        icon: Briefcase,
        type: "pipeline_status",
      },
      {
        name: "Time to Hire Analysis",
        description: "Average days from application to offer acceptance",
        icon: Clock,
        type: "time_to_hire",
      },
      {
        name: "Source Effectiveness Report",
        description: "Performance breakdown by sourcing channel",
        icon: Target,
        type: "source_effectiveness",
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
        type: "cost_per_hire",
      },
      {
        name: "Recruitment Budget Tracker",
        description: "Budget allocation vs actual spend by department",
        icon: BarChart3,
        type: "budget_tracker",
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
        type: "diversity",
      },
      {
        name: "Audit Trail Report",
        description: "Complete log of all system actions and changes",
        icon: FileText,
        type: "audit_trail",
      },
    ],
  },
];

type GeneratedReport = {
  name: string;
  type: string;
  generatedAt: string;
  csv: string;
};

export default function ReportsPage() {
  const { showToast } = useToast();
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedReport[]>([]);

  const downloadCSV = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerate = useCallback(
    async (report: ReportItem) => {
      setGenerating(report.type);
      try {
        const res = await fetch(`/api/reports?type=${report.type}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to generate report");
        }
        const csv = await res.text();
        const now = formatDateTimeShortWita(new Date());
        const entry: GeneratedReport = {
          name: report.name,
          type: report.type,
          generatedAt: now,
          csv,
        };
        setGenerated((prev) => [entry, ...prev]);
        downloadCSV(
          `${report.type}-${new Date().toISOString().split("T")[0]}.csv`,
          csv,
        );
        showToast(`${report.name} generated successfully`, "success");
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : "Failed to generate report",
          "error",
        );
      } finally {
        setGenerating(null);
      }
    },
    [showToast],
  );

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
                className="group transition hover:border-[#006b5f] hover:shadow-md"
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
                      {generating === report.type ? "Generating..." : "Ready"}
                    </span>
                    <button
                      onClick={() => handleGenerate(report)}
                      disabled={generating === report.type}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#006b5f] hover:gap-2 transition-all disabled:opacity-50"
                    >
                      {generating === report.type ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      Generate
                    </button>
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
        {generated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Inbox className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-slate-900">
              No reports generated yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Generate a report from the categories above to see it listed here
              for download.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Report
                  </th>
                  <th className="pb-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Generated
                  </th>
                  <th className="pb-3 pl-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {generated.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3.5 pr-4 font-medium text-slate-900">
                      {r.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {r.generatedAt}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <button
                        onClick={() =>
                          downloadCSV(
                            `${r.type}-${new Date()
                              .toISOString()
                              .split("T")[0]}.csv`,
                            r.csv,
                          )
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#006b5f] hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
