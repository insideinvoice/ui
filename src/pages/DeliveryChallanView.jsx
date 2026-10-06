import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import LoadingDots from "../components/LoadingDots";
import DeliveryChallanDoc from "../components/DeliveryChallanDoc";
import { renderDeliveryChallanPdf } from "../components/DeliveryChallanDownload";
import { chunkDcItems } from "../utils/deliveryChallanPdf";
import { deliveryChallanAPI, businessAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, Download, Trash2, ClipboardList } from "lucide-react";

export default function DeliveryChallanView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [dc, setDc] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [template, setTemplate] = useState(
    () => localStorage.getItem("ii_dc_template") || "classic"
  );
  const [sealOn, setSealOn] = useState(
    () => localStorage.getItem("ii_dc_seal") !== "off"
  );

  useEffect(() => {
    Promise.all([
      deliveryChallanAPI.getById(id),
      businessAPI.getProfile(),
    ])
      .then(([dRes, bRes]) => {
        setDc(dRes.data.data);
        setBusiness(bRes.data.data);
      })
      .catch(() => toast.error("Failed to load delivery challan"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    if (!dc || !business) return;
    setDownloading(true);
    try {
      const pdf = await renderDeliveryChallanPdf(dc, business, {
        variant: template,
        sealOn,
      });
      pdf.save(`Delivery_Challan_${dc.challanNumber}.pdf`);
      toast.success("Downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this delivery challan?")) return;
    try {
      await deliveryChallanAPI.delete(id);
      toast.success("Delivery challan deleted");
      navigate("/delivery-challans");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  if (loading || !dc) {
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

  const chunks = chunkDcItems(dc.items || []);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1400px] mx-auto">
        <PageHeader title={`Challan ${dc.challanNumber}`} />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardList className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="mr-auto">
              <p className="text-sm font-semibold text-slate-800">
                {dc.customerName}{" "}
                <span className="text-slate-400 font-normal">·</span>{" "}
                {dc.challanDate}
              </p>
              <p className="text-xs text-slate-500">
                {dc.items?.length || 0} items
                {dc.poNumber ? ` · P.O No ${dc.poNumber}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={template}
                onChange={(e) => {
                  setTemplate(e.target.value);
                  localStorage.setItem("ii_dc_template", e.target.value);
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 bg-white min-h-[38px]"
              >
                <option value="classic">Classic template</option>
                <option value="royal">Royal template</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sealOn}
                  onChange={(e) => {
                    setSealOn(e.target.checked);
                    localStorage.setItem(
                      "ii_dc_seal",
                      e.target.checked ? "on" : "off"
                    );
                  }}
                  className="w-4 h-4 accent-teal-600"
                />
                Seal
              </label>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-all min-h-[38px]"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 bg-white text-red-600 text-xs font-semibold rounded-lg border border-red-200 hover:bg-red-50 transition-all min-h-[38px]"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button
                onClick={() => navigate("/delivery-challans")}
                className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-600 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 transition-all min-h-[38px]"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 pb-8 overflow-x-auto">
          {chunks.map((chunk, i) => (
            <div
              key={i}
              className="shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-slate-200 shrink-0"
            >
              <DeliveryChallanDoc
                variant={template}
                business={business}
                customer={{
                  name: dc.customerName,
                  billingAddress: dc.customerAddress,
                  phone: dc.customerPhone,
                  gstIn: dc.customerGstIn,
                }}
                challanNumber={dc.challanNumber}
                challanDate={dc.challanDate}
                poNumber={dc.poNumber}
                poDate={dc.poDate}
                items={chunk}
                showSeal={sealOn}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
