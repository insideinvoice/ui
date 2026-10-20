import { useState, useEffect } from "react";
import LoadingDots from "../components/LoadingDots";
import { adminAPI } from "../api/auth";
import { Search } from "lucide-react";
import PageHeader from "../components/PageHeader";
import PaginationBar from "../components/PaginationBar";

const PAGE_SIZE = 25;

export default function AdminCustomersList() {
  const [customers, setCustomers] = useState([]);
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
    adminAPI.getAllCustomers({ page, size: PAGE_SIZE, q: query })
      .then((res) => {
        if (cancelled) return;
        const d = res.data.data;
        setCustomers(d?.content || []);
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
        <PageHeader title="All Customers" />
        <div className="relative max-w-md mb-4 -mt-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone or GSTIN…"
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
        ) : customers.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Name</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Email</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Phone</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">GSTIN</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">City</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Business ID</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6 text-xs text-slate-800 font-medium whitespace-nowrap">{c.name}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{c.email || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{c.phone || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{c.gstIn || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{c.city || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{c.businessId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {customers.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Email:</span> {c.email || "-"}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Phone:</span> {c.phone || "-"}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">GSTIN:</span> {c.gstIn || "-"}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">City:</span> {c.city || "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              onPage={(p) => { setLoading(true); setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              loading={loading}
            />
          </>
        ) : (
          <p className="text-sm text-slate-400 text-center py-16">
            {query ? "No customers match your search" : "No customers found"}
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
