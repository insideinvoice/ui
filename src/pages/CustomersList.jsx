import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { customerAPI } from "../api/auth";
import Spinner from "../components/Spinner";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { Search, Users } from "lucide-react";

export default function CustomersList() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    customerAPI.getAll({ size: 100 })
      .then((res) => setCustomers(res.data.data?.content || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.name || "").toLowerCase().includes(q)
      || (c.email || "").toLowerCase().includes(q)
      || (c.phone || "").includes(q)
      || (c.gstIn || "").toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <AppNavbar />
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100dvh - 80px)" }}>
          <Spinner size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="View Customers" />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h1 className="text-base sm:text-lg font-semibold text-slate-900">Customers</h1>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone or GSTIN..."
                className="w-full md:w-56 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white" />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">{search ? "No customers match your search" : "No customers yet"}</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">{search ? "Try a different name, email or phone" : "Add your first customer to get started"}</p>
              <button onClick={() => navigate("/customers/new")}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-sm">
                <Users className="w-4 h-4" /> Add Customer
              </button>
            </div>
          ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">GSTIN</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Billing Address</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-100 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-slate-800">{c.name}</span>
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm text-slate-600">{c.email || "-"}</td>
                    <td className="py-3 px-4 text-xs sm:text-sm text-slate-600">{c.phone || "-"}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-slate-600">{c.gstIn || "-"}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{c.billingAddress || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <div className="text-sm font-semibold text-slate-800 mb-1">{c.name}</div>
                <div className="space-y-0.5 text-xs text-slate-500">
                  {c.email && <div>Email: {c.email}</div>}
                  {c.phone && <div>Phone: {c.phone}</div>}
                  {c.gstIn && <div className="font-mono">GSTIN: {c.gstIn}</div>}
                  {c.billingAddress && <div>Address: {c.billingAddress}</div>}
                </div>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h1 { font-family: 'Space Grotesk', sans-serif; }
      `}</style>
    </div>
  );
}