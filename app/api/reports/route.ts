import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function escapeCSV(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCSV(rows: (string | number | null)[][]): string {
  return rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type) {
    return NextResponse.json(
      { error: "Report type is required" },
      { status: 400 },
    );
  }

  try {
    let csv = "";

    switch (type) {
      case "hiring_summary": {
        const applications = await prisma.application.findMany({
          include: {
            candidate: true,
            vacancy: true,
          },
          orderBy: { appliedAt: "desc" },
        });

        const total = applications.length;
        const hired = applications.filter(
          (a) => a.currentStage.toLowerCase() === "hired",
        ).length;
        const conversionRate =
          total > 0 ? ((hired / total) * 100).toFixed(1) + "%" : "0.0%";

        const rows: (string | number | null)[][] = [
          ["Hiring Summary Report"],
          [`Generated: ${new Date().toLocaleString()}`],
          [],
          ["Metric", "Value"],
          ["Total Applications", total],
          ["Total Hires", hired],
          ["Conversion Rate", conversionRate],
          [],
          ["Candidate", "Position", "Stage", "Applied Date", "Source"],
        ];

        for (const a of applications) {
          rows.push([
            a.candidate?.name ?? "Unknown",
            a.vacancy?.title ?? a.appliedFor ?? "—",
            a.currentStage,
            a.appliedAt.toLocaleDateString("en-GB"),
            a.source ?? "—",
          ]);
        }

        csv = rowsToCSV(rows);
        break;
      }

      case "pipeline_status": {
        const applications = await prisma.application.findMany({
          include: {
            candidate: true,
            vacancy: true,
          },
          orderBy: { appliedAt: "desc" },
        });

        const rows: (string | number | null)[][] = [
          ["Pipeline Status Report"],
          [`Generated: ${new Date().toLocaleString()}`],
          [],
          ["Candidate", "Position", "Current Stage", "Applied Date", "Source"],
        ];

        for (const a of applications) {
          rows.push([
            a.candidate?.name ?? "Unknown",
            a.vacancy?.title ?? a.appliedFor ?? "—",
            a.currentStage,
            a.appliedAt.toLocaleDateString("en-GB"),
            a.source ?? "—",
          ]);
        }

        csv = rowsToCSV(rows);
        break;
      }

      case "time_to_hire": {
        const hiredApps = await prisma.application.findMany({
          where: { currentStage: { equals: "hired", mode: "insensitive" } },
          include: {
            candidate: true,
            vacancy: true,
          },
          orderBy: { appliedAt: "desc" },
        });

        const rows: (string | number | null)[][] = [
          ["Time to Hire Analysis"],
          [`Generated: ${new Date().toLocaleString()}`],
          [],
          [
            "Candidate",
            "Position",
            "Applied Date",
            "Updated Date",
            "Days to Hire",
          ],
        ];

        let totalDays = 0;
        for (const a of hiredApps) {
          const days = Math.round(
            (a.updatedAt.getTime() - a.appliedAt.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          totalDays += days;
          rows.push([
            a.candidate?.name ?? "Unknown",
            a.vacancy?.title ?? a.appliedFor ?? "—",
            a.appliedAt.toLocaleDateString("en-GB"),
            a.updatedAt.toLocaleDateString("en-GB"),
            days,
          ]);
        }

        const avgDays =
          hiredApps.length > 0
            ? Math.round(totalDays / hiredApps.length)
            : 0;

        rows.push([]);
        rows.push(["Average Days to Hire", avgDays]);
        rows.push(["Total Hires", hiredApps.length]);

        csv = rowsToCSV(rows);
        break;
      }

      case "source_effectiveness": {
        const applications = await prisma.application.findMany({
          include: { vacancy: true },
        });

        const sourceMap = new Map<
          string,
          { applications: number; interviews: number; hires: number }
        >();

        for (const a of applications) {
          const source = a.source ?? "Unknown";
          if (!sourceMap.has(source)) {
            sourceMap.set(source, {
              applications: 0,
              interviews: 0,
              hires: 0,
            });
          }
          const entry = sourceMap.get(source)!;
          entry.applications++;
          const stage = a.currentStage.toLowerCase();
          if (stage === "interview" || stage === "offer" || stage === "hired") {
            entry.interviews++;
          }
          if (stage === "hired") {
            entry.hires++;
          }
        }

        const rows: (string | number | null)[][] = [
          ["Source Effectiveness Report"],
          [`Generated: ${new Date().toLocaleString()}`],
          [],
          ["Source", "Applications", "Interviews", "Hires", "Conversion Rate"],
        ];

        for (const [source, data] of Array.from(sourceMap.entries())) {
          const convRate =
            data.applications > 0
              ? ((data.hires / data.applications) * 100).toFixed(1) + "%"
              : "0.0%";
          rows.push([
            source,
            data.applications,
            data.interviews,
            data.hires,
            convRate,
          ]);
        }

        csv = rowsToCSV(rows);
        break;
      }

      case "cost_per_hire": {
        const employees = await prisma.employee.findMany({
          include: {
            user: true,
            employeeContract: true,
          },
          orderBy: { startDate: "desc" },
        });

        const rows: (string | number | null)[][] = [
          ["Cost per Hire Report"],
          [`Generated: ${new Date().toLocaleString()}`],
          [],
          [
            "Employee",
            "Position",
            "Department",
            "Start Date",
            "Basic Salary",
            "Total Allowances",
            "Total Monthly Cost",
          ],
        ];

        let totalCost = 0;
        for (const e of employees) {
          const basic = e.employeeContract
            ? Number(e.employeeContract.basicSalary)
            : 0;
          const allowances = e.employeeContract
            ? Number(e.employeeContract.mealAllowance) +
              Number(e.employeeContract.transportAllowance) +
              Number(e.employeeContract.healthAllowance) +
              Number(e.employeeContract.otherAllowanceAmount)
            : 0;
          const total = basic + allowances;
          totalCost += total;
          rows.push([
            e.user.name,
            e.position,
            e.department ?? "—",
            e.startDate.toLocaleDateString("en-GB"),
            basic,
            allowances,
            total,
          ]);
        }

        rows.push([]);
        rows.push(["Total Employees", employees.length]);
        rows.push(["Total Monthly Cost", totalCost]);
        rows.push([
          "Average Cost per Hire",
          employees.length > 0 ? Math.round(totalCost / employees.length) : 0,
        ]);

        csv = rowsToCSV(rows);
        break;
      }

      case "budget_tracker": {
        const employees = await prisma.employee.findMany({
          include: {
            employeeContract: true,
          },
          orderBy: { department: "asc" },
        });

        const deptMap = new Map<string, { count: number; totalCost: number }>();

        for (const e of employees) {
          const dept = e.department || "Unassigned";
          if (!deptMap.has(dept)) {
            deptMap.set(dept, { count: 0, totalCost: 0 });
          }
          const entry = deptMap.get(dept)!;
          entry.count++;
          if (e.employeeContract) {
            entry.totalCost +=
              Number(e.employeeContract.basicSalary) +
              Number(e.employeeContract.mealAllowance) +
              Number(e.employeeContract.transportAllowance) +
              Number(e.employeeContract.healthAllowance) +
              Number(e.employeeContract.otherAllowanceAmount);
          }
        }

        const rows: (string | number | null)[][] = [
          ["Recruitment Budget Tracker"],
          [`Generated: ${new Date().toLocaleString()}`],
          [],
          ["Department", "Headcount", "Total Monthly Cost", "Average Cost"],
        ];

        for (const [dept, data] of Array.from(deptMap.entries())) {
          rows.push([
            dept,
            data.count,
            data.totalCost,
            data.count > 0 ? Math.round(data.totalCost / data.count) : 0,
          ]);
        }

        csv = rowsToCSV(rows);
        break;
      }

      case "diversity": {
        const profiles = await prisma.candidateProfile.findMany({
          orderBy: { createdAt: "desc" },
        });

        const genderMap = new Map<string, number>();
        for (const p of profiles) {
          const gender = p.gender || "Not specified";
          genderMap.set(gender, (genderMap.get(gender) ?? 0) + 1);
        }

        const rows: (string | number | null)[][] = [
          ["Diversity & Inclusion Report"],
          [`Generated: ${new Date().toLocaleString()}`],
          [],
          ["Gender", "Count", "Percentage"],
        ];

        const total = profiles.length;
        for (const [gender, count] of Array.from(genderMap.entries())) {
          const pct =
            total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0.0%";
          rows.push([gender, count, pct]);
        }

        rows.push([]);
        rows.push(["Total Candidates", total]);

        csv = rowsToCSV(rows);
        break;
      }

      case "audit_trail": {
        const notifications = await prisma.notification.findMany({
          orderBy: { createdAt: "desc" },
          take: 500,
        });

        const rows: (string | number | null)[][] = [
          ["Audit Trail Report"],
          [`Generated: ${new Date().toLocaleString()}`],
          [],
          ["Date", "Type", "Title", "Message"],
        ];

        for (const n of notifications) {
          rows.push([
            n.createdAt.toLocaleString("en-GB"),
            n.type,
            n.title,
            n.message,
          ]);
        }

        csv = rowsToCSV(rows);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}` },
          { status: 400 },
        );
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}-${new Date()
          .toISOString()
          .split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate report:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
