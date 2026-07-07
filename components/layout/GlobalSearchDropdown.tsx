"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, X, User, Briefcase, Loader2 } from "lucide-react";
import { cn, initials } from "@/lib/utils";

type CandidateResult = {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  stage: string;
  isBlacklisted: boolean;
  avatarColor: string;
};

type JobResult = {
  id: string;
  title: string;
  department: string;
  status: string;
  location: string;
};

type SearchResults = {
  candidates: CandidateResult[];
  jobs: JobResult[];
};

type GlobalSearchDropdownProps = {
  open: boolean;
  onClose: () => void;
};

export function GlobalSearchDropdown({ open, onClose }: GlobalSearchDropdownProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ candidates: [], jobs: [] });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      // Small delay to ensure the panel is rendered
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    // Reset state when closed
    setQuery("");
    setResults({ candidates: [], jobs: [] });
    setHasSearched(false);
    setLoading(false);
  }, [open]);

  // Debounced search
  const performSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults({ candidates: [], jobs: [] });
      setLoading(false);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!res.ok) {
          setResults({ candidates: [], jobs: [] });
        } else {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        setResults({ candidates: [], jobs: [] });
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    }, 300);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    performSearch(value);
  };

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Use mousedown so we catch the click before any link navigation
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!open) return null;

  const hasResults = results.candidates.length > 0 || results.jobs.length > 0;
  const showEmpty = hasSearched && !loading && !hasResults && query.trim().length >= 2;

  const handleResultClick = () => {
    onClose();
  };

  return (
    <>
      {/* Backdrop for mobile — transparent on desktop (click handled by mousedown above) */}
      <div className="fixed inset-0 z-40" aria-hidden="true" />

      {/* Search panel */}
      <div
        ref={panelRef}
        className="absolute right-0 top-full mt-2 w-[min(560px,calc(100vw-3rem))] z-50 origin-top-right"
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <Search className="h-5 w-5 flex-shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search candidates or jobs..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            {loading && <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-slate-400" />}
            <button
              onClick={onClose}
              className="flex-shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Candidates section */}
            {results.candidates.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 bg-slate-50/50">
                  <User className="h-3.5 w-3.5" />
                  Candidates ({results.candidates.length})
                </div>
                {results.candidates.map((c) => (
                  <Link
                    key={c.id}
                    href={`/candidates/${c.id}`}
                    onClick={handleResultClick}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                  >
                    {/* Avatar */}
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: c.avatarColor }}
                    >
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 group-hover:text-[#006b5f]">
                        {c.name}
                        {c.isBlacklisted && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            Blacklisted
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {c.position}
                        {c.email ? ` · ${c.email}` : ""}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                      {c.stage}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {/* Jobs section */}
            {results.jobs.length > 0 && (
              <div className={results.candidates.length > 0 ? "border-t border-slate-100" : ""}>
                <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 bg-slate-50/50">
                  <Briefcase className="h-3.5 w-3.5" />
                  Jobs ({results.jobs.length})
                </div>
                {results.jobs.map((j) => (
                  <Link
                    key={j.id}
                    href={`/jobs/${j.id}`}
                    onClick={handleResultClick}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#006b5f]/10">
                      <Briefcase className="h-4 w-4 text-[#006b5f]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 group-hover:text-[#006b5f]">
                        {j.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {j.department}
                        {j.location ? ` · ${j.location}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                        j.status === "Open" && "bg-green-100 text-green-700",
                        j.status === "On Hold" && "bg-amber-100 text-amber-700",
                        j.status === "Closed" && "bg-slate-100 text-slate-600",
                        j.status === "Draft" && "bg-slate-100 text-slate-600",
                      )}
                    >
                      {j.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {/* Empty state */}
            {showEmpty && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Search className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No results found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Try searching by name, email, phone, or job title
                </p>
              </div>
            )}

            {/* Initial state (before any search) */}
            {!hasSearched && !loading && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Search className="h-7 w-7 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">
                  Start typing to search candidates and jobs
                </p>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Search candidates & jobs</span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] text-slate-500">
                Esc
              </kbd>
              to close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
