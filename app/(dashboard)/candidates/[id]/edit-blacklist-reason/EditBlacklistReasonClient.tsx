"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Button, Avatar, useToast } from "@/components/ui";
import type { Candidate } from "@/lib/mock-data";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";

const textareaClass =
  "w-full min-h-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 resize-y";

export function EditBlacklistReasonClient({
  candidate,
}: {
  candidate: Candidate;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  // Reconstruct the `from*` query string (list origin) so it can be
  // propagated back to the candidate detail page after Save/Cancel.
  const returnQuery = (() => {
    const params = new URLSearchParams();
    const fromPage = searchParams.get("fromPage");
    const fromSearch = searchParams.get("fromSearch");
    const fromStage = searchParams.get("fromStage");
    const fromSort = searchParams.get("fromSort");
    const fromDir = searchParams.get("fromDir");
    if (fromPage) params.set("fromPage", fromPage);
    if (fromSearch) params.set("fromSearch", fromSearch);
    if (fromStage) params.set("fromStage", fromStage);
    if (fromSort) params.set("fromSort", fromSort);
    if (fromDir) params.set("fromDir", fromDir);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  })();

  const [reason, setReason] = useState(candidate.blacklistReason ?? "");
  const [saving, setSaving] = useState(false);

  const trimmed = reason.trim();
  const isValid = trimmed.length > 0;

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Keep the candidate blacklisted; only update the reason.
          isBlacklisted: true,
          blacklistReason: trimmed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update blacklist reason");
      }
      showToast("Blacklist reason updated", "success");
      router.push(`/candidates/${candidate.id}${returnQuery}`);
      router.refresh();
    } catch (err) {
      setSaving(false);
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to update blacklist reason",
        "error",
      );
    }
  };

  const handleCancel = () => {
    router.push(`/candidates/${candidate.id}${returnQuery}`);
  };

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/candidates/${candidate.id}${returnQuery}`}
        scroll={false}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#006b5f] mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to candidate
      </Link>

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <Avatar name={candidate.name} size="lg" color={candidate.avatarColor} />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 font-heading">
              {candidate.name}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {candidate.department
                ? `${candidate.position} · ${candidate.department}`
                : candidate.position}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{candidate.email}</p>
          </div>
        </div>
      </Card>

      <Card title="Edit blacklist reason">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 mb-5">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700">
            This candidate is currently blacklisted. Update the reason below — a
            non-empty reason is required.
          </p>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          Reason for blacklisting
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={5}
          placeholder="e.g. No-show at 3 scheduled interviews"
          className={textareaClass}
          autoFocus
        />
        {!isValid && reason.length > 0 && (
          <p className="mt-1.5 text-xs text-red-600">
            Reason cannot be empty.
          </p>
        )}

        <div className="flex items-center gap-2 mt-5">
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save reason"
            )}
          </Button>
          <Button variant="secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
