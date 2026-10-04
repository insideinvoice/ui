import { useState, useEffect, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingDots from "../components/LoadingDots";
import Spinner from "../components/Spinner";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { invoiceAPI } from "../api/auth";
import { resolveBusinessProfile, getBusinessProfile } from "../utils/businessProfile";
import toast from "react-hot-toast";
import { ArrowLeft, FileText, Download, Eye, PlusCircle, Share2, Trash2, Search, X } from "lucide-react";
import { downloadInvoicePDF } from "../components/InvoicePDF";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import { getPrintSettings, getPaperDimensions } from "../constants/paperSizes";
import { openWhatsApp, buildInvoiceWhatsAppMessage } from "../utils/whatsapp";

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const waitForPaint = (el) => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(async () => {
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const imgs = el ? Array.from(el.querySelectorAll("img")) : [];
      await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => {
        img.addEventListener("load", r, { once: true });
        img.addEventListener("error", r, { once: true });
      }))));
    } catch {
      // ignore
    }
    resolve();
  }));
});

const parseDate = (dateStr) => {
  if (!dateStr) return { month: 0, year: 0 };
  const parts = dateStr.split(/[-/]/);
  if (parts.length < 2) return { month: 0, year: 0 };
  let month = 0, year = 0;
  const first = parseInt(parts[0], 10);
  if (first > 31) {
    year = first;
    month = parseInt(parts[1], 10) || 0;
  } else {
    month = parseInt(parts[1], 10) || 0;
    year = parts.length >= 3 ? parseInt(parts[2], 10) || 0 : 0;
  }
  return { month, year };
};

export default function InvoicesList() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => location.state?.month ? String(location.state.month) : "");
  const [selectedYear, setSelectedYear] = useState(() => location.state?.year ? String(location.state.year) : "");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [busy, setBusy] = useState("");

  const isBusy = (id, action) => busy === `${id}:${action}`;
  const rowBusy = (id) => busy.startsWith(`${id}:`);

  const goToInvoice = useCallback((invoice) => {
    setBusy(`${invoice.id}:view`);
    window.setTimeout(() => navigate(`/invoice/${invoice.id}`), 80);
  }, [navigate]);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await invoiceAPI.getAll({ size: 100, sortBy: "createdAt", sortDir: "desc" });
      setInvoices(res.data.data?.content || res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Warm the business profile cache so the first PDF/share click is instant
  useEffect(() => { getBusinessProfile().catch(() => {}); }, []);

  const filtered = useMemo(() => invoices.filter((inv) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesSearch = (inv.invoiceNumber || "").toLowerCase().includes(q)
        || (inv.customerName || "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (selectedMonth || selectedYear) {
      const { month, year } = parseDate(inv.invoiceDate || "");
      if (!month && !year) return false;
      if (selectedMonth && month !== parseInt(selectedMonth, 10)) return false;
      if (selectedYear && year !== parseInt(selectedYear, 10)) return false;
    }
    return true;
  }), [invoices, search, selectedMonth, selectedYear]);

  const monthNames = MONTH_NAMES;

  // Get all year+month combos from invoices
  const yearMonthPairs = useMemo(() => invoices
    .map((inv) => parseDate(inv.invoiceDate || ""))
    .filter((d) => d.month > 0 && d.year > 0), [invoices]);

  // Available years: unique years from all invoices
  const availableYears = useMemo(
    () => [...new Set(yearMonthPairs.map((d) => d.year))].sort((a, b) => b - a),
    [yearMonthPairs]
  );

  // Available months: depends on selected year
  const availableMonths = useMemo(() => [...new Set(
    yearMonthPairs
      .filter((d) => {
        if (!selectedYear) return true;
        return d.year === parseInt(selectedYear, 10);
      })
      .map((d) => d.month)
  )].sort((a, b) => a - b), [yearMonthPairs, selectedYear]);

  // Available years: depends on selected month
  const availableYearsForMonth = useMemo(() => [...new Set(
    yearMonthPairs
      .filter((d) => {
        if (!selectedMonth) return true;
        return d.month === parseInt(selectedMonth, 10);
      })
      .map((d) => d.year)
  )].sort((a, b) => b - a), [yearMonthPairs, selectedMonth]);

  // Handle year change - reset month if not available in new year
  const handleYearChange = useCallback((e) => {
    const newYear = e.target.value;
    setSelectedYear(newYear);
    if (newYear && selectedMonth) {
      const monthExists = yearMonthPairs.some(
        (d) => d.year === parseInt(newYear, 10) && d.month === parseInt(selectedMonth, 10)
      );
      if (!monthExists) setSelectedMonth("");
    }
  }, [selectedMonth, yearMonthPairs]);

  // Handle month change - reset year if not available in new month
  const handleMonthChange = useCallback((e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    if (newMonth && selectedYear) {
      const yearExists = yearMonthPairs.some(
        (d) => d.month === parseInt(newMonth, 10) && d.year === parseInt(selectedYear, 10)
      );
      if (!yearExists) setSelectedYear("");
    }
  }, [selectedYear, yearMonthPairs]);

  const downloadPDF = useCallback(async (invoice) => {
    setBusy(`${invoice.id}:pdf`);
    const business = await resolveBusinessProfile();
    const items = (invoice.items || []).map((i) => ({
      itemName: i.itemName, hsn: i.hsn || "", qty: String(i.qty), rate: String(i.rate),
      gstPercentage: String(i.gstPercentage), taxableValue: i.taxableValue, taxAmount: i.taxAmount, total: i.total,
    }));
    const totals = {
      subtotal: invoice.subtotal || 0,
      taxAmount: invoice.taxAmount || 0,
      grandTotal: invoice.grandTotal || 0,
    };

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;pointer-events:none;";
    document.body.appendChild(container);
    const root = createRoot(container);
    const filename = `${invoice.invoiceType === "PROFORMA_INVOICE" ? "Proforma" : "Tax"}_Invoice_${invoice.invoiceNumber}.pdf`;

    try {
      await new Promise((resolve, reject) => {
        let done = false;
        root.render(
          <InvoiceTemplateRenderer
            ref={(el) => {
              if (el && !done) {
                done = true;
                waitForPaint(el).then(() => downloadInvoicePDF(el, filename)).then(resolve).catch(reject);
              }
            }}
            business={business}
            customer={{
              name: invoice.customerName || "",
              billingAddress: invoice.billingAddress || "",
              gstIn: invoice.customerGstIn || "",
              phone: invoice.customerPhone || "",
              email: invoice.customerEmail || "",
            }}
            form={{
              invoiceDate: invoice.invoiceDate || "",
              dueDate: invoice.dueDate || "",
              placeOfSupply: invoice.placeOfSupply || "",
              destination: invoice.destination || "",
              termsOfDelivery: invoice.termsOfDelivery || "",
              paymentTerms: invoice.paymentTerms || "",
              deliveryNote: invoice.deliveryNote || "",
              otherReferences: invoice.otherReferences || "",
              notes: invoice.notes || "",
              deliveryNoteDate: invoice.deliveryNoteDate || "",
              referenceNumber: invoice.referenceNumber || "",
              buyerOrderNumber: invoice.buyerOrderNumber || "",
              dispatchDocNumber: invoice.dispatchDocNumber || "",
              dispatchedThrough: invoice.dispatchedThrough || "",
            }}
            items={items}
            totals={totals}
            type={invoice.invoiceType}
            invoiceNumber={invoice.invoiceNumber}
            template={localStorage.getItem("invoice_template") || "template-1"}
          />
        );
      });
    } catch (err) {
      toast.error("Failed to download PDF");
    } finally {
      root.unmount();
      document.body.removeChild(container);
      setBusy("");
    }
  }, []);

  const ghostMode = useMemo(() => localStorage.getItem("ghost_mode") === "true", []);

  const openDeleteModal = useCallback((invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!invoiceToDelete) return;
    try {
      await invoiceAPI.delete(invoiceToDelete.id);
      toast.success("Invoice deleted");
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceToDelete.id));
      setDeleteModalOpen(false);
      setInvoiceToDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete invoice");
    }
  }, [invoiceToDelete]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteModalOpen(false);
    setInvoiceToDelete(null);
  }, []);

const printInvoice = useCallback(async (invoice) => {
    setBusy(`${invoice.id}:share`);
    const business = await resolveBusinessProfile();
    const items = (invoice.items || []).map((i) => ({
      itemName: i.itemName, hsn: i.hsn || "", qty: String(i.qty), rate: String(i.rate),
      gstPercentage: String(i.gstPercentage), taxableValue: i.taxableValue, taxAmount: i.taxAmount, total: i.total,
    }));
    const totals = {
      subtotal: invoice.subtotal || 0,
      taxAmount: invoice.taxAmount || 0,
      grandTotal: invoice.grandTotal || 0,
    };

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;pointer-events:none;";
    document.body.appendChild(container);
    const root = createRoot(container);
    const filename = `${invoice.invoiceType === "PROFORMA_INVOICE" ? "Proforma" : "Tax"}_Invoice_${invoice.invoiceNumber}.pdf`;
    const paperSizeId = (getPrintSettings()[invoice.invoiceType] || {}).paperSize || "A4_PORTRAIT";

    try {
      await new Promise((resolve, reject) => {
        let done = false;
        root.render(
          <InvoiceTemplateRenderer
            ref={(el) => {
              if (el && !done) {
                done = true;
                waitForPaint(el).then(async () => {
                  try {
                    const { jsPDF } = await import("jspdf");
                    const html2canvas = (await import("html2canvas")).default;
                    const dim = getPaperDimensions(paperSizeId);
                    const SCALE = 2;
                    const CONTENT_W = dim.contentW;
                    const LEFT = dim.left;
                    const PAGE_H = dim.usableH;
                    const rowSelectors = [
                      '[id^="section-item-row-"]', '[id^="section-hsn-row-"]',
                      "#section-subtotals", "#section-amount-words",
                      "#section-hsn-header", "#section-hsn-total", "#section-hsn-words",
                      "#section-footer", "#section-bottom-note",
                      "#section-bottom-note",
                    ];
                    const allRowEls = el.querySelectorAll(rowSelectors.join(", "));
                    const invoiceRect = el.getBoundingClientRect();
                    const canvas = await html2canvas(el, { scale: SCALE, useCORS: true, logging: false });
                    const imgW = CONTENT_W;
                    const imgH = (canvas.height / canvas.width) * imgW;
                    const pdf = new jsPDF(dim.orientation, "mm", dim.format);
                    let hPos = 0;
                    const firstRow = allRowEls.length > 0 ? allRowEls[0] : el;
                    const firstRowTop = firstRow.getBoundingClientRect().top - invoiceRect.top;
                    const firstRowPageBreak = (firstRowTop / invoiceRect.height) * imgH;
                    const bottomNote = el.querySelector("#section-bottom-note");
                    const afterBottomNote = bottomNote
                      ? ((bottomNote.getBoundingClientRect().top - invoiceRect.top + bottomNote.getBoundingClientRect().height) / invoiceRect.height) * imgH
                      : imgH;
                    const contentEnd = afterBottomNote;
                    const availH = PAGE_H;
                    while (hPos < contentEnd) {
                      const srcY = (hPos / imgH) * canvas.height;
                      const sliceH = Math.min(availH, contentEnd - hPos);
                      const srcH = (sliceH / imgH) * canvas.height;
                      const pageCanvas = document.createElement("canvas");
                      pageCanvas.width = canvas.width;
                      pageCanvas.height = srcH;
                      const ctx = pageCanvas.getContext("2d");
                      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
                      const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
                      if (hPos > 0) pdf.addPage();
                      pdf.addImage(pageImgData, "JPEG", LEFT, 0, imgW, sliceH);
                      hPos += availH;
                    }
                    const blob = pdf.output("blob");
                    let shared = false;
                    try {
                      if (navigator.share) {
                        const file = new File([blob], filename, { type: "application/pdf" });
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                          await navigator.share({ files: [file], title: filename });
                          shared = true;
                        }
                      }
                    } catch (_) {}
                    if (!shared) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = filename; a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 5000);
                      toast.success("PDF downloaded");
                    }
                    resolve();
                  } catch (e) { reject(e); }
                });
              }
            }}
            business={business}
            customer={{
              name: invoice.customerName || "",
              billingAddress: invoice.billingAddress || "",
              gstIn: invoice.customerGstIn || "",
              phone: invoice.customerPhone || "",
              email: invoice.customerEmail || "",
            }}
            form={{
              invoiceDate: invoice.invoiceDate || "",
              dueDate: invoice.dueDate || "",
              placeOfSupply: invoice.placeOfSupply || "",
              destination: invoice.destination || "",
              termsOfDelivery: invoice.termsOfDelivery || "",
              paymentTerms: invoice.paymentTerms || "",
              deliveryNote: invoice.deliveryNote || "",
              otherReferences: invoice.otherReferences || "",
              notes: invoice.notes || "",
              deliveryNoteDate: invoice.deliveryNoteDate || "",
              referenceNumber: invoice.referenceNumber || "",
              buyerOrderNumber: invoice.buyerOrderNumber || "",
              dispatchDocNumber: invoice.dispatchDocNumber || "",
              dispatchedThrough: invoice.dispatchedThrough || "",
            }}
            items={items}
            totals={totals}
            type={invoice.invoiceType}
            invoiceNumber={invoice.invoiceNumber}
            template={localStorage.getItem("invoice_template") || "template-1"}
          />
        );
      });
    } catch (err) {
      toast.error("Failed to print");
    } finally {
      root.unmount();
      document.body.removeChild(container);
      setBusy("");
    }
  }, []);
}, []);

const shareViaWhatsApp = useCallback(async (invoice) => {
    if (busy) return;
    setBusy(`${invoice.id}:whatsapp`);
    try {
      const business = await resolveBusinessProfile();
      const total = invoice.grandTotal || 0;
      const label = invoice.invoiceType === "PROFORMA_INVOICE" ? "Proforma Invoice" : "Tax Invoice";
      const text = `Hello,\n\n${label} ${invoice.invoiceNumber || ""} - Total: Rs. ${total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      await openWhatsApp({
        text: `Hello ${invoice.customerName || ""},\n\n${label} ${invoice.invoiceNumber || ""} - Total: Rs. ${total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n- ${business?.businessName || ""}`,
        getPdfFile: () => createInvoicePdfFileFromInvoice(invoice),
      });
    } catch (err) {
      toast.error("Failed to share on WhatsApp");
    } finally {
      setBusy("");
    }
  }, [busy];
);

const createInvoicePdfFileFromInvoice = async (invoice) => {
  try {
    const business = await resolveBusinessProfile();
    const items = (invoice.items || []).map((i) => ({
      itemName: i.itemName, hsn: i.hsn || "", qty: String(i.qty), rate: String(i.rate),
      gstPercentage: String(i.gstPercentage), taxableValue: i.taxableValue, taxAmount: i.taxAmount, total: i.total,
    }));
    const totals = {
      subtotal: invoice.subtotal || 0,
      taxAmount: invoice.taxAmount || 0,
      grandTotal: invoice.grandTotal || 0,
    };
    const filename = `${invoice.invoiceType === "PROFORMA_INVOICE" ? "Proforma" : "Tax"}_Invoice_${invoice.invoiceNumber}.pdf`;
    
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;pointer-events:none;";
    document.body.appendChild(container);
    const root = createRoot(container);
    
    const { jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");
    const dim = getPaperDimensions((getPrintSettings()[invoice.invoiceType] || {}).paperSize || "A4_PORTRAIT");
    
    const canvas = await html2canvas(root.current ? root.current : container, { scale: 2, useCORS: true, logging: false });
    const pdf = new jsPDF(dim.orientation, "mm", dim.format);
    const PAGE_W = dim.pageW, PAGE_H = dim.pageH, LEFT = dim.left, CONTENT_W = dim.contentW, PY = 10;
    const usableH = dim.usableH;
    const pxToMm = CONTENT_W / canvas.width;
    const onePagePx = usableH / pxToMm;
    let pageStartPx = 0, isFirstPage = true;
    
    while (pageStartPx < canvas.height) {
      const sliceH = Math.min(onePagePx, canvas.height - pageStartPx);
      const sc = document.createElement("canvas");
      sc.width = canvas.width; sc.height = sliceH;
      sc.getContext("2d").drawImage(canvas, 0, pageStartPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (!isFirstPage) pdf.addPage();
      pdf.addImage(sc.toDataURL("image/jpeg", 0.95), "JPEG", LEFT, PY, CONTENT_W, sliceH * pxToMm);
      pageStartPx += sliceH; isFirstPage = false;
    }
    
    const blob = pdf.output("blob");
    URL.revokeObjectURL(container.toDataURL());
    document.body.removeChild(container);
    
    return new File([blob], filename, { type: "application/pdf" });
  } catch (err) {
    toast.error("Failed to generate PDF for WhatsApp");
    return null;
  }
};

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <AppNavbar />
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100dvh - 80px)" }}>
          <LoadingDots className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="View Invoices" />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
              <select value={selectedMonth} onChange={handleMonthChange}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white">
                <option value="">All Months</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>{monthNames[m]}</option>
                ))}
              </select>
              <select value={selectedYear} onChange={handleYearChange}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white">
                <option value="">All Years</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice no. or customer..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white" />
              </div>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 sm:p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No invoices yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Create your first invoice to get started</p>
              <button onClick={() => navigate("/invoice")}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-sm">
                <PlusCircle className="w-4 h-4" /> Create Invoice
              </button>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice No.</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv, i) => (
                      <tr key={inv.id} className={`border-b border-slate-100 hover:bg-slate-100 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                        <td className="py-3 px-4">
                          <button onClick={() => navigate(`/invoice/${inv.id}`)} className="inline-flex items-center font-mono text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md border border-indigo-200 hover:border-indigo-300 transition-all">
                            {inv.invoiceNumber}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-xs sm:text-sm text-slate-600">{inv.customerName}</td>
                        <td className="py-3 px-4 text-xs sm:text-sm text-slate-600">{inv.invoiceDate}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            inv.invoiceType === "PROFORMA_INVOICE" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {inv.invoiceType === "PROFORMA_INVOICE" ? "Proforma" : "Tax"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs sm:text-sm font-semibold text-slate-800">
                          Rs. {parseFloat(inv.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => goToInvoice(inv)} disabled={rowBusy(inv.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-60">
                              {isBusy(inv.id, "view") ? <Spinner size={14} /> : <Eye className="w-3.5 h-3.5" />} {isBusy(inv.id, "view") ? "Loading..." : "View"}
                            </button>
                            <button onClick={() => downloadPDF(inv)} disabled={rowBusy(inv.id)}
                              className="p-2 hover:bg-indigo-50 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 disabled:opacity-60" title="Download PDF">
                              {isBusy(inv.id, "pdf") ? <Spinner size={16} /> : <Download className="w-4 h-4" />}
                            </button>
                            <button onClick={() => printInvoice(inv)} disabled={rowBusy(inv.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-60">
                              {isBusy(inv.id, "share") ? <Spinner size={14} /> : <Share2 className="w-3.5 h-3.5" />} {isBusy(inv.id, "share") ? "Loading..." : "Share"}
                            </button>
                            {ghostMode && (
                              <button onClick={() => openDeleteModal(inv)}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-600" title="Delete Invoice">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-3">
                {filtered.map((inv) => (
                  <div key={inv.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:bg-slate-50 transition-colors" onClick={() => goToInvoice(inv)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                        {inv.invoiceNumber}
                      </span>
                      {isBusy(inv.id, "view") ? (
                        <Spinner size={18} className="text-indigo-500" />
                      ) : (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          inv.invoiceType === "PROFORMA_INVOICE" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {inv.invoiceType === "PROFORMA_INVOICE" ? "Proforma" : "Tax"}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-slate-800 mb-2">{inv.customerName}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{inv.invoiceDate}</span>
                      <span className="font-mono text-sm font-semibold text-slate-800">
                        Rs. {parseFloat(inv.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                      <button onClick={(e) => { e.stopPropagation(); goToInvoice(inv); }} disabled={rowBusy(inv.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors min-h-[44px] disabled:opacity-60">
                        {isBusy(inv.id, "view") ? <Spinner size={14} /> : <Eye className="w-3.5 h-3.5" />} {isBusy(inv.id, "view") ? "Loading..." : "View"}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); downloadPDF(inv); }} disabled={rowBusy(inv.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors min-h-[44px] disabled:opacity-60">
                        {isBusy(inv.id, "pdf") ? <Spinner size={14} /> : <Download className="w-3.5 h-3.5" />} {isBusy(inv.id, "pdf") ? "Loading..." : "PDF"}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); printInvoice(inv); }} disabled={rowBusy(inv.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors min-h-[44px] disabled:opacity-60">
                        {isBusy(inv.id, "share") ? <Spinner size={14} /> : <Share2 className="w-3.5 h-3.5" />} {isBusy(inv.id, "share") ? "Loading..." : "Share"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Invoice"
        message={
          <>
            Are you sure you want to delete invoice{" "}
            <span className="inline-flex items-center font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 mx-0.5">
              {invoiceToDelete?.invoiceNumber || ""}
            </span>
            ? This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
