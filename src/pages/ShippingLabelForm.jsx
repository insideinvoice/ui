import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppNavbar from "../components/AppNavbar";
import PdfPreview from "../components/PdfPreview";
import ShippingLabelPreview from "../components/labelPreview/ShippingLabelPreview";
import usePdfPreview from "../hooks/usePdfPreview";
import PageHeader from "../components/PageHeader";
import { labelAPI } from "../api/auth";
import { downloadLabelPdf, printLabelPdf } from "../utils/labelPdf";
import LabelAddressBlock from "../components/LabelAddressBlock";
import toast from "react-hot-toast";

const PRESET_OPTIONS = [
  { value: "STANDARD_CARRIER_4X6", label: "Standard Carrier 4×6" },
  { value: "AMAZON_FBA_4X6", label: "Amazon FBA 4×6" },
  { value: "GS1_SSCC_4X6", label: "GS1 SSCC 4×6" },
  { value: "SIMPLE_ADDRESS", label: "Simple Address" },
  { value: "RETURN_LABEL", label: "Return Label" },
  { value: "FNSKU_30UP", label: "FNSKU 30-up" },
];

const SIZES = ["4x6in", "4x3in", "4x4in", "4x8in", "100x100mm", "100x150mm", "a4-2up", "a4-4up", "letter-2up", "letter-30up"];

const emptyAddress = () => ({ name: "", company: "", addressLines: [], city: "", state: "", pincode: "", country: "India", phone: "" });

export default function ShippingLabelForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);

  const [form, setForm] = useState({
    preset: "STANDARD_CARRIER_4X6",
    sizeKey: "4x6in",
    dpi: 203,
    thermalMode: true,
    printBorder: false,
    carrier: "",
    serviceLevel: "",
    serviceCode: "",
    trackingNumber: "",
    weightKg: "",
    dimsCm: "",
    cartonCount: 1,
    billingType: "",
    codAmount: "",
    invoiceNo: "",
    poNumber: "",
    ref1: "",
    ref2: "",
    notes: "",
    thisWayUp: false,
    fragile: false,
    keepDry: false,
    doNotStack: false,
    handleWithCare: false,
    shipFrom: emptyAddress(),
    shipTo: emptyAddress(),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    labelAPI.shipping.get(id)
      .then((res) => {
        const l = res.data.data;
        setForm((f) => ({
          ...f,
          preset: l.preset || f.preset,
          sizeKey: l.labelSize || f.sizeKey,
          dpi: l.dpi ?? f.dpi,
          thermalMode: l.thermalMode ?? f.thermalMode,
          printBorder: l.printBorder ?? f.printBorder,
          carrier: l.carrier || "",
          serviceLevel: l.serviceLevel || "",
          serviceCode: l.serviceCode || "",
          trackingNumber: l.trackingNumber || "",
          weightKg: l.packageWeightKg ? String(l.packageWeightKg) : "",
          dimsCm: l.dimsCm || "",
          cartonCount: l.cartonCount || 1,
          billingType: l.billingType || "",
          codAmount: l.codAmount || "",
          invoiceNo: l.invoiceNo || "",
          poNumber: l.poNumber || "",
          ref1: l.ref1 || "",
          ref2: l.ref2 || "",
          notes: l.notes || "",
          thisWayUp: Boolean(l.thisWayUp),
          fragile: Boolean(l.fragile),
          keepDry: Boolean(l.keepDry),
          doNotStack: Boolean(l.doNotStack),
          handleWithCare: Boolean(l.handleWithCare),
          shipFrom: l.shipFrom || emptyAddress(),
          shipTo: l.shipTo || emptyAddress(),
        }));
      })
      .catch(() => toast.error("Failed to load label"));
  }, [id, editing]);

  const previewPayload = useMemo(() => ({
    preset: form.preset, sizeKey: form.sizeKey, dpi: Number(form.dpi) || 203,
    thermalMode: form.thermalMode, printBorder: form.printBorder,
    carrier: form.carrier, serviceLevel: form.serviceLevel, serviceCode: form.serviceCode,
    trackingNumber: form.trackingNumber, weightKg: form.weightKg, dimsCm: form.dimsCm,
    cartonCount: Number(form.cartonCount) || 1, billingType: form.billingType,
    codAmount: form.codAmount, invoiceNo: form.invoiceNo, poNumber: form.poNumber,
    ref1: form.ref1, ref2: form.ref2, notes: form.notes,
    thisWayUp: form.thisWayUp, fragile: form.fragile, keepDry: form.keepDry,
    doNotStack: form.doNotStack, handleWithCare: form.handleWithCare,
    shipFrom: form.shipFrom, shipTo: form.shipTo,
  }), [form]);

  // 800ms debounce: a shorter one fired a server preview POST (and a full PDF
  // iframe re-parse) on every typing pause.
  const { pdfUrl, error } = usePdfPreview(previewPayload, labelAPI.shipping.preview, false, 800);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const payload = { ...previewPayload, sizeKey: form.sizeKey };
        await labelAPI.shipping.update(id, payload);
        toast.success("Label updated");
      } else {
        await labelAPI.shipping.create(previewPayload);
        toast.success("Label created");
      }
      navigate("/labels/shipping");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save label");
    } finally {
      setSaving(false);
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.type === "number" ? Number(e.target.value) : e.target.value })),
  });

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title={editing ? "Edit Shipping Label" : "New Shipping Label"} />
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <form onSubmit={submit} className="xl:col-span-3 space-y-4">
            <div className="rounded-xl border border-slate-200 p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="sm:col-span-1 text-[11px] font-semibold text-slate-600">Preset
                <select value={form.preset} onChange={(e) => setForm((f) => ({ ...f, preset: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white">
                  {PRESET_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-slate-600">Size
                <select value={form.sizeKey} onChange={(e) => setForm((f) => ({ ...f, sizeKey: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white">
                  {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-slate-600">DPI
                <select value={form.dpi} onChange={(e) => setForm((f) => ({ ...f, dpi: Number(e.target.value) }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white">
                  <option value={203}>203</option>
                  <option value={300}>300</option>
                </select>
              </label>
              <label className="text-[11px] font-semibold text-slate-600">Cartons
                <input type="number" min={1} max={999} {...field("cartonCount")}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              </label>
              <div className="sm:col-span-2 flex items-center gap-4 text-xs text-slate-700 pt-1">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={form.thermalMode} onChange={(e) => setForm((f) => ({ ...f, thermalMode: e.target.checked }))} /> Thermal (B/W)
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={form.printBorder} onChange={(e) => setForm((f) => ({ ...f, printBorder: e.target.checked }))} /> Print border
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <h3 className="sm:col-span-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">Shipment</h3>
              <input list="indian-carriers" placeholder="Carrier (e.g. Delhivery)" {...field("carrier")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <datalist id="indian-carriers">
                <option value="Delhivery" /><option value="Blue Dart" /><option value="DTDC" /><option value="India Post" /><option value="Ekart" /><option value="Xpressbees" /><option value="Ecom Express" /><option value="Trackon" /><option value="Rivigo" /><option value="FedEx" /><option value="DHL" /><option value="Amazon Logistics" /><option value="Aramex" />
              </datalist>
              <input placeholder="Service level" {...field("serviceLevel")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="Service code" {...field("serviceCode")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="Tracking number(s), comma-sep." {...field("trackingNumber")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="Weight (kg)" {...field("weightKg")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="Dims LxWxH (cm)" {...field("dimsCm")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="Billing type" {...field("billingType")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="COD amount (₹)" {...field("codAmount")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="Invoice no." {...field("invoiceNo")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="PO number" {...field("poNumber")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="Reference 1" {...field("ref1")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="Reference 2" {...field("ref2")} className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <textarea placeholder="Notes" rows={2} {...field("notes")} className="sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
              <div className="sm:col-span-2 flex flex-wrap items-center gap-4 text-xs text-slate-700">
                {[["thisWayUp", "This way up"], ["fragile", "Fragile"], ["keepDry", "Keep dry"], ["doNotStack", "Do not stack"], ["handleWithCare", "Handle with care"]].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))} /> {label}
                  </label>
                ))}
              </div>
            </div>

            <LabelAddressBlock title="Ship From" value={form.shipFrom} onChange={(v) => setForm((f) => ({ ...f, shipFrom: v }))} />
            <LabelAddressBlock title="Ship To" value={form.shipTo} onChange={(v) => setForm((f) => ({ ...f, shipTo: v }))} />

            <div className="flex items-center gap-3 pb-8">
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 min-h-[44px] bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-sm whitespace-nowrap disabled:opacity-50 flex-shrink-0">
                {saving ? "Saving..." : editing ? "Update Label" : "Create Label"}
              </button>
              <p className="text-[11px] text-slate-400">Verify rendered dimensions and handling marks before printing.</p>
            </div>
          </form>
          <div className="xl:col-span-2">
            <div className="sticky top-4">
              <PdfPreview pdfUrl={pdfUrl} error={error}
                fallback={<ShippingLabelPreview payload={previewPayload} />}
                onDownload={() => downloadLabelPdf(() => labelAPI.shipping.preview(previewPayload), "shipping-label.pdf")}
                onPrint={() => printLabelPdf(() => labelAPI.shipping.preview(previewPayload))} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
