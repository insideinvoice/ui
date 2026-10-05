import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingDots from "../components/LoadingDots";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { adminAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, Package, Building2, User, Hash, IndianRupee, Percent } from "lucide-react";

export default function AdminProductsList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await adminAPI.getAllProducts();
        const data = res?.data?.data;
        setProducts(Array.isArray(data) ? data : data?.content || []);
      } catch (err) {
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <AppNavbar />
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100dvh - 80px)" }}>
          <LoadingDots className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-[1900px] mx-auto">
        <PageHeader title="All Products" />
        <p className="text-xs text-slate-500 -mt-4 mb-6">All products across all businesses</p>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {products.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No products registered yet</p>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Business</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-100 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-sm font-medium text-slate-800">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{p.hsn || "-"}</td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-slate-800">
                        Rs. {parseFloat(p.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-semibold text-slate-600">{p.gstPercentage || 0}%</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-xs text-slate-700">{p.businessName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="text-xs text-slate-700">{p.ownerName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {products.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                    <span className="text-xs font-semibold text-slate-600">{p.gstPercentage || 0}%</span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Rate:</span> Rs. {parseFloat(p.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">HSN:</span> {p.hsn || "-"}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Business:</span> {p.businessName}
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