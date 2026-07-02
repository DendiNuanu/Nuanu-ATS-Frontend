"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";
import { Star, Copy, Check, Save, Link2, Users } from "lucide-react";

const hrStaff = [
  "Sari Wijaya",
  "Putri Maharani",
  "Budi Santoso",
  "Dewi Lestari",
  "Rizki Pratama",
  "Andi Wijaya",
];

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

export function InterviewResultsTab({
  candidateName,
  candidateId,
}: {
  candidateName: string;
  candidateId: string;
}) {
  const [reviewer1, setReviewer1] = useState("");
  const [reviewer2, setReviewer2] = useState("");
  const [assignmentsSaved, setAssignmentsSaved] = useState(false);

  const [hrFeedback, setHrFeedback] = useState<FeedbackState>({ ...initialFeedback });
  const [user1Feedback, setUser1Feedback] = useState<FeedbackState>({ ...initialFeedback });
  const [user2Feedback, setUser2Feedback] = useState<FeedbackState>({ ...initialFeedback });

  const [copied, setCopied] = useState(false);
  const interviewLink = `https://nuanu-hr-ats.example.com/interview-result/${candidateId}-${candidateName.toLowerCase().replace(/\s+/g, "-")}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(interviewLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  };

  const handleSaveAssignments = () => {
    setAssignmentsSaved(true);
    setTimeout(() => setAssignmentsSaved(false), 2500);
  };

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
              {hrStaff.map((name) => (
                <option key={name} value={name}>
                  {name}
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
              {hrStaff.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" size="md" icon={<Save className="h-4 w-4" />} onClick={handleSaveAssignments}>
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
        reviewerName="Sari Wijaya"
        reviewerAssigned
        state={hrFeedback}
        setState={setHrFeedback}
      />
      <FeedbackSection
        title="User 1 Comment"
        reviewerName={reviewer1}
        reviewerAssigned={!!reviewer1}
        state={user1Feedback}
        setState={setUser1Feedback}
      />
      <FeedbackSection
        title="User 2 Comment"
        reviewerName={reviewer2}
        reviewerAssigned={!!reviewer2}
        state={user2Feedback}
        setState={setUser2Feedback}
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
}: {
  title: string;
  reviewerName: string;
  reviewerAssigned: boolean;
  state: FeedbackState;
  setState: (s: FeedbackState) => void;
}) {
  const handleSave = () => {
    const updated = { ...state, saved: true };
    setState(updated);
    setTimeout(() => setState({ ...updated, saved: false }), 2500);
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
          <Button variant="primary" size="md" icon={<Save className="h-4 w-4" />} onClick={handleSave}>
            Save Comment
          </Button>
          {state.saved && (
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
