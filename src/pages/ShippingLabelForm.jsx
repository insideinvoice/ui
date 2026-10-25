import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

// Label sizes in both unit systems — carriers worldwide quote inches, the rest
// of the world quotes millimetres, so every option shows both.
const SIZES = [
  ["4x6in", "4 × 6 in — 101.6 × 152.4 mm"],
  ["4x3in", "4 × 3 in — 101.6 × 76.2 mm"],
  ["4x4in", "4 × 4 in — 101.6 × 101.6 mm"],
  ["4x8in", "4 × 8 in — 101.6 × 203.2 mm"],
  ["100x100mm", "100 × 100 mm"],
  ["100x150mm", "100 × 150 mm"],
  ["a4-2up", "A4 sheet — 2-up"],
  ["a4-4up", "A4 sheet — 4-up"],
  ["letter-2up", "US Letter — 2-up"],
  ["letter-30up", "US Letter — 30-up (Avery 5167)"],
];

const BILLING_OPTIONS = [
  ["", "Not specified"],
  ["PREPAID", "Prepaid"],
  ["COD", "Cash on delivery (COD)"],
  ["THIRD_PARTY", "Third-party billing"],
];

// Global carrier set: worldwide express, national posts and the big regional
// players — anyone creating a label, anywhere, gets a sensible suggestion.
const CARRIERS = [
  "DHL", "DHL Express", "FedEx", "UPS", "USPS", "Royal Mail", "Canada Post",
  "Australia Post", "New Zealand Post", "Deutsche Post", "La Poste", "Correos",
  "Poste Italiane", "Japan Post", "China Post", "SF Express", "Yamato Transport",
  "Sagawa Express", "J&T Express", "Ninja Xpress", "Aramex", "Emirates Post",
  "Qatar Post", "Saudi Post SPL", "Israel Post", "SingPost", "Pos Malaysia",
  "Thailand Post", "Vietnam Post", "Pos Indonesia", "Korea Post", "India Post",
  "Delhivery", "Blue Dart", "DTDC", "Ekart", "Xpressbees", "Ecom Express",
  "Amazon Logistics",
];

// Address without a forced country: the shipper picks the destination, this
// form never assumes one.
const emptyAddress = () => ({ name: "", company: "", addressLines: [], city: "", state: "", pincode: "", country: "", phone: "" });

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

  const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15";
  const labelCls = "text-[11px] font-semibold text-slate-600";
  const gridCls = "rounded-xl border border-slate-200 p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2.5";
  const headingCls = "sm:col-span-2 text-xs font-semibold text-slate-700 uppercase tracking-wider";

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title={editing ? "Edit Shipping Label" : "New Shipping Label"} />
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <form onSubmit={submit} className="xl:col-span-3 space-y-4">
            {/* ---------------------------------------------------- format */}
            <div className={gridCls}>
              <h3 className={headingCls}>Format &amp; print</h3>
              <label className={labelCls}>Preset
                <select value={form.preset} onChange={(e) => setForm((f) => ({ ...f, preset: e.target.value }))}
                  className={"mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white cursor-pointer"}>
                  {PRESET_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label className={labelCls}>Size
                <select value={form.sizeKey} onChange={(e) => setForm((f) => ({ ...f, sizeKey: e.target.value }))}
                  className={"mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white cursor-pointer"}>
                  {SIZES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label className={labelCls}>Resolution
                <select value={form.dpi} onChange={(e) => setForm((f) => ({ ...f, dpi: Number(e.target.value) }))}
                  className={"mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white cursor-pointer"}>
                  <option value={203}>203 dpi (thermal)</option>
                  <option value={300}>300 dpi (thermal / laser)</option>
                </select>
              </label>
              <label className={labelCls}>Cartons
                <input type="number" min={1} max={999} {...field("cartonCount")}
                  className={inputCls} />
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

            {/* ------------------------------------------- carrier & service */}
            <div className={gridCls}>
              <h3 className={headingCls}>Carrier &amp; service</h3>
              <label className={labelCls}>Carrier
                <input list="carriers" placeholder="e.g. DHL, FedEx, UPS, USPS…" {...field("carrier")}
                  className={inputCls} />
                <datalist id="carriers">
                  {CARRIERS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>
              <label className={labelCls}>Service level
                <input placeholder="e.g. Ground, Express, Overnight" {...field("serviceLevel")} className={inputCls} />
              </label>
              <label className={labelCls}>Service code
                <input placeholder="e.g. PMD, EXP, 2D" {...field("serviceCode")} className={inputCls} />
              </label>
              <label className={labelCls}>Tracking number(s)
                <input placeholder="Comma-separated for multiple cartons" {...field("trackingNumber")} className={inputCls} />
              </label>
              <label className={labelCls}>Weight (kg)
                <input placeholder="e.g. 2.5" {...field("weightKg")} className={inputCls} />
              </label>
              <label className={labelCls}>Dimensions L×W×H (cm)
                <input placeholder="e.g. 40x30x20" {...field("dimsCm")} className={inputCls} />
              </label>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-4 text-xs text-slate-700 pt-1">
                {[["thisWayUp", "This way up"], ["fragile", "Fragile"], ["keepDry", "Keep dry"], ["doNotStack", "Do not stack"], ["handleWithCare", "Handle with care"]].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))} /> {label}
                  </label>
                ))}
              </div>
            </div>

            {/* ---------------------------------------- billing & references */}
            <div className={gridCls}>
              <h3 className={headingCls}>Billing &amp; references</h3>
              <label className={labelCls}>Billing
                <select value={form.billingType} onChange={(e) => setForm((f) => ({ ...f, billingType: e.target.value }))}
                  className={"mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white cursor-pointer"}>
                  {BILLING_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className={labelCls}>COD amount
                <input placeholder="Amount in your billing currency" {...field("codAmount")} className={inputCls} />
              </label>
              <label className={labelCls}>Invoice no.
                <input placeholder="e.g. INV-2026-0042" {...field("invoiceNo")} className={inputCls} />
              </label>
              <label className={labelCls}>PO number
                <input placeholder="Purchase order reference" {...field("poNumber")} className={inputCls} />
              </label>
              <label className={labelCls}>Reference 1
                <input placeholder="ASN, order no., etc." {...field("ref1")} className={inputCls} />
              </label>
              <label className={labelCls}>Reference 2
                <input placeholder="Secondary reference" {...field("ref2")} className={inputCls} />
              </label>
              <textarea placeholder="Notes printed on the label" rows={2} {...field("notes")}
                className="sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15" />
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
