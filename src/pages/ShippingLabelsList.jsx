import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import PageHeader from "../components/PageHeader";
import { labelAPI } from "../api/auth";
import toast from "react-hot-toast";
import { Search, Package, Plus } from "lucide-react";
import { downloadLabelPdf, printLabelPdf } from "../utils/labelPdf";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS = ["", "DRAFT", "GENERATED", "PRINTED", "VOID"];

export default function ShippingLabelsList() {
  const navigate = useNavigate();
  const { documentAccess } = useAuth();
  const canCreate = documentAccess?.shippingLabel !== false;
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async (query, statusFilter) => {
    try {
      setLoading(true);
      const res = await labelAPI.shipping.list({ size: 100, sortBy: "createdAt", sortDir: "desc", q: query, status: statusFilter || undefined });
      setLabels(res.data.data?.content || []);
    } catch {
      toast.error("Failed to load labels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, status), 300);
    return () => clearTimeout(t);
  }, [q, status, load]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-slate-50 to-violet-50/40">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="Shipping Labels" />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Card header — inline icon, filters and primary action */}
            <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-wrap items-center gap-2.5">
              <Package className="w-4 h-4 text-violet-600 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">All Shipping Labels</h2>
                <p className="text-xs text-slate-500 mt-0.5">Print-ready dispatch labels · {labels.length} total</p>
              </div>
              <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2.5">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search labels" aria-label="Search shipping labels"
                    className="w-full md:w-60 h-10 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200" />
                </div>
                <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"
                  className="h-10 min-w-[110px] px-3 pr-8 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 cursor-pointer transition-all duration-200">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || "Status"}</option>)}
                </select>
                {canCreate && (
                <button onClick={() => navigate("/labels/shipping/new")}
                  className="h-10 shrink-0 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all duration-150 whitespace-nowrap">
                  <Plus className="w-4 h-4" /> New Label
                </button>
                )}
              </div>
            </div>
          {loading ? (
            <div className="p-16 flex items-center justify-center"><LoadingDots className="text-slate-400" /></div>
          ) : labels.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No shipping labels yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Create your first shipping label</p>
              {canCreate && (
              <button onClick={() => navigate("/labels/shipping/new")}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[40px] text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all duration-150 whitespace-nowrap">
                Create Label
              </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-3">Label #</th>
                    <th className="px-4 py-3">Carrier</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Tracking</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {labels.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{l.labelNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{l.carrier || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{l.serviceLevel || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{l.trackingNumber || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{l.labelSize}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.status === "PRINTED" ? "bg-green-100 text-green-700" : l.status === "GENERATED" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => downloadLabelPdf(() => labelAPI.shipping.pdf(l.id), `${l.labelNumber}.pdf`)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-slate-50 transition-all">Download</button>
                          <button onClick={() => printLabelPdf(() => labelAPI.shipping.pdf(l.id))}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 transition-all">Print</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
