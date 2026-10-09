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
import { ArrowLeft, FileText, Download, Eye, PlusCircle, Share2, Trash2, Search, X, Link2, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { downloadInvoicePDF } from "../components/InvoicePDF";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import { getInvoiceTemplate } from "../constants/paperSizes";
import { buildInvoiceWhatsAppMessage, openWhatsAppChat } from "../utils/whatsapp";
import { shareLinkToUser, proformaShareUrl } from "../utils/shareLink";

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

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

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

  // Reset to first page when search filters change or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedMonth, selectedYear, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedInvoices = useMemo(
    () => filtered.slice(startIndex, startIndex + pageSize),
    [filtered, startIndex, pageSize]
  );

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
            discountPercent={String(invoice.discountPercent || "0")}
            type={invoice.invoiceType}
            invoiceNumber={invoice.invoiceNumber}
            template={getInvoiceTemplate(invoice.invoiceType)}
          />
        );
      });
    } catch {
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

  // ---------- Share sheet (same as InvoiceView) ----------
  const [shareSheetInvoice, setShareSheetInvoice] = useState(null);
  const [shareBusy, setShareBusy] = useState("");
  const [sheetShareToken, setSheetShareToken] = useState(null);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;
  const sheetShareUrl = shareSheetInvoice && sheetShareToken
    ? `${window.location.origin}/i/${sheetShareToken}` : "";

  const openShareSheet = useCallback((invoice) => {
    setShareSheetInvoice(invoice);
    setSheetShareToken(null);
    setShareBusy("");
  }, []);

  const closeShareSheet = useCallback(() => {
    if (shareBusy) return;
    setShareSheetInvoice(null);
    setSheetShareToken(null);
  }, [shareBusy]);

  const ensureSheetShareToken = async () => {
    if (sheetShareToken) return sheetShareToken;
    const res = await invoiceAPI.createShare(shareSheetInvoice.id);
    const token = res.data?.data?.token;
    if (!token) throw new Error("no token");
    setSheetShareToken(token);
    return token;
  };

  const sheetShareLink = async () => `${window.location.origin}/i/${await ensureSheetShareToken()}`;

  const copyLinkFromSheet = async () => {
    if (shareBusy) return;
    setShareBusy("copy");
    try {
      const url = await sheetShareLink();
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied to clipboard");
      } catch {
        toast.success(`Share link: ${url}`);
      }
      closeShareSheet();
    } catch (err) {
      if (err?.response?.status === 404) toast.error("Invoice not found");
      else toast.error("Could not create the share link");
    } finally {
      setShareBusy("");
    }
  };

  const nativeShareFromSheet = async () => {
    if (shareBusy) return;
    setShareBusy("native");
    try {
      const url = await sheetShareLink();
      const num = shareSheetInvoice?.invoiceNumber || "";
      await navigator.share({
        title: `Invoice ${num}`.trim(),
        text: `Invoice ${num}`,
        url,
      });
      closeShareSheet();
    } catch (err) {
      if (err?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(await sheetShareLink());
          toast.success("Link copied to clipboard");
        } catch {
          toast.error("Could not open the share menu");
        }
      }
    } finally {
      setShareBusy("");
    }
  };

  const shareFromSheetWhatsApp = async () => {
    if (shareBusy || !shareSheetInvoice) return;
    setShareBusy("sheet-wa");
    const invoice = shareSheetInvoice;
    try {
      let token = sheetShareToken;
      if (!token) {
        const res = await invoiceAPI.createShare(invoice.id);
        token = res.data?.data?.token;
        if (token) setSheetShareToken(token);
      }
      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://insideinvoice.com";
      const shareUrl = token ? `${origin}/i/${token}` : undefined;
      const business = await resolveBusinessProfile();
      const text = buildInvoiceWhatsAppMessage({
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        total: invoice.grandTotal || 0,
        businessName: business?.businessName,
        shareUrl,
      });
      setShareBusy("");
      setShareSheetInvoice(null);
      setSheetShareToken(null);
      openWhatsAppChat(text);
    } catch (err) {
      setShareBusy("");
      setShareSheetInvoice(null);
      setSheetShareToken(null);
      toast.error(err.response?.data?.message || "Could not share via WhatsApp");
    }
  };

  // Proforma view of THIS invoice: same share token, rendered as a proforma document,
  // so the customer can be sent a quotation-style copy without a second invoice record.
  const shareProformaFromSheet = async () => {
    if (shareBusy || !shareSheetInvoice) return;
    setShareBusy("proforma");
    const invoice = shareSheetInvoice;
    try {
      const url = proformaShareUrl(await sheetShareLink());
      setShareSheetInvoice(null);
      setSheetShareToken(null);
      await shareLinkToUser({
        url,
        title: `Proforma Invoice ${invoice.invoiceNumber || ""}`.trim(),
        copyMessage: "Proforma invoice link copied to clipboard",
      });
    } catch (err) {
      if (err?.response?.status === 404) toast.error("Invoice not found");
      else toast.error("Could not create the proforma link");
    } finally {
      setShareBusy("");
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
              <div className="relative w-full sm:w-auto min-w-[110px]">
                <select value={selectedMonth} onChange={handleMonthChange}
                  className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white appearance-none cursor-pointer text-slate-700 font-medium">
                  <option value="">Month</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>{monthNames[m]}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative w-full sm:w-auto min-w-[100px]">
                <select value={selectedYear} onChange={handleYearChange}
                  className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white appearance-none cursor-pointer text-slate-700 font-medium">
                  <option value="">Years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white text-slate-800 placeholder:text-slate-400" />
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
                    {paginatedInvoices.map((inv, i) => (
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
                            <button onClick={() => openShareSheet(inv)} disabled={rowBusy(inv.id)}
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
              <div className="md:hidden space-y-3 p-3">
                {paginatedInvoices.map((inv) => (
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
                      <button onClick={(e) => { e.stopPropagation(); openShareSheet(inv); }} disabled={rowBusy(inv.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors min-h-[44px] disabled:opacity-60">
                        {isBusy(inv.id, "share") ? <Spinner size={14} /> : <Share2 className="w-3.5 h-3.5" />} {isBusy(inv.id, "share") ? "Loading..." : "Share"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filtered.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <div className="relative">
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="pl-2.5 pr-7 py-1 border border-slate-300 rounded-md bg-white text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400 appearance-none cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                    <span className="text-slate-300">|</span>
                    <span>
                      Showing <span className="font-semibold text-slate-800">{filtered.length === 0 ? 0 : startIndex + 1}</span>–
                      <span className="font-semibold text-slate-800">{endIndex}</span> of{" "}
                      <span className="font-semibold text-slate-800">{filtered.length}</span>
                    </span>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 transition-colors"
                        title="First page"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 transition-colors"
                        title="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-2 font-medium text-slate-700">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 transition-colors"
                        title="Next page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 transition-colors"
                        title="Last page"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
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

      {shareSheetInvoice && (
        <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={closeShareSheet}>
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
                <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{shareSheetInvoice.invoiceNumber || "Draft"}</p>
              </div>
              <button type="button" onClick={closeShareSheet} disabled={!!shareBusy}
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
                    {sheetShareUrl ? "Link ready — anyone with it can view" : "Creates a view-only link"}
                  </span>
                </span>
              </button>

              <button type="button" onClick={shareFromSheetWhatsApp} disabled={!!shareBusy}
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
