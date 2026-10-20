import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { adminAPI } from "../api/auth";
import { Search } from "lucide-react";
import PageHeader from "../components/PageHeader";

const PAGE_SIZE = 25; // invoices per page — keeps even 10k+ lists smooth

export default function AdminInvoicesList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1); // 1-based UI page (server is 0-based)
  const [q, setQ] = useState(""); // search input
  const [query, setQuery] = useState(""); // debounced server-side search term
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Debounce the search box → server-side ?q= (search runs in SQL now, not .filter()).
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true); // page reset + search = a new request
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    adminAPI.getAllInvoices({ page: page - 1, size: PAGE_SIZE, q: query })
      .then((res) => {
        if (cancelled) return;
        const d = res.data.data;
        setInvoices(d?.content || []);
        setTotalElements(d?.totalElements ?? 0);
        setTotalPages(Math.max(1, d?.totalPages ?? 1));
      })
      .catch((err) => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, query]);

  // Derived (not state): if the list ever shrinks below the stored page, the
  // effective page clamps itself — no cascading-render setState needed.
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageInvoices = invoices;

  const goTo = (p) => {
    if (p >= 1 && p <= totalPages && p !== safePage) {
      setLoading(true); // next page = a new request
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Compact numbered pagination: 1 … (page-1, page, page+1) … last
  const pageButtons = useMemo(() => {
    const cells = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= safePage - 1 && p <= safePage + 1)) {
        cells.push(p);
      } else if (cells[cells.length - 1] !== "…") {
        cells.push("…");
      }
    }
    return cells;
  }, [totalPages, safePage]);

  const showPagination = !loading && totalPages > 1;
  const paginationBar = (
    <nav className="flex items-center justify-center flex-wrap gap-1.5 py-6">
      <button type="button" onClick={() => goTo(safePage - 1)} disabled={safePage === 1}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        ‹ Prev
      </button>
      {pageButtons.map((cell, i) => cell === "…"
        ? <span key={`e${i}`} className="px-1 text-xs text-slate-400 select-none">…</span>
        : (
          <button type="button" key={cell} onClick={() => goTo(cell)} aria-current={cell === safePage}
            className={`min-w-[32px] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              cell === safePage
                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            {cell}
          </button>))}
      <button type="button" onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        Next ›
      </button>
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="All Invoices" />
        <div className="relative max-w-md mb-4 -mt-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice #, customer or business…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
        <p className="text-xs text-slate-500 -mt-1 mb-6">
          {totalElements > 0
            ? `Showing ${start + 1}–${start + invoices.length} of ${totalElements.toLocaleString("en-IN")}`
            : "0 total"}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <LoadingDots className="text-slate-400" />
          </div>
        ) : invoices.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">S.No.</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Invoice #</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Customer</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Date</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Due Date</th>
                    <th className="text-right py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Grand Total</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Status</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {pageInvoices.map((inv, idx) => (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/invoices/${inv.id}`)}>
                      <td className="py-3 px-6 text-xs text-slate-400 font-medium whitespace-nowrap">{start + idx + 1}</td>
                      <td className="py-3 px-6 text-xs font-mono text-indigo-600 whitespace-nowrap">{inv.invoiceNumber}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{inv.customerName}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{inv.invoiceDate}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{inv.dueDate}</td>
                      <td className="py-3 px-6 text-xs text-slate-800 font-medium text-right whitespace-nowrap">₹{Number(inv.grandTotal).toLocaleString()}</td>
                      <td className="py-3 px-6 whitespace-nowrap">
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          inv.status === "PAID" ? "bg-emerald-100 text-emerald-700" :
                          inv.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                          inv.status === "DRAFT" ? "bg-slate-100 text-slate-600" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{inv.businessName} ({inv.ownerName})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {pageInvoices.map((inv, idx) => (
                <div key={inv.id} className="p-4" onClick={() => navigate(`/admin/invoices/${inv.id}`)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-semibold text-indigo-600">
                      <span className="text-slate-400 mr-1.5">{start + idx + 1}.</span>
                      {inv.invoiceNumber}
                    </span>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                      inv.status === "PAID" ? "bg-emerald-100 text-emerald-700" :
                      inv.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                      inv.status === "DRAFT" ? "bg-slate-100 text-slate-600" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Customer:</span> {inv.customerName}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Amount:</span> ₹{Number(inv.grandTotal).toLocaleString()}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Owner:</span> {inv.businessName} ({inv.ownerName})
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {showPagination && paginationBar}
          </>
        ) : (
          <p className="text-sm text-slate-400 text-center py-16">
            {query ? "No invoices match your search" : "No invoices found"}
          </p>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h1 { font-family: 'Space Grotesk', sans-serif; }
      `}</style>
    </div>
  );
}
