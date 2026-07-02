"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Paperclip,
  Bold,
  Italic,
  Underline,
  List,
  Link2,
  Send,
  Image as ImageIcon,
  Smile,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button, Avatar, useToast } from "@/components/ui";
import { mockCandidates } from "@/lib/mock-data";
import { EMAIL_TEMPLATES, TEMPLATE_OPTIONS, fillTemplate } from "@/lib/email-templates";

export default function ComposeEmailPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedCandidate, setSelectedCandidate] = useState(
    mockCandidates[0]?.name || "",
  );
  const [template, setTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const selected = mockCandidates.find((c) => c.name === selectedCandidate);

  const applyTemplate = (value: string) => {
    setTemplate(value);
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === value);
    if (tpl && selected) {
      setSubject(tpl.subject);
      setBody(fillTemplate(tpl.body, selected.name));
    }
  };

  const handleSendEmail = () => {
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === template);
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ts = `${dd}/${mm}/${yyyy} · ${hh}:${min}`;

    // Update the mock candidate's email tracking fields
    if (selected) {
      selected.lastEmailSent = {
        type: tpl?.label ?? "Email",
        sentAt: ts,
      };
      // Only set rejection-specific fields when the "Rejected" template is used
      if (tpl?.id === "rejected") {
        selected.rejectionEmailSent = true;
        selected.rejectionEmailSentAt = ts;
      }
    }

    showToast(`Email sent to ${selected?.name ?? "candidate"}`);
    router.push("/candidates");
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-16 z-10 -mx-6 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/candidates"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-[#006b5f]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Candidates
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="font-heading text-xl font-bold text-slate-900">
            Compose Email
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="md">
            Save Draft
          </Button>
          <Button variant="primary" size="md" onClick={handleSendEmail}>
            <Send className="mr-2 h-4 w-4" />
            Send Email
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compose Form */}
        <div className="lg:col-span-2">
          <Card>
            {/* Recipient */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="w-16 shrink-0 text-sm font-medium text-slate-500">
                To:
              </span>
              <select
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
              >
                {mockCandidates.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} — {c.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Template */}
            <div className="flex items-center gap-3 border-b border-slate-100 py-4">
              <span className="w-16 shrink-0 text-sm font-medium text-slate-500">
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

            {/* From */}
            <div className="flex items-center gap-3 border-b border-slate-100 py-4">
              <span className="w-16 shrink-0 text-sm font-medium text-slate-500">
                From:
              </span>
              <span className="text-sm text-slate-700">
                {"Sari Wijaya <sari.wijaya@nuanu.com>"}
              </span>
            </div>

            {/* Subject */}
            <div className="flex items-center gap-3 border-b border-slate-100 py-4">
              <span className="w-16 shrink-0 text-sm font-medium text-slate-500">
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
              <button className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Bold className="h-4 w-4" />
              </button>
              <button className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Italic className="h-4 w-4" />
              </button>
              <button className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Underline className="h-4 w-4" />
              </button>
              <div className="mx-1 h-5 w-px bg-slate-200" />
              <button className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <List className="h-4 w-4" />
              </button>
              <button className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Link2 className="h-4 w-4" />
              </button>
              <button className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <ImageIcon className="h-4 w-4" />
              </button>
              <button className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100">
                <Smile className="h-4 w-4" />
              </button>
              <div className="ml-auto">
                <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100">
                  <Paperclip className="h-3.5 w-3.5" />
                  Attach
                </button>
              </div>
            </div>

            {/* Body */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here..."
              className="min-h-[400px] w-full resize-none pt-4 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
            />

            {/* Attachments */}
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Attachments
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                <Paperclip className="h-4 w-4" />
                Drag files here or click to upload
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar — Candidate Preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 space-y-4">
            <Card>
              <h3 className="font-heading text-base font-semibold text-slate-900">
                Candidate Preview
              </h3>
              {selected && (
                <div className="mt-4 flex flex-col items-center text-center">
                  <Avatar name={selected.name} size="xl" />
                  <h4 className="mt-3 font-heading text-lg font-semibold text-slate-900">
                    {selected.name}
                  </h4>
                  <p className="text-sm text-slate-500">
                    {selected.position}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {selected.email}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <span className="rounded-full bg-[#e6f5f3] px-2.5 py-0.5 text-xs font-medium text-[#006b5f]">
                      {selected.source}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {selected.stage}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-heading text-base font-semibold text-slate-900">
                Email Tips
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#006b5f]" />
                  Personalize the greeting with the candidate name
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#006b5f]" />
                  Keep the subject line clear and concise
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#006b5f]" />
                  Include next steps or call-to-action
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#006b5f]" />
                  Proofread before sending
                </li>
              </ul>
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
