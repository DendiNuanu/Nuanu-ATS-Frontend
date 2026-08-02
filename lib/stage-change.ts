import type { Candidate, Stage, RejectionType } from "@/lib/mock-data";

/**
 * Result of a stage-change persistence operation. Rejection delivery is queued
 * only after the stage commit and never affects `success`.
 */
export type StageChangeResult = {
  success: boolean;
  emailSent: boolean;
  error?: string;
  rejectionEmailQueued?: boolean;
  conversion?: {
    offerId: string;
    employeeId: string;
  };
};

/**
 * Persists a stage change to the database via PATCH /api/candidates/[id].
 * Rejection delivery is queued durably after stage persistence; compose remains
 * available as a manual fallback.
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
    const rejectionEmailQueued = data.rejectionEmailQueued === true;
    if (rejectionEmailQueued) {
      // Fire-and-forget only after the fast stage response has arrived. The
      // durable job remains retryable if this request is interrupted or fails.
      void fetch(`/api/rejection-emails/${candidate.id}`, {
        method: "POST",
        keepalive: true,
      }).catch(() => undefined);
    }
    return {
      success: true,
      emailSent: false,
      rejectionEmailQueued,
      conversion: data.conversion,
    };
  } catch {
    return {
      success: false,
      emailSent: false,
      error: "Network error — could not reach the server to update stage",
    };
  }

}
