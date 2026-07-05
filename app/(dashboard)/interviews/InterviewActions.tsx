"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ExternalLink, Loader2, Link2, X, Check } from "lucide-react";

/**
 * Client component for the action buttons on each interview card:
 *  - "Reschedule" → navigates to /interviews/[id]/reschedule
 *  - "Join" / "No link" → if a meeting URL exists, link to it; otherwise
 *    open an inline input to add a meeting URL via PATCH.
 */
export function InterviewActions({
  interviewId,
  meetingUrl,
}: {
  interviewId: string;
  meetingUrl: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [addingLink, setAddingLink] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSaveLink = async () => {
    if (!linkValue.trim()) {
      showToast("Please enter a meeting URL", "error");
      return;
    }

    // Basic URL validation
    let url = linkValue.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/interviews?id=${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl: url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to add meeting link");
      }

      showToast("Meeting link added successfully", "success");
      setAddingLink(false);
      setLinkValue("");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add link";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelLink = () => {
    setAddingLink(false);
    setLinkValue("");
  };

  // Inline "add link" mode
  if (addingLink) {
    return (
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-2">
          <input
            type="url"
            autoFocus
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveLink();
              if (e.key === "Escape") handleCancelLink();
            }}
            placeholder="https://meet.google.com/xxx-yyyy-zzz"
            className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSaveLink}
            disabled={saving}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-[#006b5f] text-white hover:bg-[#005a4f] disabled:opacity-50"
            title="Save"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleCancelLink}
            disabled={saving}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 pt-2">
      <Link href={`/interviews/${interviewId}/reschedule`} className="flex-1">
        <Button variant="secondary" size="sm" className="w-full">
          Reschedule
        </Button>
      </Link>
      {meetingUrl ? (
        <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button variant="primary" size="sm" className="w-full">
            Join
            <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Button>
        </a>
      ) : (
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => setAddingLink(true)}
        >
          <Link2 className="mr-1 h-3.5 w-3.5" />
          Add link
        </Button>
      )}
    </div>
  );
}
