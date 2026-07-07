import { NextRequest, NextResponse } from "next/server";
import { fetchGlobalSearchResults } from "@/lib/data-access";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";

    if (q.trim().length < 2) {
      return NextResponse.json({ candidates: [], jobs: [] });
    }

    const results = await fetchGlobalSearchResults(q, 8);
    return NextResponse.json(results);
  } catch (error) {
    console.error("[api/search] error:", error);
    return NextResponse.json(
      { candidates: [], jobs: [] },
      { status: 200 },
    );
  }
}
