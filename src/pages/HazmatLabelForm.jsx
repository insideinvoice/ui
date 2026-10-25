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
import { Tag, AlertTriangle, X, Package, Phone } from "lucide-react";
import { dialCodeFor } from "../utils/countries";

// [value, display label] — raw enum keys never reach the screen.
const LABEL_TYPES = [
  ["CLASS_DIAMOND", "Class diamond"],
  ["LITHIUM", "Lithium battery mark"],
  ["LIMITED_QTY", "Limited quantity"],
  ["EXCEPTED_QTY", "Excepted quantity"],
  ["ENV_HAZARD", "Environmentally hazardous"],
  ["ORIENTATION", "Orientation arrows"],
  ["CAO", "Cargo aircraft only"],
  ["OVERPACK", "Overpack"],
  ["PLACARD", "Placard (A4 sheet)"],
];
const SIZES = [
  ["hazmat-4x4", "4 × 4 in · 100 × 100 mm"],
  ["hazmat-4x6", "4 × 6 in · 100 × 150 mm"],
  ["hazmat-100mm", "100 × 100 mm square"],
  ["hazmat-50mm", "50 × 50 mm square"],
  ["a4", "A4 sheet · 210 × 297 mm"],
];
const TRANSPORTS = [
  ["ROAD", "Road"],
  ["AIR", "Air"],
  ["SEA", "Sea"],
  ["RAIL", "Rail"],
];
const COLOR_MODES = [
  ["COLOR", "Full colour"],
  ["THERMAL_BW", "Thermal (black & white)"],
];

// Widely shipped UN entries — one click pulls the full classification
// (class, packing group, ERG guide, subsidiary risks, limited-qty code)
// from the backend's UN reference table.
const UN_PRESETS = [
  ["UN3480", "Lithium-ion batteries"],
  ["UN3481", "Li-ion with equipment"],
  ["UN1993", "Flammable liquid"],
  ["UN1263", "Paint related material"],
  ["UN1090", "Acetone"],
  ["UN3082", "Environmentally hazardous"],
];

// The regulation that governs each transport mode — shown under the selector
// so shippers know which code the label is being produced for.
const REGULATIONS = {
  ROAD: "ADR — international road carriage of dangerous goods",
  RAIL: "RID — international rail carriage of dangerous goods",
  SEA: "IMDG Code — international maritime dangerous goods",
  AIR: "IATA DGR / ICAO TI — air cargo dangerous goods",
};

// Same medium-scale form tokens as AddProduct: 40px controls, one border per
// element, violet focus language.
const inputClass =
  "w-full h-10 px-3.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200";
const selectClass = inputClass + " pr-8 cursor-pointer";
const labelClass = "block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5";

const emptyAddress = () => ({ name: "", company: "", addressLines: [], city: "", state: "", pincode: "", country: "", phone: "" });

export default function HazmatLabelForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);

  const [form, setForm] = useState({
    labelNumber: "", // saved label's real number (empty for a new label)
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
    graCode: "",
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
          labelNumber: l.labelNumber || "",
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
          graCode: l.graCode || "",
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
      // The reference row carries the limited-quantity code (e.g. Y for air)
      // — pre-fill it so the LQ mark matches the UN entry.
      limitedQuantityCode: r.ltdQty || f.limitedQuantityCode,
    }));
    setUnOpen(false);
  };

  // Quick-start chips: load a UN entry's full classification from the table.
  const applyPreset = async (un) => {
    try {
      const res = await labelAPI.hazmat.unNumbers(un);
      const rows = res.data.data || [];
      const hit = rows.find((r) => r.unNumber === un) || rows[0];
      if (!hit) {
        toast.error(`${un} is not in the UN reference table`);
        return;
      }
      pickUn(hit);
      toast.success(`${un} loaded — ${hit.properShippingName}`);
    } catch {
      toast.error("Could not load UN reference data");
    }
  };

  const { pdfUrl, error } = usePdfPreview(previewPayload, labelAPI.hazmat.preview, !form.properShippingName.trim(), 800);

  // Caption below the rendered PDF — same line the label itself prints.
  const footerText = `Generated by insideinvoice.com \u00b7 \u00a9 ${new Date().getFullYear()}`;
  const emergencyDial = dialCodeFor(form.consignor?.country);

  // Spec strip under the preview: what is currently being rendered.
  const specChips = [
    form.labelNumber ? `#${form.labelNumber}` : null,
    LABEL_TYPES.find(([v]) => v === form.labelType)?.[1],
    SIZES.find(([v]) => v === form.labelSize)?.[1],
    TRANSPORTS.find(([v]) => v === form.transportMode)?.[1],
    COLOR_MODES.find(([v]) => v === form.colorMode)?.[1],
  ].filter(Boolean);

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
                    {LABEL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="hz-size" className={labelClass}>Size</label>
                  <select id="hz-size" value={form.labelSize} onChange={(e) => setForm((f) => ({ ...f, labelSize: e.target.value }))}
                    className={selectClass}>
                    {SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="hz-transport" className={labelClass}>Transport</label>
                  <select id="hz-transport" value={form.transportMode} onChange={(e) => setForm((f) => ({ ...f, transportMode: e.target.value }))}
                    className={selectClass}>
                    {TRANSPORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{REGULATIONS[form.transportMode]}</p>
                </div>
                <div>
                  <label htmlFor="hz-color" className={labelClass}>Color mode</label>
                  <select id="hz-color" value={form.colorMode} onChange={(e) => setForm((f) => ({ ...f, colorMode: e.target.value }))}
                    className={selectClass}>
                    {COLOR_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Classification — UN reference data */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-violet-600 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">Classification</h2>
                  <p className="text-xs text-slate-500 mt-0.5">UN number, proper shipping name and hazard class</p>
                </div>
              </div>
              <div className="px-5 sm:px-6 pb-5 space-y-4">
                <div>
                  <span className={labelClass}>Quick start</span>
                  <div className="flex flex-wrap gap-2">
                    {UN_PRESETS.map(([un, name]) => (
                      <button key={un} type="button" onClick={() => applyPreset(un)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all">
                        <span className="font-semibold">{un}</span>
                        <span className="text-slate-300">·</span>
                        <span>{name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">Loads class, packing group, ERG guide and limited-quantity code from the UN numbered list.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <input aria-label="UN number" placeholder="UN number (e.g. UN1993)" value={form.unNumber}
                      onChange={(e) => { setForm((f) => ({ ...f, unNumber: e.target.value })); setUnOpen(true); }}
                      className={inputClass} />
                    {unOpen && unOptions.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg text-xs divide-y divide-slate-100">
                        {unOptions.map((r) => (
                          <li key={r.unNumber} onClick={() => pickUn(r)} className="px-3 py-2 hover:bg-violet-50 cursor-pointer">
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-slate-900">{r.unNumber}</span>
                              <span className="text-slate-500 truncate">{r.properShippingName}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Class {r.hazardClass}</span>
                              {r.division && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Div {r.division}</span>}
                              {r.packingGroup && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">PG {r.packingGroup}</span>}
                              {r.ergGuide && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">ERG {r.ergGuide}</span>}
                              {r.ltdQty && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">LQ {r.ltdQty}</span>}
                              {r.paxAllowed && r.caoAllowed && (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">PAX + cargo</span>
                              )}
                              {r.paxAllowed === false && (
                                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">Cargo aircraft only</span>
                              )}
                              {r.caoAllowed === false && (
                                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">Passenger aircraft only</span>
                              )}
                              {r.specialProvisions && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">SP {r.specialProvisions}</span>
                              )}
                            </div>
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
                  <input aria-label="Division" placeholder="Division (e.g. 1.4)" value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))}
                    className={inputClass} />
                  <input aria-label="Compatibility group" placeholder="Compat. group (e.g. S)" value={form.compatGroup} onChange={(e) => setForm((f) => ({ ...f, compatGroup: e.target.value }))}
                    className={inputClass} />
                  <input aria-label="Packing group" placeholder="Packing group (I / II / III)" value={form.packingGroup} onChange={(e) => setForm((f) => ({ ...f, packingGroup: e.target.value }))}
                    className={inputClass} />
                  <input aria-label="Subsidiary risks" placeholder="Subsidiary risks (e.g. 6.1)" value={form.subsidiaryRisks} onChange={(e) => setForm((f) => ({ ...f, subsidiaryRisks: e.target.value }))}
                    className={inputClass} />
                </div>
              </div>
            </div>

            {/* Quantities & marks */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5">
                <Package className="w-4 h-4 text-violet-600 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">Quantities &amp; marks</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Amounts, packages and the marks that go on the label</p>
                </div>
              </div>
              <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input aria-label="Net quantity" placeholder="Net quantity (e.g. 5 L, 12 kg)" value={form.netQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, netQuantity: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Package count" type="number" min={1} placeholder="Package count" value={form.packageCount}
                  onChange={(e) => setForm((f) => ({ ...f, packageCount: e.target.value }))}
                  className={inputClass + " tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"} />
                <input aria-label="Limited quantity code" placeholder="Limited qty code (e.g. Y)" value={form.limitedQuantityCode}
                  onChange={(e) => setForm((f) => ({ ...f, limitedQuantityCode: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Radiation category" placeholder="Radiation category (I / II / III)" value={form.radiationCategory}
                  onChange={(e) => setForm((f) => ({ ...f, radiationCategory: e.target.value }))}
                  className={inputClass} />
                <div className="sm:col-span-2 flex items-center gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.overpack} onChange={(e) => setForm((f) => ({ ...f, overpack: e.target.checked }))} className="w-4 h-4 accent-violet-600" /> Overpack
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.marinePollutant} onChange={(e) => setForm((f) => ({ ...f, marinePollutant: e.target.checked }))} className="w-4 h-4 accent-violet-600" /> Marine pollutant
                  </label>
                </div>
                <textarea aria-label="Notes" placeholder="Notes printed on the label" rows={2} value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="sm:col-span-2 w-full min-h-[68px] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200 resize-none" />
              </div>
            </div>

            {/* Emergency response & contacts */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-violet-600 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">Emergency response</h2>
                  <p className="text-xs text-slate-500 mt-0.5">24-hour contact, ERG reference and lithium details</p>
                </div>
              </div>
              <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <input aria-label="Emergency phone" type="tel"
                    placeholder={emergencyDial ? `${emergencyDial} emergency phone` : "24-hour emergency phone (with country code)"}
                    value={form.emergencyPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                    className={inputClass} />
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-400">Printed as “24-HOUR EMERGENCY: …” — include the country code so crews anywhere can call.</p>
                </div>
                <div>
                  <input aria-label="ERG guide" placeholder="ERG guide (e.g. 128)" value={form.ergGuide}
                    onChange={(e) => setForm((f) => ({ ...f, ergGuide: e.target.value }))}
                    className={inputClass} />
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-400">Emergency Response Guidebook number from the ERG.</p>
                </div>
                <input aria-label="Global Response Access Code" placeholder="GRA code (Global Response Access)" value={form.graCode}
                  onChange={(e) => setForm((f) => ({ ...f, graCode: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Lithium watt-hours" inputMode="decimal" placeholder="Lithium watt-hours (Wh)" value={form.lithiumWh}
                  onChange={(e) => setForm((f) => ({ ...f, lithiumWh: e.target.value }))}
                  className={inputClass + " tabular-nums"} />
                <input aria-label="Lithium UN list" placeholder="Lithium UN list (e.g. UN3480 / UN3481)" value={form.lithiumUnList}
                  onChange={(e) => setForm((f) => ({ ...f, lithiumUnList: e.target.value }))}
                  className={inputClass} />
                <input aria-label="Packing instruction" placeholder="Packing instruction (e.g. PI 965 IB)" value={form.lithiumPackingInstruction}
                  onChange={(e) => setForm((f) => ({ ...f, lithiumPackingInstruction: e.target.value }))}
                  className={inputClass} />
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
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap gap-1.5">
                  {specChips.map((c) => (
                    <span key={c}
                      className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                      {c}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] leading-snug text-slate-400">{REGULATIONS[form.transportMode]}</p>
                <p className="mt-2 text-[11px] text-slate-400">{footerText}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
