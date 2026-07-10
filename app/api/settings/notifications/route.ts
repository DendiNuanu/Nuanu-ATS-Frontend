import { NextRequest, NextResponse } from "next/server";
import {
  fetchNotificationPreferences,
  updateNotificationPreference,
  NOTIFICATION_PREFERENCE_KEYS,
  type NotificationPreferenceKey,
} from "@/lib/data-access";

/**
 * GET /api/settings/notifications
 *
 * Returns the current user's notification preference flags. Creates a row
 * with defaults (all true) if none exists yet.
 */
export async function GET() {
  try {
    const preferences = await fetchNotificationPreferences();
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("[settings/notifications] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load notification preferences" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/settings/notifications
 *
 * Updates a single notification preference flag for the current user.
 *
 * Body: { key: NotificationPreferenceKey, value: boolean }
 *   key   — one of: "newCandidateApplications", "interviewReminders",
 *          "offerStatusUpdates", "approvalRequests", "weeklySummaryDigest"
 *   value — true to enable, false to disable
 *
 * Returns the full updated preferences object.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body as {
      key: string;
      value: boolean;
    };

    // Validate the key is one of the known preference flags.
    if (
      !key ||
      !NOTIFICATION_PREFERENCE_KEYS.includes(key as NotificationPreferenceKey)
    ) {
      return NextResponse.json(
        { error: `Invalid preference key: "${key}"` },
        { status: 400 },
      );
    }

    if (typeof value !== "boolean") {
      return NextResponse.json(
        { error: "Value must be a boolean" },
        { status: 400 },
      );
    }

    const preferences = await updateNotificationPreference(
      key as NotificationPreferenceKey,
      value,
    );

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("[settings/notifications] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update notification preference" },
      { status: 500 },
    );
  }
}
