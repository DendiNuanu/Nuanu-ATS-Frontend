"use client";

import { useState } from "react";
import { Card, Button, Avatar, EmptyState, useToast } from "@/components/ui";
import { formatDateTimeShortWita } from "@/lib/format-wita";
import type { CandidateNoteEntry } from "@/lib/mock-data";
import { Plus, StickyNote, X, Save, Loader2 } from "lucide-react";

type Props = {
  applicationId: string;
  initialNotes: CandidateNoteEntry[];
  /** Display name of the currently logged-in user (for the composer avatar). */
  currentUserName: string;
  /** Email of the currently logged-in user (sent to the API to resolve author). */
  currentUserEmail?: string;
};

export function NotesTab({
  applicationId,
  initialNotes,
  currentUserName,
  currentUserEmail,
}: Props) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<CandidateNoteEntry[]>(initialNotes);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/candidates/${applicationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: draft.trim(),
          authorEmail: currentUserEmail,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save note");
      }
      const data = await res.json();
      const newNote: CandidateNoteEntry = data.note;
      setNotes((prev) => [newNote, ...prev]);
      setDraft("");
      setComposing(false);
      showToast("Note added", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to save note",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft("");
    setComposing(false);
  };

  const formatTimestamp = (iso: string) => {
    return formatDateTimeShortWita(iso);
  };

  return (
    <div className="space-y-6">
      {/* Header row with Add Note button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 font-heading">
            Notes
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Internal notes about this candidate.
          </p>
        </div>
        {!composing && (
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setComposing(true)}
          >
            Add Note
          </Button>
        )}
      </div>

      {/* Inline composer */}
      {composing && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Avatar name={currentUserName} size="sm" />
              <span className="text-sm font-medium text-slate-900">
                {currentUserName}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            autoFocus
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your note..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20 focus:outline-none resize-none transition"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={
                saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )
              }
              onClick={handleSave}
              disabled={!draft.trim() || saving}
            >
              {saving ? "Saving…" : "Save Note"}
            </Button>
          </div>
        </Card>
      )}

      {/* Notes list or empty state */}
      {notes.length === 0 ? (
        <Card>
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            description="Add a note to keep track of important details about this candidate."
            ctaLabel="Add Note"
            onCta={() => setComposing(true)}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <Card key={note.id}>
              <div className="flex items-start gap-3">
                <Avatar name={note.authorName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {note.authorName}
                    </p>
                    <p className="text-xs text-slate-400 whitespace-nowrap">
                      {formatTimestamp(note.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
