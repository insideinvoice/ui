import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { invoiceAPI, customerAPI, businessAPI, productAPI, deliveryChallanAPI } from "../api/auth";
import toast from "react-hot-toast";
import {
  ArrowLeft, Plus, Trash2, Save, FileText, Download,
  User, Building2, Phone, MapPin, Hash,
  Package, FileSpreadsheet, Share2, Info, X, ChevronDown, Truck
} from "lucide-react";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import { renderDeliveryChallanPdf } from "../components/DeliveryChallanDownload";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { processQueue } from "../utils/retryQueue";
import { processPrint } from "../utils/printInvoice";
import { buildInvoiceWhatsAppMessage, openWhatsAppChat } from "../utils/whatsapp";
import { getPrintSettings, getInvoiceTemplate } from "../constants/paperSizes";
import { computeInvoiceTotals, round2 } from "../utils/invoiceTotals";
import { formatInvoiceNumber } from "../utils/invoiceConvention";
import { INDIAN_STATES, DELIVERY_TERMS, PAYMENT_TERMS } from "../constants/indianStates";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
const emptyItem = { itemName: "", hsn: "", qty: "", rate: "", gstPercentage: "18", taxableValue: 0, taxAmount: 0, total: 0 };
const inputClass = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white transition-all min-h-[44px]";
const selectClass = "w-full pl-3 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white transition-all min-h-[44px] appearance-none cursor-pointer text-slate-800 font-normal";
const labelClass = "block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase";

const FOCUS_ORDER = ["phone", "name", "email", "gstIn", "billingAddress", "invoiceType", "invoiceDate", "dueDate", "placeOfSupply", "destination", "paymentTerms", "paymentMode", "deliveryNote", "deliveryNoteDate", "referenceNumber", "dispatchDocNumber", "dispatchedThrough", "termsOfDelivery", "otherReferences", "notes"];

const focusNext = (currentName) => {
  const i = FOCUS_ORDER.indexOf(currentName);
  if (i === -1 || i === FOCUS_ORDER.length - 1) return;
  const next = document.querySelector(`[name="${FOCUS_ORDER[i + 1]}"], select[name="${FOCUS_ORDER[i + 1]}"]`);
  next?.focus();
};

const FOCUS_FIELDS = ["hsn", "desc", "qty", "rate", "gst"];

const ItemRow = memo(({ item, calc, idx, onItemChange, onRemove, onAdd, onHsnLookup }) => {
  const handleKeyDown = (e, field) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onAdd();
      setTimeout(() => {
        const next = document.querySelector('input[name="hsn-1"]');
        next?.focus();
      }, 50);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const fieldIndex = FOCUS_FIELDS.indexOf(field);
      if (fieldIndex === FOCUS_FIELDS.length - 1) {
        onAdd();
        setTimeout(() => {
          const next = document.querySelector(`input[name="hsn-${idx + 2}"]`);
          next?.focus();
        }, 50);
      } else {
        const nextField = FOCUS_FIELDS[fieldIndex + 1];
        const next = document.querySelector(`input[name="${nextField}-${idx + 1}"]`);
        next?.focus();
      }
    }
  };

  return (
  <tr className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/20 transition-colors`}>
    <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs border-b border-slate-100">{idx + 1}</td>
    <td className="py-3 px-3 border-b border-slate-100">
      <div className="relative">
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
          className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono pr-8"
          placeholder="Scan or type" />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300" title="Barcode scannable">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5V3h4v2H5v2H3V5zm14 0V3h4v2h-2v2h-2V5zM3 19v-2h2v-2h2v4H3zm14 0v-2h2v-2h2v4h-4zM7 7h1v10H7V7zm3 0h1v10h-1V7zm3 0h1v10h-1V7zm3 0h1v10h-1V7z"/></svg>
        </span>
      </div>
    </td>
    <td className="py-3 px-3 border-b border-slate-100">
      <input type="text" value={item.itemName} name={`desc-${idx + 1}`}
        onChange={(e) => onItemChange(idx, "itemName", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "desc")}
        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white"
        placeholder="Item name" />
    </td>
    <td className="py-3 px-3 border-b border-slate-100">
      <input type="number" step="1" min="0" value={item.qty} name={`qty-${idx + 1}`}
        onChange={(e) => onItemChange(idx, "qty", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "qty")}
        className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
    </td>
    <td className="py-3 px-3 border-b border-slate-100">
      <input type="number" step="0.01" min="0" value={item.rate} name={`rate-${idx + 1}`}
        onChange={(e) => onItemChange(idx, "rate", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "rate")}
        className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
    </td>
    <td className="py-3 px-3 border-b border-slate-100">
      <div className="relative">
        <input type="number" step="0.01" min="0" max="40" value={item.gstPercentage} name={`gst-${idx + 1}`}
          onChange={(e) => onItemChange(idx, "gstPercentage", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "gst")}
          className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono pr-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
      </div>
    </td>
    <td className="py-3 px-3 text-right font-mono text-sm text-slate-700 border-b border-slate-100 truncate">
      {((calc?.taxable ?? parseFloat(item.taxableValue)) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
    </td>
    <td className="py-3 px-3 text-right font-mono text-sm text-slate-600 border-b border-slate-100 truncate">
      {((calc?.tax ?? parseFloat(item.taxAmount)) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
    </td>
    <td className="py-3 px-3 text-right font-mono text-sm font-semibold text-slate-900 border-b border-slate-100 truncate">
      {((calc?.total ?? parseFloat(item.total)) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
    </td>
    <td className="py-3 px-2 text-center border-b border-slate-100">
      <button onClick={() => onRemove(idx)}
        className="p-1.5 hover:bg-red-50 rounded transition-colors text-slate-400 hover:text-red-500">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </td>
  </tr>
  );
});

const ItemCard = memo(({ item, calc, idx, onItemChange, onRemove, onAdd, onHsnLookup }) => {
  const handleKeyDown = (e, field) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onAdd();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const fieldIndex = FOCUS_FIELDS.indexOf(field);
      if (fieldIndex === FOCUS_FIELDS.length - 1) {
        onAdd();
      } else {
        const nextField = FOCUS_FIELDS[fieldIndex + 1];
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
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Description</label>
          <input type="text" value={item.itemName} data-mobile-field={`desc-${idx}`}
            onChange={(e) => onItemChange(idx, "itemName", e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, "desc")}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white min-h-[44px]" placeholder="Item name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Qty</label>
            <input type="number" step="1" min="0" value={item.qty} data-mobile-field={`qty-${idx}`}
              onChange={(e) => onItemChange(idx, "qty", e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "qty")}
              inputMode="numeric"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono min-h-[44px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Rate</label>
            <input type="number" step="0.01" min="0" value={item.rate} data-mobile-field={`rate-${idx}`}
              onChange={(e) => onItemChange(idx, "rate", e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "rate")}
              inputMode="decimal"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono min-h-[44px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
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
  const { logout } = useAuth();
  const navigate = useNavigate();
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
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState("");
  const ghostMode = localStorage.getItem("ghost_mode") === "true";
  const [sealType, setSealType] = useState(localStorage.getItem("seal_type") || "");
  const sealEnabled = localStorage.getItem("show_seal") === "true";
  const sealRequired = sealEnabled && !sealType;
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [emailOnSave, setEmailOnSave] = useState(false);
  const [showPrefillBanner, setShowPrefillBanner] = useState(!!prefilledData);
  const discountVal = parseFloat(discountPercent) || 0;
  const invoiceRef = useRef(null);
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
    otherReferences: "",
    destination: "Karnataka",
    notes: "",
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

  const nextInvoiceNumber = business
    ? formatInvoiceNumber(business.invoicePrefix, business.nextInvoiceSequence ?? 1)
    : "";

  useEffect(() => {
    if (business && ghostMode && !customInvoiceNumber) {
      setCustomInvoiceNumber(nextInvoiceNumber);
    }
  }, [business]);

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

  const totals = useMemo(() => computeInvoiceTotals(items, discountEnabled ? discountPercent : "0"), [items, discountEnabled, discountPercent]);

  const validItemsCount = useMemo(
    () => items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0).length,
    [items]
  );

  // localStorage read + JSON.parse + structuredClone — done once per invoice
  // type instead of on every render of the hidden capture document.
  const effectiveType = captureType || form.invoiceType;
  const previewPaperSize = useMemo(() => (getPrintSettings()[effectiveType] || {}).paperSize || "A4_PORTRAIT", [effectiveType]);
  const previewTemplate = useMemo(() => getInvoiceTemplate(effectiveType), [effectiveType]);

  const validate = () => {
    if (!customer.name.trim()) { toast.error("Customer name is required"); return false; }
    if (!form.dueDate) { toast.error("Due date is required"); return false; }
    if (!form.invoiceDate) { toast.error("Invoice date is required"); return false; }
    const validItems = items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0);
    if (validItems.length === 0) { toast.error("Add at least one item"); return false; }
    return true;
  };

  const buildPayload = (customerId) => ({
    customerId,
    invoiceType: form.invoiceType,
    invoiceDate: form.invoiceDate,
    dueDate: form.dueDate,
    placeOfSupply: form.placeOfSupply || undefined,
    paymentTerms: form.paymentTerms || undefined,
    paymentMode: form.paymentMode || undefined,
    notes: form.notes || undefined,
    deliveryNote: form.deliveryNote || undefined,
    deliveryNoteDate: form.deliveryNoteDate || undefined,
    referenceNumber: form.referenceNumber || undefined,
    buyerOrderNumber: form.otherReferences || undefined,
    dispatchDocNumber: form.dispatchDocNumber || undefined,
    dispatchedThrough: form.dispatchedThrough || undefined,
    termsOfDelivery: form.termsOfDelivery || undefined,
    otherReferences: form.otherReferences || undefined,
    destination: form.destination || undefined,
    ...(ghostMode && customInvoiceNumber.trim() ? { invoiceNumber: customInvoiceNumber.trim() } : {}),
    discountPercent: discountEnabled ? parseFloat(discountPercent) || 0 : 0,
    items: items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0).map((i, idx) => ({
      sno: idx + 1, itemName: i.itemName, hsn: i.hsn || undefined,
      qty: Math.floor(parseFloat(i.qty)) || 0, rate: parseFloat(i.rate), gstPercentage: parseFloat(i.gstPercentage) || 0,
    })),
  });

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
      res = await invoiceAPI.update(savedInvoiceId, { ...buildPayload(customerId), status: "DRAFT" });
    } else {
      res = await invoiceAPI.create(buildPayload(customerId));
    }
    setSavedInvoiceId(res.data.data.id);
    setSavedInvoiceNumber(res.data.data.invoiceNumber);
    if (emailOnSave) {
      try {
        await invoiceAPI.sendInvoiceEmail(res.data.data.id, window.location.origin);
        toast.success(`Invoice emailed to ${customer.email}`);
        setEmailOnSave(false);
      } catch (err) {
        toast.error(err.response?.data?.message || "Could not send the invoice email");
      }
    }
    businessAPI.getProfile().then((bRes) => setBusiness(bRes.data.data)).catch(() => {});
    return res;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveInvoice();
      toast.success(`Invoice ${res.data.data.invoiceNumber} ${savedInvoiceId ? "updated" : "created"} successfully`);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.details?.[0]?.msg || "Failed to save invoice";
      toast.error(msg);
    } finally {
      setSaving(false);
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
      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://insideinvoice.com";
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
      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://insideinvoice.com";
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

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
        <Spinner size={32} />
      </div>
    );
  }

  const actionsCard = (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-6">
      <h2 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">Actions</h2>
      <div className="space-y-3">
        {/* Row 1: Save + Share + WhatsApp — equal width */}
        <div className="flex items-stretch gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm min-h-[44px]">
            {saving ? <Spinner size={16} className="text-white shrink-0" /> : <Save className="w-4 h-4 shrink-0" />}
            <span className="truncate">{saving ? "Saving..." : "Save"}</span>
          </button>

          <span className="relative group flex-1 flex">
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              Share Invoice Link
            </span>
            <button onClick={handleShare} aria-label="Share invoice link"
              disabled={linkSharing || sealRequired || totals.grandTotal <= 0}
              className="w-full flex items-center justify-center px-2 py-2.5 bg-white text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm min-h-[44px]">
              {linkSharing ? <Spinner size={16} /> : <Share2 className="w-4 h-4" />}
            </button>
          </span>

          <span className="relative group flex-1 flex">
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              Share on WhatsApp
            </span>
            <button type="button" onClick={shareViaWhatsApp}
              aria-label="Share on WhatsApp"
              disabled={sharing || sealRequired || totals.grandTotal <= 0}
              className="w-full flex items-center justify-center px-2 py-2.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5b] disabled:opacity-50 transition-all shadow-sm min-h-[44px]">
              {sharing ? <Spinner size={18} /> : <WhatsAppIcon className="w-5 h-5" />}
            </button>
          </span>
        </div>

        {/* Row 2: Delivery Challan + Proforma */}
        <div className="flex items-stretch gap-2">
          <button onClick={generateDeliveryChallanPdf}
            disabled={saving || !customer.name?.trim() || !(items || []).some((i) => (i.itemName || "").trim() && parseFloat(i.qty) > 0)}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-all shadow-sm min-h-[44px] whitespace-nowrap">
            <Truck className="w-4 h-4 shrink-0" /> Delivery
          </button>
          <button onClick={() => generatePDF("PROFORMA_INVOICE")} disabled={saving || sealRequired || totals.grandTotal <= 0}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm min-h-[44px] whitespace-nowrap">
            <Download className="w-4 h-4 shrink-0" /> Proforma
          </button>
        </div>

        {/* Row 3: Tax Invoice — full row */}
        <button onClick={() => generatePDF("TAX_INVOICE")} disabled={saving || sealRequired || totals.grandTotal <= 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm min-h-[44px]">
          <Download className="w-4 h-4" /> Tax Invoice PDF
        </button>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Items:</span>
            <span className="font-semibold text-slate-800">{validItemsCount}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Subtotal:</span>
            <span className="font-mono text-slate-700">Rs. {totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          {discountEnabled && discountVal > 0 && (
            <div className="flex justify-between gap-3 text-emerald-600">
              <span>Discount ({discountVal}%):</span>
              <span className="font-mono">-Rs. {totals.discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-slate-500 whitespace-nowrap">Taxable Amount:</span>
            <span className="font-mono text-slate-700">Rs. {totals.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Tax:</span>
            <span className="font-mono text-slate-700">Rs. {totals.taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between gap-3 font-bold text-slate-800 pt-2 border-t border-slate-200">
            <span>Total:</span>
            <span className="font-mono">Rs. {totals.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {business && (
        <div className="mt-6 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Business</h3>
          <p className="text-xs text-slate-600 font-medium">{business.businessName}</p>
          {business.phone && <p className="text-xs text-slate-400">Phone: {business.phone}</p>}
          {business.email && <p className="text-xs text-slate-400">Email: {business.email}</p>}
          {business.addressLine1 && <p className="text-xs text-slate-400">{business.addressLine1}{business.city ? `, ${business.city}` : ""}{business.state ? `, ${business.state}` : ""}{business.pincode ? ` - ${business.pincode}` : ""}</p>}
          {business.gstIn && <p className="text-xs text-slate-400 font-mono">GST: {business.gstIn}</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
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
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
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
                <div>
                  <label className={labelClass}>Type</label>
                  <div className="relative">
                    <select name="invoiceType" value={form.invoiceType} onChange={handleFieldChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("invoiceType"); } }}
                      className={selectClass}>
                      <option value="TAX_INVOICE">Tax Invoice</option>
                      <option value="PROFORMA_INVOICE">Proforma Invoice</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
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
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Destination</label>
                  <div className="relative">
                    <select name="destination" value={form.destination} onChange={handleFieldChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("destination"); } }}
                      className={selectClass}>
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
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
              </div>
            </div>

            {/* References & Delivery */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Hash className="w-4 h-4 text-slate-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">References & Delivery</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>Delivery Note</label>
                  <input type="text" name="deliveryNote" value={form.deliveryNote} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("deliveryNote"); } }}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Delivery Note Date</label>
                  <input type="date" name="deliveryNoteDate" value={form.deliveryNoteDate} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("deliveryNoteDate"); } }}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Reference No</label>
                  <input type="text" name="referenceNumber" value={form.referenceNumber} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("referenceNumber"); } }}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Dispatch Doc No</label>
                  <input type="text" name="dispatchDocNumber" value={form.dispatchDocNumber} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("dispatchDocNumber"); } }}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Dispatched Through</label>
                  <input type="text" name="dispatchedThrough" value={form.dispatchedThrough} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("dispatchedThrough"); } }}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Terms of Delivery</label>
                  <div className="relative">
                    <select name="termsOfDelivery" value={form.termsOfDelivery} onChange={handleFieldChange}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("termsOfDelivery"); } }}
                      className={selectClass}>
                      {DELIVERY_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Other References / P.O No</label>
                  <input type="text" name="otherReferences" value={form.otherReferences} onChange={handleFieldChange}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext("otherReferences"); } }}
                    className={inputClass} />
              </div>
            </div>
          </div>
          </div>

          <div className="xl:sticky xl:top-6 space-y-4">
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</h3>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailOnSave}
                  aria-label="Email the invoice to the customer on save"
                  onClick={() => setEmailOnSave((v) => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${emailOnSave ? "bg-blue-500" : "bg-slate-300"}`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${emailOnSave ? "translate-x-6" : ""}`} />
                </button>
              </div>
              {emailOnSave && (
                <p className={`text-xs leading-relaxed ${customer.email ? "text-slate-500" : "text-amber-600"}`}>
                  {customer.email ? (
                    <>The customer will receive this invoice with a view-only link at <span className="font-medium text-slate-700">{customer.email}</span>.</>
                  ) : (
                    <>This customer has no email address yet — add one to send the invoice.</>
                  )}
                </p>
              )}
            </div>
            {sealEnabled && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Company Stamp</h3>
                <div className="space-y-2">
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
            <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "3%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "21%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "4%" }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-800">
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-center">#</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-left">HSN/SAC</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-left">Description</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-center">Qty</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-center">Rate</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-center">GST %</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-right">Taxable</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-right">Tax</th>
                  <th className="text-white text-xs font-semibold py-3.5 px-3 text-right">Total</th>
                  <th className="text-white"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <ItemRow key={item.id ?? idx} item={item} calc={totals.perItem[idx]} idx={idx} onItemChange={handleItemChange} onRemove={removeItem} onAdd={addItem} onHsnLookup={handleHsnLookup} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {items.map((item, idx) => (
              <ItemCard key={item.id ?? idx} item={item} calc={totals.perItem[idx]} idx={idx} onItemChange={handleItemChange} onRemove={removeItem} onAdd={addItem} onHsnLookup={handleHsnLookup} />
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
