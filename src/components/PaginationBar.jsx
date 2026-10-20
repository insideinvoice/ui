import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

/**
 * Compact server-side pagination bar shared by every admin list page.
 *
 * All admin list endpoints return `PagedResponse` — 0-based `page`, page
 * `size`, `totalElements`, `totalPages`. This component is deliberately dumb:
 * it renders the current window and delegates page changes, so each page owns
 * its fetch state.
 *
 * @param {number} page           0-based current page
 * @param {number} totalPages     total page count (from PagedResponse)
 * @param {number} totalElements  total row count (from PagedResponse)
 * @param {(page: number) => void} onPage  called with the next 0-based page
 * @param {boolean} [loading]     disables the buttons while a fetch is in flight
 */
export default function PaginationBar({ page, totalPages, totalElements, onPage, loading = false }) {
  const pages = Math.max(totalPages || 1, 1);
  const current = Math.min(Math.max(page, 0), pages - 1);
  const isFirst = current <= 0;
  const isLast = current >= pages - 1;

  if (!totalElements) return null;

  const btn =
    "h-8 min-w-8 px-2 inline-flex items-center justify-center gap-1 rounded-lg text-xs font-semibold " +
    "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 " +
    "disabled:opacity-40 disabled:pointer-events-none transition-colors";
  const edge = `${btn} px-1.5`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="text-xs text-slate-500">
        Showing page {current + 1} of {pages} ·{" "}
        <span className="font-semibold text-slate-700">{totalElements.toLocaleString("en-IN")}</span>{" "}
        total{totalElements === 1 ? " record" : " records"}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={edge}
          disabled={loading || isFirst}
          onClick={() => onPage(0)}
          aria-label="First page"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          className={btn}
          disabled={loading || isFirst}
          onClick={() => onPage(current - 1)}
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <button
          type="button"
          className={btn}
          disabled={loading || isLast}
          onClick={() => onPage(current + 1)}
        >
          Next <ChevronRight size={14} />
        </button>
        <button
          type="button"
          className={edge}
          disabled={loading || isLast}
          onClick={() => onPage(pages - 1)}
          aria-label="Last page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
