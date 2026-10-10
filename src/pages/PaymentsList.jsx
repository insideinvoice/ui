import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { paymentAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, CreditCard, IndianRupee, Calendar, Trash2, FileText, PlusCircle } from "lucide-react";

const MODE_COLORS = {
  UPI: "bg-purple-100 text-purple-700",
  CASH: "bg-emerald-100 text-emerald-700",
  CARD: "bg-amber-100 text-amber-700",
  CHEQUE: "bg-blue-100 text-blue-700",
  NEFT: "bg-cyan-100 text-cyan-700",
  IMPS: "bg-pink-100 text-pink-700",
};

export default function PaymentsList() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    try {
      const res = await paymentAPI.getAll({ size: 100, sortBy: "createdAt", sortDir: "desc" });
      setPayments(res.data.data?.content || res.data.data || []);
    } catch {
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this payment record?")) return;
    try {
      await paymentAPI.delete(id);
      toast.success("Payment deleted");
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

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
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="Payments" />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm shrink-0">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-slate-900">Payments Received</h1>
              <p className="text-xs text-slate-500">{payments.length} total</p>
            </div>
          </div>
          {payments.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No payments recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">Payments appear when you record them against invoices</p>
            </div>
          ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mode</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-100 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                    <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{p.paymentDate}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => navigate(`/invoice/${p.invoiceId}`)}
                        className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline text-left">
                        {p.invoiceNumber || `#${p.invoiceId}`}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{p.customerName}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${MODE_COLORS[p.paymentMode] || "bg-slate-100 text-slate-600"}`}>
                        {p.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-xs">{p.referenceNo || "-"}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-semibold text-emerald-600 whitespace-nowrap">
                      Rs. {parseFloat(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleDelete(p.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {payments.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">{p.paymentDate}</span>
                  <span className="font-mono text-sm font-semibold text-emerald-600">
                    Rs. {parseFloat(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => navigate(`/invoice/${p.invoiceId}`)}
                    className="font-mono text-xs font-semibold text-indigo-600 hover:underline">
                    {p.invoiceNumber || `#${p.invoiceId}`}
                  </button>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${MODE_COLORS[p.paymentMode] || "bg-slate-100 text-slate-600"}`}>
                    {p.paymentMode}
                  </span>
                </div>
                <div className="text-sm text-slate-600 mb-2">{p.customerName}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono">Ref: {p.referenceNo || "-"}</span>
                  <button onClick={() => handleDelete(p.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
