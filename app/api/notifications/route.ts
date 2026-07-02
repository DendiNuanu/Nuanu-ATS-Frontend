import { NextRequest, NextResponse } from "next/server";
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/lib/data-access";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id } = body as { action: string; id?: string };

    if (action === "mark_all_read") {
      await markAllNotificationsRead();
      return NextResponse.json({ ok: true });
    }

    if (action === "mark_read" && id) {
      await markNotificationRead(id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[notifications] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 },
      );
    }

    await deleteNotification(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notifications] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}
