import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useLocation } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import Spinner from "../components/Spinner";
import PageHeader from "../components/PageHeader";
import { invoiceAPI, customerAPI, businessAPI, productAPI, deliveryChallanAPI, waitForInvoiceEmail } from "../api/auth";
import toast from "react-hot-toast";
import {
  ArrowLeft, Plus, Trash2, Zap, FileText, Download,
  User, Building2, Phone, MapPin, Hash,
  Package, FileSpreadsheet, Share2, Info, X, ChevronDown, Truck,
  Link2, Copy, Mail, RotateCw, Unlink
} from "lucide-react";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import { renderDeliveryChallanPdf } from "../components/DeliveryChallanDownload";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { processQueue } from "../utils/retryQueue";
import { processPrint } from "../utils/printInvoice";
import { buildInvoiceWhatsAppMessage, openWhatsAppChat, createInvoicePdfFile } from "../utils/whatsapp";
import { getPrintSettings, getInvoiceTemplate } from "../constants/paperSizes";
import { computeInvoiceTotals, round2 } from "../utils/invoiceTotals";
import { determineTaxMode, validateTaxMode } from "../utils/taxMode";
import { formatInvoiceNumber } from "../utils/invoiceConvention";
import { INDIAN_STATES, DELIVERY_TERMS, PAYMENT_TERMS } from "../constants/indianStates";
import { UNITS } from "../constants/units";
import {
  getIndustryConfig, isFieldHidden, fieldLabel, fieldPlaceholder, REFERENCES_SECTION_FIELDS,
  getExtendedFields, isExtendedFieldType, ALL_EXTENDED_FIELDS,
} from "../constants/industryConfig";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
const emptyItem = { itemName: "", hsn: "", unit: "Unit", qty: "", rate: "", gstPercentage: "18", taxableValue: 0, taxAmount: 0, total: 0 };
const inputClass = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white transition-all min-h-[44px]";
const selectClass = "w-full pl-3 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white transition-all min-h-[44px] appearance-none cursor-pointer text-slate-800 font-normal";
const labelClass = "block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase";
// Safety-net labels if an industry profile ever misses one of the V29 fields.
const EXTENDED_FALLBACK_LABELS = {
  agreementNumber: "Rental Agreement No.",
  assetNumber: "Asset / Equipment ID",
  serialNumber: "Serial Number",
  vehicleNumber: "Vehicle Reg. No.",
  periodStart: "Rental Period Start",
  periodEnd: "Rental Period End",
  billingPeriodStart: "Billing Period Start",
  billingPeriodEnd: "Billing Period End",
  expectedReturnDate: "Expected Return Date",
  depositReference: "Deposit Reference",
  patientReference: "Patient / Customer ID",
  serviceDate: "Service Date",
  treatmentReference: "Treatment / Session Ref.",
  referringDoctor: "Referring Doctor",
};

const FOCUS_ORDER = ["phone", "name", "email", "gstIn", "billingAddress", "invoiceDate", "dueDate", "placeOfSupply", "destination", "paymentTerms", "paymentMode", "deliveryNote", "deliveryNoteDate", "referenceNumber", "buyerOrderNumber", "dispatchDocNumber", "dispatchedThrough", "termsOfDelivery", "otherReferences", "notes"];

const focusNext = (currentName) => {
  const i = FOCUS_ORDER.indexOf(currentName);
  if (i === -1 || i === FOCUS_ORDER.length - 1) return;
  // Fields hidden by the industry profile are not rendered, so skip over them.
  for (let j = i + 1; j < FOCUS_ORDER.length; j++) {
    const next = document.querySelector(`[name="${FOCUS_ORDER[j]}"], select[name="${FOCUS_ORDER[j]}"]`);
    if (next) {
      next.focus();
      return;
    }
  }
};

const FOCUS_FIELDS = ["hsn", "desc", "qty", "rate", "gst"];
// When the business hides HSN/SAC, the field is not rendered, so the Enter
// chain skips it entirely (same rule as the invoice-header focus order).
const focusFieldsFor = (showHnSac) => (showHnSac ? FOCUS_FIELDS : FOCUS_FIELDS.filter((f) => f !== "hsn"));

const ItemRow = memo(({ item, calc, idx, onItemChange, onRemove, onAdd, onHsnLookup, showHnSac = true, locked = false }) => {
  const focusFields = focusFieldsFor(showHnSac);
  const handleKeyDown = (e, field) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onAdd();
      setTimeout(() => {
        const next = document.querySelector(`input[name="${focusFields[0]}-${idx + 2}"]`) || document.querySelector(`input[name="${focusFields[0]}-1"]`);
        next?.focus();
      }, 50);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const fieldIndex = focusFields.indexOf(field);
      if (fieldIndex === focusFields.length - 1) {
        onAdd();
        setTimeout(() => {
          const next = document.querySelector(`input[name="${focusFields[0]}-${idx + 2}"]`);
          next?.focus();
        }, 50);
      } else {
        const nextField = focusFields[fieldIndex + 1];
        const next = document.querySelector(`input[name="${nextField}-${idx + 1}"]`);
        next?.focus();
      }
    }
  };

  return (
  <tr className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/20 transition-colors`}>
    <td className="py-3 px-2 text-center text-slate-400 font-mono text-xs border-b border-slate-100 whitespace-nowrap w-[36px] min-w-[36px]">{idx + 1}</td>
    {showHnSac && (
    <td className="py-3 px-2 border-b border-slate-100">
      <input type="text" value={item.hsn} name={`hsn-${idx + 1}`}
        onChange={(e) => { delete e.target.dataset.enterPressed; onItemChange(idx, "hsn", e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) {
            e.target.dataset.enterPressed = "true";
            onHsnLookup(idx, e.target.value);
          }
          handleKeyDown(e, "hsn");
        }}
        onBlur={(e) => { if (e.target.value && !e.target.dataset.enterPressed) onHsnLookup(idx, e.target.value); delete e.target.dataset.enterPressed; }}
        className="w-full min-w-[100px] px-2.5 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono"
        placeholder="Scan or type" />
    </td>
    )}
    <td className="py-3 px-2 border-b border-slate-100">
      <input type="text" value={item.itemName} name={`desc-${idx + 1}`}
        onChange={(e) => onItemChange(idx, "itemName", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "desc")}
        readOnly={locked}
        className={`w-full min-w-[160px] px-2.5 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white ${locked ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""}`}
        placeholder="Item name" />
    </td>
    <td className="py-3 px-2 border-b border-slate-100">
      <div className="flex items-center gap-1.5 w-full min-w-[140px]">
        <input type="number" step="1" min="0" value={item.qty} name={`qty-${idx + 1}`}
          onChange={(e) => onItemChange(idx, "qty", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "qty")}
          inputMode="decimal"
          placeholder="Qty"
          className="flex-[7] min-w-[50px] w-0 px-2 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        <select value={item.unit ?? "Unit"} name={`unit-${idx + 1}`}
          onChange={(e) => onItemChange(idx, "unit", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "unit")}
          title="Unit of measurement"
          className="flex-[10] min-w-[75px] w-0 px-1 py-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white text-slate-600">
          {UNITS.map((u) => (
            <option key={u} value={u}>{u === "" ? "No unit" : u}</option>
          ))}
        </select>
      </div>
    </td>
    <td className="py-3 px-2 border-b border-slate-100">
      <input type="number" step="0.01" min="0" value={item.rate} name={`rate-${idx + 1}`}
        onChange={(e) => onItemChange(idx, "rate", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "rate")}
        readOnly={locked}
        placeholder="0.00"
        className="w-full min-w-[85px] px-2.5 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
    </td>
    <td className="py-3 px-1 border-b border-slate-100 text-center">
      <div className="relative w-[56px] min-w-[56px] mx-auto">
        <input type="number" step="0.01" min="0" max="40" value={item.gstPercentage} name={`gst-${idx + 1}`}
          onChange={(e) => onItemChange(idx, "gstPercentage", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "gst")}
          className="w-full min-w-0 px-1.5 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono pr-4 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">%</span>
      </div>
    </td>
    <td className="py-3 px-3 text-right font-mono text-sm text-slate-700 border-b border-slate-100 whitespace-nowrap tabular-nums min-w-[160px]">
      {((calc?.taxable ?? parseFloat(item.taxableValue)) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
    </td>
    <td className="py-3 px-3 text-right font-mono text-sm text-slate-600 border-b border-slate-100 whitespace-nowrap tabular-nums min-w-[145px]">
      {((calc?.tax ?? parseFloat(item.taxAmount)) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
    </td>
    <td className="py-3 px-3 text-right font-mono text-sm font-semibold text-slate-900 border-b border-slate-100 whitespace-nowrap tabular-nums min-w-[170px]">
      {((calc?.total ?? parseFloat(item.total)) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
    </td>
    <td className="py-3 px-1 text-center border-b border-slate-100 w-[45px] min-w-[45px]">
      <button onClick={() => onRemove(idx)}
        className="p-1.5 hover:bg-red-50 rounded transition-colors text-slate-400 hover:text-red-500"
        title="Delete item">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </td>
  </tr>
  );
});

const ItemCard = memo(({ item, calc, idx, onItemChange, onRemove, onAdd, onHsnLookup, descLabel = "Description", showHnSac = true, locked = false }) => {
  const focusFields = focusFieldsFor(showHnSac);
  const handleKeyDown = (e, field) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onAdd();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const fieldIndex = focusFields.indexOf(field);
      if (fieldIndex === focusFields.length - 1) {
        onAdd();
      } else {
        const nextField = focusFields[fieldIndex + 1];
        const next = document.querySelector(`[data-mobile-field="${nextField}-${idx}"]`);
        next?.focus();
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Item #{idx + 1}</span>
        <button onClick={() => onRemove(idx)}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        {showHnSac && (
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">HSN/SAC</label>
          <input type="text" value={item.hsn} data-mobile-field={`hsn-${idx}`}
            onChange={(e) => { delete e.target.dataset.enterPressed; onItemChange(idx, "hsn", e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) {
                e.target.dataset.enterPressed = "true";
                onHsnLookup(idx, e.target.value);
              }
              handleKeyDown(e, "hsn");
            }}
            onBlur={(e) => { if (e.target.value && !e.target.dataset.enterPressed) onHsnLookup(idx, e.target.value); delete e.target.dataset.enterPressed; }}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono min-h-[44px]" placeholder="Scan or type" />
        </div>
        )}
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{descLabel}</label>
          <input type="text" value={item.itemName} data-mobile-field={`desc-${idx}`}
            onChange={(e) => onItemChange(idx, "itemName", e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, "desc")}
            readOnly={locked}
            className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white min-h-[44px] ${locked ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""}`} placeholder="Item name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Qty</label>
            <input type="number" step="1" min="0" value={item.qty} data-mobile-field={`qty-${idx}`}
              onChange={(e) => onItemChange(idx, "qty", e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "qty")}
              inputMode="numeric"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono min-h-[44px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <select value={item.unit ?? "Unit"} data-mobile-field={`unit-${idx}`}
              onChange={(e) => onItemChange(idx, "unit", e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "unit")}
              title="Unit of measurement"
              className="mt-2 w-full px-2.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white text-slate-600 min-h-[44px]">
              {UNITS.map((u) => (
            <option key={u} value={u}>{u === "" ? "No unit" : u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Rate</label>
            <input type="number" step="0.01" min="0" value={item.rate} data-mobile-field={`rate-${idx}`}
              onChange={(e) => onItemChange(idx, "rate", e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "rate")}
              readOnly={locked}
              inputMode="decimal"
              className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono min-h-[44px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${locked ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">GST %</label>
            <div className="relative">
              <input type="number" step="0.01" min="0" max="40" value={item.gstPercentage} data-mobile-field={`gst-${idx}`}
                onChange={(e) => onItemChange(idx, "gstPercentage", e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, "gst")}
                inputMode="decimal"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono min-h-[44px] pr-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Amount</label>
            <div className="w-full px-3 py-2.5 border border-slate-100 rounded-lg text-sm text-right bg-slate-50 font-mono text-slate-700 min-h-[44px] flex items-center justify-end">
              Rs. {((calc?.total ?? parseFloat(item.total)) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function InvoiceForm() {
  const location = useLocation();
  const prefilled = location.state?.prefilled;
  const prefilledData = prefilled ? location.state : null;
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [linkSharing, setLinkSharing] = useState(false);
  const [savedInvoiceNumber, setSavedInvoiceNumber] = useState(null);
  const [savedInvoiceId, setSavedInvoiceId] = useState(null);
  // Status as last seen from the server. Sending a hardcoded "DRAFT" on every save
  // silently downgraded a PAID/CANCELLED invoice; the API requires the field, so we
  // echo back what the server currently holds instead of assuming DRAFT.
  const [savedStatus, setSavedStatus] = useState("DRAFT");
  // Public share link — created only when the user asks for it, and only after
  // the invoice has been saved (see Share Link panel in the Actions card).
  const [shareToken, setShareToken] = useState(null);
  const [shareBusy, setShareBusy] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  // Generate Tax Invoice flow — once the invoice has been saved + emailed, the
  // button reads "Download Tax Invoice PDF" until the invoice content changes.
  const [generating, setGenerating] = useState(false);
  const [generatedSignature, setGeneratedSignature] = useState(null);
  const shareUrl = shareToken ? `${window.location.origin}/i/${shareToken}` : "";
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState("");
  const ghostMode = localStorage.getItem("ghost_mode") === "true";
  // With the company seal enabled and no stored choice, default to the ROUND
  // seal (the same fallback resolveSeal and the delivery-challan flow use) so
  // Share/WhatsApp/Proforma aren't blocked waiting for a manual pick.
  const [sealType, setSealType] = useState(localStorage.getItem("seal_type") || "round");
  const sealEnabled = localStorage.getItem("show_seal") === "true";
  const sealRequired = sealEnabled && !sealType;
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  // Construction billing representation. COMPLETE_PROJECT bills one agreed
  // amount line; ITEMIZED bills category lines. Both are ordinary line-item
  // invoices — the flag only restores the right editor when re-opened.
  const isConstruction = business?.industry === "CONSTRUCTION";
  const [billingMode, setBillingMode] = useState("ITEMIZED");
  const [project, setProject] = useState({
    name: "", description: "", agreedAmount: "", workOrder: "", siteAddress: "", workPeriod: "",
  });
  const [showPrefillBanner, setShowPrefillBanner] = useState(!!prefilledData);
  const discountVal = parseFloat(discountPercent) || 0;
  const invoiceRef = useRef(null);
  // Invoice-level GST tax mode. Once the user flips the IGST toggle the
  // derivation effect must stop touching it — a manual choice is law and is
  // never silently overridden (only an explicit flip changes it).
  const taxModeTouchedRef = useRef(prefilledData?.taxMode === "IGST" || prefilledData?.taxMode === "CGST_SGST");
  // The hidden A4 invoice preview is only mounted while a PDF is being generated.
  // Re-rendering it on every keystroke was the main source of typing lag.
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  // Document type requested by the PDF button being pressed ("PROFORMA_INVOICE"
  // vs "TAX_INVOICE") — the hidden capture must render THIS, not the form's
  // invoiceType select, otherwise "Proforma PDF" downloads a Tax Invoice.
  const [captureType, setCaptureType] = useState(null);

  // Pull the html2canvas/jsPDF chunk in before it is needed so the WhatsApp
  // click-to-share window stays inside the browser's transient-activation limit.
  const mountPdfPreview = async () => {
    setShowPdfPreview(true);
    // Wait for React to commit + paint so invoiceRef points at real DOM
    for (let i = 0; i < 5 && !invoiceRef.current; i++) {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const [customer, setCustomer] = useState({
    name: prefilledData?.customerName || "",
    email: "",
    phone: prefilledData?.customerPhone || "",
    billingAddress: "",
    gstIn: "",
  });
  const [existingCustomer, setExistingCustomer] = useState(null);
  const [customerCheckLoading, setCustomerCheckLoading] = useState(false);
  const [customerSaved, setCustomerSaved] = useState(false);

  const [form, setForm] = useState({
    invoiceType: "TAX_INVOICE",
    invoiceDate: prefilledData?.invoiceDate || today,
    dueDate: today,
    placeOfSupply: "Karnataka",
    deliveryNote: "",
    deliveryNoteDate: today,
    referenceNumber: "",
    buyerOrderNumber: "",
    dispatchDocNumber: "",
    dispatchedThrough: "",
    termsOfDelivery: "Standard Shipping",
    paymentTerms: "Due on Receipt",
    paymentMode: "CASH",
    // GST structure: CGST + SGST/UTGST (intra-state) or IGST (inter-state).
    // Seeded from prefilled (duplicate) data when present, then refined by
    // the supplier-state vs place-of-supply derivation until touched.
    taxMode: prefilledData?.taxMode === "IGST" ? "IGST" : "CGST_SGST",
    otherReferences: "",
    destination: "Karnataka",
    notes: "",
    // V29 industry-extended reference fields (Rental & Healthcare).
    // Always present in state so updates round-trip loaded values; fields the
    // industry does not expose stay "" and are dropped from the payload.
    agreementNumber: "",
    assetNumber: "",
    serialNumber: "",
    vehicleNumber: "",
    periodStart: "",
    periodEnd: "",
    billingPeriodStart: "",
    billingPeriodEnd: "",
    expectedReturnDate: "",
    depositReference: "",
    patientReference: "",
    serviceDate: "",
    treatmentReference: "",
    referringDoctor: "",
  });

  const [items, setItems] = useState(
    prefilledData?.items?.length
      ? prefilledData.items.map((item) => ({ ...emptyItem, ...item, id: uid() }))
      : [{ ...emptyItem, id: uid() }]
  );

  // Latest HSN typed per row — lets async lookups detect stale/rapid (scanner) input
  const hsnRef = useRef({});
  // Last lookup result per row — Enter and blur can both trigger a lookup for the
  // same code, so we skip repeat calls until the user edits the code.
  const hsnLookupRef = useRef({});

  // Complete Project Cost: keep a single synced line item — project name +
  // description become the description, the agreed amount becomes the rate.
  // GST / HSN / unit / qty on the row stay user-editable; switching back to
  // Itemized leaves the rows exactly as they are.
  useEffect(() => {
    if (billingMode !== "COMPLETE_PROJECT") return;
    const composed = [project.name.trim(), project.description.trim()].filter(Boolean).join(" — ");
    setItems((prev) => {
      const first = prev[0] || { ...emptyItem, id: uid() };
      const nextRow = {
        ...first,
        itemName: composed,
        qty: "1",
      };
      if (project.agreedAmount !== "") nextRow.rate = project.agreedAmount;
      if (prev.length === 1 && prev[0].itemName === nextRow.itemName && String(prev[0].rate) === String(nextRow.rate) && String(prev[0].qty) === String(nextRow.qty)) {
        return prev;
      }
      return [nextRow];
    });
  }, [billingMode, project.name, project.description, project.agreedAmount]);

  // WO/contract ref + site ride existing invoice fields, labelled for
  // construction by the industry profile (Work Order No., Site / Work Location).
  useEffect(() => {
    if (billingMode !== "COMPLETE_PROJECT") return;
    setForm((f) => ({
      ...f,
      deliveryNote: project.workOrder,
      destination: project.siteAddress || f.destination,
    }));
  }, [billingMode, project.workOrder, project.siteAddress]);

  const nextInvoiceNumber = business
    ? formatInvoiceNumber(business.invoicePrefix, business.nextInvoiceSequence ?? 1)
    : "";

  const industryConfig = useMemo(
    () => business?.industryConfig || getIndustryConfig(business?.industry),
    [business?.industry, business?.industryConfig]
  );
  // V29 extended fields the current industry exposes (empty for all others).
  const extendedFields = useMemo(
    () => getExtendedFields(business?.industry || industryConfig?.id),
    [business?.industry, industryConfig?.id]
  );
  // Display-only HSN/SAC switch; missing/legacy business data keeps the column on.
  const showHnSac = !business || business.showHnSac !== false;
  const isHidden = useCallback((field) => isFieldHidden(industryConfig, field), [industryConfig]);
  const labelFor = useCallback((field, fallback) => fieldLabel(industryConfig, field, fallback), [industryConfig]);
  const placeholderFor = useCallback((field) => fieldPlaceholder(industryConfig, field), [industryConfig]);
  const showReferencesCard = useMemo(
    () => REFERENCES_SECTION_FIELDS.some((field) => !isFieldHidden(industryConfig, field)),
    [industryConfig]
  );
  const canCreateDeliveryChallan = industryConfig?.documents?.deliveryChallan !== false;

  useEffect(() => {
    if (business && ghostMode) {
      setCustomInvoiceNumber((prev) => prev || nextInvoiceNumber);
    }
  }, [business, ghostMode, nextInvoiceNumber]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bRes = await businessAPI.getProfile();
        setBusiness(bRes.data.data);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    processQueue(
      (data) => customerAPI.create(data),
      (data) => invoiceAPI.create(data)
    ).then((count) => {
      if (count > 0) toast.success(`${count} pending invoice${count > 1 ? 's' : ''} synced`);
    });
  }, []);

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setCustomer((prev) => ({ ...prev, [name]: value }));
    if (existingCustomer) setExistingCustomer(null);
  };

  const handleCheckCustomer = useCallback((phone) => {
    if (!phone || phone.length !== 10) return;
    setCustomerCheckLoading(true);
    customerAPI.check({ phone })
      .then((res) => {
        const found = res.data.data;
        if (found) {
          setExistingCustomer(found);
          setCustomer({
            name: found.name || "",
            email: found.email || "",
            phone: found.phone || "",
            billingAddress: found.billingAddress || "",
            gstIn: found.gstIn || "",
          });
        }
      })
      .catch(() => setExistingCustomer(null))
      .finally(() => setCustomerCheckLoading(false));
  }, []);

  const handleSaveCustomer = async () => {
    if (!customer.name.trim() || (!customer.email && !customer.phone)) return;
    try {
      await customerAPI.create({
        name: customer.name.trim(),
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        billingAddress: customer.billingAddress || undefined,
        gstIn: customer.gstIn || undefined,
      });
      setCustomerSaved(true);
      toast.success("Customer saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save customer");
    }
  };

  const handleItemChange = useCallback((idx, field, value) => {
    if (field === "hsn") {
      hsnRef.current[idx] = value;
      delete hsnLookupRef.current[idx];
    }
    if (field === "qty") {
      // Integers only: no decimals, no negatives, no exponent notation.
      const n = parseFloat(value);
      value = value.trim() === "" || Number.isNaN(n) ? "" : String(Math.max(0, Math.floor(n)));
    }
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === "gstPercentage" && parseFloat(value) > 40) value = "40";
      const updated = { ...item, [field]: value };
      if (["qty", "rate", "gstPercentage"].includes(field)) {
        const qty = parseFloat(updated.qty) || 0;
        const rate = parseFloat(updated.rate) || 0;
        const gst = parseFloat(updated.gstPercentage) || 0;
        const taxableValue = qty * rate;
        const taxAmount = (taxableValue * gst) / 100;
        updated.taxableValue = round2(taxableValue);
        updated.taxAmount = round2(taxAmount);
        updated.total = round2(taxableValue + taxAmount);
      }
      return updated;
    }));
  }, []);

  const handleHsnLookup = useCallback(async (idx, hsnRaw) => {
    const code = (hsnRaw || "").trim();
    if (!code || code.length < 3) return;

    // Dedupe: Enter (keydown) and blur both fire a lookup for the same code —
    // only re-call when the row's code changes or the last attempt errored.
    const seen = hsnLookupRef.current[idx];
    if (seen && seen.code === code && seen.status !== "error") return;
    hsnLookupRef.current[idx] = { code, status: "pending" };

    try {
      const res = await productAPI.findByHsn(code);
      const p = res.data.data;
      if (!p) {
        hsnLookupRef.current[idx] = { code, status: "notfound" };
        return;
      }
      hsnLookupRef.current[idx] = { code, status: "done" };
      // User typed more on this row while the request was in flight — skip
      const latest = hsnRef.current[idx];
      if (latest !== undefined && (latest || "").trim() !== code) return;
      setItems((prev) => prev.map((item, i) => {
        if (i !== idx) return item;
        if ((item.hsn || "").trim() !== code) return item;
        const qty = item.qty || "1";
        const rate = p.rate?.toString() || item.rate;
        const gst = p.gstPercentage?.toString() || item.gstPercentage;
        const q = parseFloat(qty) || 0;
        const r = parseFloat(rate) || 0;
        const g = parseFloat(gst) || 0;
        const taxableValue = q * r;
        const taxAmount = (taxableValue * g) / 100;
        return {
          ...item,
          itemName: p.name || item.itemName,
          rate,
          gstPercentage: gst,
          qty,
          taxableValue: round2(taxableValue),
          taxAmount: round2(taxAmount),
          total: round2(taxableValue + taxAmount),
        };
      }));
      toast.success(`Found: ${p.name}`);
    } catch (err) {
      if (err?.response?.status === 404) {
        hsnLookupRef.current[idx] = { code, status: "notfound" };
      } else {
        hsnLookupRef.current[idx] = { code, status: "error" };
        toast.error("HSN lookup failed — check your connection and try again");
      }
    }
  }, []);

  const recalcAll = useCallback(() => {
    setItems((prev) => prev.map((item) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const gst = parseFloat(item.gstPercentage) || 0;
      const taxableValue = qty * rate;
      const taxAmount = (taxableValue * gst) / 100;
      return { ...item, taxableValue: round2(taxableValue), taxAmount: round2(taxAmount), total: round2(taxableValue + taxAmount) };
    }));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { ...emptyItem, id: uid() }]);
  }, []);

  const removeItem = useCallback((idx) => {
    setItems((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      return filtered.length === 0 ? [{ ...emptyItem, id: uid() }] : filtered;
    });
  }, []);

  const totals = useMemo(() => computeInvoiceTotals(items, discountEnabled ? discountPercent : "0", form.taxMode), [items, discountEnabled, discountPercent, form.taxMode]);

  const validItemsCount = useMemo(
    () => items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0).length,
    [items]
  );

  // Fingerprint of everything that shapes the invoice document. Compared with
  // the snapshot taken when Generate Tax Invoice ran, so any later edit flips
  // the button from Download back to Generate.
  const contentSignature = useMemo(
    () =>
      JSON.stringify({
        form,
        customer,
        // Derived totals are recomputed on save — only raw inputs count as edits.
        items: items.map(({ taxableValue, taxAmount, total, ...rest }) => rest),
        discountEnabled,
        discountPercent,
        billingMode,
        project,
      }),
    [form, customer, items, discountEnabled, discountPercent, billingMode, project]
  );
  const taxInvoiceGenerated = !!generatedSignature && generatedSignature === contentSignature;

  // localStorage read + JSON.parse + structuredClone — done once per invoice
  // type instead of on every render of the hidden capture document.
  const effectiveType = captureType || form.invoiceType;
  const previewPaperSize = useMemo(() => (getPrintSettings()[effectiveType] || {}).paperSize || "A4_PORTRAIT", [effectiveType]);
  const previewTemplate = useMemo(() => getInvoiceTemplate(effectiveType), [effectiveType]);

  // Initial tax-mode default — derived from the SUPPLIER's (business) state
  // vs the legally applicable Place of Supply, never from the customer's
  // billing address or Destination. Re-derives while the user hasn't touched
  // the toggle (e.g. they are still picking the place of supply); after the
  // first manual flip it never runs again for this invoice.
  useEffect(() => {
    if (taxModeTouchedRef.current || !business) return;
    const derived = determineTaxMode(business.state, form.placeOfSupply);
    if (derived && derived !== form.taxMode) {
      setForm((f) => ({ ...f, taxMode: derived }));
    }
  }, [business, form.placeOfSupply, form.taxMode]);

  // Live rule-check of the selection vs the applicable GST structure. Used by
  // the helper text under the toggle and by validate() to gate finalization.
  const taxValidation = useMemo(
    () => validateTaxMode(form.taxMode, business?.state, form.placeOfSupply),
    [form.taxMode, business?.state, form.placeOfSupply],
  );

  const toggleTaxMode = () => {
    taxModeTouchedRef.current = true;
    setForm((f) => ({ ...f, taxMode: f.taxMode === "IGST" ? "CGST_SGST" : "IGST" }));
  };

  const validate = () => {
    if (!customer.name.trim()) { toast.error("Customer name is required"); return false; }
    if (!form.dueDate) { toast.error("Due date is required"); return false; }
    if (!form.invoiceDate) { toast.error("Invoice date is required"); return false; }
    // V29 period sanity — mirrors the backend's validateExtendedDates (ISO
    // strings compare lexicographically). Fires only when both ends exist.
    if (form.periodStart && form.periodEnd && form.periodEnd < form.periodStart) {
      toast.error("Period end date cannot be before the period start date"); return false;
    }
    if (form.billingPeriodStart && form.billingPeriodEnd && form.billingPeriodEnd < form.billingPeriodStart) {
      toast.error("Billing period end date cannot be before the billing period start date"); return false;
    }
    const validItems = items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0);
    if (validItems.length === 0) { toast.error("Add at least one item"); return false; }
    // Tax mode vs GST rules: the user's selection is NEVER silently changed —
    // a conflicting mode can only proceed through an explicit override, which
    // keeps invalid finalization out while still allowing deliberate choices.
    if (!taxValidation.ok && !window.confirm(`${taxValidation.message}\n\nSave with this tax mode anyway?`)) {
      return false;
    }
    return true;
  };

  const buildPayload = (customerId) => {
    // Hidden industry fields are omitted on create so form defaults never
    // leak into stored data. Existing values are preserved on the server.
    const opt = (field, value) => (isHidden(field) ? undefined : value || undefined);
    // Complete Project Cost appends the work period to notes so the document
    // says what the single agreed amount covers — without touching totals.
    const workPeriodNote = isConstruction && billingMode === "COMPLETE_PROJECT" && project.workPeriod.trim()
      ? `Work period: ${project.workPeriod.trim()}`
      : "";
    const baseNotes = form.notes || "";
    const notes = [baseNotes, workPeriodNote].filter(Boolean).join("\n") || undefined;
    return {
      customerId,
      invoiceType: form.invoiceType,
      // Persisted with the invoice — the backend validates it and every
      // renderer (preview, download, email, share link) reads it back.
      taxMode: form.taxMode,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate,
      placeOfSupply: form.placeOfSupply || undefined,
      paymentTerms: form.paymentTerms || undefined,
      paymentMode: form.paymentMode || undefined,
      notes,
      billingMode: isConstruction ? billingMode : undefined,
      deliveryNote: opt("deliveryNote", form.deliveryNote),
      deliveryNoteDate: opt("deliveryNoteDate", form.deliveryNoteDate),
      referenceNumber: form.referenceNumber || undefined,
      buyerOrderNumber: opt("buyerOrderNumber", form.buyerOrderNumber),
      dispatchDocNumber: opt("dispatchDocNumber", form.dispatchDocNumber),
      dispatchedThrough: opt("dispatchedThrough", form.dispatchedThrough),
      termsOfDelivery: opt("termsOfDelivery", form.termsOfDelivery),
      otherReferences: opt("otherReferences", form.otherReferences),
      destination: opt("destination", form.destination),
      // V29 extended fields: always round-trip whatever is in form state so an
      // update never clears loaded values (backend sets them unconditionally).
      // Unexposed fields stay "" -> undefined -> dropped by JSON serialization.
      ...Object.fromEntries(ALL_EXTENDED_FIELDS.map((f) => [f, form[f] || undefined])),
      ...(ghostMode && customInvoiceNumber.trim() ? { invoiceNumber: customInvoiceNumber.trim() } : {}),
      discountPercent: discountEnabled ? parseFloat(discountPercent) || 0 : 0,
      items: items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0).map((i, idx) => ({
        sno: idx + 1, itemName: i.itemName, hsn: i.hsn || undefined, unit: i.unit || undefined,
        qty: Math.floor(parseFloat(i.qty)) || 0, rate: parseFloat(i.rate), gstPercentage: parseFloat(i.gstPercentage) || 0,
      })),
    };
  };

  const saveInvoice = async () => {
    recalcAll();
    // Reuse the customer found via phone/email check instead of creating a duplicate every save
    let customerId = existingCustomer?.id;
    if (!customerId) {
      const custRes = await customerAPI.create({
        name: customer.name,
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        billingAddress: customer.billingAddress || undefined,
        gstIn: customer.gstIn || undefined,
      });
      customerId = custRes.data.data?.id;
    }
    let res;
    if (savedInvoiceId) {
      res = await invoiceAPI.update(savedInvoiceId, { ...buildPayload(customerId), status: savedStatus || "DRAFT" });
    } else {
      res = await invoiceAPI.create(buildPayload(customerId));
    }
    setSavedInvoiceId(res.data.data.id);
    setSavedInvoiceNumber(res.data.data.invoiceNumber);
    setSavedStatus(res.data.data.status || "DRAFT");
    businessAPI.getProfile().then((bRes) => setBusiness(bRes.data.data)).catch(() => {});
    return res;
  };

  // Renders the SAME PDF the Download button produces (it reads the seal/stamp
  // preference from localStorage) and returns it as an uploadable File, so the
  // emailed document is identical to the one the user would download. The
  // attachment is best-effort — a render failure returns null and the email
  // still sends with the share link.
  const buildTaxInvoicePdfFile = async (invNo) => {
    try {
      setCaptureType("TAX_INVOICE");
      await mountPdfPreview();
      // Let the hidden capture paint fully before html2canvas reads it.
      await new Promise((r) => setTimeout(r, 100));
      const ps = (getPrintSettings()["TAX_INVOICE"] || {}).paperSize || "A4_PORTRAIT";
      const filename = `Tax_Invoice_${invNo || form.invoiceDate || today}.pdf`;
      if (!invoiceRef.current) {
        console.error("Invoice email attachment skipped: hidden invoice capture never mounted");
        return null;
      }
      const file = await createInvoicePdfFile(invoiceRef.current, ps, filename);
      if (!file) {
        console.error("Invoice email attachment skipped: PDF render returned no file");
      }
      return file;
    } catch (err) {
      console.error("Invoice email attachment render failed:", err);
      return null;
    } finally {
      setShowPdfPreview(false);
      setCaptureType(null);
    }
  };

  // Background PDF-email job: the share link, the hidden-capture render and
  // the email POST all run detached from the UI. Callers finish immediately
  // after their synchronous part (the save); milestones and failures surface
  // as toasts. An in-flight guard serialises jobs — two overlapping calls can
  // never double-email an invoice.
  const pdfEmailJobRef = useRef(false);
  const runPdfEmailJob = (invoiceId, invNo) => {
    if (pdfEmailJobRef.current) return;
    pdfEmailJobRef.current = true;
    const email = (customer.email || "").trim();
    (async () => {
      // The email carries the same public link the Share Link panel shows;
      // createShare is idempotent and the backend also creates it on demand.
      if (!shareToken) {
        const shareRes = await invoiceAPI.createShare(invoiceId);
        const token = shareRes.data?.data?.token;
        if (token) setShareToken(token);
      }
      // Attach the SAME PDF the Download button produces (seal/stamp
      // included) so the emailed document matches the download exactly.
      const pdfFile = await buildTaxInvoicePdfFile(invNo);
      await invoiceAPI.sendInvoiceEmail(invoiceId, window.location.origin, pdfFile);
      const attachNote = pdfFile ? ` — PDF attached (${Math.round(pdfFile.size / 1024)} KB)` : "";
      // The POST only QUEUES — the backend dispatches to Resend on an async
      // thread (see waitForInvoiceEmail in api/auth.js).
      toast.success(`Tax Invoice ${invNo} queued for ${email}${attachNote}`);
      if (!pdfFile) {
        toast("Emailed WITHOUT the PDF attachment — the render failed; see the browser console", { icon: "⚠️" });
      }
      // Wait for the delivery verdict instead of claiming success up-front.
      const verdict = await waitForInvoiceEmail(invoiceId);
      if (verdict.status === "SENT") {
        toast.success(`Tax Invoice ${invNo} emailed to ${email}`);
      } else if (verdict.status === "FAILED") {
        toast.error(`Tax Invoice ${invNo} email failed${verdict.error ? ` — ${verdict.error}` : ""}`);
      } else if (verdict.status === "TIMEOUT") {
        toast(`Tax Invoice ${invNo} email is still processing — try Send Email again in a moment`, { icon: "⏳" });
      }
    })()
      .catch((err) => {
        toast.error(err.response?.data?.message || "Invoice saved, but the email could not be sent — retry with Send Email below");
      })
      .finally(() => {
        pdfEmailJobRef.current = false;
      });
  };

  // Generate Tax Invoice — one action that saves the invoice to the DB
  // (create or update) and emails it to the customer's registered email with
  // its share link. The save is awaited (the record must exist before the
  // email job can reference it) — but the PDF render and the SMTP round-trip
  // are a BACKGROUND job: the button flips to "Download Tax Invoice PDF" as
  // soon as the save lands, the user is free to keep working, and progress
  // arrives as toasts. Editing the invoice brings Generate back (see
  // contentSignature).
  const handleGenerateTaxInvoice = async () => {
    if (saving) return;
    // Without validate(), an invalid save still reached saveInvoice(), which
    // creates the customer record first — leaving orphan customers behind.
    if (!validate()) return;
    const signature = contentSignature;
    setSaving(true);
    setGenerating(true);

    let invoiceId;
    let invNo;
    try {
      const res = await saveInvoice();
      invoiceId = res.data.data.id;
      invNo = res.data.data.invoiceNumber;
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.details?.[0]?.msg || "Failed to save invoice";
      toast.error(msg);
      setGenerating(false);
      setSaving(false);
      return;
    }

    // Save landed — release the UI immediately and hand the rest to the
    // background runner.
    setGeneratedSignature(signature);
    setGenerating(false);
    setSaving(false);
    if (customer.email?.trim()) {
      toast(`Saved ${invNo} — preparing the email in the background`, { icon: "📨" });
      runPdfEmailJob(invoiceId, invNo);
    } else {
      toast.success(`Tax Invoice ${invNo} saved`);
      toast("Customer has no email on record — add one to email the invoice", { icon: "📧" });
    }
  };

  const generateDeliveryChallanPdf = async () => {
    const dcItems = (items || [])
      .filter((i) => (i.itemName || "").trim() && parseFloat(i.qty) > 0)
      .map((i) => ({
        description: i.itemName.trim(),
        quantity: Math.max(0, Math.floor(parseFloat(i.qty))),
      }));
    if (!dcItems.length) {
      toast.error("Add at least one item with quantity to generate a delivery challan");
      return;
    }
    if (!customer.name?.trim()) {
      toast.error("Select a customer to generate a delivery challan");
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      // Persist with the customer first — only when the user clicks this
      // button — so the challan can be re-downloaded from Delivery Challans.
      let customerId = existingCustomer?.id;
      if (!customerId) {
        const custRes = await customerAPI.create({
          name: customer.name,
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          billingAddress: customer.billingAddress || undefined,
          gstIn: customer.gstIn || undefined,
        });
        customerId = custRes.data.data?.id;
        setExistingCustomer(custRes.data.data);
        setCustomerSaved(true);
      }
      const po = form.otherReferences && form.otherReferences !== "N/A" ? form.otherReferences : "";
      const res = await deliveryChallanAPI.create({
        customerId,
        challanDate: form.invoiceDate || today,
        poNumber: po || undefined,
        poDate: po ? form.invoiceDate || today : undefined,
        items: dcItems,
      });
      const dc = res.data.data;
      const variant = localStorage.getItem("ii_dc_template") || "classic";
      const sealOn = localStorage.getItem("ii_dc_seal") !== "off";
      const b = business || (await businessAPI.getProfile()).data.data;
      const pdf = await renderDeliveryChallanPdf(dc, b, { variant, sealOn });
      pdf.save(`Delivery_Challan_${dc.challanNumber}.pdf`);
      toast.success(`Delivery challan ${dc.challanNumber} saved & downloaded`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save delivery challan");
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = async (type) => {
    if (!validate()) return;
    recalcAll();

    setSaving(true);
    setCaptureType(type);
    await mountPdfPreview();
    try {
      const filename = `${type === "PROFORMA_INVOICE" ? "Proforma_Invoice" : "Tax_Invoice"}_${form.invoiceDate || new Date().toISOString().split("T")[0]}.pdf`;
      const ps = (getPrintSettings()[type] || {}).paperSize || "A4_PORTRAIT";
      await new Promise((r) => setTimeout(r, 100));
      await processPrint(invoiceRef, type, filename, ps);
    } catch {
      toast.error("Failed to generate PDF");
      setShowPdfPreview(false);
      setCaptureType(null);
      setSaving(false);
      return;
    }

    if (!savedInvoiceId) {
      try {
        const res = await saveInvoice();
        toast.success(`Invoice ${res.data.data.invoiceNumber} saved`);
      } catch {
        toast.error("Failed to save invoice");
      }
    }
    setShowPdfPreview(false);
    setCaptureType(null);
    setSaving(false);
  };

  // Share opens the native share sheet with the invoice LINK only — it must
  // never build/open/download a PDF (the old flow fell back to downloading
  // one after the share sheet was dismissed).
  const handleShare = async () => {
    if (linkSharing) return;
    if (!validate()) return;
    recalcAll();
    setLinkSharing(true);
    try {
      const saveRes = await saveInvoice();
      const invoiceId = saveRes.data.data.id;
      const invNo = saveRes.data.data.invoiceNumber || savedInvoiceNumber || customInvoiceNumber || nextInvoiceNumber;
      const shareRes = await invoiceAPI.createShare(invoiceId);
      const token = shareRes.data?.data?.token;
      if (token) setShareToken(token);
      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://www.insideinvoice.com";
      const shareUrl = token ? `${origin}/i/${token}` : undefined;
      if (!shareUrl) throw new Error("no-link");
      if (navigator.share) {
        try {
          await navigator.share({ title: `Invoice ${invNo}`, url: shareUrl });
        } catch { /* dismissed — do nothing, never download */ }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Invoice link copied to clipboard");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not share invoice");
    } finally {
      setLinkSharing(false);
    }
  };

  const shareViaWhatsApp = async () => {
    if (sharing) return;
    if (!validate()) return;
    recalcAll();
    setSharing(true);
    try {
      // 1. Save the invoice (if unsaved)
      const saveRes = await saveInvoice();
      const invoiceId = saveRes.data.data.id;
      const invNo = saveRes.data.data.invoiceNumber || savedInvoiceNumber || customInvoiceNumber || nextInvoiceNumber;

      // 2. Create/ensure a public share link
      const shareRes = await invoiceAPI.createShare(invoiceId);
      const token = shareRes.data?.data?.token;
      if (token) setShareToken(token);
      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://www.insideinvoice.com";
      const shareUrl = token ? `${origin}/i/${token}` : undefined;

      // 3. Open WhatsApp with the prefilled invoice message + link
      const type = form.invoiceType || "TAX_INVOICE";
      const text = buildInvoiceWhatsAppMessage({
        customerName: customer?.name || form.customerName,
        invoiceNumber: invNo,
        invoiceType: type,
        total: totals.grandTotal,
        businessName: business?.businessName,
        shareUrl,
      });
      openWhatsAppChat(text);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not share via WhatsApp");
    } finally {
      setSharing(false);
    }
  };

  const copyShareUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.success("Share link ready — copy it from the field");
    }
  };

  // Share Link panel — mirrors View Invoice, but only unlocked once Save has
  // been clicked (the invoice must exist server-side before a link or email
  // can refer to it).
  const handleShareLink = async (action) => {
    if (shareBusy || !savedInvoiceId) return;
    setShareBusy(action);
    try {
      if (action === "create") {
        const res = await invoiceAPI.createShare(savedInvoiceId);
        const token = res.data?.data?.token;
        if (!token) throw new Error("no token");
        setShareToken(token);
        await copyShareUrl(`${window.location.origin}/i/${token}`);
      } else if (action === "regenerate") {
        const res = await invoiceAPI.regenerateShare(savedInvoiceId);
        const token = res.data?.data?.token;
        if (!token) throw new Error("no token");
        setShareToken(token);
        await copyShareUrl(`${window.location.origin}/i/${token}`);
        toast("Previous link disabled — only the new one works", { icon: "🔑" });
      } else if (action === "revoke") {
        await invoiceAPI.revokeShare(savedInvoiceId);
        setShareToken(null);
        toast.success("Share link revoked — it no longer resolves");
      }
    } catch (err) {
      if (err?.response?.status === 404) toast.error("Invoice not found");
      else toast.error("Could not update the share link");
    } finally {
      setShareBusy("");
    }
  };

  const sendInvoiceEmailToCustomer = async () => {
    if (emailBusy || !savedInvoiceId) return;
    setEmailBusy(true);
    try {
      // Make sure the email carries the same link the panel shows.
      if (!shareToken) {
        const res = await invoiceAPI.createShare(savedInvoiceId);
        const token = res.data?.data?.token;
        if (token) setShareToken(token);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not create the share link for the email");
      setEmailBusy(false);
      return;
    }
    // Link is ready — release the button and let the PDF render + SMTP run
    // detached (runPdfEmailJob guards against duplicate sends).
    setEmailBusy(false);
    toast("Preparing the invoice email in the background", { icon: "📨" });
    runPdfEmailJob(savedInvoiceId, savedInvoiceNumber);
  };

  if (loading) {
    // Keep the app shell (sidebar/navbar) mounted while the business profile
    // loads — only the center area shows the spinner, matching InvoicesList.
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100dvh - 80px)" }}
        >
          <Spinner size={32} />
        </div>
      </div>
    );
  }

  const actionsCard = (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-6">
      <h2 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">
        Actions
      </h2>
      <div className="space-y-3">
        {/* Row 1: Delivery (icon-only) + Share + WhatsApp. Saving happens
            automatically through Generate Tax Invoice, Share, WhatsApp and
            Proforma. */}
        <div className="flex items-stretch gap-2">
          {canCreateDeliveryChallan && (
            <span className="relative group flex-1 flex">
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                Delivery Challan
              </span>
              <button
                onClick={generateDeliveryChallanPdf}
                disabled={
                  saving ||
                  !customer.name?.trim() ||
                  !(items || []).some(
                    (i) => (i.itemName || "").trim() && parseFloat(i.qty) > 0,
                  )
                }
                aria-label="Delivery challan"
                className="w-full flex items-center justify-center px-2 py-2.5 border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-50 disabled:opacity-50 transition-all min-h-[44px]"
              >
                <Truck className="w-4 h-4 shrink-0" />
              </button>
            </span>
          )}

          <span className="relative group flex-1 flex">
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              Share Invoice Link
            </span>
            <button
              onClick={handleShare}
              aria-label="Share invoice link"
              disabled={linkSharing || sealRequired || totals.grandTotal <= 0}
              className="w-full flex items-center justify-center px-2 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm min-h-[44px]"
            >
              {linkSharing ? (
                <Spinner size={16} className="text-white shrink-0" />
              ) : (
                <Share2 className="w-4 h-4 shrink-0" />
              )}
            </button>
          </span>

          <span className="relative group flex-1 flex">
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              Share on WhatsApp
            </span>
            <button
              type="button"
              onClick={shareViaWhatsApp}
              aria-label="Share on WhatsApp"
              disabled={sharing || sealRequired || totals.grandTotal <= 0}
              className="w-full flex items-center justify-center px-2 py-2.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5b] disabled:opacity-50 transition-all shadow-sm min-h-[44px]"
            >
              {sharing ? (
                <Spinner size={18} />
              ) : (
                <WhatsAppIcon className="w-5 h-5" />
              )}
            </button>
          </span>
        </div>

        {/* Proforma — full width */}
        <button
          onClick={() => generatePDF("PROFORMA_INVOICE")}
          disabled={saving || sealRequired || totals.grandTotal <= 0}
          className="w-full flex items-center justify-center gap-2 px-2 sm:px-3 py-2.5 border border-emerald-300 text-emerald-700 text-sm font-semibold rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-all min-h-[44px] whitespace-nowrap"
        >
          <Download className="w-4 h-4 shrink-0" /> Proforma Invoice
        </button>

        {/* Tax Invoice — Generate (save + email) until it has been generated;
            then Download, until an edit brings Generate back. */}
        {taxInvoiceGenerated ? (
          <button
            onClick={() => generatePDF("TAX_INVOICE")}
            disabled={saving || sealRequired || totals.grandTotal <= 0}
            title="Download the tax invoice PDF"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-indigo-300 text-indigo-700 text-sm font-semibold rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-all min-h-[44px]"
          >
            {saving ? (
              <Spinner size={16} className="shrink-0" />
            ) : (
              <Download className="w-4 h-4 shrink-0" />
            )}{" "}
            {saving ? "Preparing..." : "Tax Invoice PDF"}
          </button>
        ) : (
          <button
            onClick={handleGenerateTaxInvoice}
            disabled={saving || sealRequired || totals.grandTotal <= 0}
            title="Save this invoice and email it to the customer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-indigo-300 text-indigo-700 text-sm font-semibold rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-all min-h-[44px]"
          >
            {generating ? (
              <Spinner size={16} className="shrink-0" />
            ) : (
              <Zap className="w-4 h-4 shrink-0" />
            )}{" "}
            {generating ? "Generating..." : "Generate Tax Invoice"}
          </button>
        )}

        {/* Share Link — same as View Invoice; unlocks once the invoice has been
            saved (Generate Tax Invoice, Share and WhatsApp all save) */}
        <div className="pt-3 border-t border-slate-100">
          <h3
            className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"
            title="Send Email creates the link automatically. Anyone with it can view the invoice without logging in."
          >
            <Link2 className="w-3.5 h-3.5" /> Share Link
          </h3>
          {shareToken ? (
            <div className="space-y-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="w-full px-2.5 py-2 border border-slate-200 bg-slate-50 rounded-lg text-xs font-mono text-slate-600 focus:outline-none"
                aria-label="Public share link"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyShareUrl(shareUrl)}
                  disabled={!!shareBusy || !savedInvoiceId}
                  className="min-w-0 flex-1 flex items-center justify-center gap-1.5 px-2 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-all"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                    Copy link
                  </span>
                </button>
                <button
                  type="button"
                  onClick={sendInvoiceEmailToCustomer}
                  disabled={emailBusy || !savedInvoiceId}
                  title="Email this invoice and its link to the customer"
                  className="min-w-0 flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm"
                >
                  {emailBusy ? (
                    <Spinner size={14} className="shrink-0" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                    {emailBusy ? "Sending..." : "Send Email"}
                  </span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-400 leading-relaxed flex-1">
                  Anyone with this link can view the invoice without logging in.
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleShareLink("regenerate")}
                    disabled={!!shareBusy || !savedInvoiceId}
                    className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-slate-500 hover:text-indigo-600 rounded disabled:opacity-60 transition-colors"
                    title="Create a new link and disable the current one"
                  >
                    {shareBusy === "regenerate" ? (
                      <Spinner size={12} />
                    ) : (
                      <RotateCw className="w-3 h-3" />
                    )}{" "}
                    New
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShareLink("revoke")}
                    disabled={!!shareBusy || !savedInvoiceId}
                    className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-slate-500 hover:text-red-600 rounded disabled:opacity-60 transition-colors"
                    title="Revoke the link — recipients can no longer open it"
                  >
                    {shareBusy === "revoke" ? (
                      <Spinner size={12} />
                    ) : (
                      <Unlink className="w-3 h-3" />
                    )}{" "}
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                className="flex gap-2"
                title={
                  !savedInvoiceId
                    ? "Save the invoice first (Generate Tax Invoice, Share or WhatsApp) — Create link and Send Email unlock once it exists."
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={() => handleShareLink("create")}
                  disabled={saving || !!shareBusy || !savedInvoiceId}
                  className="min-w-0 flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 border border-sky-300 text-sky-700 rounded-lg hover:bg-sky-50 disabled:opacity-60 transition-all"
                >
                  {shareBusy === "create" ? (
                    <Spinner size={14} className="shrink-0" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                    {shareBusy === "create" ? "Creating..." : "Create link"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={sendInvoiceEmailToCustomer}
                  disabled={saving || emailBusy || !savedInvoiceId}
                  title="Email this invoice and its link to the customer"
                  className="min-w-0 flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm"
                >
                  {emailBusy ? (
                    <Spinner size={14} className="shrink-0" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                    {emailBusy ? "Sending..." : "Send Email"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Items:</span>
            <span className="font-semibold text-slate-800">
              {validItemsCount}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Subtotal:</span>
            <span className="font-mono text-slate-700">
              Rs.{" "}
              {totals.subtotal.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          {discountEnabled && discountVal > 0 && (
            <div className="flex justify-between gap-3 text-emerald-600">
              <span>Discount ({discountVal}%):</span>
              <span className="font-mono">
                -Rs.{" "}
                {totals.discountAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-slate-500 whitespace-nowrap">
              Taxable Amount:
            </span>
            <span className="font-mono text-slate-700">
              Rs.{" "}
              {totals.taxableAmount.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Tax:</span>
            <span className="font-mono text-slate-700">
              Rs.{" "}
              {totals.taxAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="flex justify-between gap-3 font-bold text-slate-800 pt-2 border-t border-slate-200">
            <span>Total:</span>
            <span className="font-mono">
              Rs.{" "}
              {totals.grandTotal.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {business && (
        <div className="mt-6 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Business
          </h3>
          <p className="text-xs text-slate-600 font-medium">
            {business.businessName}
          </p>
          {business.phone && (
            <p className="text-xs text-slate-400">Phone: {business.phone}</p>
          )}
          {business.email && (
            <p className="text-xs text-slate-400">Email: {business.email}</p>
          )}
          {business.addressLine1 && (
            <p className="text-xs text-slate-400">
              {business.addressLine1}
              {business.city ? `, ${business.city}` : ""}
              {business.state ? `, ${business.state}` : ""}
              {business.pincode ? ` - ${business.pincode}` : ""}
            </p>
          )}
          {business.gstIn && (
            <p className="text-xs text-slate-400 font-mono">
              GST: {business.gstIn}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Hidden Invoice PDF for capture — mounted only while generating a PDF */}
      {showPdfPreview && (
        <div style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}>
          <InvoiceTemplateRenderer
            ref={invoiceRef}
            business={business}
            customer={customer}
            form={form}
            items={items}
            totals={totals}
            discountPercent={discountEnabled ? discountPercent : "0"}
            taxMode={form.taxMode}
            type={effectiveType}
            invoiceNumber={savedInvoiceNumber || customInvoiceNumber || nextInvoiceNumber || ""}
            paperSize={previewPaperSize}
            template={previewTemplate}
          />
        </div>
      )}
      <div className="max-w-[1900px] mx-auto px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5">
        <PageHeader title="Create Invoice" />
        {showPrefillBanner && (
          <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-4">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <p className="text-xs text-indigo-700 flex-1">We've filled in what we could read from your bill — please review before saving.</p>
            <button onClick={() => setShowPrefillBanner(false)} className="p-1 hover:bg-indigo-100 rounded transition-colors">
              <X className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] side-fixed-grid gap-6 items-start">
          <div className="space-y-6">

            {/* Customer Details - Inline Fields */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-600" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">Customer Details</h2>
                </div>
                <div className="flex items-center gap-2">
                  {customerCheckLoading && (
                    <LoadingDots className="text-slate-400" />
                  )}
                  {existingCustomer && (
                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Existing customer</span>
                  )}
                  {customerSaved && (
                    <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Customer saved</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input type="tel" name="phone" value={customer.phone} onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10);
                      handleCustomerChange({ target: { name: "phone", value: v } });
                    }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (customer.phone.length === 10) handleCheckCustomer(customer.phone);
                          focusNext("phone");
                        }
                      }}
                      onBlur={() => {
                        if (customer.phone.length === 10) handleCheckCustomer(customer.phone);
                      }}
                      className={"pl-10 " + inputClass} placeholder="e.g. 9036843735" inputMode="numeric" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Customer Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input type="text" name="name" value={customer.name} onChange={handleCustomerChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("name"); } }}
                      className={"pl-10 " + inputClass} placeholder="e.g. Good Luck Enterprises" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <input type="email" name="email" value={customer.email} onChange={handleCustomerChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("email"); } }}
                      className={"pl-10 " + inputClass} placeholder="customer@email.com" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>GSTIN</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input type="text" name="gstIn" value={customer.gstIn} onChange={handleCustomerChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("gstIn"); } }}
                      className={"pl-10 font-mono uppercase tracking-wider " + inputClass} placeholder="e.g. 29AEQPJ1655J1Z0" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Billing Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                    <textarea name="billingAddress" value={customer.billingAddress} onChange={handleCustomerChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("billingAddress"); } }}
                      rows={2} className={"pl-10 " + inputClass + " resize-none"} placeholder="Full billing address" />
                  </div>
                </div>
              </div>
              {!existingCustomer && !customerSaved && customer.name.trim() && customer.phone && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <button onClick={handleSaveCustomer}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-all shadow-sm min-h-[44px]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                    Save Customer
                  </button>
                </div>
              )}
            </div>

            {/* Invoice Details */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">Invoice Details</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Type selector removed on purpose: every document saved from
                    this form is a Tax Invoice (the default below), and Proforma
                    has its own dedicated button in Actions — captureType
                    drives the proforma PDF, so it never read this select.
                    Existing PROFORMA invoices keep their type when edited. */}
                {savedInvoiceNumber && (
                  <div>
                    <label className={labelClass}>Invoice No.</label>
                    <input type="text" value={savedInvoiceNumber} readOnly
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-mono cursor-not-allowed" />
                  </div>
                )}
                {!savedInvoiceNumber && (
                  <div>
                    <label className={labelClass}>Invoice No.</label>
                    {ghostMode ? (
                      <input type="text" value={customInvoiceNumber}
                        onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                        className={inputClass + " font-mono"} placeholder="Enter invoice number" />
                    ) : (
                      <input type="text" value={nextInvoiceNumber} readOnly disabled
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-mono cursor-not-allowed" />
                    )}
                  </div>
                )}
                <div>
                  <label className={labelClass}>Date <span className="text-red-500">*</span></label>
                  <input type="date" name="invoiceDate" value={form.invoiceDate} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("invoiceDate"); } }}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Due Date <span className="text-red-500">*</span></label>
                  <input type="date" name="dueDate" value={form.dueDate} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("dueDate"); } }}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Place of Supply</label>
                  <div className="relative">
                    <select name="placeOfSupply" value={form.placeOfSupply} onChange={handleFieldChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("placeOfSupply"); } }}
                      className={selectClass}>
                      <option value="">State</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                {!isHidden("destination") && (
                <div>
                  <label className={labelClass}>{labelFor("destination", "Destination")}</label>
                  {isConstruction ? (
                    // Site / Work Location is a free-text address for builders —
                    // a state dropdown would reject "Plot 12, Whitefield".
                    <input type="text" name="destination" value={form.destination} onChange={handleFieldChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("destination"); } }}
                      className={inputClass} placeholder={placeholderFor("destination") || "e.g. Plot 12, Whitefield, Bengaluru"} />
                  ) : (
                  <div className="relative">
                    <select name="destination" value={form.destination} onChange={handleFieldChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("destination"); } }}
                      className={selectClass}>
                      <option value="">State</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  )}
                </div>
                )}
                <div>
                  <label className={labelClass}>Payment Terms</label>
                  <div className="relative">
                    <select name="paymentTerms" value={form.paymentTerms} onChange={handleFieldChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("paymentTerms"); } }}
                      className={selectClass}>
                      {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Payment Mode</label>
                  <div className="relative">
                    <select name="paymentMode" value={form.paymentMode} onChange={handleFieldChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("paymentMode"); } }}
                      className={selectClass}>
                      <option value="UPI">UPI</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="NEFT">NEFT</option>
                      <option value="IMPS">IMPS</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                {/* Invoice-level GST tax mode — immediately beside Payment Mode
                    in the same grid. ON = IGST (inter-state), OFF = CGST +
                    SGST/UTGST (intra-state). The default is derived from the
                    business state vs the legally applicable place of supply;
                    the helper text flags any conflict with GST rules but the
                    user's selection is never silently changed. */}
                <div>
                  <label className={labelClass} id="tax-mode-label">Tax Mode <span className="normal-case font-normal text-slate-400">(GST)</span></label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.taxMode === "IGST"}
                    aria-labelledby="tax-mode-label"
                    onClick={toggleTaxMode}
                    title="Inter-state supply: IGST at the full rate. Intra-state supply: CGST + SGST/UTGST split in half."
                    className={`w-full flex items-center justify-between gap-2 px-3 rounded-lg border bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/30 transition-all min-h-[44px] ${
                      taxValidation.level === "warning" ? "border-amber-400" : "border-slate-300"
                    }`}>
                    <span className="text-sm font-medium text-slate-700">IGST</span>
                    <span className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold ${form.taxMode === "IGST" ? "text-emerald-600" : "text-slate-500"}`}>
                        {form.taxMode === "IGST" ? "ON · IGST" : "OFF · CGST + SGST"}
                      </span>
                      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${form.taxMode === "IGST" ? "bg-emerald-500" : "bg-slate-300"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.taxMode === "IGST" ? "translate-x-4" : "translate-x-0.5"}`} />
                      </span>
                    </span>
                  </button>
                  <p className={`mt-1.5 text-[11px] leading-snug ${
                    taxValidation.level === "warning" ? "text-amber-600 font-medium"
                      : taxValidation.level === "info" ? "text-slate-500 italic" : "text-slate-500"
                  }`}>
                    {taxValidation.message || "Inter-state supplies use IGST; intra-state use CGST + SGST/UTGST."}
                  </p>
                </div>
              </div>
            </div>

            {/* References & Delivery */}
            {showReferencesCard && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Hash className="w-4 h-4 text-slate-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">References & Delivery</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {!isHidden("deliveryNote") && (
                <div>
                  <label className={labelClass}>{labelFor("deliveryNote", "Delivery Note")}</label>
                  <input type="text" name="deliveryNote" value={form.deliveryNote} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("deliveryNote"); } }}
                    placeholder={placeholderFor("deliveryNote")}
                    className={inputClass} />
                </div>
                )}
                {!isHidden("deliveryNoteDate") && (
                <div>
                  <label className={labelClass}>{labelFor("deliveryNoteDate", "Delivery Note Date")}</label>
                  <input type="date" name="deliveryNoteDate" value={form.deliveryNoteDate} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("deliveryNoteDate"); } }}
                    className={inputClass} />
                </div>
                )}
                <div>
                  <label className={labelClass}>{labelFor("referenceNumber", "Reference No")}</label>
                  <input type="text" name="referenceNumber" value={form.referenceNumber} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("referenceNumber"); } }}
                    placeholder={placeholderFor("referenceNumber")}
                    className={inputClass} />
                </div>
                {!isHidden("buyerOrderNumber") && (
                <div>
                  <label className={labelClass}>{labelFor("buyerOrderNumber", "Buyer's Order No.")}</label>
                  <input type="text" name="buyerOrderNumber" value={form.buyerOrderNumber} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("buyerOrderNumber"); } }}
                    placeholder={placeholderFor("buyerOrderNumber") || "e.g. PO-221"}
                    className={inputClass} />
                </div>
                )}
                {!isHidden("dispatchDocNumber") && (
                <div>
                  <label className={labelClass}>{labelFor("dispatchDocNumber", "Dispatch Doc No")}</label>
                  <input type="text" name="dispatchDocNumber" value={form.dispatchDocNumber} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("dispatchDocNumber"); } }}
                    placeholder={placeholderFor("dispatchDocNumber")}
                    className={inputClass} />
                </div>
                )}
                {!isHidden("dispatchedThrough") && (
                <div>
                  <label className={labelClass}>{labelFor("dispatchedThrough", "Dispatched Through")}</label>
                  <input type="text" name="dispatchedThrough" value={form.dispatchedThrough} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("dispatchedThrough"); } }}
                    placeholder={placeholderFor("dispatchedThrough")}
                    className={inputClass} />
                </div>
                )}
                {!isHidden("termsOfDelivery") && (
                <div>
                  <label className={labelClass}>{labelFor("termsOfDelivery", "Terms of Delivery")}</label>
                  <div className="relative">
                    <select name="termsOfDelivery" value={form.termsOfDelivery} onChange={handleFieldChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("termsOfDelivery"); } }}
                      className={selectClass}>
                      {DELIVERY_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                )}
                <div>
                  <label className={labelClass}>{labelFor("otherReferences", "Others / P.O No")}</label>
                  <input type="text" name="otherReferences" value={form.otherReferences} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("otherReferences"); } }}
                    placeholder={placeholderFor("otherReferences")}
                    className={inputClass} />
                </div>
              </div>
              {/* V29 industry-extended fields — only rendered for Rental &
                  Healthcare; reference/display data only, never in totals. */}
              {extendedFields.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    {industryConfig?.id === "HEALTHCARE" ? "Patient & Treatment Details" : "Rental Details"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {extendedFields.map((field) => (
                      <div key={field}>
                        <label className={labelClass}>{labelFor(field, EXTENDED_FALLBACK_LABELS[field] || field)}</label>
                        <input
                          type={isExtendedFieldType(field, "date") ? "date" : "text"}
                          name={field}
                          value={form[field] || ""}
                          onChange={handleFieldChange}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext(field); } }}
                          placeholder={placeholderFor(field)}
                          className={inputClass} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

            <div className="xl:sticky xl:top-6 space-y-4 side-fixed">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Discount</h3>
                <button onClick={() => {
                  const next = !discountEnabled;
                  setDiscountEnabled(next);
                  if (!next) setDiscountPercent("");
                }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${discountEnabled ? "bg-blue-500" : "bg-slate-300"}`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${discountEnabled ? "translate-x-6" : ""}`} />
                </button>
              </div>
              {discountEnabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="0"
                    className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 min-h-[44px]"
                  />
                  <span className="text-sm text-slate-600">%</span>
                  {discountVal > 0 && (
                    <span className="text-xs text-emerald-600 font-medium ml-auto">
                      -Rs. {(totals.subtotal * Math.min(discountVal, 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              )}
            </div>
            {sealEnabled && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Company Stamp</h3>
                <div className="space-y-2 md:space-y-0 md:flex md:items-center md:gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sealType"
                      value="round"
                      checked={sealType === "round"}
                      onChange={() => {
                        setSealType("round");
                        localStorage.setItem("seal_type", "round");
                      }}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-slate-700">Round Seal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sealType"
                      value="stamp"
                      checked={sealType === "stamp"}
                      onChange={() => {
                        setSealType("stamp");
                        localStorage.setItem("seal_type", "stamp");
                      }}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-slate-700">Rubber Stamp</span>
                  </label>
                </div>
              </div>
            )}
            <div className="hidden xl:block">
              {actionsCard}
            </div>
          </div>
        </div>

      {/* Construction billing mode */}
      {isConstruction && (
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
          </div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Billing Mode</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${billingMode === "COMPLETE_PROJECT" ? "border-blue-400 bg-blue-50/40" : "border-slate-200 hover:border-slate-300"}`}>
            <input type="radio" name="billingMode" value="COMPLETE_PROJECT" checked={billingMode === "COMPLETE_PROJECT"}
              onChange={() => {
                setBillingMode("COMPLETE_PROJECT");
                setProject((p) => ({
                  ...p,
                  name: p.name || items[0]?.itemName || "",
                  agreedAmount: p.agreedAmount || items[0]?.rate || "",
                }));
              }}
              className="mt-0.5 accent-blue-500" />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Complete Project Cost</span>
              <span className="block text-xs text-slate-500 mt-0.5">Bill one agreed project amount as a single line.</span>
            </span>
          </label>
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${billingMode === "ITEMIZED" ? "border-blue-400 bg-blue-50/40" : "border-slate-200 hover:border-slate-300"}`}>
            <input type="radio" name="billingMode" value="ITEMIZED" checked={billingMode === "ITEMIZED"}
              onChange={() => setBillingMode("ITEMIZED")}
              className="mt-0.5 accent-blue-500" />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Itemized Cost Breakdown</span>
              <span className="block text-xs text-slate-500 mt-0.5">Bill separate work / material / labour lines.</span>
            </span>
          </label>
        </div>
        {billingMode === "COMPLETE_PROJECT" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Project Name</label>
            <input type="text" value={project.name} name="projectName"
              onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
              className={inputClass} placeholder="e.g. Residential Building (G+1)" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Work Description</label>
            <input type="text" value={project.description} name="projectDescription"
              onChange={(e) => setProject((p) => ({ ...p, description: e.target.value }))}
              className={inputClass} placeholder="e.g. Complete civil work as per WO" />
          </div>
          <div>
            <label className={labelClass}>Agreed Project Amount (₹)</label>
            <input type="number" step="0.01" min="0" value={project.agreedAmount} name="projectAmount"
              onChange={(e) => setProject((p) => ({ ...p, agreedAmount: e.target.value }))}
              className={inputClass} placeholder="e.g. 450000" />
          </div>
          <div>
            <label className={labelClass}>{labelFor("deliveryNote", "Work Order No.")}</label>
            <input type="text" value={project.workOrder} name="projectWorkOrder"
              onChange={(e) => setProject((p) => ({ ...p, workOrder: e.target.value }))}
              className={inputClass} placeholder={placeholderFor("deliveryNote") || "e.g. WO-2026-14"} />
          </div>
          <div>
            <label className={labelClass}>{labelFor("destination", "Site / Work Location")}</label>
            <input type="text" value={project.siteAddress} name="projectSite"
              onChange={(e) => setProject((p) => ({ ...p, siteAddress: e.target.value }))}
              className={inputClass} placeholder={placeholderFor("destination") || "e.g. Plot 12, Whitefield, Bengaluru"} />
          </div>
          <div>
            <label className={labelClass}>Work Period</label>
            <input type="text" value={project.workPeriod} name="projectWorkPeriod"
              onChange={(e) => setProject((p) => ({ ...p, workPeriod: e.target.value }))}
              className={inputClass} placeholder="e.g. Jan 2026 – Mar 2026" />
          </div>
          <p className="sm:col-span-2 lg:col-span-3 text-xs text-slate-400">
            Project name and description become the invoice line description; the agreed amount becomes its rate.
            GST, HSN/SAC and unit stay editable on the line below.
          </p>
        </div>
        )}
      </div>
      )}

      {/* Items — full width below the two-column grid, inside max-w container */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 my-6">
          <div className="flex items-center justify-between mb-4 sm:mb-5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-slate-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Items</h2>
            </div>
            <button onClick={addItem}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all shadow-sm min-h-[44px]">
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block border border-slate-200 rounded-lg w-full overflow-x-auto">
            <table className="w-full min-w-[1260px] text-sm border-collapse" style={{ tableLayout: "auto" }}>
              <colgroup>
                <col style={{ width: "2.5%" }} />
                <col style={{ width: showHnSac ? "13%" : "0%" }} />
                <col style={{ width: showHnSac ? "20%" : "33%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "4.5%" }} />
                <col style={{ width: "12.5%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "13.5%" }} />
                <col style={{ width: "2.5%" }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-800">
                  <th className="text-white text-xs font-semibold py-3.5 px-2 text-center whitespace-nowrap w-[36px] min-w-[36px]">#</th>
                  {showHnSac && <th className="text-white text-xs font-semibold py-3.5 px-2 text-left whitespace-nowrap min-w-[120px]">HSN/SAC</th>}
                  <th className="text-white text-xs font-semibold py-3.5 px-2 text-left whitespace-nowrap min-w-[180px]">{labelFor("itemName", "Description")}</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-2 text-center whitespace-nowrap min-w-[140px]">Qty</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-2 text-center whitespace-nowrap min-w-[95px]">Rate</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-1 text-center whitespace-nowrap min-w-[65px]">GST %</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-right whitespace-nowrap min-w-[160px]">Taxable</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-right whitespace-nowrap min-w-[145px]">Tax</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-right whitespace-nowrap min-w-[170px]">Total</th>
                  <th className="text-white py-3.5 px-1 w-[45px] min-w-[45px]"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <ItemRow key={item.id ?? idx} item={item} calc={totals.perItem[idx]} idx={idx} onItemChange={handleItemChange} onRemove={removeItem} onAdd={addItem} onHsnLookup={handleHsnLookup} showHnSac={showHnSac} locked={isConstruction && billingMode === "COMPLETE_PROJECT"} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {items.map((item, idx) => (
              <ItemCard key={item.id ?? idx} item={item} calc={totals.perItem[idx]} idx={idx} onItemChange={handleItemChange} onRemove={removeItem} onAdd={addItem} onHsnLookup={handleHsnLookup} descLabel={labelFor("itemName", "Description")} showHnSac={showHnSac} locked={isConstruction && billingMode === "COMPLETE_PROJECT"} />
            ))}
            <button onClick={addItem}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-all shadow-lg min-h-[48px]">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 flex justify-end">
            <div className="w-full sm:w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal:</span>
                <span className="font-mono font-medium text-slate-700">Rs. {totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tax Amount:</span>
                <span className="font-mono font-medium text-slate-700">Rs. {totals.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t-2 border-slate-800">
                <span className="text-slate-800">Grand Total:</span>
                <span className="font-mono text-slate-800">Rs. {totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
      </div>

      {/* Actions — mobile/tablet only, after Items and before Notes */}
      <div className="xl:hidden w-full my-6">
        {actionsCard}
      </div>

      {/* Notes — full width below Items */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-sm font-bold text-slate-800 mb-3">Notes</h2>
        <textarea name="notes" value={form.notes} onChange={handleFieldChange}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("notes"); } }}
          rows={2} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 resize-none"
          placeholder="Additional notes or remarks..." />
      </div>
      </div>
    </div>
  );
}
