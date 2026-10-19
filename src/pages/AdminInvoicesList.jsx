import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { adminAPI } from "../api/auth";
import { ArrowLeft, FileText } from "lucide-react";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";

const PAGE_SIZE = 25; // invoices per page — keeps even 10k+ lists smooth

export default function AdminInvoicesList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    adminAPI.getAllInvoices()
      .then((res) => { const d = res.data.data; setInvoices(Array.isArray(d) ? d : d?.content || []); })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  // Derived (not state): if the list ever shrinks below the stored page, the
  // effective page clamps itself — no cascading-render setState needed.
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const start = (safePage - 1) * PAGE_SIZE;
  const pageInvoices = invoices.slice(start, start + PAGE_SIZE);

  const goTo = (p) => {
    if (p >= 1 && p <= totalPages && p !== safePage) {
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
          </button>
        ))}
      <button type="button" onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        Next ›
      </button>
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="All Invoices" />
        <p className="text-xs text-slate-500 -mt-4 mb-6">
          {invoices.length > 0
            ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, invoices.length)} of ${invoices.length}`
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
          <p className="text-sm text-slate-400 text-center py-16">No invoices found</p>
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
