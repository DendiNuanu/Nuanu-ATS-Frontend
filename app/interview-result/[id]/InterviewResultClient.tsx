"use client";

import { useState } from "react";
import { Avatar, RadialGauge } from "@/components/ui";
import {
  Star,
  Check,
  Loader2,
  Send,
  AlertCircle,
  Briefcase,
  Sparkles,
} from "lucide-react";

type Candidate = {
  id: string;
  name: string;
  appliedFor: string | null;
  avatar: string | null;
  aiMatch: number | null;
};

type Reviewer = { id: string; name: string } | null;

type Reviewers = {
  hr: Reviewer;
  user1: Reviewer;
  user2: Reviewer;
};

type ExistingComment = {
  id: string;
  content: string;
  rating: number | null;
  recommendation: string | null;
  reviewerRole: string;
  updatedAt: string;
};

const recommendations = [
  "Strong Hire",
  "Hire",
  "No Hire",
  "Strong No Hire",
] as const;

/**
 * Public-facing interview result review page.
 *
 * Shown to a reviewer who received a shareable link. No login required.
 * Displays a read-only candidate summary and a single review form for the
 * reviewer's role. Submissions are saved to the same InterviewComment table
 * used by the HR candidate detail page (single source of truth).
 *
 * The page determines which reviewer role to show the form for based on which
 * reviewers are assigned. Priority: USER_1 → USER_2 → HR (fallback).
 */
export function InterviewResultClient({
  candidate,
  reviewers,
  comments,
}: {
  candidate: Candidate;
  reviewers: Reviewers;
  comments: ExistingComment[];
}) {
  // Determine which reviewer role this link is for. We pick the first assigned
  // reviewer in priority order (USER_1, then USER_2, then HR as fallback).
  const activeRole: "USER_1" | "USER_2" | "HR" = reviewers.user1
    ? "USER_1"
    : reviewers.user2
      ? "USER_2"
      : "HR";

  const activeReviewer =
    activeRole === "USER_1"
      ? reviewers.user1
      : activeRole === "USER_2"
        ? reviewers.user2
        : reviewers.hr;

  // Pre-fill from any existing comment for this role.
  const existing = comments.find((c) => c.reviewerRole === activeRole);

  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [recommendation, setRecommendation] = useState<string>(
    existing?.recommendation ?? "",
  );
  const [comment, setComment] = useState<string>(existing?.content ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!existing);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (rating < 1) {
      setError("Please select a rating (1-5 stars).");
      return;
    }
    if (!recommendation) {
      setError("Please select a recommendation.");
      return;
    }
    if (!comment.trim()) {
      setError("Please share your assessment in the comment field.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/interview-result/${candidate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerRole: activeRole,
          rating,
          recommendation,
          comment: comment.trim(),
          reviewerId: activeReviewer?.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit review");
      }

      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit review";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#006b5f] flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="font-heading text-lg font-bold text-slate-900">
              Nuanu
            </span>
          </div>
          <span className="text-sm font-medium text-slate-500">
            Interview Result Review
          </span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        {/* Candidate summary card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-8 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <Avatar name={candidate.name} src={candidate.avatar ?? undefined} size="xl" />
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-2xl font-bold text-slate-900">
                {candidate.name}
              </h1>
              {candidate.appliedFor && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <Briefcase className="h-4 w-4 text-slate-400" />
                  Applied for:{" "}
                  <span className="font-medium text-slate-800">
                    {candidate.appliedFor}
                  </span>
                </p>
              )}
            </div>
            {candidate.aiMatch != null && (
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <RadialGauge value={candidate.aiMatch} size={96} />
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Sparkles className="h-3 w-3" />
                  AI Match
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Review form */}
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="font-heading text-xl font-bold text-slate-900">
              Your Review
            </h2>
            {activeReviewer && (
              <p className="mt-1 text-sm text-slate-500">
                Reviewing as:{" "}
                <span className="font-medium text-slate-700">
                  {activeReviewer.name}
                </span>
              </p>
            )}
          </div>

          {submitted ? (
            <div className="rounded-xl border border-[#006b5f]/20 bg-[#e6f5f3] p-6 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-[#006b5f] flex items-center justify-center">
                <Check className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-heading text-lg font-bold text-slate-900">
                Review submitted, thank you!
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">
                Your assessment has been recorded. You can close this page.
              </p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div className="rounded-lg bg-white/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Rating
                  </p>
                  <div className="mt-1 flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-4 w-4 ${
                          s <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-slate-100 text-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-lg bg-white/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Recommendation
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {recommendation}
                  </p>
                </div>
                <div className="rounded-lg bg-white/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Comment
                  </p>
                  <p className="mt-1 text-sm text-slate-700 line-clamp-3">
                    {comment}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rating
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110"
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-slate-100 text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-3 text-sm font-medium text-slate-600">
                      {rating} / 5
                    </span>
                  )}
                </div>
              </div>

              {/* Recommendation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Recommendation
                </label>
                <select
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  className="w-full sm:max-w-xs rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none transition bg-white"
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Comment
                </label>
                <textarea
                  rows={6}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your assessment of this candidate..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none transition"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#006b5f] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#005248] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b5f]/30 disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Review
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-[#006b5f] flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="font-heading text-sm font-bold text-slate-700">
              Nuanu
            </span>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Nuanu. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
