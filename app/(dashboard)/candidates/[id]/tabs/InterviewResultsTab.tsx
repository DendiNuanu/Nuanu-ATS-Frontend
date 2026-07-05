"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, useToast } from "@/components/ui";
import { Star, Copy, Check, Save, Link2, Users, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Reviewer = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AssignedReviewer = {
  id: string;
  name: string;
  email: string;
} | null;

const recommendations = [
  "Strong Hire",
  "Hire",
  "No Hire",
  "Strong No Hire",
] as const;

type FeedbackState = {
  rating: number;
  recommendation: string;
  comment: string;
  saved: boolean;
};

const initialFeedback: FeedbackState = {
  rating: 0,
  recommendation: "",
  comment: "",
  saved: false,
};

// Maps a UI section to the reviewerRole value stored in the database.
const ROLE_MAP = {
  HR: "HR",
  USER_1: "USER_1",
  USER_2: "USER_2",
} as const;

export function InterviewResultsTab({
  candidateId,
  reviewers,
  hrReviewer,
  user1Reviewer,
  user2Reviewer,
}: {
  candidateId: string;
  reviewers: Reviewer[];
  hrReviewer: AssignedReviewer;
  user1Reviewer: AssignedReviewer;
  user2Reviewer: AssignedReviewer;
}) {
  const { showToast } = useToast();
  const { user: currentUser } = useCurrentUser();
  // Initialise dropdowns from the DB-persisted reviewer assignments so they
  // survive page reloads (no more "reset to empty on refresh" bug).
  const [reviewer1, setReviewer1] = useState(user1Reviewer?.id ?? "");
  const [reviewer2, setReviewer2] = useState(user2Reviewer?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [assignmentsSaved, setAssignmentsSaved] = useState(false);

  const [hrFeedback, setHrFeedback] = useState<FeedbackState>({ ...initialFeedback });
  const [user1Feedback, setUser1Feedback] = useState<FeedbackState>({ ...initialFeedback });
  const [user2Feedback, setUser2Feedback] = useState<FeedbackState>({ ...initialFeedback });

  const [copied, setCopied] = useState(false);
  // Use NEXT_PUBLIC_APP_URL when available (production domain), falling back
  // to a sensible default. This keeps the shareable link resolvable instead of
  // pointing at the old placeholder domain.
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const interviewLink = `${appBaseUrl}/interview-result/${candidateId}`;

  // Fetch persisted interview comments on mount so the feedback sections are
  // pre-filled with whatever was saved previously (persists across refresh).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/candidates/${candidateId}/interview-comments`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data.comments)) return;

        const byRole = (role: string) =>
          data.comments.find((c: { reviewerRole: string }) => c.reviewerRole === role);

        const hydrate = (role: string): FeedbackState => {
          const c = byRole(role);
          if (!c) return { ...initialFeedback };
          return {
            rating: typeof c.rating === "number" ? c.rating : 0,
            recommendation: c.recommendation ?? "",
            comment: c.content ?? "",
            saved: false,
          };
        };

        setHrFeedback(hydrate(ROLE_MAP.HR));
        setUser1Feedback(hydrate(ROLE_MAP.USER_1));
        setUser2Feedback(hydrate(ROLE_MAP.USER_2));
      } catch {
        // Silent — leave sections empty on fetch failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(interviewLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  };

  const handleSaveAssignments = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user1ReviewerId: reviewer1 || null,
          user2ReviewerId: reviewer2 || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save reviewer assignments");
      }
      setAssignmentsSaved(true);
      setTimeout(() => setAssignmentsSaved(false), 2500);
      showToast("Reviewer assignments saved", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Resolve the display name for a reviewer id from the reviewers list.
  const reviewerName = (id: string): string =>
    reviewers.find((r) => r.id === id)?.name ?? "";

  const hrReviewerName = hrReviewer?.name ?? "";

  // Shared save handler used by all three feedback sections. Persists to the
  // database via the interview-comments API so data survives refresh.
  const handleSaveFeedback = useCallback(
    async (
      role: "HR" | "USER_1" | "USER_2",
      state: FeedbackState,
      setState: (s: FeedbackState) => void,
    ) => {
      if (!state.comment.trim()) {
        showToast("Please enter a comment before saving", "error");
        return;
      }
      if (state.rating < 1) {
        showToast("Please select a rating (1-5)", "error");
        return;
      }
      if (!state.recommendation) {
        showToast("Please select a recommendation", "error");
        return;
      }

      setState({ ...state, saved: true });
      try {
        const res = await fetch(
          `/api/candidates/${candidateId}/interview-comments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reviewerRole: role,
              rating: state.rating,
              recommendation: state.recommendation,
              comment: state.comment,
              authorEmail: currentUser.email,
            }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save comment");
        }
        setState({ ...state, saved: true });
        setTimeout(() => setState({ ...state, saved: false }), 2500);
        showToast("Comment saved", "success");
      } catch (err) {
        setState({ ...state, saved: false });
        const message = err instanceof Error ? err.message : "Failed to save";
        showToast(message, "error");
      }
    },
    [candidateId, currentUser.email, showToast],
  );

  return (
    <div className="space-y-6">
      {/* Assign interview reviewers */}
      <Card title="Assign Interview Reviewers" subtitle="Select two reviewers to evaluate this candidate.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
              User 1 Reviewer
            </label>
            <select
              value={reviewer1}
              onChange={(e) => setReviewer1(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none transition bg-white"
            >
              <option value="">Select reviewer...</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
              User 2 Reviewer
            </label>
            <select
              value={reviewer2}
              onChange={(e) => setReviewer2(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none transition bg-white"
            >
              <option value="">Select reviewer...</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.role})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            onClick={handleSaveAssignments}
            disabled={saving}
          >
            Save assignments
          </Button>
          {assignmentsSaved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#006b5f]">
              <Check className="h-4 w-4" />
              Assignments saved
            </span>
          )}
        </div>
      </Card>

      {/* Share Interview Result */}
      <Card title="Share Interview Result" subtitle="Copy the link to share with reviewers.">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            icon={copied ? <Check className="h-4 w-4 text-[#006b5f]" /> : <Copy className="h-4 w-4" />}
            onClick={handleCopyLink}
          >
            {copied ? "Copied!" : "Copy Interview Link"}
          </Button>
          <div className="flex items-center gap-1.5 text-sm text-slate-400 min-w-0">
            <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{interviewLink}</span>
          </div>
        </div>
      </Card>

      {/* Feedback sections */}
      <FeedbackSection
        title="HR Manager Comment"
        reviewerName={hrReviewerName}
        reviewerAssigned={!!hrReviewerName}
        state={hrFeedback}
        setState={setHrFeedback}
        onSave={() => handleSaveFeedback("HR", hrFeedback, setHrFeedback)}
      />
      <FeedbackSection
        title="User 1 Comment"
        reviewerName={reviewer1 ? reviewerName(reviewer1) : ""}
        reviewerAssigned={!!reviewer1}
        state={user1Feedback}
        setState={setUser1Feedback}
        onSave={() => handleSaveFeedback("USER_1", user1Feedback, setUser1Feedback)}
      />
      <FeedbackSection
        title="User 2 Comment"
        reviewerName={reviewer2 ? reviewerName(reviewer2) : ""}
        reviewerAssigned={!!reviewer2}
        state={user2Feedback}
        setState={setUser2Feedback}
        onSave={() => handleSaveFeedback("USER_2", user2Feedback, setUser2Feedback)}
      />
    </div>
  );
}

function FeedbackSection({
  title,
  reviewerName,
  reviewerAssigned,
  state,
  setState,
  onSave,
}: {
  title: string;
  reviewerName: string;
  reviewerAssigned: boolean;
  state: FeedbackState;
  setState: (s: FeedbackState) => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={title} subtitle={reviewerAssigned ? reviewerName : undefined}>
      {!reviewerAssigned && (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
          <Users className="h-3.5 w-3.5" />
          No reviewer assigned yet
        </p>
      )}
      <div className="space-y-4">
        {/* Star rating */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
            Rating
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setState({ ...state, rating: star })}
                className="p-0.5 transition-transform hover:scale-110"
                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
              >
                <Star
                  className={`h-6 w-6 ${
                    star <= state.rating
                      ? "fill-amber-400 text-amber-400"
                      : "fill-slate-100 text-slate-300"
                  }`}
                />
              </button>
            ))}
            {state.rating > 0 && (
              <span className="ml-2 text-sm font-medium text-slate-600">
                {state.rating} / 5
              </span>
            )}
          </div>
        </div>

        {/* Recommendation */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
            Recommendation
          </label>
          <select
            value={state.recommendation}
            onChange={(e) => setState({ ...state, recommendation: e.target.value })}
            className="w-full sm:max-w-xs rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none transition bg-white"
          >
            <option value="">Select recommendation...</option>
            {recommendations.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
            Comment
          </label>
          <textarea
            rows={4}
            value={state.comment}
            onChange={(e) => setState({ ...state, comment: e.target.value })}
            placeholder="Add your feedback..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none transition"
          />
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Comment"}
          </Button>
          {state.saved && !saving && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#006b5f]">
              <Check className="h-4 w-4" />
              Comment saved
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
