"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button, useToast } from "@/components/ui";
import type { Job } from "@/lib/mock-data";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

type FileStatus = "pending" | "parsing" | "success" | "failed";

type UploadFile = {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
  candidateName?: string;
};

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTS = [".pdf", ".doc", ".docx"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export function UploadCVClient({ vacancies }: { vacancies: Job[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [jobId, setJobId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTS.includes(ext)) {
      return "Only PDF, DOC, and DOCX files are allowed";
    }
    if (file.size > MAX_SIZE) {
      return "File size exceeds 5MB limit";
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const additions: UploadFile[] = [];
    for (const file of arr) {
      const error = validateFile(file);
      additions.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: error ? "failed" : "pending",
        error: error ?? undefined,
      });
    }
    setFiles((prev) => [...prev, ...additions]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUploadOne = async (uploadFile: UploadFile): Promise<void> => {
    if (uploadFile.status !== "pending") return;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: "parsing" } : f,
      ),
    );

    try {
      const formData = new FormData();
      formData.append("file", uploadFile.file);
      formData.append("jobId", jobId);

      const res = await fetch("/api/candidates/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to parse CV");
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: "success",
                candidateName: data.candidateName,
              }
            : f,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse CV";
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "failed", error: message }
            : f,
        ),
      );
    }
  };

  const handleUploadAll = async () => {
    if (!jobId) {
      showToast("Please select a job/vacancy first", "error");
      return;
    }
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) {
      showToast("No files to upload", "info");
      return;
    }

    setProcessing(true);
    // Process sequentially to avoid overwhelming the AI API
    for (const f of pending) {
      await handleUploadOne(f);
    }
    setProcessing(false);
    setDone(true);

    const successCount = files.filter((f) => f.status === "success").length;
    const failedCount = files.filter((f) => f.status === "failed").length;
    showToast(
      `Upload complete: ${successCount} succeeded, ${failedCount} failed`,
    );
  };

  const successCount = files.filter((f) => f.status === "success").length;
  const failedCount = files.filter((f) => f.status === "failed").length;
  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <div>
      {/* Breadcrumb + header */}
      <Link
        href="/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#006b5f] mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Candidates
      </Link>

      <div className="mb-6">
        <nav className="text-xs text-slate-400 mb-1">
          <Link href="/" className="hover:text-slate-600">Dashboard</Link>
          {" / "}
          <Link href="/candidates" className="hover:text-slate-600">Candidates</Link>
          {" / "}
          <span className="text-slate-600">Upload CV</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-900 font-heading">
          Upload CV
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload one or more CVs — AI will parse and create candidate records automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: dropzone + file list */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 px-6 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-[#006b5f] bg-[#e6f5f3]"
                  : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <UploadCloud className="h-12 w-12 text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-700">
                Drag & drop CV files here, or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">
                PDF, DOC, DOCX · max 5MB per file
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-6 space-y-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <FileText className="h-5 w-5 flex-shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {f.file.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(f.file.size / 1024).toFixed(0)} KB
                        {f.candidateName && f.status === "success" && (
                          <span className="text-[#006b5f]">
                            {" · "}Created: {f.candidateName}
                          </span>
                        )}
                        {f.error && f.status === "failed" && (
                          <span className="text-red-500">{" · "}{f.error}</span>
                        )}
                      </p>
                    </div>
                    {/* Status */}
                    {f.status === "pending" && (
                      <span className="text-xs font-medium text-slate-400">Pending</span>
                    )}
                    {f.status === "parsing" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#006b5f]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Parsing...
                      </span>
                    )}
                    {f.status === "success" && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    )}
                    {f.status === "failed" && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    {/* Remove (only when not processing) */}
                    {!processing && (
                      <button
                        type="button"
                        onClick={() => handleRemove(f.id)}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Summary after processing */}
          {done && (
            <Card className="bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f5f3]">
                  <Sparkles className="h-5 w-5 text-[#006b5f]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    Upload complete
                  </p>
                  <p className="text-xs text-slate-500">
                    {successCount} succeeded, {failedCount} failed
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => router.push("/candidates")}
                >
                  View in Candidates
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar: job selector + submit */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 space-y-4">
            <Card>
              <h3 className="font-heading text-base font-semibold text-slate-900">
                Applied For
              </h3>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                Select the vacancy this candidate is applying for.
              </p>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20"
              >
                <option value="">Select a vacancy...</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} — {v.department}
                  </option>
                ))}
              </select>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={handleUploadAll}
                  disabled={processing || pendingCount === 0 || !jobId}
                >
                  {processing ? "Processing..." : "Upload & Parse with AI"}
                </Button>
                {pendingCount > 0 && (
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    {pendingCount} file{pendingCount !== 1 ? "s" : ""} ready
                  </p>
                )}
              </div>
            </Card>

            <Card className="bg-slate-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    How it works
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Each CV is parsed by AI to extract name, email, phone,
                    skills, and experience. A new candidate record is created
                    and linked to the selected vacancy.
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
