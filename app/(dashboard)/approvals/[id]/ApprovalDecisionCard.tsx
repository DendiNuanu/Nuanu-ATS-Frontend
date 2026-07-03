"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, useToast } from "@/components/ui";
import { CheckCircle2, XCircle } from "lucide-react";
import type { RequisitionDetail } from "@/lib/data-access";

export function ApprovalDecisionCard({
  requisition,
}: {
  requisition: RequisitionDetail;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDecided = requisition.status !== "Pending";

  const handleDecision = async (decision: "approved" | "rejected") => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/requisitions/${requisition.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${decision} requisition`);
      }

      showToast(
        decision === "approved"
          ? "Requisition approved"
          : "Requisition rejected",
      );
      router.push("/approvals");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update requisition");
      setSubmitting(false);
    }
  };

  return (
    <Card title="Decision" subtitle="Provide your rationale and approve or reject.">
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          Rationale
        </label>
        <textarea
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isDecided || submitting}
          placeholder="Add your comments for this decision..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      {isDecided ? (
        <div className="flex items-center justify-center py-2 text-sm text-slate-500">
          This requisition has already been {requisition.status.toLowerCase()}.
        </div>
      ) : (
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="destructive"
            icon={<XCircle className="h-4 w-4" />}
            disabled={submitting}
            onClick={() => handleDecision("rejected")}
          >
            Reject
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={<CheckCircle2 className="h-4 w-4" />}
            disabled={submitting}
            onClick={() => handleDecision("approved")}
          >
            {submitting ? "Processing..." : "Approve"}
          </Button>
        </div>
      )}
    </Card>
  );
}
