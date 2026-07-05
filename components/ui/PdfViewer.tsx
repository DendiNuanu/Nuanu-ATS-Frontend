"use client";

import { useState, useEffect } from "react";
import { FileText, Download, ExternalLink, Loader2, AlertCircle } from "lucide-react";

/**
 * Renders a candidate's resume/CV file inline.
 *
 * PDFs are displayed in an <iframe> pointing at the `/api/proxy-resume`
 * proxy route (the files live in `backups-resumes/`, outside `public/`,
 * so they can't be served directly by Next.js). DOC/DOCX files can't
 * be rendered inline by the browser, so we offer a download link instead.
 *
 * The proxy route handles BOTH local files and remote URLs (legacy
 * candidates imported from the old ATS domain).
 */
export function PdfViewer({
  resumeUrl,
  resumeText,
}: {
  resumeUrl: string | null | undefined;
  resumeText?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Probe the proxy route to detect 404s before rendering the iframe.
  // This lets us show a helpful error state instead of a broken viewer.
  useEffect(() => {
    if (!resumeUrl) return;
    setLoading(true);
    setNotFound(false);
    const proxySrc = `/api/proxy-resume?url=${encodeURIComponent(resumeUrl)}`;
    let cancelled = false;
    fetch(proxySrc, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
        }
      })
      .catch(() => {
        // Network errors are non-fatal — the iframe will still try to load.
      });
    return () => {
      cancelled = true;
    };
  }, [resumeUrl]);

  if (!resumeUrl) {
    // Fall back to raw parsed text if we have it but no file URL.
    if (resumeText && resumeText.trim().length > 0) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-600">
            <FileText className="h-4 w-4" />
            Parsed Resume Text
          </div>
          <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700 font-sans">
            {resumeText}
          </pre>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 font-heading mb-1.5">
          No resume on file
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          This candidate does not have an uploaded resume/CV file.
        </p>
      </div>
    );
  }

  const ext = resumeUrl.split(".").pop()?.toLowerCase();
  const isPdf = ext === "pdf";
  // Proxy route serves the file from outside public/
  const proxySrc = `/api/proxy-resume?url=${encodeURIComponent(resumeUrl)}`;
  const fileName = resumeUrl.split("/").pop() ?? "resume";

  // --- Error state: file not found on server -----------------------------
  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-amber-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 font-heading mb-1.5">
          Resume file not found
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-2">
          The resume file for this candidate could not be located on the
          server. This may happen for candidates imported from the legacy
          system whose files were not migrated.
        </p>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-4 break-all">
          File: {fileName}
        </p>
        {resumeText && resumeText.trim().length > 0 ? (
          <details className="mt-2 w-full text-left">
            <summary className="cursor-pointer text-sm font-medium text-[#006b5f] hover:underline">
              View parsed text instead
            </summary>
            <pre className="mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700 font-sans">
              {resumeText}
            </pre>
          </details>
        ) : (
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No parsed text is available either.
          </p>
        )}
      </div>
    );
  }

  // Non-PDF files (DOC/DOCX) cannot be rendered inline by the browser.
  if (!isPdf) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-[#e6f5f3] flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-[#006b5f]" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 font-heading mb-1.5">
          {fileName}
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
          This document format cannot be previewed inline. Download it to view
          the full content.
        </p>
        <a
          href={proxySrc}
          download={fileName}
          className="inline-flex items-center gap-2 rounded-lg bg-[#006b5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#005248] transition-colors"
        >
          <Download className="h-4 w-4" />
          Download File
        </a>
        {resumeText && resumeText.trim().length > 0 && (
          <details className="mt-6 w-full text-left">
            <summary className="cursor-pointer text-sm font-medium text-[#006b5f] hover:underline">
              View parsed text instead
            </summary>
            <pre className="mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700 font-sans">
              {resumeText}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <FileText className="h-4 w-4" />
          <span className="font-medium text-slate-700">{fileName}</span>
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
      </div>
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50">
            <Loader2 className="h-6 w-6 animate-spin text-[#006b5f]" />
            <p className="text-sm text-slate-500">Loading PDF…</p>
          </div>
        )}
        <iframe
          src={proxySrc}
          title="Resume/CV PDF"
          className="h-[600px] w-full"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
