import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { adminAPI } from "../api/auth";
import { Search } from "lucide-react";
import PageHeader from "../components/PageHeader";
import PaginationBar from "../components/PaginationBar";

const PAGE_SIZE = 25;

export default function AdminBusinessesList() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0); // 0-based server page
  const [q, setQ] = useState("");
  const [query, setQuery] = useState(""); // debounced search term
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Debounce the search box → server-side ?q= (SQL search, not .filter()).
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true); // page reset + search = a new request
      setQuery(q.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    adminAPI.getAllBusinesses({ page, size: PAGE_SIZE, q: query })
      .then((res) => {
        if (cancelled) return;
        const d = res.data.data;
        setBusinesses(d?.content || []);
        setTotalElements(d?.totalElements ?? 0);
        setTotalPages(Math.max(1, d?.totalPages ?? 1));
      })
      .catch((err) => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, query]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="Registered Businesses" />
        <div className="relative max-w-md mb-4 -mt-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search business, owner, email, GST or phone…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
        <p className="text-xs text-slate-500 -mt-1 mb-6">
          {totalElements.toLocaleString("en-IN")} total{query ? " (matching search)" : ""}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <LoadingDots className="text-slate-400" />
          </div>
        ) : businesses.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Business Name</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Owner</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Email</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Phone</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">GST</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Website</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Invoice Prefix</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Address</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b) => (
                    <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6 text-xs font-medium whitespace-nowrap">
                        <button onClick={() => navigate(`/admin/businesses/${b.id}/invoices`)}
                          className="text-slate-800 hover:text-indigo-600 hover:underline transition-colors text-left">
                          {b.businessName}
                        </button>
                      </td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.ownerName || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.email || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.phone || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.gstIn || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.website || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.invoicePrefix || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600">{[b.addressLine1, b.addressLine2, b.city, b.state, b.pincode].filter(Boolean).join(", ") || "-"}</td>
                      <td className="py-3 px-6 text-xs whitespace-nowrap">
                        <button onClick={() => navigate(`/admin/businesses/${b.id}/invoices`)}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline text-xs">
                          View Invoices
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {businesses.map((b) => (
                <div key={b.id} className="p-4" onClick={() => navigate(`/admin/businesses/${b.id}/invoices`)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-800">{b.businessName}</span>
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/businesses/${b.id}/invoices`); }}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium min-h-[44px] flex items-center">
                      View Invoices
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Owner:</span> {b.ownerName || "-"}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Email:</span> {b.email || "-"}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Phone:</span> {b.phone || "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 text-center py-16">
            {query ? "No businesses match your search" : "No businesses registered yet"}
          </p>
        )}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          onPage={(p) => { setLoading(true); setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          loading={loading}
        />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h1 { font-family: 'Space Grotesk', sans-serif; }
      `}</style>
    </div>
  );
}
