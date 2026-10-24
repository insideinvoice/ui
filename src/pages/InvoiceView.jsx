import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import Spinner from "../components/Spinner";
import PageHeader from "../components/PageHeader";
import { invoiceAPI, businessAPI, customerAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, Download, Save, Edit3, Plus, Trash2, FileText, AlertCircle, User, Building2, Phone, MapPin, Hash, Package, Mail, Globe, X, Share2, Smartphone, Link2, Copy, RotateCw, Unlink, ChevronDown, MessageSquare } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import TermsCard from "../components/TermsCard";
import DocZoomSurface from "../components/DocZoomSurface";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { processQueue } from "../utils/retryQueue";
import { invalidateBusinessProfile } from "../utils/businessProfile";
import { processPrint } from "../utils/printInvoice";
import { buildInvoiceWhatsAppMessage, openWhatsAppChat, createInvoicePdfFile, probeFileShare, prefetchInvoicePdf } from "../utils/whatsapp";
import { shareLinkToUser, proformaShareUrl, readCachedShareToken, writeCachedShareToken, clearCachedShareToken } from "../utils/shareLink";
import { getPrintSettings, getInvoiceTemplate } from "../constants/paperSizes";
import { computeInvoiceTotals, round2 } from "../utils/invoiceTotals";
import { resolveTaxMode, validateTaxMode } from "../utils/taxMode";
import { goBack } from "../utils/navigation";
import { INDIAN_STATES, DELIVERY_TERMS, PAYMENT_TERMS } from "../constants/indianStates";
import { UNITS } from "../constants/units";
import { getIndustryConfig, isFieldHidden, fieldLabel, getExtendedFields, isExtendedFieldType, ALL_EXTENDED_FIELDS } from "../constants/industryConfig";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
const emptyItem = () => ({ id: uid(), itemName: "", hsn: "", unit: "", qty: "1", rate: "", gstPercentage: "18", taxableValue: "0", taxAmount: "0", total: "0" });
// Serialized snapshot of everything the Save button persists (invoice fields,
// line items, discount). Save/Cancel stay disabled until the live state
// diverges from the last-saved baseline.
const serializeEditableState = (form, items, discountEnabled, discountPercent) => JSON.stringify({
  form,
  items,
  discountEnabled,
  discountPercent: discountEnabled ? String(parseFloat(discountPercent) || 0) : "",
});
const fmt = (v) => parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
// Screen (CSS px) width of each paper — mirrors InvoiceTemplateRenderer's map;
// sizes the zoomable document inside DocZoomSurface (the PDF modal).
const PAPER_WIDTH_PX = { A4_PORTRAIT: 794, A4_LANDSCAPE: 1123, A5: 559, LETTER: 816 };

const inputClass = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400";
const selectClass = "w-full pl-3 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white appearance-none cursor-pointer text-slate-800";
const labelClass = "block text-xs font-semibold text-slate-600 mb-1.5";

// Declared at module scope so React keeps the same component type across renders
// (an inner declaration remounts every row on each parent render).
const InfoRow = memo(({ label, value }) => value ? <p className="text-sm text-slate-600"><span className="text-slate-400">{label}:</span> {value}</p> : null);

const ViewItemRow = memo(({ item, calc, idx, isEditing, onItemChange, onRemove, onAdd, showHnSac = true }) => (
  <tr className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} ${isEditing ? "hover:bg-blue-50/20" : ""} transition-colors`}>
    <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs border-b border-slate-100">{idx + 1}</td>
    {isEditing ? (
      <>
        <td className="py-3 px-3 border-b border-slate-100">
          <input type="text" value={item.itemName} name={`desc-${idx + 1}`}
            onChange={(e) => onItemChange(idx, "itemName", e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const next = document.querySelector(`input[name="${showHnSac ? "hsn" : "qty"}-${idx + 1}"]`); next?.focus(); } }}
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white" placeholder="Item name" />
        </td>
        {showHnSac && (
        <td className="py-3 px-3 border-b border-slate-100">
          <input type="text" value={item.hsn} name={`hsn-${idx + 1}`}
            onChange={(e) => onItemChange(idx, "hsn", e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const qty = document.querySelector(`input[name="qty-${idx + 1}"]`); qty?.focus(); } }}
            className="w-full max-w-[80px] px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono" placeholder="Scan or type" />
        </td>
        )}
        <td className="py-3 px-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <input type="number" step="0.01" min="0" value={item.qty} name={`qty-${idx + 1}`}
              onChange={(e) => onItemChange(idx, "qty", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const rate = document.querySelector(`input[name="rate-${idx + 1}"]`); rate?.focus(); } }}
              inputMode="decimal"
              size={10}
              className="w-28 px-3 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <select value={item.unit || ""} name={`unit-${idx + 1}`}
              onChange={(e) => onItemChange(idx, "unit", e.target.value)}
              title="Unit of measurement"
              className="shrink-0 w-[88px] px-1.5 py-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white text-slate-600">
              {UNITS.map((u) => (
                <option key={u} value={u}>{u === "" ? "No unit" : u}</option>
              ))}
            </select>
          </div>
        </td>
        <td className="py-3 px-3 border-b border-slate-100">
          <input type="number" step="0.01" min="0" value={item.rate} name={`rate-${idx + 1}`}
            onChange={(e) => onItemChange(idx, "rate", e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const gst = document.querySelector(`input[name="gst-${idx + 1}"]`); gst?.focus(); } }}
            inputMode="decimal"
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        </td>
        <td className="py-3 px-3 border-b border-slate-100">
          <div className="relative">
            <input type="number" step="0.01" min="0" max="100" value={item.gstPercentage} name={`gst-${idx + 1}`}
              onChange={(e) => onItemChange(idx, "gstPercentage", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
              inputMode="decimal"
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono pr-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
          </div>
        </td>
      </>
    ) : (
      <>
        <td className="py-3 px-3 text-slate-800 border-b border-slate-100 truncate">{item.itemName}</td>
        {showHnSac && (
        <td className="py-3 px-3 text-center font-mono text-xs text-slate-500 border-b border-slate-100 whitespace-nowrap">{item.hsn || "-"}</td>
        )}
        <td className="py-3 px-3 text-center font-mono text-sm text-slate-700 border-b border-slate-100 whitespace-nowrap">{item.qty}</td>
        <td className="py-3 px-3 text-center font-mono text-sm text-slate-700 border-b border-slate-100 whitespace-nowrap">{fmt(item.rate)}</td>
        <td className="py-3 px-3 text-center font-mono text-sm text-slate-600 border-b border-slate-100 whitespace-nowrap">{item.gstPercentage}%</td>
      </>
    )}
    <td className={`py-3 px-3 text-right font-mono text-sm border-b border-slate-100 whitespace-nowrap ${isEditing ? "text-slate-700" : "text-slate-700"}`}>
      {fmt(calc?.taxable ?? item.taxableValue)}
    </td>
    <td className={`py-3 px-3 text-right font-mono text-sm border-b border-slate-100 whitespace-nowrap ${isEditing ? "text-slate-600" : "text-slate-600"}`}>
      {fmt(calc?.tax ?? item.taxAmount)}
    </td>
    <td className={`py-3 px-3 text-right font-mono text-sm font-semibold border-b border-slate-100 whitespace-nowrap ${isEditing ? "text-slate-900" : "text-slate-900"}`}>
      {fmt(calc?.total ?? item.total)}
    </td>
    {isEditing && (
      <td className="py-3 px-2 text-center border-b border-slate-100">
        <button type="button" onClick={() => onRemove(idx)} aria-label={`Remove item ${idx + 1}`}
          className="p-1.5 hover:bg-red-50 rounded transition-colors text-slate-400 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    )}
  </tr>
));

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [invoiceType, setInvoiceType] = useState("TAX_INVOICE");
  const invoiceRef = useRef(null);
  const proformaRef = useRef(null);
  // Dual-pane wheel routing (xl) — the hover state lives in a ref, the two
  // column elements in refs the effect binds listeners to.
  const leftPaneRef = useRef(null);
  const rightPaneRef = useRef(null);
  const hoveredPaneRef = useRef(null);
  // The hidden A4 documents are only mounted while a PDF/print/share action is
  // running — keeping them permanently mounted meant every keystroke and every
  // busy-flag toggle re-rendered two full invoice documents.
  const [captureType, setCaptureType] = useState(null);
  // With the company seal enabled and no stored choice, default to the ROUND
  // seal (the same fallback resolveSeal and the delivery-challan flow use) so
  // the round seal is pre-selected instead of leaving the pick blank.
  const [sealType, setSealType] = useState(localStorage.getItem("seal_type") || "round");
  const ghostMode = localStorage.getItem("ghost_mode") === "true";
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountDirty, setDiscountDirty] = useState(false);
  // Baseline for the Save/Cancel enable check: the editable state exactly as
  // last loaded/saved. Null until the invoice finishes loading.
  const [savedBaseline, setSavedBaseline] = useState(null);
  const discountVal = parseFloat(discountPercent) || 0;
  const [business, setBusiness] = useState(null);
  // NOTE: these must come after `business` is declared — reading `business` from
  // an earlier line would hit the temporal dead zone and crash the component.
  // The business profile is the source of truth (it is what the public share
  // page and the emailed PDF use). localStorage stays as the immediate value
  // for the logged-in app and as a fallback before the profile loads.
  const sealEnabled =
    typeof business?.sealEnabled === "boolean" ? business.sealEnabled : localStorage.getItem("show_seal") === "true";
  const sealRequired = sealEnabled && !sealType;
  // Choosing a seal type updates the on-screen preview instantly (local state),
  // keeps localStorage for the logged-in app, and persists to the business
  // profile so the emailed PDF and the public share page match it.
  const chooseSealType = useCallback((type) => {
    setSealType(type);
    localStorage.setItem("seal_type", type);
    setBusiness((b) => (b ? { ...b, sealType: type } : b));
    businessAPI
      .update({ sealType: type })
      .then(() => invalidateBusinessProfile())
      .catch(() => {});
  }, []);
  const industryConfig = useMemo(
    () => business?.industryConfig || getIndustryConfig(business?.industry),
    [business?.industry, business?.industryConfig]
  );
  const isHidden = (field) => isFieldHidden(industryConfig, field);
  const labelFor = (field, fallback) => fieldLabel(industryConfig, field, fallback);
  // V29 extended fields the current industry exposes (empty for all others).
  const extendedFields = useMemo(
    () => getExtendedFields(business?.industry || industryConfig?.id),
    [business?.industry, industryConfig?.id]
  );
  // Display-only HSN/SAC switch; missing/legacy business data keeps the column on.
  const showHnSac = !business || business.showHnSac !== false;
  const isConstruction = business?.industry === "CONSTRUCTION";
  const [form, setForm] = useState({
    customerId: null, customerName: "", customerEmail: "", customerPhone: "", billingAddress: "", customerGstIn: "",
    invoiceDate: "", dueDate: "", placeOfSupply: "", destination: "", termsOfDelivery: "",
    paymentTerms: "", paymentMode: "CASH", deliveryNote: "", otherReferences: "", notes: "", invoiceNumber: "",
    // GST structure — replaced by the stored selection (or the legal
    // heuristic for legacy invoices) once the invoice loads.
    taxMode: "CGST_SGST",
    deliveryNoteDate: "", referenceNumber: "", buyerOrderNumber: "",
    dispatchDocNumber: "", dispatchedThrough: "", invoiceType: "TAX_INVOICE", status: "DRAFT",
    agreementNumber: "", assetNumber: "", serialNumber: "", vehicleNumber: "",
    periodStart: "", periodEnd: "", billingPeriodStart: "", billingPeriodEnd: "",
    expectedReturnDate: "", depositReference: "", patientReference: "", serviceDate: "",
    treatmentReference: "", referringDoctor: "",
  });
  const [items, setItems] = useState([{ ...emptyItem() }]);
  // Last-saved BILL TO values. Saving an invoice only sends invoice fields, so the
  // buyer block is persisted separately through the customer record; without this
  // snapshot there is no way to tell whether it actually changed.
  const buyerSnapshotRef = useRef(null);
  // No pdfPreviewUrl blob state any more: the modal renders the LIVE document
  // inside DocZoomSurface (opens instantly); Download uses the capture flow.
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Public share link: created lazily on the first explicit user action, so invoices
  // are private by default and never become link-accessible without consent.
  const [shareToken, setShareToken] = useState(null);
  const [shareBusy, setShareBusy] = useState("");
  const shareUrl = shareToken ? `${window.location.origin}/i/${shareToken}` : "";

  const copyShareUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.success("Share link ready — copy it from the field");
    }
  };

  const handleShareLink = async (action) => {
    if (shareBusy) return;
    setShareBusy(action);
    try {
      if (action === "create") {
        const res = await invoiceAPI.createShare(id);
        const token = res.data?.data?.token;
        if (!token) throw new Error("no token");
        setShareToken(token);
        await copyShareUrl(`${window.location.origin}/i/${token}`);
      } else if (action === "regenerate") {
        const res = await invoiceAPI.regenerateShare(id);
        const token = res.data?.data?.token;
        if (!token) throw new Error("no token");
        setShareToken(token);
        writeCachedShareToken(id, token);
        await copyShareUrl(`${window.location.origin}/i/${token}`);
        toast("Previous link disabled — only the new one works");
      } else if (action === "revoke") {
        await invoiceAPI.revokeShare(id);
        setShareToken(null);
        clearCachedShareToken(id);
        toast.success("Share link revoked — it no longer resolves");
      }
    } catch (err) {
      if (err?.response?.status === 404) toast.error("Invoice not found");
      else toast.error("Could not update the share link");
    } finally {
      setShareBusy("");
    }
  };

  // ---------- YouTube-style share sheet ----------
  const [showShareSheet, setShowShareSheet] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const ensureShareToken = async () => {
    if (shareToken) return shareToken;
    // A token from an earlier explicit share on this device: reuse it so the
    // NEXT share tap needs no network round-trip (and stays in the gesture).
    const cached = readCachedShareToken(id);
    if (cached) {
      setShareToken(cached);
      return cached;
    }
    const res = await invoiceAPI.createShare(id);
    const token = res.data?.data?.token;
    if (!token) throw new Error("no token");
    setShareToken(token);
    writeCachedShareToken(id, token);
    return token;
  };

  const shareLinkFor = async () => `${window.location.origin}/i/${await ensureShareToken()}`;

  const copyLinkFromSheet = async () => {
    if (shareBusy || busyAction) return;
    setShareBusy("copy");
    try {
      if (!(await persistDiscount())) return;
      await copyShareUrl(await shareLinkFor());
      setShowShareSheet(false);
    } catch {
      toast.error("Could not create the share link");
    } finally {
      setShareBusy("");
    }
  };

  const nativeShareFromSheet = async () => {
    if (shareBusy || busyAction) return;
    setShareBusy("native");
    try {
      if (!(await persistDiscount())) return;
      const url = await shareLinkFor();
      // Full friendly message with the link inline. A separate `url` field is
      // deliberately NOT passed: several Android targets drop the text and
      // share only the bare link when both are present.
      const text = buildInvoiceWhatsAppMessage({
        customerName: form.customerName,
        invoiceNumber: form.invoiceNumber,
        invoiceType,
        total: totals.grandTotal,
        businessName: business?.businessName,
        shareUrl: url,
      });
      // Prefer attaching the invoice PDF itself — More apps → pick any app
      // (WhatsApp, mail, Notes, …) shares the document with the message as its
      // caption. Falls back to the text+link share when this browser cannot
      // hand files to the share sheet.
      let file = null;
      if (probeFileShare()) {
        try {
          const captureRef = await mountCapture(invoiceType);
          const ps = (getPrintSettings()[invoiceType] || {}).paperSize || "A4_PORTRAIT";
          const filename = `${invoiceType === "PROFORMA_INVOICE" ? "Proforma" : "Tax"}_Invoice_${form.invoiceNumber}.pdf`;
          file = await createInvoicePdfFile(captureRef.current, ps, filename);
          if (file && !navigator.canShare({ files: [file] })) file = null;
        } finally {
          releaseCapture();
        }
      }
      if (file) {
        await navigator.share({ files: [file], text, title: file.name });
      } else {
        await navigator.share({ title: `Invoice ${form.invoiceNumber || ""}`.trim(), text });
      }
      setShowShareSheet(false);
    } catch (err) {
      if (err?.name !== "AbortError") {
        // Menu unavailable (blocked/unsupported): fall back to copying the link.
        try {
          await navigator.clipboard.writeText(await shareLinkFor());
          toast.success("Link copied to clipboard");
        } catch {
          toast.error("Could not open the share menu");
        }
      }
      // AbortError = the user closed the menu. Nothing downloads, ever.
    } finally {
      setShareBusy("");
    }
  };

  const shareFromSheet = async () => {
    if (shareBusy || busyAction) return;
    setShareBusy("sheet-wa");
    try {
      await ensureShareToken();
    } catch {
      // Share anyway — the message still works without the link.
    }
    setShareBusy("");
    setShowShareSheet(false);
    shareViaWhatsApp();
  };

  // Proforma view of THIS invoice: same share token, rendered as a proforma document,
  // so the customer can be sent a quotation-style copy without a second invoice record.
  const shareProformaFromSheet = async () => {
    if (shareBusy || busyAction) return;
    setShareBusy("proforma");
    try {
      if (!(await persistDiscount())) return;
      const url = proformaShareUrl(await shareLinkFor());
      setShowShareSheet(false);
      await shareLinkToUser({
        url,
        title: `Proforma Invoice ${form.invoiceNumber || ""}`.trim(),
        copyMessage: "Proforma invoice link copied to clipboard",
      });
    } catch {
      toast.error("Could not create the proforma link");
    } finally {
      setShareBusy("");
    }
  };

  // ---------- Send email (re-trigger) ----------
  const [emailBusy, setEmailBusy] = useState(false);

  const sendInvoiceEmailToCustomer = async () => {
    if (emailBusy || busyAction) return;
    // Fully synchronous: discount persist → share link → PDF render → email
    // send, all while the button stays busy; one result toast at the end.
    setEmailBusy(true);
    try {
      if (!(await persistDiscount())) return;
      // Make sure the panel shows the same link the email will carry.
      if (!shareToken) {
        const res = await invoiceAPI.createShare(id);
        setShareToken(res.data?.data?.token);
      }
      // Build the SAME PDF the Download button produces (it reads the
      // seal/stamp preference from localStorage) and attach it, so the
      // document the customer receives by email is identical to the one
      // they'd download.
      let pdfFile = null;
      try {
        const captureRef = await mountCapture(invoiceType);
        const ps = (getPrintSettings()[invoiceType] || {}).paperSize || "A4_PORTRAIT";
        const filename = `${invoiceType === "PROFORMA_INVOICE" ? "Proforma" : "Tax"}_Invoice_${form.invoiceNumber}.pdf`;
        pdfFile = await createInvoicePdfFile(captureRef.current, ps, filename);
      } catch (renderErr) {
        console.error("Invoice PDF render failed:", renderErr);
        pdfFile = null; // attachment is best-effort; the email still sends
      } finally {
        releaseCapture();
      }
      await invoiceAPI.sendInvoiceEmail(id, window.location.origin, pdfFile);
      toast.success(`Email sent to ${form.customerEmail || "the customer"}`);
    } catch (err) {
      console.error("Invoice email failed:", err);
      toast.error("Email failed");
    } finally {
      setEmailBusy(false);
    }
  };



  useEffect(() => {
    Promise.all([
      invoiceAPI.getById(id),
      businessAPI.getProfile().catch(() => null),
    ]).then(async ([invRes, bizRes]) => {
      const inv = invRes.data.data;
      // Buyer contact details (email/phone/address/GSTIN) live on the CUSTOMER
      // record, not the invoice. Fetching it after the first paint used to pop
      // the document in half — name first, then the rest "refreshing" into
      // place. The load spinner now covers this request too, so the page and
      // the View PDF modal render ONCE with the complete buyer block.
      let customer = null;
      if (inv.customerId) {
        try {
          const cRes = await customerAPI.getById(inv.customerId);
          customer = cRes.data.data;
        } catch {
          /* customer record may be deleted — render without contact details */
        }
      }
      setBusiness(bizRes?.data?.data || null);
      // Seed the seal type from the saved business profile so the radio and the
      // rendered document agree with what the share page/email will show.
      if (bizRes?.data?.data?.sealType) setSealType(bizRes.data.data.sealType);
      // Restore a share token the user already consented to on this device, so
      // the first WhatsApp/share tap needs no network and stays in-gesture.
      const cachedToken = readCachedShareToken(id);
      if (cachedToken) setShareToken(cachedToken);
      setInvoiceType(inv.invoiceType || "TAX_INVOICE");
      const dPct = parseFloat(inv.discountPercent);
      const dOn = !Number.isNaN(dPct) && dPct > 0;
      const dVal = dOn ? String(inv.discountPercent) : "";
      setDiscountEnabled(dOn);
      setDiscountPercent(dVal);
      setDiscountDirty(false);
      // Tax mode: the stored selection wins outright; legacy invoices (null)
      // resolve via supplier state vs place of supply — never a silent change.
      const loadedForm = {
        customerId: inv.customerId || null, customerName: inv.customerName || "",
        customerEmail: customer?.email || "", customerPhone: customer?.phone || "",
        billingAddress: customer?.billingAddress || "", customerGstIn: customer?.gstIn || "",
        invoiceDate: inv.invoiceDate || "",
        dueDate: inv.dueDate || "", placeOfSupply: inv.placeOfSupply || "",
        destination: inv.destination || "", termsOfDelivery: inv.termsOfDelivery || "",
        paymentTerms: inv.paymentTerms || "", paymentMode: inv.paymentMode || "CASH", deliveryNote: inv.deliveryNote || "",
        otherReferences: inv.otherReferences || "", notes: inv.notes || "",
        invoiceNumber: inv.invoiceNumber || "",
        deliveryNoteDate: inv.deliveryNoteDate || "", referenceNumber: inv.referenceNumber || "",
        buyerOrderNumber: inv.buyerOrderNumber || "", dispatchDocNumber: inv.dispatchDocNumber || "",
        dispatchedThrough: inv.dispatchedThrough || "",
        invoiceType: inv.invoiceType || "TAX_INVOICE", status: inv.status || "DRAFT",
        taxMode: resolveTaxMode(inv.taxMode, bizRes?.data?.data?.state, inv.placeOfSupply),
        billingMode: inv.billingMode || "ITEMIZED",
        // V29 extended fields — always loaded so a save round-trips them intact.
        agreementNumber: inv.agreementNumber || "", assetNumber: inv.assetNumber || "",
        serialNumber: inv.serialNumber || "", vehicleNumber: inv.vehicleNumber || "",
        periodStart: inv.periodStart || "", periodEnd: inv.periodEnd || "",
        billingPeriodStart: inv.billingPeriodStart || "", billingPeriodEnd: inv.billingPeriodEnd || "",
        expectedReturnDate: inv.expectedReturnDate || "", depositReference: inv.depositReference || "",
        patientReference: inv.patientReference || "", serviceDate: inv.serviceDate || "",
        treatmentReference: inv.treatmentReference || "", referringDoctor: inv.referringDoctor || "",
      };
      setForm(loadedForm);
      buyerSnapshotRef.current = {
        name: inv.customerName || "",
        phone: customer?.phone || "", email: customer?.email || "",
        billingAddress: customer?.billingAddress || "", gstIn: customer?.gstIn || "",
      };
      const loadedItems = (inv.items || []).length > 0 ? inv.items.map((i) => ({
        id: uid(),
        itemName: i.itemName, hsn: i.hsn || "", unit: i.unit || "", qty: String(i.qty), rate: String(i.rate),
        gstPercentage: String(i.gstPercentage), taxableValue: String(i.taxableValue || 0),
        taxAmount: String(i.taxAmount || 0), total: String(i.total || 0),
      })) : [{ ...emptyItem() }];
      setItems(loadedItems);
      // The just-loaded state IS the saved state — a no-op save would send it
      // back unchanged, so Save/Cancel start out disabled.
      setSavedBaseline(serializeEditableState(loadedForm, loadedItems, dOn, dVal));
    })
    .catch(() => setError("Failed to load invoice"))
    .finally(() => setLoading(false));
  }, [id]);

  // Warm the PDF generator chunks as soon as the share sheet opens, so the
  // More-apps PDF share finishes inside the browser's user-gesture window.
  useEffect(() => {
    if (showShareSheet) prefetchInvoicePdf();
  }, [showShareSheet]);

  // Issue 1: while the share sheet or the PDF modal is up, the page behind
  // must NEVER scroll (the invoice list used to slide around under the share
  // sheet). Same lock class the public share page uses — html/body overflow
  // hidden, index.css .pip-locked. The locks deliberately keep the user's
  // scroll position: closing resumes exactly where they left off.
  useEffect(() => {
    if (!(showShareSheet || showPdfPreview)) return undefined;
    document.documentElement.classList.add("pip-locked");
    return () => document.documentElement.classList.remove("pip-locked");
  }, [showShareSheet, showPdfPreview]);

  // Escape closes the top surface: the share sheet when it is stacked above
  // the PDF modal, the PDF modal otherwise — and never mid-share (a stray
  // Escape during a share is ignored, matching the click-away behaviour).
  useEffect(() => {
    if (!(showShareSheet || showPdfPreview)) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (showShareSheet) {
        if (shareBusy) return;
        setShowShareSheet(false);
        return;
      }
      if (showPdfPreview) setShowPdfPreview(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showShareSheet, showPdfPreview, shareBusy]);

  // ----- Hover-wheel routing (xl dual-pane scroll) -----
  // The browser natively wheels whichever overflow container sits under the
  // cursor, but "dead zones" — the column gutter, the page padding, the
  // header strip — scroll nothing, and a column whose content fits the window
  // can't scroll at all. Together that reads as "I have to click a section
  // first". One listener routes every wheel tick to the column under (or last
  // under) the cursor, and never wastes a scroll: if the hovered column has
  // nothing to scroll, the other one does.
  useEffect(() => {
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    const surface = left?.parentElement;
    if (!left || !right || !surface) return undefined;
    hoveredPaneRef.current = left;
    const hasOverflow = (el) => el.scrollHeight > el.clientHeight + 1;
    const anyPaneScroll = (pane) => {
      if (pane && hasOverflow(pane)) return pane;
      const other = pane === left ? right : left;
      return hasOverflow(other) ? other : null;
    };
    const markLeft = () => { hoveredPaneRef.current = left; };
    const markRight = () => { hoveredPaneRef.current = right; };
    const onWheel = (e) => {
      if (e.ctrlKey) return; // ctrl+wheel / pinch = zoom, never scrolling
      // Stacked layout (below xl): the page owns the wheel as usual.
      if (!window.matchMedia("(min-width: 1280px)").matches) return;
      const inLeft = left.contains(e.target);
      const inRight = right.contains(e.target);
      if (inLeft || inRight) {
        // Inside a pane the browser scrolls it natively — unless this pane's
        // content fits and nothing would move; then hand the tick to the
        // sibling so the wheel is never dead.
        const pane = inLeft ? left : right;
        if (hasOverflow(pane)) return;
        const other = anyPaneScroll(pane);
        if (other) {
          e.preventDefault();
          other.scrollBy({ top: e.deltaY });
        }
        return;
      }
      // Dead zone (gutter / padding / header): route the wheel to the pane
      // the cursor last hovered so ANY position always scrolls that column.
      e.preventDefault();
      const target = anyPaneScroll(hoveredPaneRef.current);
      if (target) target.scrollBy({ top: e.deltaY });
    };
    left.addEventListener("mouseenter", markLeft);
    right.addEventListener("mouseenter", markRight);
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      left.removeEventListener("mouseenter", markLeft);
      right.removeEventListener("mouseenter", markRight);
      surface.removeEventListener("wheel", onWheel);
    };
  }, [loading, error]);

  useEffect(() => {
    processQueue(
      (data) => customerAPI.create(data),
      (data) => invoiceAPI.create(data)
    ).then((count) => {
      if (count > 0) toast.success(`${count} pending invoice${count > 1 ? 's' : ''} synced`);
    });
  }, []);

  const handleFieldChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleItemChange = useCallback((idx, field, value) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const qty = parseFloat(field === "qty" ? value : item.qty) || 0;
      const rate = parseFloat(field === "rate" ? value : item.rate) || 0;
      const gst = parseFloat(field === "gstPercentage" ? value : item.gstPercentage) || 0;
      const updated = { ...item, [field]: value };
      if (["qty", "rate", "gstPercentage"].includes(field)) {
        const taxableValue = qty * rate;
        const taxAmount = taxableValue * gst / 100;
        updated.taxableValue = round2(taxableValue).toFixed(2);
        updated.taxAmount = round2(taxAmount).toFixed(2);
        updated.total = round2(taxableValue + taxAmount).toFixed(2);
      }
      return updated;
    }));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { ...emptyItem() }]);
  }, []);

  const removeItem = useCallback((idx) => {
    setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }, []);

  const totals = useMemo(() => computeInvoiceTotals(items, discountEnabled ? discountPercent : "0", form.taxMode), [items, discountEnabled, discountPercent, form.taxMode]);

  const validItemsCount = useMemo(
    () => items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0).length,
    [items]
  );

  // Stable identities for the hidden document props: without these, every
  // busy-flag/state change handed React.memo'd templates a brand new object.
  const previewCustomer = useMemo(() => ({
    name: form.customerName,
    billingAddress: form.billingAddress,
    gstIn: form.customerGstIn,
    phone: form.customerPhone,
    email: form.customerEmail,
    state: form.placeOfSupply,
  }), [form.customerName, form.billingAddress, form.customerGstIn, form.customerPhone, form.customerEmail, form.placeOfSupply]);

  const previewPaperSize = useMemo(() => (getPrintSettings()[invoiceType] || {}).paperSize || "A4_PORTRAIT", [invoiceType]);
  const previewTemplate = useMemo(() => getInvoiceTemplate(invoiceType), [invoiceType]);
  const proformaPaperSize = useMemo(() => (getPrintSettings()["PROFORMA_INVOICE"] || {}).paperSize || "A4_PORTRAIT", []);
  const proformaTemplate = useMemo(() => getInvoiceTemplate("PROFORMA_INVOICE"), []);

  // Mounts the hidden document for `type` and resolves once its DOM is committed
  // so the capture ref is usable, mirroring InvoiceForm's mountPdfPreview().
  const mountCapture = useCallback(async (type) => {
    setCaptureType(type);
    const ref = type === "PROFORMA_INVOICE" ? proformaRef : invoiceRef;
    for (let i = 0; i < 5 && !ref.current; i++) {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    return ref;
  }, []);
  const releaseCapture = useCallback(() => setCaptureType(null), []);

  // Live rule-check of the selection vs the applicable GST structure — shown
  // under the toggle and used to gate saving an invalid finalization.
  const taxValidation = useMemo(
    () => validateTaxMode(form.taxMode, business?.state, form.placeOfSupply),
    [form.taxMode, business?.state, form.placeOfSupply],
  );

  const toggleTaxMode = () => {
    setForm((p) => ({ ...p, taxMode: p.taxMode === "IGST" ? "CGST_SGST" : "IGST" }));
  };

  // True once any editable field, line item or the discount drifted from the
  // last-saved baseline. Gates the Save/Cancel buttons in edit mode.
  const hasUnsavedChanges = useMemo(
    () => savedBaseline !== null && serializeEditableState(form, items, discountEnabled, discountPercent) !== savedBaseline,
    [savedBaseline, form, items, discountEnabled, discountPercent]
  );

  const validate = () => {
    if (!form.customerName.trim()) { toast.error("Customer name is required"); return false; }
    if (!form.invoiceDate) { toast.error("Invoice date is required"); return false; }
    // V29 period sanity — mirrors the backend's validateExtendedDates.
    if (form.periodStart && form.periodEnd && form.periodEnd < form.periodStart) {
      toast.error("Period end date cannot be before the period start date"); return false;
    }
    if (form.billingPeriodStart && form.billingPeriodEnd && form.billingPeriodEnd < form.billingPeriodStart) {
      toast.error("Billing period end date cannot be before the billing period start date"); return false;
    }
    const validItems = items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0);
    if (validItems.length === 0) { toast.error("At least one valid item required"); return false; }
    // Data-loss guard: handleSave() silently DROPS rows that are not fully
    // valid, so a half-typed row (rate but no name, qty but no name, …) used to
    // vanish the moment the user saved — with a success toast. Blocked here,
    // naming the row, the same way empty Term lines are blocked.
    const incompleteIdx = items.findIndex((i) => {
      const hasName = i.itemName.trim();
      const hasQty = parseFloat(i.qty) > 0;
      const hasRate = parseFloat(i.rate) > 0;
      return (hasName || hasQty || hasRate) && !(hasName && hasQty && hasRate);
    });
    if (incompleteIdx !== -1) {
      toast.error(`Row ${incompleteIdx + 1} is incomplete — fill its name, qty and rate, or remove it`);
      return false;
    }
    // Tax mode vs GST rules: conflicting selections require an explicit
    // override — never a silent switch behind the user's back.
    if (!taxValidation.ok && !window.confirm(`${taxValidation.message}\n\nSave with this tax mode anyway?`)) {
      return false;
    }
    return true;
  };

  // The invoice payload carries only customerId, so BILL TO edits have to be
  // written to the customer record separately or they are silently dropped.
  // Only changed fields are sent: the backend treats a null/omitted field as
  // "leave unchanged", so an untouched save must not rewrite the record.
  const saveBuyerChanges = async () => {
    const snap = buyerSnapshotRef.current;
    if (!form.customerId || !snap) return;
    const patch = {};
    if (form.customerName !== snap.name) patch.name = form.customerName;
    // An empty phone fails the backend's 10-digit pattern, which would abort the
    // whole save; omit it instead (the backend cannot clear a phone either).
    if (form.customerPhone && form.customerPhone !== snap.phone) patch.phone = form.customerPhone;
    if (form.customerEmail !== snap.email) patch.email = form.customerEmail;
    if (form.billingAddress !== snap.billingAddress) patch.billingAddress = form.billingAddress;
    if (form.customerGstIn !== snap.gstIn) patch.gstIn = form.customerGstIn;
    if (Object.keys(patch).length === 0) return;
    await customerAPI.update(form.customerId, patch);
    buyerSnapshotRef.current = {
      name: form.customerName, phone: form.customerPhone, email: form.customerEmail,
      billingAddress: form.billingAddress, gstIn: form.customerGstIn,
    };
  };

  const handleSave = async () => {
    if (!validate()) return false;
    setSaving(true);
    try {
      await saveBuyerChanges();
      await invoiceAPI.update(id, {
        customerId: form.customerId,
        invoiceType: form.invoiceType,
        taxMode: form.taxMode,
        ...(ghostMode && form.invoiceNumber ? { invoiceNumber: form.invoiceNumber } : {}),
        invoiceDate: form.invoiceDate || undefined,
        dueDate: form.dueDate || undefined,
        status: form.status || "DRAFT",
        placeOfSupply: form.placeOfSupply || undefined,
        destination: form.destination || undefined,
        termsOfDelivery: form.termsOfDelivery || undefined,
        paymentTerms: form.paymentTerms || undefined,
        paymentMode: form.paymentMode || "CASH",
        deliveryNote: form.deliveryNote || undefined,
        deliveryNoteDate: form.deliveryNoteDate || undefined,
        referenceNumber: form.referenceNumber || undefined,
        buyerOrderNumber: form.buyerOrderNumber || undefined,
        dispatchDocNumber: form.dispatchDocNumber || undefined,
        dispatchedThrough: form.dispatchedThrough || undefined,
        otherReferences: form.otherReferences || undefined,
        notes: form.notes || undefined,
        billingMode: form.billingMode || undefined,
        // V29 extended fields: always re-sent so loaded values survive the
        // update path (backend assigns them unconditionally). Empty -> dropped.
        ...Object.fromEntries(ALL_EXTENDED_FIELDS.map((f) => [f, form[f] || undefined])),
        discountPercent: discountEnabled ? parseFloat(discountPercent) || 0 : 0,
        items: items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0)
          .map((i, idx) => ({
            sno: idx + 1, itemName: i.itemName, hsn: i.hsn || undefined, unit: i.unit || undefined,
            qty: parseFloat(i.qty), rate: parseFloat(i.rate), gstPercentage: parseFloat(i.gstPercentage) || 0,
          })),
      });
      toast.success("Invoice updated successfully");
      setIsEditing(false);
      setDiscountDirty(false);
      // What was just written is the new saved baseline, so Save/Cancel go
      // back to disabled until the next real edit.
      setSavedBaseline(serializeEditableState(form, items, discountEnabled, discountPercent));
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Failed to update invoice";
      toast.error(msg);
      console.error("Update invoice error:", err.response?.data);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Persists pending discount edits before any action (share / PDF / email / link)
  // so the generated document always matches what the user typed. Returns false
  // when the invoice could not be saved, so callers can abort.
  const persistDiscount = async () => {
    if (!discountDirty) return true;
    if (!validate()) return false;
    return handleSave();
  };

  const downloadPDF = async (type) => {
    if (!(await persistDiscount())) return;
    setBusyAction(`download:${type}`);
    try {
      const filename = `${type === "PROFORMA_INVOICE" ? "Proforma" : "Tax"}_Invoice_${form.invoiceNumber}.pdf`;
      const captureRef = await mountCapture(type);
      const ps = (getPrintSettings()[type] || {}).paperSize || "A4_PORTRAIT";
      await processPrint(captureRef, type, filename, ps);
    } catch {
      toast.error("Failed to generate");
    } finally {
      releaseCapture();
      setBusyAction("");
    }
  };

  const shareViaWhatsApp = async () => {
    if (busyAction) return;
    // Fast path: the share token is already known (restored from cache or a
    // previous share) and there is nothing to save → build the message and
    // share with ZERO awaits, so navigator.share / wa.me still sit inside the
    // tap's user-gesture window. iOS and Android drop the message when these
    // fire after a network round-trip ("just opens WhatsApp").
    if (shareToken && !discountDirty && !isEditing) {
      const text = buildInvoiceWhatsAppMessage({
        customerName: form.customerName,
        invoiceNumber: form.invoiceNumber,
        invoiceType,
        total: totals.grandTotal,
        businessName: business?.businessName,
        shareUrl: `${window.location.origin}/i/${shareToken}`,
      });
      openWhatsAppChat(text);
      return;
    }
    setBusyAction("whatsapp");
    try {
      // 1. Save the invoice (if unsaved / editing, or pending discount edits)
      if (!(await persistDiscount())) {
        setBusyAction("");
        return;
      }

      // 2. Create/ensure a public share link
      const token = await ensureShareToken();
      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://www.insideinvoice.com";
      const shareUrl = `${origin}/i/${token}`;

      // 3. Open WhatsApp with the prefilled invoice message + link
      const text = buildInvoiceWhatsAppMessage({
        customerName: form.customerName,
        invoiceNumber: form.invoiceNumber,
        invoiceType,
        total: totals.grandTotal,
        businessName: business?.businessName,
        shareUrl,
      });
      openWhatsAppChat(text);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not share via WhatsApp");
    } finally {
      setBusyAction("");
    }
  };

  const shareViaSms = async () => {
    if (busyAction) return;
    const phone = (form.customerPhone || buyerSnapshotRef.current?.phone || "").trim().replace(/[\s\-()]/g, "");
    if (!phone) {
      toast.error("Customer phone number is missing");
      return;
    }
    setBusyAction("sms");
    try {
      if (!(await persistDiscount())) {
        setBusyAction("");
        return;
      }
      const token = await ensureShareToken();
      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://www.insideinvoice.com";
      const shareUrl = `${origin}/i/${token}`;
      // Compact, single-segment-friendly message for SMS (the WhatsApp message
      // is too long and gets split into multiple SMS segments).
      const name = (form.customerName || "").trim();
      const label = invoiceType === "PROFORMA_INVOICE" ? "Proforma Invoice" : "Tax Invoice";
      const invNo = (form.invoiceNumber || "").trim();
      const amount = parseFloat(totals.grandTotal);
      const totalStr = !isNaN(amount) && amount >= 0
        ? `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "";
      const smsLines = [];
      if (name) smsLines.push(`Hi ${name},`);
      else smsLines.push("Hello,");
      const invLine = invNo ? `${label} ${invNo}` : label;
      if (totalStr) smsLines.push(`${invLine}, Total: ${totalStr}.`);
      else smsLines.push(`${invLine}.`);
      if (shareUrl) {
        // A zero-width space inside the URL stops iMessage/SMS apps from
        // generating a link-preview "thumbnail" card for this message only
        // (WhatsApp keeps its normal preview because it uses the unmodified
        // URL). The link still opens correctly in most clients.
        const smsUrl = shareUrl.replace("https://", "https://\u200B");
        smsLines.push(`View invoice: ${smsUrl}`);
      }
      const text = smsLines.join(" ");
      // sms: opens the device's default SMS app with recipient + body
      // pre-filled. Android uses `?body=`, iOS historically uses `&body=`.
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const smsLink = `sms:${phone}${isIOS ? "&" : "?"}body=${encodeURIComponent(text)}`;
      // Navigate the current tab to the sms: scheme. This avoids the
      // "Open in Messages?" confirmation prompt that a programmatic anchor
      // click triggers on iOS/Android.
      window.location.href = smsLink;
      setShowShareSheet(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not open the SMS app");
    } finally {
      setBusyAction("");
    }
  };

  // Opens the zoomable document INSTANTLY — no PDF bytes are built here. The
  // modal renders the live invoice inside DocZoomSurface (pinch/pan/zoom); the
  // PDF blob is only built on demand for Download.
  const viewPDF = async () => {
    if (!(await persistDiscount())) return;
    setShowPdfPreview(true);
  };

  if (loading) {
    // Keep the sidebar mounted during load — only the center area shows the
    // loading state (same pattern as InvoicesList).
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100dvh - 80px)" }}
        >
          <LoadingDots className="text-slate-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="px-6 py-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600">{error}</p>
          <button onClick={() => goBack(navigate, "/invoices")} className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium">Back to Invoices</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100 xl:h-[calc(100dvh-var(--status-bar-offset,0px))] xl:overflow-hidden xl:flex xl:flex-col">
      {/* Hidden Invoice PDF for capture — mounted only while a PDF action runs */}
      {captureType && captureType !== "PROFORMA_INVOICE" && (
        <div style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}>
          <InvoiceTemplateRenderer
            ref={invoiceRef}
            business={business}
            customer={previewCustomer}
            form={form}
            items={items}
            totals={totals}
            discountPercent={discountEnabled ? discountPercent : "0"}
            taxMode={form.taxMode}
            type={invoiceType}
            invoiceNumber={form.invoiceNumber}
            paperSize={previewPaperSize}
            template={previewTemplate}
          />
        </div>
      )}
      {/* Hidden Proforma renderer — mounted only while a PDF action runs */}
      {captureType === "PROFORMA_INVOICE" && (
        <div style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}>
          <InvoiceTemplateRenderer
            ref={proformaRef}
            business={business}
            customer={previewCustomer}
            form={form}
            items={items}
            totals={totals}
            discountPercent={discountEnabled ? discountPercent : "0"}
            taxMode={form.taxMode}
            type="PROFORMA_INVOICE"
            invoiceNumber={form.invoiceNumber}
            paperSize={proformaPaperSize}
            template={proformaTemplate}
          />
        </div>
      )}
      <div className="max-w-[1900px] mx-auto w-full px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 xl:flex xl:flex-1 xl:min-h-0 xl:flex-col">
        {/* In-flow header (same pattern as the View Invoices list page) — it
            scrolls away with the content instead of staying pinned; the user
            simply scrolls up to reach Back / WhatsApp. Previously it was
            position:fixed below the navbar, which slid under the navbar on
            mobile scroll-up (iOS Safari) and needed a compensating spacer. */}
        <div className="mb-6 border-b border-slate-200/60 lg:border-0 py-2 lg:py-0 flex items-center justify-between shrink-0">
          <div className="w-full flex items-center justify-between">
          <PageHeader title="View Invoice" backTo="/invoices" className="" />
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              invoiceType === "PROFORMA_INVOICE" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
            }`}>
              {invoiceType === "PROFORMA_INVOICE" ? "Proforma" : "Tax"} Invoice
            </span>
            <button type="button" onClick={shareViaWhatsApp} disabled={sealRequired || !!busyAction} title="Share on WhatsApp" aria-label="Share on WhatsApp"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5b] disabled:opacity-60 transition-all shadow-sm">
              {busyAction === "whatsapp" ? <Spinner size={18} /> : <WhatsAppIcon className="w-5 h-5" />}
            </button>
          </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.34fr)] side-fixed-grid gap-6 xl:flex-1 xl:min-h-0 xl:grid-rows-1">
          <div ref={leftPaneRef} className="space-y-6 pane-scroll xl:overflow-y-auto xl:min-h-0">
            {/* Seller & Buyer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  <h2 className="text-sm font-bold text-slate-800">Seller</h2>
                </div>
                  {business ? (
                    <div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{business.businessName}</p>
                        <InfoRow label="GSTIN" value={business.gstIn} />
                        <InfoRow label="Phone" value={business.phone} />
                        <InfoRow label="Email" value={business.email} />
                        {business.addressLine1 && <p className="text-xs text-slate-500 mt-1">{business.addressLine1}{business.city ? `, ${business.city}` : ""}{business.state ? `, ${business.state}` : ""}{business.pincode ? ` - ${business.pincode}` : ""}</p>}
                      </div>
                      {business.upiId && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col items-center">
                          <div className="flex items-center gap-2 mb-2">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs font-medium text-emerald-700">Pay via UPI</span>
                          </div>
                          <div className="bg-white p-1.5 rounded-lg border border-slate-200 inline-flex overflow-hidden min-w-0">
                            <QRCodeSVG value={`upi://pay?pa=${business.upiId}&pn=${encodeURIComponent(business.businessName || "")}&am=${totals.grandTotal.toFixed(2)}&tr=${encodeURIComponent(form.invoiceNumber)}&tn=${encodeURIComponent(form.invoiceNumber)}&cu=INR`} size={70} className="max-w-full h-auto" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                  <p className="text-sm text-slate-400">Business details not available</p>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-slate-600" />
                  <h2 className="text-sm font-bold text-slate-800">Buyer</h2>
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Phone *</label>
                        <input name="customerPhone" value={form.customerPhone} onChange={handleFieldChange} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Customer Name *</label>
                        <input name="customerName" value={form.customerName} onChange={handleFieldChange} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Email</label>
                        <input name="customerEmail" value={form.customerEmail} onChange={handleFieldChange} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>GSTIN</label>
                        <input name="customerGstIn" value={form.customerGstIn} onChange={handleFieldChange} className={inputClass + " font-mono uppercase"} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Billing Address</label>
                      <textarea name="billingAddress" value={form.billingAddress} onChange={handleFieldChange} rows={2} className={inputClass + " resize-none"} />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-800">{form.customerName}</p>
                    {form.customerEmail && <InfoRow label="Email" value={form.customerEmail} />}
                    {form.customerPhone && <InfoRow label="Phone" value={form.customerPhone} />}
                    {form.customerGstIn && <InfoRow label="GSTIN" value={form.customerGstIn} />}
                    {form.billingAddress && <p className="text-xs text-slate-500 mt-1">{form.billingAddress}</p>}
                  </>
                )}
              </div>
            </div>

            {/* Invoice Details */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
                <FileText className="w-5 h-5 text-slate-600" />
                <h2 className="text-sm font-bold text-slate-800">Invoice Details</h2>
              </div>
              {isEditing ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Invoice No.</label>
                    {ghostMode ? (
                      <input type="text" name="invoiceNumber" value={form.invoiceNumber}
                        onChange={handleFieldChange}
                        className={inputClass + " font-mono"} placeholder="Enter invoice number" />
                    ) : (
                      <input value={form.invoiceNumber} disabled className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-mono" />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Invoice Date *</label>
                    <input type="date" name="invoiceDate" value={form.invoiceDate} onChange={handleFieldChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Due Date</label>
                    <input type="date" name="dueDate" value={form.dueDate} onChange={handleFieldChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Place of Supply</label>
                    <div className="relative">
                      <select name="placeOfSupply" value={form.placeOfSupply} onChange={handleFieldChange} className={selectClass}>
                        <option value="">State</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  {!isHidden("destination") && (
                  <div>
                    <label className={labelClass}>{labelFor("destination", "Destination")}</label>
                    <div className="relative">
                      <select name="destination" value={form.destination} onChange={handleFieldChange} className={selectClass}>
                        <option value="">State</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  )}
                  {!isHidden("termsOfDelivery") && (
                  <div>
                    <label className={labelClass}>{labelFor("termsOfDelivery", "Terms of Delivery")}</label>
                    <div className="relative">
                      <select name="termsOfDelivery" value={form.termsOfDelivery} onChange={handleFieldChange} className={selectClass}>
                        {DELIVERY_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  )}
                  <div>
                    <label className={labelClass}>Payment Terms</label>
                    <div className="relative">
                      <select name="paymentTerms" value={form.paymentTerms} onChange={handleFieldChange} className={selectClass}>
                        {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  {!isHidden("deliveryNote") && (
                  <div>
                    <label className={labelClass}>{labelFor("deliveryNote", "Delivery Note")}</label>
                    <input name="deliveryNote" value={form.deliveryNote} onChange={handleFieldChange} className={inputClass} />
                  </div>
                  )}
                  <div>
                    <label className={labelClass}>{labelFor("otherReferences", "Others")}</label>
                    <input name="otherReferences" value={form.otherReferences} onChange={handleFieldChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Payment Mode</label>
                    <div className="relative">
                      <select name="paymentMode" value={form.paymentMode} onChange={handleFieldChange} className={selectClass}>
                        <option value="UPI">UPI</option>
                        <option value="CASH">CASH</option>
                        <option value="CARD">CARD</option>
                        <option value="CHEQUE">CHEQUE</option>
                        <option value="NEFT">NEFT</option>
                      <option value="IMPS">IMPS</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                {/* Invoice-level GST tax mode — beside Payment Mode. ON = IGST
                    (inter-state), OFF = CGST + SGST/UTGST (intra-state); a rule
                    conflict warns but never silently changes the selection. */}
                <div>
                  <label className={labelClass} id="tax-mode-label-view">Tax Mode <span className="normal-case font-normal text-slate-400">(GST)</span></label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.taxMode === "IGST"}
                    aria-labelledby="tax-mode-label-view"
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
                {/* Reference / delivery rows the PDF already prints — view ≡ PDF */}
                <div>
                  <label className={labelClass}>{labelFor("referenceNumber", "Reference No")}</label>
                  <input name="referenceNumber" value={form.referenceNumber} onChange={handleFieldChange} className={inputClass} />
                </div>
                {!isHidden("buyerOrderNumber") && (
                <div>
                  <label className={labelClass}>{labelFor("buyerOrderNumber", "Buyer's Order No.")}</label>
                  <input name="buyerOrderNumber" value={form.buyerOrderNumber || ""} onChange={handleFieldChange} className={inputClass} />
                </div>
                )}
                {!isHidden("deliveryNoteDate") && (
                <div>
                  <label className={labelClass}>{labelFor("deliveryNoteDate", "Delivery Note Date")}</label>
                  <input type="date" name="deliveryNoteDate" value={form.deliveryNoteDate} onChange={handleFieldChange} className={inputClass} />
                </div>
                )}
                {!isHidden("dispatchDocNumber") && (
                <div>
                  <label className={labelClass}>{labelFor("dispatchDocNumber", "Dispatch Doc No")}</label>
                  <input name="dispatchDocNumber" value={form.dispatchDocNumber} onChange={handleFieldChange} className={inputClass} />
                </div>
                )}
                {!isHidden("dispatchedThrough") && (
                <div>
                  <label className={labelClass}>{labelFor("dispatchedThrough", "Dispatched Through")}</label>
                  <input name="dispatchedThrough" value={form.dispatchedThrough} onChange={handleFieldChange} className={inputClass} />
                </div>
                )}
                {/* V29 industry-extended fields (reference/display only) */}
                {extendedFields.map((field) => (
                  <div key={field}>
                    <label className={labelClass}>{labelFor(field, field)}</label>
                    <input
                      type={isExtendedFieldType(field, "date") ? "date" : "text"}
                      name={field}
                      value={form[field] || ""}
                      onChange={handleFieldChange}
                      className={inputClass} />
                  </div>
                ))}
              </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Invoice No.</label>
                    <p className="text-sm font-mono text-slate-800 font-medium">{form.invoiceNumber}</p>
                  </div>
                  <div>
                    <label className={labelClass}>Invoice Date</label>
                    <p className="text-sm text-slate-800">{form.invoiceDate}</p>
                  </div>
                  {form.dueDate && <div>
                    <label className={labelClass}>Due Date</label>
                    <p className="text-sm text-slate-800">{form.dueDate}</p>
                  </div>}
                  {form.placeOfSupply && <div>
                    <label className={labelClass}>Place of Supply</label>
                    <p className="text-sm text-slate-800">{form.placeOfSupply}</p>
                  </div>}
                  {!isHidden("destination") && form.destination && <div>
                    <label className={labelClass}>{labelFor("destination", "Destination")}</label>
                    <p className="text-sm text-slate-800">{form.destination}</p>
                  </div>}
                  {!isHidden("termsOfDelivery") && form.termsOfDelivery && <div>
                    <label className={labelClass}>{labelFor("termsOfDelivery", "Terms of Delivery")}</label>
                    <p className="text-sm text-slate-800">{form.termsOfDelivery}</p>
                  </div>}
                  {form.paymentTerms && <div>
                    <label className={labelClass}>Payment Terms</label>
                    <p className="text-sm text-slate-800">{form.paymentTerms}</p>
                  </div>}
                  {!isHidden("deliveryNote") && form.deliveryNote && <div>
                    <label className={labelClass}>{labelFor("deliveryNote", "Delivery Note")}</label>
                    <p className="text-sm text-slate-800">{form.deliveryNote}</p>
                  </div>}
                  {form.otherReferences && <div>
                    <label className={labelClass}>{labelFor("otherReferences", "Others")}</label>
                    <p className="text-sm text-slate-800">{form.otherReferences}</p>
                  </div>}
                  {form.paymentMode && <div>
                    <label className={labelClass}>Payment Mode</label>
                    <p className="text-sm text-slate-800">{form.paymentMode}</p>
                  </div>}
                  <div>
                    <label className={labelClass}>Tax Mode</label>
                    <p className="text-sm text-slate-800">{form.taxMode === "IGST" ? "IGST (inter-state)" : "CGST + SGST/UTGST (intra-state)"}</p>
                  </div>
                  {/* Reference / delivery rows the PDF already prints — view ≡ PDF */}
                  {form.referenceNumber && <div>
                    <label className={labelClass}>{labelFor("referenceNumber", "Reference No")}</label>
                    <p className="text-sm text-slate-800">{form.referenceNumber}</p>
                  </div>}
                  {form.buyerOrderNumber && <div>
                    <label className={labelClass}>{labelFor("buyerOrderNumber", "Buyer's Order No.")}</label>
                    <p className="text-sm text-slate-800">{form.buyerOrderNumber}</p>
                  </div>}
                  {!isHidden("deliveryNoteDate") && form.deliveryNoteDate && <div>
                    <label className={labelClass}>{labelFor("deliveryNoteDate", "Delivery Note Date")}</label>
                    <p className="text-sm text-slate-800">{form.deliveryNoteDate}</p>
                  </div>}
                  {!isHidden("dispatchDocNumber") && form.dispatchDocNumber && <div>
                    <label className={labelClass}>{labelFor("dispatchDocNumber", "Dispatch Doc No")}</label>
                    <p className="text-sm text-slate-800">{form.dispatchDocNumber}</p>
                  </div>}
                  {!isHidden("dispatchedThrough") && form.dispatchedThrough && <div>
                    <label className={labelClass}>{labelFor("dispatchedThrough", "Dispatched Through")}</label>
                    <p className="text-sm text-slate-800">{form.dispatchedThrough}</p>
                  </div>}
                  {/* V29 industry-extended fields — value-driven only */}
                  {extendedFields.map((field) => form[field] ? (
                    <div key={field}>
                      <label className={labelClass}>{labelFor(field, field)}</label>
                      <p className="text-sm text-slate-800">{form[field]}</p>
                    </div>
                  ) : null)}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-slate-600" />
                  <h2 className="text-sm font-bold text-slate-800">Items</h2>
                  {isConstruction && !isEditing && form.billingMode && form.billingMode !== "ITEMIZED" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                      {form.billingMode === "COMPLETE_PROJECT" ? "Complete Project Cost" : form.billingMode}
                    </span>
                  )}
                  {isConstruction && isEditing && (
                    <select name="billingMode" value={form.billingMode || "ITEMIZED"} onChange={handleFieldChange}
                      title="Billing mode"
                      className="ml-2 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:border-slate-400">
                      <option value="ITEMIZED">Itemized Cost Breakdown</option>
                      <option value="COMPLETE_PROJECT">Complete Project Cost</option>
                    </select>
                  )}
                </div>
                {isEditing && (
                  <button onClick={addItem}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all shadow-sm min-h-[44px]">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800">
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-center whitespace-nowrap">#</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-left whitespace-nowrap">{labelFor("itemName", "Description")}</th>
                      {showHnSac && <th className="text-white text-xs font-semibold py-3.5 px-3 text-center whitespace-nowrap">HSN/SAC</th>}
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-center whitespace-nowrap">Qty</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-center whitespace-nowrap">Rate</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-center whitespace-nowrap">GST %</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-right whitespace-nowrap">Taxable</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-right whitespace-nowrap">Tax</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-right whitespace-nowrap">Total</th>
                      {isEditing && <th className="text-white"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <ViewItemRow key={item.id ?? idx} item={item} calc={totals.perItem[idx]} idx={idx} isEditing={isEditing} onItemChange={handleItemChange} onRemove={removeItem} onAdd={addItem} showHnSac={showHnSac} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {items.map((item, idx) => (
                  <div key={item.id ?? idx} className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Item #{idx + 1}</span>
                      {isEditing && (
                        <button type="button" onClick={() => removeItem(idx)} aria-label={`Remove item ${idx + 1}`}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors text-slate-400 hover:text-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 uppercase">{labelFor("itemName", "Description")}</label>
                          <input type="text" value={item.itemName}
                            onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white min-h-[44px]" placeholder="Item name" />
                        </div>
                        <div className={showHnSac ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
                          {showHnSac && (
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">HSN/SAC</label>
                            <input type="text" value={item.hsn}
                              onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white font-mono min-h-[44px]" />
                          </div>
                          )}
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">GST %</label>
                            <input type="number" step="0.01" min="0" max="100" value={item.gstPercentage}
                              onChange={(e) => handleItemChange(idx, "gstPercentage", e.target.value)}
                              inputMode="decimal"
                              className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right bg-white font-mono min-h-[44px]" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">Qty</label>
                            <input type="number" step="0.01" min="0" value={item.qty}
                              onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                              inputMode="decimal"
                              className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right bg-white font-mono min-h-[44px]" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">Rate</label>
                            <input type="number" step="0.01" min="0" value={item.rate}
                              onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                              inputMode="decimal"
                              className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right bg-white font-mono min-h-[44px]" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">Total</label>
                            <div className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right bg-slate-100 font-mono min-h-[44px] flex items-center justify-end text-slate-700">
                              Rs. {fmt(item.total)}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-slate-800">{item.itemName}</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {showHnSac && <div><span className="text-slate-400">HSN:</span> <span className="font-mono">{item.hsn || "-"}</span></div>}
                          <div><span className="text-slate-400">Qty:</span> <span className="font-mono">{item.qty}</span></div>
                          <div><span className="text-slate-400">Rate:</span> <span className="font-mono">{fmt(item.rate)}</span></div>
                          <div><span className="text-slate-400">GST:</span> <span className="font-mono">{item.gstPercentage}%</span></div>
                          <div className="col-span-2"><span className="text-slate-400">Total:</span> <span className="font-mono font-semibold">{fmt(item.total)}</span></div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-4 pt-3 border-t border-slate-200">
                <div className="w-full sm:w-72 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal:</span>
                    <span className="font-mono font-medium text-slate-700">Rs. {fmt(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax Amount:</span>
                    <span className="font-mono font-medium text-slate-700">Rs. {fmt(totals.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t-2 border-slate-800">
                    <span className="text-slate-800">Grand Total:</span>
                    <span className="font-mono text-slate-800">Rs. {fmt(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms & Conditions — the business's default GST footer terms
                (Settings owns the data; this page renders it), placed above
                Notes as on a standard invoice footer. */}
            <TermsCard business={business} className="p-4 sm:p-6" />

            {/* Notes */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <h2 className="text-sm font-bold text-slate-800 mb-3">Notes</h2>
              {isEditing ? (
                <textarea name="notes" value={form.notes} onChange={handleFieldChange}
                  rows={2} className={inputClass + " resize-none"} placeholder="Additional notes..." />
              ) : form.notes ? (
                <p className="text-sm text-slate-600">{form.notes}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No notes</p>
              )}
            </div>
          </div>

          {/* Right Sidebar — its own scroll surface at xl: wheeling anywhere
              over the discount/actions column moves ONLY this column, never
              the invoice content behind it (overscroll-behavior: contain). */}
          <div ref={rightPaneRef} className="space-y-4 side-fixed pane-scroll xl:overflow-y-auto xl:min-h-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Discount</h3>
                <button type="button" role="switch" aria-checked={discountEnabled} aria-label="Invoice discount"
                  onClick={() => {
                  const next = !discountEnabled;
                  setDiscountEnabled(next);
                  if (!next) setDiscountPercent("");
                  setDiscountDirty(true);
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
                    onChange={(e) => {
                      setDiscountPercent(e.target.value);
                      setDiscountDirty(true);
                    }}
                    inputMode="numeric"
                    placeholder="0"
                    className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400"
                  />
                  <span className="text-sm text-slate-600">%</span>
                  {discountVal > 0 && (
                    <span className="text-xs text-emerald-600 font-medium ml-auto">
                      -Rs. {(totals.subtotal * Math.min(discountVal, 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                      onChange={() => chooseSealType("round")}
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
                      onChange={() => chooseSealType("stamp")}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-slate-700">Rubber Stamp</span>
                  </label>
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-6">
              <h2 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">Actions</h2>
              <div className="flex flex-col sm:flex-row xl:flex-col gap-2 sm:flex-wrap">
                {isEditing ? (
                  <>
                    <button onClick={handleSave} disabled={saving || !hasUnsavedChanges}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                      {saving ? <LoadingDots className="text-white" /> : <Save className="w-4 h-4" />}
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setIsEditing(false)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-all">
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </>
                ) : null}
                {!isEditing && (
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button onClick={() => setIsEditing(true)} title="Edit invoice"
                      className="min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all shadow-sm">
                      <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">Edit</span>
                    </button>
                    <button onClick={() => viewPDF()} disabled={sealRequired || !!busyAction} title="View PDF"
                      className="min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">
                      <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">View</span>
                    </button>
                    <button onClick={() => setShowShareSheet(true)} disabled={!!busyAction} title="Share"
                      className="min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm">
                      <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">Share</span>
                    </button>
                  </div>
                )}
                {!isEditing && (
                  <>
                    <button onClick={() => downloadPDF("PROFORMA_INVOICE")} disabled={sealRequired || !!busyAction}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-emerald-300 text-emerald-700 text-sm font-semibold rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-all">
                      {busyAction === "download:PROFORMA_INVOICE" ? <Spinner size={16} /> : <Download className="w-4 h-4" />} {busyAction === "download:PROFORMA_INVOICE" ? "Preparing..." : "Proforma"}
                    </button>
                    <button onClick={() => downloadPDF(invoiceType)} disabled={sealRequired || !!busyAction}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-indigo-300 text-indigo-700 text-sm font-semibold rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-all">
                      {busyAction === `download:${invoiceType}` ? <Spinner size={16} /> : <Download className="w-4 h-4" />} {busyAction === `download:${invoiceType}` ? "Preparing..." : "Download PDF"}
                    </button>
                  </>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
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
                      <button type="button" onClick={() => copyShareUrl(shareUrl)} disabled={!!shareBusy}
                        className="min-w-0 flex-1 flex items-center justify-center gap-1.5 px-2 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-all">
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">Copy link</span>
                      </button>
                      <button type="button" onClick={sendInvoiceEmailToCustomer} disabled={emailBusy || !!busyAction}
                        title="Email this invoice and its link to the customer"
                        className="min-w-0 flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm">
                        {emailBusy ? <Spinner size={14} className="shrink-0" /> : <Mail className="w-3.5 h-3.5 shrink-0" />}
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
                        <button type="button" onClick={() => handleShareLink("regenerate")} disabled={!!shareBusy}
                          className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-slate-500 hover:text-indigo-600 rounded disabled:opacity-60 transition-colors"
                          title="Create a new link and disable the current one">
                          {shareBusy === "regenerate" ? <Spinner size={12} /> : <RotateCw className="w-3 h-3" />} New
                        </button>
                        <button type="button" onClick={() => handleShareLink("revoke")} disabled={!!shareBusy}
                          className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-slate-500 hover:text-red-600 rounded disabled:opacity-60 transition-colors"
                          title="Revoke the link — recipients can no longer open it">
                          {shareBusy === "revoke" ? <Spinner size={12} /> : <Unlink className="w-3 h-3" />} Revoke
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleShareLink("create")} disabled={!!shareBusy}
                        className="min-w-0 flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 border border-sky-300 text-sky-700 rounded-lg hover:bg-sky-50 disabled:opacity-60 transition-all">
                        {shareBusy === "create" ? <Spinner size={14} className="shrink-0" /> : <Link2 className="w-3.5 h-3.5 shrink-0" />}
                        <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                          {shareBusy === "create" ? "Creating..." : "Create link"}
                        </span>
                      </button>
                      <button type="button" onClick={sendInvoiceEmailToCustomer} disabled={emailBusy || !!busyAction}
                        title="Email this invoice and its link to the customer"
                        className="min-w-0 flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm">
                        {emailBusy ? <Spinner size={14} className="shrink-0" /> : <Mail className="w-3.5 h-3.5 shrink-0" />}
                        <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                          {emailBusy ? "Sending..." : "Send Email"}
                        </span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Send Email creates the link automatically. Anyone with it can view the invoice without logging in.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Items:</span>
                    <span className="font-semibold text-slate-800">{validItemsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal:</span>
                    <span className="font-mono text-slate-700">Rs. {fmt(totals.subtotal)}</span>
                  </div>
                  {discountEnabled && discountVal > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount ({discountVal}%):</span>
                      <span className="font-mono">-Rs. {fmt(totals.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taxable Amount:</span>
                    <span className="font-mono text-slate-700">Rs. {fmt(totals.taxableAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax:</span>
                    <span className="font-mono text-slate-700">Rs. {fmt(totals.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-slate-200">
                    <span>Total:</span>
                    <span className="font-mono">Rs. {fmt(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPdfPreview && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1200] flex items-center justify-center p-0 sm:p-4" onClick={() => setShowPdfPreview(false)}>
          <div className="bg-white shadow-xl w-full flex flex-col rounded-none sm:rounded-2xl sm:border border-slate-200 h-full sm:h-[92vh] max-w-full sm:max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-slate-200 flex-shrink-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-800 truncate font-mono">{form.invoiceNumber || "Draft"}</h2>
                  <p className="text-xs text-slate-400 truncate">
                    {invoiceType === "PROFORMA_INVOICE" ? "Proforma Invoice" : "Tax Invoice"}
                    {form.customerName ? ` · ${form.customerName}` : ""} · Rs. {fmt(totals.grandTotal)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button onClick={() => setShowShareSheet(true)} disabled={!!busyAction} title="Share"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Share</span>
                </button>
                <button onClick={() => downloadPDF(invoiceType)} disabled={sealRequired || !!busyAction} title="Download PDF"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all">
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Download</span>
                </button>
                <button onClick={() => setShowPdfPreview(false)} aria-label="Close PDF preview"
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Live zoomable document — opens instantly (no <embed>, no blob);
                pinch/ctrl+wheel/double-click own the zoom, page behind is
                scroll-locked and this modal sits above nav + tab bar. */}
            <DocZoomSurface
              paperWidth={PAPER_WIDTH_PX[previewPaperSize] || 794}
              fitCap={1}
              className="min-h-0 w-full flex-1 bg-slate-200/60"
            >
              <InvoiceTemplateRenderer
                business={business}
                customer={previewCustomer}
                form={form}
                items={items}
                totals={totals}
                discountPercent={discountEnabled ? discountPercent : "0"}
                taxMode={form.taxMode}
                type={invoiceType}
                invoiceNumber={form.invoiceNumber}
                paperSize={previewPaperSize}
                template={previewTemplate}
              />
            </DocZoomSurface>
          </div>
        </div>
      )}

      {showShareSheet && (
        <div className="fixed inset-0 z-[1300] bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => !shareBusy && setShowShareSheet(false)}>
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[85dvh] overflow-y-auto pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Share invoice"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-600" /> Share invoice
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{form.invoiceNumber || "Draft"}</p>
              </div>
              <button type="button" onClick={() => setShowShareSheet(false)} disabled={!!shareBusy}
                aria-label="Close share sheet"
                className="p-2 -mr-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 space-y-1">
              <button type="button" onClick={copyLinkFromSheet} disabled={!!shareBusy}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 disabled:opacity-60 transition-colors text-left">
                <span className="w-10 h-10 shrink-0 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
                  {shareBusy === "copy" ? <Spinner size={18} /> : <Link2 className="w-5 h-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">Invoice Link</span>
                  <span className="block text-xs text-slate-400 truncate">
                    {shareUrl ? "Link ready — anyone with it can view" : "Creates a view-only link"}
                  </span>
                </span>
              </button>

              <button type="button" onClick={shareFromSheet} disabled={!!shareBusy}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 disabled:opacity-60 transition-colors text-left">
                <span className="w-10 h-10 shrink-0 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
                  {shareBusy === "sheet-wa" ? <Spinner size={18} /> : <WhatsAppIcon className="w-5 h-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">WhatsApp</span>
                  <span className="block text-xs text-slate-400">Send the invoice link in a chat</span>
                </span>
              </button>

              <button type="button" onClick={shareViaSms} disabled={!!shareBusy}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 disabled:opacity-60 transition-colors text-left">
                <span className="w-10 h-10 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  {shareBusy === "sms" ? <Spinner size={18} /> : <MessageSquare className="w-5 h-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">Text Message</span>
                  <span className="block text-xs text-slate-400">Send the invoice link via SMS</span>
                </span>
              </button>

              <button type="button" onClick={shareProformaFromSheet} disabled={!!shareBusy}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 disabled:opacity-60 transition-colors text-left">
                <span className="w-10 h-10 shrink-0 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  {shareBusy === "proforma" ? <Spinner size={18} /> : <FileText className="w-5 h-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">Share Proforma Invoice</span>
                  <span className="block text-xs text-slate-400">Send the proforma invoice link</span>
                </span>
              </button>

              {canNativeShare && (
                <button type="button" onClick={nativeShareFromSheet} disabled={!!shareBusy}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 disabled:opacity-60 transition-colors text-left">
                  <span className="w-10 h-10 shrink-0 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center">
                    {shareBusy === "native" ? <Spinner size={18} /> : <Share2 className="w-5 h-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">More apps</span>
                    <span className="block text-xs text-slate-400">Open your device's share menu</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
