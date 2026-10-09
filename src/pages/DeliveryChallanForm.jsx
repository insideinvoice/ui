import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import LoadingDots from "../components/LoadingDots";
import { deliveryChallanAPI, customerAPI, businessAPI } from "../api/auth";
import { renderDeliveryChallanPdf } from "../components/DeliveryChallanDownload";
import { goBack } from "../utils/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Trash2, Download, ClipboardList } from "lucide-react";

const inputClass =
  "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white transition-all min-h-[44px]";
const labelClass =
  "block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase";

const todayIso = () => new Date().toISOString().split("T")[0];

const emptyItem = { description: "", quantity: "" };

export default function DeliveryChallanForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [template, setTemplate] = useState(
    () => searchParams.get("template") || localStorage.getItem("ii_dc_template") || "classic"
  );
  const [sealOn, setSealOn] = useState(
    () => localStorage.getItem("ii_dc_seal") !== "off"
  );
  // Round seal vs rectangular rubber stamp — same global preference the
  // invoice flow uses (localStorage.seal_type), defaulting to the round seal.
  const [sealType, setSealType] = useState(
    () => localStorage.getItem("seal_type") || "round"
  );
  const [form, setForm] = useState({
    challanNumber: "",
    challanDate: todayIso(),
    customerId: "",
    poNumber: "",
    poDate: "",
  });
  const [items, setItems] = useState([{ ...emptyItem }]);

  useEffect(() => {
    Promise.all([
      customerAPI.getAll({ size: 200, sortBy: "name", sortDir: "asc" }),
      businessAPI.getProfile(),
    ])
      .then(([cRes, bRes]) => {
        setCustomers(cRes.data.data?.content || cRes.data.data || []);
        setBusiness(bRes.data.data);
      })
      .catch(() => toast.error("Failed to load form data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem("ii_dc_template", template);
  }, [template]);

  useEffect(() => {
    localStorage.setItem("ii_dc_seal", sealOn ? "on" : "off");
  }, [sealOn]);

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const setItem = (idx, name, value) =>
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, [name]: value } : it)));

  const addItem = () => setItems((list) => [...list, { ...emptyItem }]);
  const removeItem = (idx) =>
    setItems((list) => (list.length === 1 ? list : list.filter((_, i) => i !== idx)));

  const validItems = items.filter(
    (it) => it.description.trim() && parseFloat(it.quantity) > 0
  );

  const handleCreate = async () => {
    if (!form.customerId) {
      toast.error("Select a customer");
      return;
    }
    if (!validItems.length) {
      toast.error("Add at least one item with description and quantity");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        challanNumber: form.challanNumber.trim() || undefined,
        customerId: Number(form.customerId),
        challanDate: form.challanDate,
        poNumber: form.poNumber.trim() || undefined,
        poDate: form.poDate || undefined,
        items: validItems.map((it) => ({
          description: it.description.trim(),
          quantity: parseFloat(it.quantity),
        })),
      };
      const res = await deliveryChallanAPI.create(payload);
      const dc = res.data.data;
      const pdf = await renderDeliveryChallanPdf(dc, business, {
        variant: template,
        sealOn,
        sealType,
      });
      pdf.save(`Delivery_Challan_${dc.challanNumber}.pdf`);
      toast.success("Delivery challan created & downloaded");
      navigate("/delivery-challans");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to create delivery challan"
      );
    } finally {
      setSaving(false);
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
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1400px] mx-auto">
        <PageHeader title="New Delivery Challan" />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardList className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Challan Details</h2>
              <p className="text-xs text-slate-500">
                Creates the record and instantly downloads the PDF
              </p>
            </div>
          </div>

          {/* Template + seal */}
          <div className="flex flex-wrap items-end gap-6 mb-5">
            <div>
              <span className={labelClass}>Template</span>
              <div className="flex gap-2">
                {[
                  { id: "classic", label: "Classic" },
                  { id: "royal", label: "Royal" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all min-h-[40px] ${
                      template === t.id
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none pb-2.5">
              <input
                type="checkbox"
                checked={sealOn}
                onChange={(e) => setSealOn(e.target.checked)}
                className="w-4.5 h-4.5 accent-teal-600"
              />
              Seal / Rubber stamp on PDF
            </label>
            {sealOn && (
              <div className="pb-1.5">
                <span className={labelClass}>Stamp type</span>
                <div className="flex gap-2">
                  {[
                    { id: "round", label: "Round Seal" },
                    { id: "stamp", label: "Rubber Stamp" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSealType(s.id);
                        localStorage.setItem("seal_type", s.id);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all min-h-[40px] ${
                        sealType === s.id
                          ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <div>
              <label className={labelClass}>Challan No.</label>
              <input
                type="text"
                value={form.challanNumber}
                onChange={(e) => setField("challanNumber", e.target.value)}
                className={inputClass}
                placeholder="Leave blank for auto (DC-YYYYMMDD-HHMMSS)"
              />
            </div>
            <div>
              <label className={labelClass}>Challan Date</label>
              <input
                type="date"
                value={form.challanDate}
                onChange={(e) => setField("challanDate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Customer *</label>
              <select
                value={form.customerId}
                onChange={(e) => setField("customerId", e.target.value)}
                className={inputClass}
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Your P.O No (optional)</label>
              <input
                type="text"
                value={form.poNumber}
                onChange={(e) => setField("poNumber", e.target.value)}
                className={inputClass}
                placeholder="PO-2026-001"
              />
            </div>
            <div>
              <label className={labelClass}>P.O Date (optional)</label>
              <input
                type="date"
                value={form.poDate}
                onChange={(e) => setField("poDate", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Items */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className={labelClass + " mb-0"}>Items *</span>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 sm:p-0 rounded-lg border border-slate-200 sm:border-0 sm:rounded-none bg-slate-50/60 sm:bg-transparent"
                >
                  <div className="flex items-center gap-2 min-w-0 sm:flex-1">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={it.description}
                      onChange={(e) => setItem(idx, "description", e.target.value)}
                      placeholder="Description of material"
                      className={inputClass + " min-w-0 sm:flex-1"}
                    />
                  </div>
                  <div className="flex items-center gap-2 pl-9 sm:pl-0">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={it.quantity}
                      onChange={(e) => setItem(idx, "quantity", e.target.value)}
                      placeholder="Qty"
                      className={inputClass + " w-28"}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-all shadow-sm min-h-[44px]"
            >
              {saving ? <LoadingDots className="text-white" /> : <Download className="w-4 h-4" />}
              {saving ? "Creating…" : "Create & Download PDF"}
            </button>
            <button
              onClick={() => goBack(navigate, "/delivery-challans")}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-700 text-sm font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 transition-all min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" /> Back to list
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
