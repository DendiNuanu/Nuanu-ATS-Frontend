import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  /** Current page number (1-based). */
  page: number;
  /** Total number of records across all pages. */
  total: number;
  /** Number of records per page. */
  pageSize: number;
  /** Base href for building pagination links (e.g. "/candidates"). */
  basePath: string;
  /** Current query string params to preserve (e.g. "stage=Screening&search=budi"). Pass without the leading "?". */
  queryParams?: Record<string, string | undefined>;
};

/**
 * Builds a URL with the given page number, preserving existing query params.
 */
function buildUrl(
  basePath: string,
  page: number,
  queryParams?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== "") {
        params.set(key, value);
      }
    }
  }
  params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Pagination control bar for table-based pages.
 * Left: "Showing X–Y of Z". Right: Previous / "Page N of M" / Next.
 */
export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  queryParams,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  const prevHref = buildUrl(basePath, currentPage - 1, queryParams);
  const nextHref = buildUrl(basePath, currentPage + 1, queryParams);

  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= totalPages || total === 0;

  const linkClass = (disabled: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
      disabled
        ? "cursor-not-allowed bg-slate-100 text-slate-300"
        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400",
    );

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-100">
      {/* Left: showing X–Y of Z */}
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{start}</span>–
        <span className="font-medium text-slate-700">{end}</span> of{" "}
        <span className="font-medium text-slate-700">
          {total.toLocaleString()}
        </span>
      </p>

      {/* Right: Previous / Page N of M / Next */}
      <div className="flex items-center gap-3">
        {isPrevDisabled ? (
          <span className={linkClass(true)}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </span>
        ) : (
          <a href={prevHref} className={linkClass(false)}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </a>
        )}

        <span className="text-sm text-slate-600">
          Page <span className="font-semibold text-slate-900">{currentPage}</span> of{" "}
          <span className="font-semibold text-slate-900">{totalPages}</span>
        </span>

        {isNextDisabled ? (
          <span className={linkClass(true)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </span>
        ) : (
          <a href={nextHref} className={linkClass(false)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
