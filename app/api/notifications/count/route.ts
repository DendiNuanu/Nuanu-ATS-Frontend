import { NextResponse } from "next/server";
import { fetchUnreadNotificationCount } from "@/lib/data-access";

export async function GET() {
  try {
    const count = await fetchUnreadNotificationCount();
    return NextResponse.json({ count });
  } catch (error) {
    console.error("[notifications/count] error:", error);
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
