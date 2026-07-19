"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import type { Candidate } from "@/lib/mock-data";
import {
  ExternalLink,
  Upload,
  Link as LinkIcon,
  Download,
  Trash2,
  Loader2,
  FileText,
  Image as ImageIcon,
  X,
  Pencil,
} from "lucide-react";

/**
 * Portfolio tab panel for the candidate detail page.
 *
 * Replaces the previous read-only empty state with full attach/replace/remove
 * capability, supporting BOTH a file upload (PDF/PNG/JPG) and an external
 * URL (Behance, Google Drive, personal site, …).
 *
 * Storage convention (mirrors Resume/CV):
 *   - Uploaded files are saved to `backups-resumes/` on the server and the
 *     `CandidateProfile.portfolioUrl` field stores the local path
 *     (e.g. "/backups-resumes/portfolio-<ts>-<name>.pdf").
 *   - External URLs are stored verbatim in `portfolioUrl`.
 *
 * Display priority: a locally-uploaded file is rendered inline (PDF in an
 * iframe via /api/proxy-resume, images inline, other files as a download
 * link). External URLs render as an "Open Portfolio" link.
 */

const LOCAL_PREFIX = "/backups-resumes/";

function isLocalFile(url: string | null | undefined): boolean {
  return !!url && url.startsWith(LOCAL_PREFIX);
}

function fileExt(url: string): string {
  return url.split(".").pop()?.toLowerCase() ?? "";
}

export function PortfolioPanel({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"view" | "attach">("view");
  // Within the "attach" mode, toggle between file upload and URL entry.
  const [attachTab, setAttachTab] = useState<"file" | "url">("file");

  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [removing, setRemoving] = useState(false);

  const portfolioUrl = candidate.portfolioUrl ?? null;
  const hasPortfolio = !!portfolioUrl;
  const isFile = isLocalFile(portfolioUrl);

  // ---- Actions ---------------------------------------------------------

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation mirrors the server's rules.
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "png", "jpg", "jpeg"].includes(ext)) {
      showToast("Only PDF, PNG, and JPG files are allowed", "error");
      // Reset the input so the same file can be re-selected after a fix.
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size exceeds 5MB limit", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/candidates/${candidate.id}/portfolio`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload portfolio");
      }
      showToast("Portfolio uploaded successfully", "success");
      setMode("view");
      // Full server refresh so the new file is truly persisted & displayed.
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload portfolio";
      showToast(message, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveUrl = async () => {
    const url = urlInput.trim();
    if (!url) {
      showToast("Please enter a portfolio URL", "error");
      return;
    }
    // Basic client-side URL validation (server re-validates).
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("URL must start with http:// or https://");
      }
    } catch {
      showToast("Please enter a valid http(s) URL", "error");
      return;
    }

    setSavingUrl(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/portfolio`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save portfolio URL");
      }
      showToast("Portfolio link saved", "success");
      setUrlInput("");
      setMode("view");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save portfolio URL";
      showToast(message, "error");
    } finally {
      setSavingUrl(false);
    }
  };

  const handleRemove = async () => {
    if (!hasPortfolio) return;
    const confirmed = window.confirm(
      "Remove this portfolio? This cannot be undone.",
    );
    if (!confirmed) return;

    setRemoving(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/portfolio`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove portfolio");
      }
      showToast("Portfolio removed", "success");
      setMode("view");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to remove portfolio";
      showToast(message, "error");
    } finally {
      setRemoving(false);
    }
  };

  // ---- Render: attach mode (file upload / URL entry) -------------------

  if (mode === "attach") {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 font-heading">
              Attach Portfolio
            </h3>
            <button
              type="button"
              onClick={() => setMode("view")}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Cancel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Toggle between file upload and URL entry */}
          <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setAttachTab("file")}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                attachTab === "file"
                  ? "bg-white text-[#006b5f] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Upload className="h-4 w-4" />
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setAttachTab("url")}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                attachTab === "url"
                  ? "bg-white text-[#006b5f] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <LinkIcon className="h-4 w-4" />
              External Link
            </button>
          </div>

          {attachTab === "file" ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && fileInputRef.current) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    fileInputRef.current.files = dt.files;
                    handleFileSelected({
                      target: { files: fileInputRef.current.files },
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                }}
                className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:border-[#006b5f] hover:bg-[#e6f5f3]/30"
              >
                <div className="h-12 w-12 rounded-full bg-[#e6f5f3] flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-[#006b5f]" />
                </div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Drag & drop a portfolio file here
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  PDF, PNG, or JPG — up to 5MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  onChange={handleFileSelected}
                  className="hidden"
                  id="portfolio-file-input"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={
                    uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )
                  }
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Choose File"}
                </Button>
              </div>
              {hasPortfolio && (
                <p className="text-xs text-slate-500 text-center">
                  Uploading a new file will replace the current portfolio.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="portfolio-url-input"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Portfolio URL
                </label>
                <input
                  id="portfolio-url-input"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://behance.net/yourname"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006b5f] focus:outline-none focus:ring-2 focus:ring-[#006b5f]/20"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Paste a link to a Behance profile, personal website, Google
                  Drive folder, etc.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleSaveUrl}
                  disabled={savingUrl}
                  icon={
                    savingUrl ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LinkIcon className="h-4 w-4" />
                    )
                  }
                >
                  {savingUrl ? "Saving…" : "Save Link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode("view")}
                  disabled={savingUrl}
                >
                  Cancel
                </Button>
              </div>
              {hasPortfolio && (
                <p className="text-xs text-slate-500">
                  Saving a new link will replace the current portfolio.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Render: view mode (empty state OR attached portfolio) ----------

  if (!hasPortfolio) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <ExternalLink className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 font-heading mb-1.5">
          No Portfolio Attached
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
          This candidate has not provided a portfolio. Attach a file or paste a
          portfolio link below.
        </p>
        <Button
          type="button"
          icon={<Upload className="h-4 w-4" />}
          onClick={() => {
            setAttachTab("file");
            setMode("attach");
          }}
        >
          Attach Portfolio
        </Button>
      </div>
    );
  }

  // --- Attached: local file (inline viewer) ----------------------------
  if (isFile) {
    const ext = fileExt(portfolioUrl as string);
    const isPdf = ext === "pdf";
    const isImage = ["png", "jpg", "jpeg"].includes(ext);
    const proxySrc = `/api/proxy-resume?url=${encodeURIComponent(portfolioUrl as string)}`;
    const fileName = (portfolioUrl as string).split("/").pop() ?? "portfolio";

    return (
      <div className="space-y-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {isPdf ? (
              <FileText className="h-4 w-4 text-[#006b5f]" />
            ) : (
              <ImageIcon className="h-4 w-4 text-[#006b5f]" />
            )}
            <span className="font-medium text-slate-700">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => {
                setAttachTab("file");
                setMode("attach");
              }}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              icon={
                removing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )
              }
              disabled={removing}
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={proxySrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in new tab
          </a>
          <a
            href={proxySrc}
            download={fileName}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {isPdf ? (
            <iframe
              src={proxySrc}
              title="Portfolio PDF"
              className="h-[600px] w-full"
            />
          ) : isImage ? (
            <img
              src={proxySrc}
              alt="Portfolio"
              className="max-h-[600px] w-full object-contain"
            />
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">
              Preview not available for this file type. Use the download button
              above.
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Attached: external URL ------------------------------------------
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-full bg-[#e6f5f3] flex items-center justify-center mx-auto mb-4">
        <ExternalLink className="h-8 w-8 text-[#006b5f]" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 font-heading mb-1.5">
        Attached Portfolio
      </h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-4 break-all">
        {portfolioUrl}
      </p>
      <div className="flex items-center gap-2">
        <a
          href={portfolioUrl as string}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#006b5f] px-4 h-10 text-sm font-medium text-white transition hover:bg-[#005249]"
        >
          <ExternalLink className="h-4 w-4" />
          Open Portfolio
        </a>
        <Button
          type="button"
          variant="secondary"
          icon={<Pencil className="h-4 w-4" />}
          onClick={() => {
            setAttachTab("url");
            setUrlInput(portfolioUrl ?? "");
            setMode("attach");
          }}
        >
          Replace
        </Button>
        <Button
          type="button"
          variant="destructive"
          icon={
            removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )
          }
          disabled={removing}
          onClick={handleRemove}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
