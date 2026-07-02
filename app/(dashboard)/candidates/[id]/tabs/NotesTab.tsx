"use client";

import { useState } from "react";
import { Card, Button, Avatar, EmptyState } from "@/components/ui";
import { Plus, StickyNote, X, Save } from "lucide-react";

type Note = {
  id: string;
  author: string;
  authorColor?: string;
  timestamp: string;
  text: string;
};

const seedNotes: Note[] = [
  {
    id: "n1",
    author: "Sari Wijaya",
    authorColor: "bg-[#006b5f]",
    timestamp: "2026-06-20T09:30:00",
    text: "Candidate has strong frontend experience and communicated clearly during the screening call. Recommended to move forward to the technical interview stage.",
  },
  {
    id: "n2",
    author: "Budi Santoso",
    authorColor: "bg-blue-600",
    timestamp: "2026-06-18T14:15:00",
    text: "Reviewed the portfolio — the candidate has shipped production-grade React applications. Salary expectation is within our budget range for this level.",
  },
  {
    id: "n3",
    author: "Putri Maharani",
    authorColor: "bg-purple-600",
    timestamp: "2026-06-15T11:00:00",
    text: "Reference check completed with previous manager. Feedback was positive — described as reliable, detail-oriented, and a strong team player.",
  },
];

export function NotesTab() {
  const [notes, setNotes] = useState<Note[]>(seedNotes);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");

  const handleSave = () => {
    if (!draft.trim()) return;
    const newNote: Note = {
      id: `n-${Date.now()}`,
      author: "Sari Wijaya",
      authorColor: "bg-[#006b5f]",
      timestamp: new Date().toISOString(),
      text: draft.trim(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setDraft("");
    setComposing(false);
  };

  const handleCancel = () => {
    setDraft("");
    setComposing(false);
  };

  const formatTimestamp = (iso: string) => {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
              <Avatar name="Sari Wijaya" size="sm" />
              <span className="text-sm font-medium text-slate-900">
                Sari Wijaya
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
            <Button variant="ghost" size="md" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Save className="h-4 w-4" />}
              onClick={handleSave}
              disabled={!draft.trim()}
            >
              Save Note
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
                <Avatar name={note.author} size="md" color={note.authorColor} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {note.author}
                    </p>
                    <p className="text-xs text-slate-400 whitespace-nowrap">
                      {formatTimestamp(note.timestamp)}
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {note.text}
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
