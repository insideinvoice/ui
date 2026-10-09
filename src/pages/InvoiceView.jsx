import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { invoiceAPI, businessAPI, customerAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, Download, Save, Edit3, Plus, Trash2, FileText, AlertCircle, User, Building2, Phone, MapPin, Hash, Package, Mail, Globe, X, Share2, Smartphone, Link2, Copy, RotateCw, Unlink, ChevronDown, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { processQueue } from "../utils/retryQueue";
import { processPrint } from "../utils/printInvoice";
import { buildInvoiceWhatsAppMessage, openWhatsAppChat } from "../utils/whatsapp";
import { shareLinkToUser, proformaShareUrl } from "../utils/shareLink";
import { getPrintSettings, getInvoiceTemplate } from "../constants/paperSizes";
import { computeInvoiceTotals, round2 } from "../utils/invoiceTotals";
import { INDIAN_STATES, DELIVERY_TERMS, PAYMENT_TERMS } from "../constants/indianStates";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
const emptyItem = () => ({ id: uid(), itemName: "", hsn: "", qty: "1", rate: "", gstPercentage: "18", taxableValue: "0", taxAmount: "0", total: "0" });
const fmt = (v) => parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const inputClass = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400";
const selectClass = "w-full pl-3 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white appearance-none cursor-pointer text-slate-800";
const labelClass = "block text-xs font-semibold text-slate-600 mb-1.5";

// Declared at module scope so React keeps the same component type across renders
// (an inner declaration remounts every row on each parent render).
const InfoRow = memo(({ label, value }) => value ? <p className="text-sm text-slate-600"><span className="text-slate-400">{label}:</span> {value}</p> : null);

const ViewItemRow = memo(({ item, calc, idx, isEditing, onItemChange, onRemove, onAdd }) => (
  <tr className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} ${isEditing ? "hover:bg-blue-50/20" : ""} transition-colors`}>
    <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs border-b border-slate-100">{idx + 1}</td>
    {isEditing ? (
      <>
        <td className="py-3 px-3 border-b border-slate-100">
          <div className="relative">
            <input type="text" value={item.itemName} name={`desc-${idx + 1}`}
              onChange={(e) => onItemChange(idx, "itemName", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const next = document.querySelector(`input[name="hsn-${idx + 1}"]`); next?.focus(); } }}
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white pr-8" placeholder="Item name" />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300" title="Barcode scannable">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5V3h4v2H5v2H3V5zm14 0V3h4v2h-2v2h-2V5zM3 19v-2h2v-2h2v4H3zm14 0v-2h2v-2h2v4h-4zM7 7h1v10H7V7zm3 0h1v10h-1V7zm3 0h1v10h-1V7zm3 0h1v10h-1V7z"/></svg>
            </span>
          </div>
        </td>
        <td className="py-3 px-3 border-b border-slate-100">
          <div className="relative">
            <input type="text" value={item.hsn} name={`hsn-${idx + 1}`}
              onChange={(e) => onItemChange(idx, "hsn", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const qty = document.querySelector(`input[name="qty-${idx + 1}"]`); qty?.focus(); } }}
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono pr-8" placeholder="Scan or type" />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300" title="Barcode scannable">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5V3h4v2H5v2H3V5zm14 0V3h4v2h-2v2h-2V5zM3 19v-2h2v-2h2v4H3zm14 0v-2h2v-2h2v4h-4zM7 7h1v10H7V7zm3 0h1v10h-1V7zm3 0h1v10h-1V7zm3 0h1v10h-1V7z"/></svg>
            </span>
          </div>
        </td>
        <td className="py-3 px-3 border-b border-slate-100">
          <input type="number" step="0.01" min="0" value={item.qty} name={`qty-${idx + 1}`}
            onChange={(e) => onItemChange(idx, "qty", e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const rate = document.querySelector(`input[name="rate-${idx + 1}"]`); rate?.focus(); } }}
            inputMode="decimal"
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 bg-white font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
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
        <td className="py-3 px-3 text-center font-mono text-xs text-slate-500 border-b border-slate-100">{item.hsn || "-"}</td>
        <td className="py-3 px-3 text-right font-mono text-sm text-slate-700 border-b border-slate-100">{item.qty}</td>
        <td className="py-3 px-3 text-right font-mono text-sm text-slate-700 border-b border-slate-100">{fmt(item.rate)}</td>
        <td className="py-3 px-3 text-right font-mono text-sm text-slate-600 border-b border-slate-100">{item.gstPercentage}%</td>
      </>
    )}
    <td className={`py-3 px-3 text-right font-mono text-sm border-b border-slate-100 truncate ${isEditing ? "text-slate-700" : "text-slate-700"}`}>
      {fmt(calc?.taxable ?? item.taxableValue)}
    </td>
    <td className={`py-3 px-3 text-right font-mono text-sm border-b border-slate-100 truncate ${isEditing ? "text-slate-600" : "text-slate-600"}`}>
      {fmt(calc?.tax ?? item.taxAmount)}
    </td>
    <td className={`py-3 px-3 text-right font-mono text-sm font-semibold border-b border-slate-100 truncate ${isEditing ? "text-slate-900" : "text-slate-900"}`}>
      {fmt(calc?.total ?? item.total)}
    </td>
    {isEditing && (
      <td className="py-3 px-2 text-center border-b border-slate-100">
        <button onClick={() => onRemove(idx)}
          className="p-1.5 hover:bg-red-50 rounded transition-colors text-slate-400 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    )}
  </tr>
));

export default function InvoiceView() {
  const { id } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [invoiceType, setInvoiceType] = useState("TAX_INVOICE");
  const invoiceRef = useRef(null);
  const proformaRef = useRef(null);
  // The hidden A4 documents are only mounted while a PDF/print/share action is
  // running — keeping them permanently mounted meant every keystroke and every
  // busy-flag toggle re-rendered two full invoice documents.
  const [captureType, setCaptureType] = useState(null);
  const [sealType, setSealType] = useState(localStorage.getItem("seal_type") || "");
  const sealEnabled = localStorage.getItem("show_seal") === "true";
  const sealRequired = sealEnabled && !sealType;
  const ghostMode = localStorage.getItem("ghost_mode") === "true";
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const discountVal = parseFloat(discountPercent) || 0;
  const [business, setBusiness] = useState(null);
  const [form, setForm] = useState({
    customerId: null, customerName: "", customerEmail: "", customerPhone: "", billingAddress: "", customerGstIn: "",
    invoiceDate: "", dueDate: "", placeOfSupply: "", destination: "", termsOfDelivery: "",
    paymentTerms: "", paymentMode: "CASH", deliveryNote: "", otherReferences: "", notes: "", invoiceNumber: "",
    deliveryNoteDate: "", referenceNumber: "", buyerOrderNumber: "",
    dispatchDocNumber: "", dispatchedThrough: "", invoiceType: "TAX_INVOICE", status: "DRAFT",
  });
  const [items, setItems] = useState([{ ...emptyItem() }]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);

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
        await copyShareUrl(`${window.location.origin}/i/${token}`);
        toast("Previous link disabled — only the new one works", { icon: "🔑" });
      } else if (action === "revoke") {
        await invoiceAPI.revokeShare(id);
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

  // ---------- YouTube-style share sheet ----------
  const [showShareSheet, setShowShareSheet] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const ensureShareToken = async () => {
    if (shareToken) return shareToken;
    const res = await invoiceAPI.createShare(id);
    const token = res.data?.data?.token;
    if (!token) throw new Error("no token");
    setShareToken(token);
    return token;
  };

  const shareLinkFor = async () => `${window.location.origin}/i/${await ensureShareToken()}`;

  const copyLinkFromSheet = async () => {
    if (shareBusy || busyAction) return;
    setShareBusy("copy");
    try {
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
      const url = await shareLinkFor();
      await navigator.share({
        title: `Invoice ${form.invoiceNumber || ""}`.trim(),
        text: `Invoice ${form.invoiceNumber || ""}${business?.businessName ? ` — ${business.businessName}` : ""}`,
        url,
      });
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
    setEmailBusy(true);
    try {
      // Make sure the panel shows the same link the email will carry.
      if (!shareToken) {
        const res = await invoiceAPI.createShare(id);
        setShareToken(res.data?.data?.token);
      }
      const res = await invoiceAPI.sendInvoiceEmail(id, window.location.origin);
      toast.success(res.data?.message || "Invoice emailed to the customer");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send the invoice email");
    } finally {
      setEmailBusy(false);
    }
  };



  useEffect(() => {
    Promise.all([
      invoiceAPI.getById(id),
      businessAPI.getProfile().catch(() => null),
    ]).then(([invRes, bizRes]) => {
      const inv = invRes.data.data;
      setBusiness(bizRes?.data?.data || null);
      setInvoiceType(inv.invoiceType || "TAX_INVOICE");
      const dPct = parseFloat(inv.discountPercent);
      setDiscountEnabled(!Number.isNaN(dPct) && dPct > 0);
      setDiscountPercent(!Number.isNaN(dPct) && dPct > 0 ? String(inv.discountPercent) : "");
      setForm({
        customerId: inv.customerId || null, customerName: inv.customerName || "", customerEmail: "", customerPhone: "",
        billingAddress: "", customerGstIn: "", invoiceDate: inv.invoiceDate || "",
        dueDate: inv.dueDate || "", placeOfSupply: inv.placeOfSupply || "",
        destination: inv.destination || "", termsOfDelivery: inv.termsOfDelivery || "",
        paymentTerms: inv.paymentTerms || "", paymentMode: inv.paymentMode || "CASH", deliveryNote: inv.deliveryNote || "",
        otherReferences: inv.otherReferences || "", notes: inv.notes || "",
        invoiceNumber: inv.invoiceNumber || "",
        deliveryNoteDate: inv.deliveryNoteDate || "", referenceNumber: inv.referenceNumber || "",
        buyerOrderNumber: inv.buyerOrderNumber || "", dispatchDocNumber: inv.dispatchDocNumber || "",
        dispatchedThrough: inv.dispatchedThrough || "",
        invoiceType: inv.invoiceType || "TAX_INVOICE", status: inv.status || "DRAFT",
      });
      setItems((inv.items || []).length > 0 ? inv.items.map((i) => ({
        id: uid(),
        itemName: i.itemName, hsn: i.hsn || "", qty: String(i.qty), rate: String(i.rate),
        gstPercentage: String(i.gstPercentage), taxableValue: String(i.taxableValue || 0),
        taxAmount: String(i.taxAmount || 0), total: String(i.total || 0),
      })) : [{ ...emptyItem() }]);
      if (inv.customerId) {
        customerAPI.getById(inv.customerId)
          .then((cRes) => {
            const c = cRes.data.data;
            setForm((p) => ({
              ...p, customerEmail: c.email || "", customerPhone: c.phone || "",
              billingAddress: c.billingAddress || "", customerGstIn: c.gstIn || "",
            }));
          })
          .catch(() => {});
      }
    })
    .catch(() => setError("Failed to load invoice"))
    .finally(() => setLoading(false));
  }, [id]);

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

  const totals = useMemo(() => computeInvoiceTotals(items, discountEnabled ? discountPercent : "0"), [items, discountEnabled, discountPercent]);

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

  const validate = () => {
    if (!form.customerName.trim()) { toast.error("Customer name is required"); return false; }
    if (!form.invoiceDate) { toast.error("Invoice date is required"); return false; }
    const validItems = items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0);
    if (validItems.length === 0) { toast.error("At least one valid item required"); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await invoiceAPI.update(id, {
        customerId: form.customerId,
        invoiceType: form.invoiceType,
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
        discountPercent: discountEnabled ? parseFloat(discountPercent) || 0 : 0,
        items: items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0)
          .map((i, idx) => ({
            sno: idx + 1, itemName: i.itemName, hsn: i.hsn || undefined,
            qty: parseFloat(i.qty), rate: parseFloat(i.rate), gstPercentage: parseFloat(i.gstPercentage) || 0,
          })),
      });
      toast.success("Invoice updated successfully");
      setIsEditing(false);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Failed to update invoice";
      toast.error(msg);
      console.error("Update invoice error:", err.response?.data);
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = async (type) => {
    if (isEditing) {
      if (!validate()) return;
      handleSave().catch(() => {});
    }
    setBusyAction(`download:${type}`);
    try {
      const filename = `${type === "PROFORMA_INVOICE" ? "Proforma" : "Tax"}_Invoice_${form.invoiceNumber}.pdf`;
      const captureRef = await mountCapture(type);
      const ps = (getPrintSettings()[type] || {}).paperSize || "A4_PORTRAIT";
      await processPrint(captureRef, type, filename, ps);
    } catch (err) {
      toast.error("Failed to generate");
    } finally {
      releaseCapture();
      setBusyAction("");
    }
  };

  const shareViaWhatsApp = async () => {
    if (busyAction) return;
    setBusyAction("whatsapp");
    try {
      // 1. Save the invoice (if unsaved / editing)
      if (isEditing) {
        if (!validate()) {
          setBusyAction("");
          return;
        }
        await handleSave();
      }

      // 2. Create/ensure a public share link
      const token = await ensureShareToken();
      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://insideinvoice.com";
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

  const viewPDF = async () => {
    setBusyAction("view");
    try {
      const { buildInvoicePdf } = await import("../utils/invoicePdf");
      const ps = (getPrintSettings()[invoiceType] || {}).paperSize || "A4_PORTRAIT";
      const captureRef = await mountCapture(invoiceType);
      const pdf = await buildInvoicePdf(captureRef.current, ps);
      const blob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(blob) + "#toolbar=0";
      setPdfPreviewUrl(blobUrl);
      setShowPdfPreview(true);
    } catch {
      toast.error("Failed to generate PDF preview");
    } finally {
      releaseCapture();
      setBusyAction("");
    }
  };

  // Sends the already-generated PDF (the one shown in the preview modal) to
  // the printer via a hidden iframe — this prints the PDF document itself,
  // never the surrounding HTML page.
  const printPreviewPdf = () => {
    if (!pdfPreviewUrl) return;
    const url = pdfPreviewUrl.split("#")[0];
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Print invoice PDF");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    iframe.src = url;
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        // cross-viewers that block scripted print: hand the PDF to the user
        window.open(url, "_blank");
      }
      // keep the frame alive while the print dialog is open, then clean up
      setTimeout(() => iframe.remove(), 60 * 1000);
    };
    document.body.appendChild(iframe);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
        <LoadingDots className="text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <AppNavbar />
        <div className="px-6 py-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600">{error}</p>
          <button onClick={() => navigate("/invoices")} className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium">Back to Invoices</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
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
            type="PROFORMA_INVOICE"
            invoiceNumber={form.invoiceNumber}
            paperSize={proformaPaperSize}
            template={proformaTemplate}
          />
        </div>
      )}
      <div className="max-w-[1900px] mx-auto px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title="View Invoice" backTo="/invoices" />
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

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-4 space-y-6">
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
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col items-center sm:items-start">
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
                        <option value="">Select state</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Destination</label>
                    <div className="relative">
                      <select name="destination" value={form.destination} onChange={handleFieldChange} className={selectClass}>
                        <option value="">Select state</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Terms of Delivery</label>
                    <div className="relative">
                      <select name="termsOfDelivery" value={form.termsOfDelivery} onChange={handleFieldChange} className={selectClass}>
                        {DELIVERY_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Payment Terms</label>
                    <div className="relative">
                      <select name="paymentTerms" value={form.paymentTerms} onChange={handleFieldChange} className={selectClass}>
                        {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Delivery Note</label>
                    <input name="deliveryNote" value={form.deliveryNote} onChange={handleFieldChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Other References</label>
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
                  {form.destination && <div>
                    <label className={labelClass}>Destination</label>
                    <p className="text-sm text-slate-800">{form.destination}</p>
                  </div>}
                  {form.termsOfDelivery && <div>
                    <label className={labelClass}>Terms of Delivery</label>
                    <p className="text-sm text-slate-800">{form.termsOfDelivery}</p>
                  </div>}
                  {form.paymentTerms && <div>
                    <label className={labelClass}>Payment Terms</label>
                    <p className="text-sm text-slate-800">{form.paymentTerms}</p>
                  </div>}
                  {form.deliveryNote && <div>
                    <label className={labelClass}>Delivery Note</label>
                    <p className="text-sm text-slate-800">{form.deliveryNote}</p>
                  </div>}
                  {form.otherReferences && <div>
                    <label className={labelClass}>Other References</label>
                    <p className="text-sm text-slate-800">{form.otherReferences}</p>
                  </div>}
                  {form.paymentMode && <div>
                    <label className={labelClass}>Payment Mode</label>
                    <p className="text-sm text-slate-800">{form.paymentMode}</p>
                  </div>}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-slate-600" />
                  <h2 className="text-sm font-bold text-slate-800">Items</h2>
                </div>
                {isEditing && (
                  <button onClick={addItem}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all shadow-sm min-h-[44px]">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block border border-slate-200 rounded-lg">
                <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "10%" }} />
                    {isEditing && <col style={{ width: "2%" }} />}
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-800">
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-center">#</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-left">Description</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-center">HSN/SAC</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-center">Qty</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-center">Rate</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-center">GST %</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-right">Taxable</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-right">Tax</th>
                      <th className="text-white text-xs font-semibold py-3.5 px-3 text-right">Total</th>
                      {isEditing && <th className="text-white"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <ViewItemRow key={item.id ?? idx} item={item} calc={totals.perItem[idx]} idx={idx} isEditing={isEditing} onItemChange={handleItemChange} onRemove={removeItem} onAdd={addItem} />
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
                        <button onClick={() => removeItem(idx)}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors text-slate-400 hover:text-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 uppercase">Description</label>
                          <input type="text" value={item.itemName}
                            onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white min-h-[44px]" placeholder="Item name" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">HSN/SAC</label>
                            <input type="text" value={item.hsn}
                              onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white font-mono min-h-[44px]" />
                          </div>
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
                          <div><span className="text-slate-400">HSN:</span> <span className="font-mono">{item.hsn || "-"}</span></div>
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

          {/* Right Sidebar */}
          <div className="xl:col-span-1 space-y-4">
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-6">
              <h2 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">Actions</h2>
              <div className="flex flex-col sm:flex-row xl:flex-col gap-2 sm:flex-wrap">
                {isEditing ? (
                  <>
                    <button onClick={handleSave} disabled={saving}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm">
                      {saving ? <LoadingDots className="text-white" /> : <Save className="w-4 h-4" />}
                      {saving ? "Saving..." : "Save Invoice"}
                    </button>
                    <button onClick={() => setIsEditing(false)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-all">
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </>
                ) : null}
                {!isEditing && (
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setIsEditing(true)} title="Update invoice"
                      className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-all shadow-sm">
                      <Edit3 className="w-4 h-4" /> Update
                    </button>
                    <button onClick={() => viewPDF(invoiceType)} disabled={sealRequired || !!busyAction} title="View PDF"
                      className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">
                      {busyAction === "view" ? <Spinner size={16} /> : <FileText className="w-4 h-4" />} View
                    </button>
                    <button onClick={() => setShowShareSheet(true)} disabled={!!busyAction} title="Share"
                      className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm">
                      <Share2 className="w-4 h-4" /> Share
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
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-all">
                        <Copy className="w-3.5 h-3.5" /> Copy link
                      </button>
                      <button type="button" onClick={sendInvoiceEmailToCustomer} disabled={emailBusy || !!busyAction}
                        title="Email this invoice and its link to the customer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm">
                        {emailBusy ? <Spinner size={14} /> : <Mail className="w-3.5 h-3.5" />} {emailBusy ? "Sending..." : "Send Email"}
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
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border border-sky-300 text-sky-700 text-xs font-semibold rounded-lg hover:bg-sky-50 disabled:opacity-60 transition-all">
                        {shareBusy === "create" ? <Spinner size={14} /> : <Link2 className="w-3.5 h-3.5" />}
                        {shareBusy === "create" ? "Creating..." : "Create link"}
                      </button>
                      <button type="button" onClick={sendInvoiceEmailToCustomer} disabled={emailBusy || !!busyAction}
                        title="Email this invoice and its link to the customer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm">
                        {emailBusy ? <Spinner size={14} /> : <Mail className="w-3.5 h-3.5" />} {emailBusy ? "Sending..." : "Send Email"}
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

      {showPdfPreview && pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4" onClick={() => { setShowPdfPreview(false); URL.revokeObjectURL(pdfPreviewUrl.split("#")[0]); setPdfPreviewUrl(null); }}>
          <div className="bg-white shadow-xl border-slate-200 w-full flex flex-col rounded-none sm:rounded-2xl sm:border h-full sm:h-[90vh] max-w-full sm:max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex-shrink-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                <h2 className="text-sm font-bold text-slate-800 truncate">Invoice PDF</h2>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button onClick={() => setShowShareSheet(true)} disabled={!!busyAction}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Share</span>
                </button>
                <button onClick={printPreviewPdf} disabled={!!busyAction} title="Print PDF"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm">
                  <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Print</span>
                </button>
                <button onClick={() => { setShowPdfPreview(false); setPdfPreviewUrl(null); }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-2 sm:p-4 bg-slate-100/50">
              <embed src={pdfPreviewUrl} className="w-full h-full rounded-lg border border-slate-200" type="application/pdf" />
            </div>
          </div>
        </div>
      )}

      {showShareSheet && (
        <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => !shareBusy && setShowShareSheet(false)}>
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4"
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
                  <span className="block text-sm font-semibold text-slate-800">Copy link</span>
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
