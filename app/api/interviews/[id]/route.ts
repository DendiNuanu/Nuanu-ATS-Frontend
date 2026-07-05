import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  deleteCalendarEvent,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar";

/**
 * DELETE /api/interviews/[id]
 *
 * Deletes an interview record. If the interview was synced to Google
 * Calendar (has a stored `calendarEventId`), the corresponding calendar
 * event is also deleted via the service-account client (impersonating
 * job@nuanu.com).
 *
 * The calendar deletion is best-effort: if the event was already manually
 * removed from the calendar or the API call fails for any reason, the error
 * is logged but the local DB record is still deleted. The response reports
 * whether the calendar event was successfully removed so the UI can show an
 * accurate toast.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const interviewId = params.id;

    if (!interviewId) {
      return NextResponse.json(
        { error: "Interview id is required" },
        { status: 400 },
      );
    }

    // Fetch the interview first to check for a stored calendar event id.
    const existing = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: {
        id: true,
        calendarEventId: true,
        googleEventId: true,
        calendarSynced: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 },
      );
    }

    // Attempt to delete the Google Calendar event if one was synced.
    // Wrap in try/catch so a calendar API failure never blocks the DB delete.
    let calendarDeleted = false;
    let calendarError: string | null = null;

    const eventId = existing.calendarEventId ?? existing.googleEventId;
    if (eventId && existing.calendarSynced && isGoogleCalendarConfigured()) {
      try {
        await deleteCalendarEvent(eventId);
        calendarDeleted = true;
      } catch (calErr) {
        // The event may have already been deleted manually from the calendar
        // (410/404), or the service account may lack permission. Either way,
        // log and proceed with deleting the local record.
        console.error(
          "Calendar event deletion failed (service account):",
          calErr,
        );
        calendarError =
          calErr instanceof Error
            ? calErr.message
            : "Unknown calendar error";
      }
    }

    // Delete the interview record from the database.
    await prisma.interview.delete({
      where: { id: interviewId },
    });

    return NextResponse.json({
      success: true,
      interviewId,
      calendarDeleted,
      calendarError,
    });
  } catch (error) {
    console.error("Failed to delete interview:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete interview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
