import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PdfPreview from "../components/PdfPreview";
import HazmatLabelPreview from "../components/labelPreview/HazmatLabelPreview";
import usePdfPreview from "../hooks/usePdfPreview";
import PageHeader from "../components/PageHeader";
import LabelAddressBlock from "../components/LabelAddressBlock";
import { labelAPI } from "../api/auth";
import { downloadLabelPdf, printLabelPdf } from "../utils/labelPdf";
import toast from "react-hot-toast";
import { Tag, AlertTriangle, X } from "lucide-react";

const LABEL_TYPES = ["CLASS_DIAMOND", "LITHIUM", "LIMITED_QTY", "EXCEPTED_QTY", "ENV_HAZARD", "ORIENTATION", "CAO", "OVERPACK", "PLACARD"];
const SIZES = ["hazmat-4x4", "hazmat-4x6", "hazmat-100mm", "hazmat-50mm", "a4"];
const TRANSPORTS = ["ROAD", "AIR", "SEA", "RAIL"];
const COLOR_MODES = ["COLOR", "THERMAL_BW"];

// Same medium-scale form tokens as AddProduct: 40px controls, one border per
// element, violet focus language.
const inputClass =
  "w-full h-10 px-3.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200";
const selectClass = inputClass + " pr-8 cursor-pointer";
const labelClass = "block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5";

const emptyAddress = () => ({ name: "", company: "", addressLines: [], city: "", state: "", pincode: "", country: "India", phone: "" });

export default function HazmatLabelForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);

  const [form, setForm] = useState({
    labelType: "CLASS_DIAMOND",
    labelSize: "hazmat-4x4",
    colorMode: "COLOR",
    transportMode: "ROAD",
    unNumber: "",
    properShippingName: "",
    technicalName: "",
    hazardClass: "3",
    division: "",
    compatGroup: "",
    packingGroup: "",
    subsidiaryRisks: "",
    netQuantity: "",
    packageCount: 1,
    consignor: emptyAddress(),
    consignee: emptyAddress(),
    emergencyPhone: "",
    ergGuide: "",
    lithiumWh: "",
    notes: "",
    overpack: false,
    marinePollutant: false,
    radiationCategory: "",
    limitedQuantityCode: "",
    lithiumUnList: "",
    lithiumPackingInstruction: "",
  });
  const [unOptions, setUnOptions] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [unOpen, setUnOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    labelAPI.hazmat.classes().then((r) => setClassOptions(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    labelAPI.hazmat.get(id)
      .then((res) => {
        const l = res.data.data;
        setForm((f) => ({
          ...f,
          labelType: l.labelType || f.labelType,
          labelSize: l.labelSize || f.labelSize,
          colorMode: l.colorMode || f.colorMode,
          transportMode: l.transportMode || f.transportMode,
          unNumber: l.unNumber || "",
          properShippingName: l.properShippingName || "",
          technicalName: l.technicalName || "",
          hazardClass: l.hazardClass || f.hazardClass,
          division: l.division || "",
          compatGroup: l.compatGroup || "",
          packingGroup: l.packingGroup || "",
          subsidiaryRisks: l.subsidiaryRisks || "",
          netQuantity: l.netQuantity || "",
          packageCount: l.packageCount || 1,
          consignor: l.consignor || emptyAddress(),
          consignee: l.consignee || emptyAddress(),
          emergencyPhone: l.emergencyPhone || "",
          ergGuide: l.ergGuide || "",
          lithiumWh: l.lithiumWh ? String(l.lithiumWh) : "",
          notes: l.notes || "",
          overpack: Boolean(l.overpack),
          marinePollutant: Boolean(l.marinePollutant),
          radiationCategory: l.radiationCategory || "",
          limitedQuantityCode: l.limitedQuantityCode || "",
          lithiumUnList: l.lithiumUnList || "",
          lithiumPackingInstruction: l.lithiumPackingInstruction || "",
        }));
      })
      .catch(() => toast.error("Failed to load label"));
  }, [id, editing]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!form.unNumber || form.unNumber.length < 2) {
        setUnOptions([]);
        return;
      }
      labelAPI.hazmat.unNumbers(form.unNumber)
        .then((r) => setUnOptions(r.data.data || []))
        .catch(() => setUnOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [form.unNumber]);

  const previewPayload = useMemo(() => ({
    ...form,
    packageCount: Number(form.packageCount) || 1,
    lithiumWh: form.lithiumWh === "" ? null : Number(form.lithiumWh),
  }), [form]);

  const pickUn = (r) => {
    setForm((f) => ({
      ...f,
      unNumber: r.unNumber,
      properShippingName: r.properShippingName || f.properShippingName,
      hazardClass: r.hazardClass || f.hazardClass,
      division: r.division || f.division,
      compatGroup: r.compatGroup || f.compatGroup,
      packingGroup: r.packingGroup || f.packingGroup,
      subsidiaryRisks: r.subsidiaryRisks || f.subsidiaryRisks,
      ergGuide: r.ergGuide || f.ergGuide,
    }));
    setUnOpen(false);
  };

  const { pdfUrl, error } = usePdfPreview(previewPayload, labelAPI.hazmat.preview, !form.properShippingName.trim(), 800);

  // Footer text shown below the label with padding
  const footerText = "Generated by insideinvoice.com \u2022 \u2022 2026";

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, packageCount: Number(form.packageCount) || 1, lithiumWh: form.lithiumWh === "" ? null : Number(form.lithiumWh) };
      if (editing) {
        await labelAPI.hazmat.update(id, payload);
        toast.success("Label updated");
      } else {
        await labelAPI.hazmat.create(payload);
        toast.success("Label created");
      }
      navigate("/labels/hazmat");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save label");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-slate-50 to-violet-50/40">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title={editing ? "Edit Hazmat Label" : "New Hazmat Label"} />
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <form onSubmit={submit} className="xl:col-span-3 space-y-4">
            {/* Label section — same card + inline-icon header as AddProduct */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-violet-600 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">Label</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Format, size and transport mode</p>
                </div>
              </div>
              <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hz-type" className={labelClass}>Type</label>
                  <select id="hz-type" value={form.labelType} onChange={(e) => setForm((f) => ({ ...f, labelType: e.target.value }))}
                    className={selectClass}>
                    {LABEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="hz-size" className={labelClass}>Size</label>
                  <select id="hz-size" value={form.labelSize} onChange={(e) => setForm((f) => ({ ...f, labelSize: e.target.value }))}
                    className={selectClass}>
                    {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="hz-transport" className={labelClass}>Transport</label>
                  <select id="hz-transport" value={form.transportMode} onChange={(e) => setForm((f) => ({ ...f, transportMode: e.target.value }))}
                    className={selectClass}>
                    {TRANSPORTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="hz-color" className={labelClass}>Color mode</label>
                  <select id="hz-color" value={form.colorMode} onChange={(e) => setForm((f) => ({ ...f, colorMode: e.target.value }))}
                    className={selectClass}>
                    {COLOR_MODES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Dangerous Goods section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-violet-600 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">Dangerous Goods</h2>
                  <p className="text-xs text-slate-500 mt-0.5">UN classification and handling details</p>
                </div>
              </div>
              <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <input aria-label="UN number" placeholder="UN number (e.g. UN1993)" value={form.unNumber}
                    onChange={(e) => { setForm((f) => ({ ...f, unNumber: e.target.value })); setUnOpen(true); }}
                    className={inputClass} />
                  {unOpen && unOptions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg text-xs">
                      {unOptions.map((r) => (
                        <li key={r.unNumber} onClick={() => pickUn(r)} className="px-3 py-2 hover:bg-violet-50 cursor-pointer">
                          <span className="font-semibold">{r.unNumber}</span> — {r.properShippingName} ({r.hazardClass})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <input aria-label="Proper shipping name" placeholder="Proper shipping name" value={form.properShippingName}
                  onChange={(e) => setForm((f) => ({ ...f, properShippingName: e.target.value }))}
                  className={inputClass} required />
                <input aria-label="Technical name (N.O.S.)" placeholder="Technical name (N.O.S.)" value={form.technicalName}
                  onChange={(e) => setForm((f) => ({ ...f, technicalName: e.target.value }))}
                  className={inputClass} />
                <div>
                  <label htmlFor="hz-class" className={labelClass}>Hazard class</label>
                  <select id="hz-class" value={form.hazardClass} onChange={(e) => setForm((f) => ({ ...f, hazardClass: e.target.value }))}
                    className={selectClass}>
                    {classOptions.length === 0 && <option value={form.hazardClass}>{form.hazardClass}</option>}
                    {classOptions.map((c) => <option key={c.key} value={c.key}>{c.key} — {c.className}</option>)}
                  </select>
                </div>
                <input aria-label="Division" placeholder="Division" value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Packing group" placeholder="Packing group" value={form.packingGroup} onChange={(e) => setForm((f) => ({ ...f, packingGroup: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Subsidiary risks" placeholder="Subsidiary risks" value={form.subsidiaryRisks} onChange={(e) => setForm((f) => ({ ...f, subsidiaryRisks: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Net quantity" placeholder="Net quantity" value={form.netQuantity} onChange={(e) => setForm((f) => ({ ...f, netQuantity: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Package count" type="number" min={1} placeholder="Package count" value={form.packageCount}
                  onChange={(e) => setForm((f) => ({ ...f, packageCount: e.target.value }))}
                  className={inputClass + " tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"} />
                <input aria-label="ERG guide" placeholder="ERG guide e.g. 128" value={form.ergGuide} onChange={(e) => setForm((f) => ({ ...f, ergGuide: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Emergency phone" type="tel" placeholder="+91 emergency phone" value={form.emergencyPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Compatibility group" placeholder="Compat. group" value={form.compatGroup} onChange={(e) => setForm((f) => ({ ...f, compatGroup: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Lithium watt-hours" inputMode="decimal" placeholder="Lithium Wh" value={form.lithiumWh} onChange={(e) => setForm((f) => ({ ...f, lithiumWh: e.target.value }))}
                  className={inputClass + " tabular-nums"} />
                <input aria-label="Radiation category" placeholder="Radiation category" value={form.radiationCategory} onChange={(e) => setForm((f) => ({ ...f, radiationCategory: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Limited quantity code" placeholder="Limited qty code" value={form.limitedQuantityCode} onChange={(e) => setForm((f) => ({ ...f, limitedQuantityCode: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Lithium UN list" placeholder="Lithium UN list" value={form.lithiumUnList} onChange={(e) => setForm((f) => ({ ...f, lithiumUnList: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Packing instruction" placeholder="Packing instruction" value={form.lithiumPackingInstruction} onChange={(e) => setForm((f) => ({ ...f, lithiumPackingInstruction: e.target.value }))}
                  className={inputClass} />
                <textarea aria-label="Notes" placeholder="Notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="sm:col-span-2 w-full min-h-[68px] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200 resize-none" />
                <div className="sm:col-span-2 flex items-center gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.overpack} onChange={(e) => setForm((f) => ({ ...f, overpack: e.target.checked }))} className="w-4 h-4 accent-violet-600" /> Overpack
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.marinePollutant} onChange={(e) => setForm((f) => ({ ...f, marinePollutant: e.target.checked }))} className="w-4 h-4 accent-violet-600" /> Marine pollutant
                  </label>
                </div>
              </div>
            </div>

            <LabelAddressBlock title="Consignor" value={form.consignor} onChange={(v) => setForm((f) => ({ ...f, consignor: v }))} />
            <LabelAddressBlock title="Consignee" value={form.consignee} onChange={(v) => setForm((f) => ({ ...f, consignee: v }))} />

            {/* Form Footer — flat, same rhythm as AddProduct */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-4">
              <p className="text-[11px] text-slate-400 sm:order-1">UN data shown is reference info. Verify shipping requirements with your carrier.</p>
              <div className="flex items-center gap-2.5 sm:order-2 sm:ml-auto">
                <button type="button" onClick={() => navigate("/labels/hazmat")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-700 rounded-lg transition-all duration-150 whitespace-nowrap">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[40px] text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-150 whitespace-nowrap">
                  {saving ? "Saving..." : editing ? "Update Label" : "Create Label"}
                </button>
              </div>
            </div>
          </form>
          <div className="xl:col-span-2">
            <div className="sticky top-4">
              <PdfPreview pdfUrl={pdfUrl} error={error}
                fallback={<HazmatLabelPreview payload={previewPayload} />}
                onDownload={() => downloadLabelPdf(() => labelAPI.hazmat.preview(previewPayload), "hazmat-label.pdf")}
                onPrint={() => printLabelPdf(() => labelAPI.hazmat.preview(previewPayload))} />
              {pdfUrl && !error && (
                <div className="mt-4 p-3 border-t border-slate-200 text-xs text-slate-500">
                  {footerText}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
