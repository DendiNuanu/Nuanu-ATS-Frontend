"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button, Avatar, useToast } from "@/components/ui";
import type { Candidate } from "@/lib/mock-data";
import { EMAIL_TEMPLATES, TEMPLATE_OPTIONS, fillTemplate } from "@/lib/email-templates";
import {
  X,
  Bold,
  Italic,
  Underline,
  List,
  Link2,
  Send,
  Image as ImageIcon,
  Smile,
} from "lucide-react";

/**
 * Official outbound sending address for all candidate emails.
 * Hardcoded — not tied to whichever staff member is logged in.
 */
const FROM_ADDRESS = "Nuanu <job@nuanu.com>";

export function CandidateComposeClient({
  candidate,
}: {
  candidate: Candidate;
}) {
  const { id } = candidate;
  const router = useRouter();
  const { showToast } = useToast();

  const [template, setTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const applyTemplate = (value: string) => {
    setTemplate(value);
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === value);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(fillTemplate(tpl.body, candidate.name));
    }
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !body.trim()) {
      showToast("Subject and body are required", "error");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: candidate.email,
          subject,
          body,
          candidateId: id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send email");
      }

      showToast(`Email sent to ${candidate.name}`);
      router.push(`/candidates/${id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send email";
      showToast(message, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-16 z-10 -mx-6 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-bold text-slate-900">
            New Message
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="md" onClick={() => router.push(`/candidates/${id}`)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSendEmail}
            disabled={sending}
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Send Email"}
          </Button>
          <Link
            href={`/candidates/${id}`}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compose Form */}
        <div className="lg:col-span-2">
          <Card>
            {/* To (pre-filled, read-only) */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="w-20 shrink-0 text-sm font-medium text-slate-500">
                To:
              </span>
              <div className="flex flex-1 items-center gap-2">
                <Avatar name={candidate.name} size="sm" color={candidate.avatarColor} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {candidate.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {candidate.email}
                  </p>
                </div>
              </div>
            </div>

            {/* From */}
            <div className="flex items-center gap-3 border-b border-slate-100 py-4">
              <span className="w-20 shrink-0 text-sm font-medium text-slate-500">
                From:
              </span>
              <span className="text-sm text-slate-700">{FROM_ADDRESS}</span>
            </div>

            {/* Template */}
            <div className="flex items-center gap-3 border-b border-slate-100 py-4">
              <span className="w-20 shrink-0 text-sm font-medium text-slate-500">
                Template:
              </span>
              <select
                value={template}
                onChange={(e) => applyTemplate(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
              >
                {TEMPLATE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div className="flex items-center gap-3 border-b border-slate-100 py-4">
              <span className="w-20 shrink-0 text-sm font-medium text-slate-500">
                Subject:
              </span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                className="flex-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 border-b border-slate-100 py-2">
              <button type="button" className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Bold className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Italic className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Underline className="h-4 w-4" />
              </button>
              <div className="mx-1 h-5 w-px bg-slate-200" />
              <button type="button" className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <List className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Link2 className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <ImageIcon className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Smile className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here..."
              className="min-h-[400px] w-full resize-none pt-4 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
            />
          </Card>
        </div>

        {/* Right Sidebar — Candidate Preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 space-y-4">
            <Card>
              <h3 className="font-heading text-base font-semibold text-slate-900">
                Candidate Preview
              </h3>
              <div className="mt-4 flex flex-col items-center text-center">
                <Avatar name={candidate.name} size="xl" color={candidate.avatarColor} />
                <h4 className="mt-3 font-heading text-lg font-semibold text-slate-900">
                  {candidate.name}
                </h4>
                <p className="text-sm text-slate-500">
                  {candidate.position}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {candidate.email}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="rounded-full bg-[#e6f5f3] px-2.5 py-0.5 text-xs font-medium text-[#006b5f]">
                    {candidate.source}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {candidate.stage}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f5f3]">
                  <Send className="h-5 w-5 text-[#006b5f]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Ready to send?
                  </p>
                  <p className="text-xs text-slate-500">
                    Review before dispatching
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
