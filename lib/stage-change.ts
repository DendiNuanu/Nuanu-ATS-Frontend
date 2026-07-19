import type { Candidate, Stage, RejectionType } from "@/lib/mock-data";

/**
 * Result of a stage-change persistence operation.
 * - `success` — whether the stage was persisted to the DB.
 * - `emailSent` — always `false` now; rejection emails are no longer
 *   auto-sent on stage change. HR reviews and dispatches them manually
 *   from the compose page (see requirement: "Selecting a rejection reason
 *   must NOT auto-send email — HR reviews in compose before dispatching").
 *   Kept in the type for backward compatibility with callers that read it.
 * - `error` — error message if the stage change failed.
 */
export type StageChangeResult = {
  success: boolean;
  emailSent: boolean;
  error?: string;
};

/**
 * Persists a stage change to the database via PATCH /api/candidates/[id].
 *
 * When the new stage is "Rejected", the chosen `rejectionType` sub-type is
 * sent along so the server stores it on the Application row. The rejection
 * email is NOT sent automatically — HR must open the compose page, review
 * the pre-filled template, and dispatch it manually.
 *
 * The caller should:
 *  1. Optimistically update the stage in local state for responsiveness.
 *  2. Call this function.
 *  3. On `success === false`, revert the stage and show the error.
 *
 * RELIABILITY: The server returns the confirmed stage in the response. We
 * verify it matches what we sent so the caller can trust the write actually
 * committed — eliminating the "reverts to New" race where a stale cache
 * overwrites the optimistic update before the DB write lands.
 */
export async function persistStageChange(
  candidate: Candidate,
  newStage: Stage,
  rejectionType?: RejectionType,
): Promise<StageChangeResult> {
  try {
    const res = await fetch(`/api/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        newStage === "Rejected"
          ? { stage: newStage, rejectionType: rejectionType ?? "declined_by_hr" }
          : { stage: newStage },
      ),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        emailSent: false,
        error: data.error ?? "Failed to update stage",
      };
    }
    // Verify the write landed: the server echoes back the confirmed stage.
    // If it doesn't match what we sent, treat it as a failure so the caller
    // reverts the optimistic update instead of trusting a write that may not
    // have committed.
    const data = await res.json().catch(() => ({}));
    if (data.stage && data.stage !== newStage) {
      return {
        success: false,
        emailSent: false,
        error: `Stage update did not persist (expected "${newStage}", server confirmed "${data.stage}"). Please retry.`,
      };
    }
  } catch {
    return {
      success: false,
      emailSent: false,
      error: "Network error — could not reach the server to update stage",
    };
  }

  return { success: true, emailSent: false };
}
