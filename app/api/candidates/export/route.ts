import { NextRequest, NextResponse } from "next/server";
import {
  fetchCandidatesForExport,
  parseCandidateSort,
} from "@/lib/data-access";
import { formatDateWita } from "@/lib/format-wita";

export const dynamic = "force-dynamic";

function escapeCsvCell(value: string | number | null | undefined): string {
  let text = String(value ?? "");

  // Prevent spreadsheet programs from evaluating candidate-entered values.
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const stage = searchParams.get("stage") ?? "All";
    const { field: sort, dir: sortDir } = parseCandidateSort(
      searchParams.get("sort") ?? undefined,
      searchParams.get("dir") ?? undefined,
    );

    const candidates = await fetchCandidatesForExport({
      search,
      stage,
      sort,
      sortDir,
    });

    const headers = [
      "Name",
      "Email",
      "Applied For",
      "Stage",
      "AI Match (%)",
      "Applied Date",
      "Source",
      "Phone",
      "Location/Domicile",
      "Referred By",
    ];
    const rows = candidates.map((candidate) => [
      candidate.name,
      candidate.email,
      candidate.position,
      candidate.stage,
      candidate.aiMatch,
      formatDateWita(candidate.appliedDate),
      candidate.source,
      candidate.phone,
      candidate.domicile || candidate.location,
      candidate.source === "Referral" ? candidate.referredBy : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\r\n");
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="candidates-export-${today}.csv"`,
        "Cache-Control": "no-store",
        "X-Export-Row-Count": String(candidates.length),
      },
    });
  } catch (error) {
    console.error("Failed to export candidates:", error);
    return NextResponse.json(
      { error: "Failed to export candidates" },
      { status: 500 },
    );
  }
}
