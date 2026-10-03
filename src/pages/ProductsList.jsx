import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { productAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, Package, Hash, IndianRupee, Percent, Search } from "lucide-react";

export default function ProductsList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await productAPI.getAll({ size: 100, sortBy: "createdAt", sortDir: "desc" });
        setProducts(res.data.data?.content || res.data.data || []);
      } catch (err) {
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.name || "").toLowerCase().includes(q) || (p.hsn || "").toLowerCase().includes(q);
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
        <PageHeader title="Products" />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h1 className="text-base sm:text-lg font-semibold text-slate-900">Product Items</h1>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or HSN/SAC..."
                className="w-full md:w-56 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white" />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">{search ? "No products match your search" : "No products yet"}</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">{search ? "Try a different name or HSN/SAC" : "Add your first product to get started"}</p>
              <button onClick={() => navigate("/products/new")}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-sm">
                <Package className="w-4 h-4" /> Add Product
              </button>
            </div>
          ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">HSN/SAC</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">GST %</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-100 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-800">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-slate-600">{p.hsn || "-"}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-slate-800">
                      Rs. {parseFloat(p.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-xs font-semibold text-slate-600">{p.gstPercentage || 0}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                </div>
                <div className="space-y-0.5 text-xs text-slate-500">
                  <div className="font-mono">HSN/SAC: {p.hsn || "-"}</div>
                  <div className="flex items-center justify-between">
                    <span>Rate: Rs. {parseFloat(p.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    <span className="font-semibold text-slate-600">{p.gstPercentage || 0}% GST</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}