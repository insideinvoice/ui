import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import LoadingDots from "../components/LoadingDots";
import { deliveryChallanAPI, businessAPI } from "../api/auth";
import { renderDeliveryChallanPdf } from "../components/DeliveryChallanDownload";
import toast from "react-hot-toast";
import {
  ClipboardList,
  Trash2,
  Eye,
  Download,
  Plus,
  Search,
  X,
} from "lucide-react";

export default function DeliveryChallansList() {
  const navigate = useNavigate();
  const [challans, setChallans] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [challanToDelete, setChallanToDelete] = useState(null);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = !query
    ? challans
    : challans.filter((dc) =>
        (dc.challanNumber || "").toLowerCase().includes(query) ||
        (dc.customerName || "").toLowerCase().includes(query) ||
        (dc.poNumber || "").toLowerCase().includes(query)
      );

  const fetchChallans = async () => {
    try {
      const res = await deliveryChallanAPI.getAll({
        size: 100,
        sortBy: "createdAt",
        sortDir: "desc",
      });
      setChallans(res.data.data?.content || res.data.data || []);
    } catch {
      toast.error("Failed to load delivery challans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallans();
    businessAPI
      .getProfile()
      .then((res) => setBusiness(res.data.data))
      .catch(() => {});
  }, []);

  const handleDelete = async () => {
    if (!challanToDelete) return;
    try {
      await deliveryChallanAPI.delete(challanToDelete.id);
      toast.success("Delivery challan deleted");
      setChallanToDelete(null);
      fetchChallans();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const handleDownload = async (dc) => {
    if (!business) {
      toast.error("Business profile not loaded yet");
      return;
    }
    setDownloadingId(dc.id);
    try {
      const variant = localStorage.getItem("ii_dc_template") || "classic";
      const sealOn = localStorage.getItem("ii_dc_seal") !== "off";
      const pdf = await renderDeliveryChallanPdf(dc, business, {
        variant,
        sealOn,
      });
      pdf.save(`Delivery_Challan_${dc.challanNumber}.pdf`);
      toast.success("Downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <AppNavbar />
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100dvh - 80px)" }}
        >
          <LoadingDots className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="Delivery Challans" />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 whitespace-nowrap">
                All Delivery Challans
              </h1>
              <p className="text-xs text-slate-500">
                {query ? `${filtered.length} of ${challans.length} shown` : `${challans.length} total`}
              </p>
            </div>
            <button
              onClick={() => navigate("/delivery-challans/new")}
              title="New Challan"
              aria-label="New Challan"
              className="flex items-center justify-center w-10 h-10 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all shadow-sm shrink-0"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {challans.length > 0 && (
            <div className="px-4 sm:px-6 pb-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search delivery challans"
                  className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 bg-white text-slate-800 placeholder:text-slate-400 min-h-[44px]"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {challans.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                No delivery challans yet
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Create your first delivery challan — the PDF downloads instantly
              </p>
              <button
                onClick={() => navigate("/delivery-challans/new")}
                className="mt-4 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-all"
              >
                New Delivery Challan
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No challans found</p>
              <p className="text-xs text-slate-500 mt-1">
                No delivery challan matches “{search.trim()}”
              </p>
              <button
                onClick={() => setSearch("")}
                className="mt-4 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-all"
              >
                Clear search
              </button>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Challan No
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        P.O No
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((dc, i) => (
                      <tr
                        key={dc.id}
                        className={`border-b border-slate-100 hover:bg-slate-100 transition-colors ${
                          i % 2 === 1 ? "bg-slate-50/40" : ""
                        }`}
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => navigate(`/delivery-challans/${dc.id}`)}
                            className="font-mono text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline text-left"
                          >
                            {dc.challanNumber}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                          {dc.challanDate}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {dc.customerName}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {dc.poNumber || "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                            {dc.items?.length || 0}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/delivery-challans/${dc.id}`)}
                              className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownload(dc)}
                              disabled={downloadingId === dc.id}
                              className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 disabled:opacity-50 transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setChallanToDelete(dc)}
                              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map((dc) => (
                  <div key={dc.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => navigate(`/delivery-challans/${dc.id}`)}
                        className="font-mono text-xs font-semibold text-teal-700"
                      >
                        {dc.challanNumber}
                      </button>
                      <span className="text-xs text-slate-500">{dc.challanDate}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      {dc.customerName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {dc.items?.length || 0} items
                      {dc.poNumber ? ` · PO ${dc.poNumber}` : ""}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => navigate(`/delivery-challans/${dc.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        onClick={() => handleDownload(dc)}
                        disabled={downloadingId === dc.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-teal-700 bg-teal-50 rounded-lg disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                      <button
                        onClick={() => setChallanToDelete(dc)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <ConfirmModal
          open={!!challanToDelete}
          title="Delete Delivery Challan"
          message={`Are you sure you want to delete "${challanToDelete?.challanNumber}"? This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setChallanToDelete(null)}
        />
      </div>
    </div>
  );
}
