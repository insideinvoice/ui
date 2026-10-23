import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer, RefreshCw, ShieldAlert, Clock } from "lucide-react";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import ZoomPanViewer from "../components/ZoomPanViewer";
import LoadingDots from "../components/LoadingDots";
import { publicInvoiceAPI } from "../api/public";
import { computeInvoiceTotals } from "../utils/invoiceTotals";
import { resolveTaxMode } from "../utils/taxMode";
import { ALL_EXTENDED_FIELDS } from "../constants/industryConfig";

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

function mapToTemplateProps(data, typeOverride) {
  const s = data.seller || {};
  const pay = s.payment || {};
  const b = data.buyer || {};
  const business = {
    businessName: s.businessName,
    gstIn: s.gstIn,
    phone: s.phone,
    email: s.email,
    website: s.website,
    addressLine1: s.addressLine1,
    addressLine2: s.addressLine2,
    city: s.city,
    state: s.state,
    country: s.country,
    pincode: s.pincode,
    // The uploaded Base64 logo travels in the share payload so the letterhead/
    // email header shows the same document as the owner's download.
    logo: s.logo,
    signature: s.signature,
    specialistIn: s.specialistIn,
    specialistInEnabled: s.specialistInEnabled,
    industry: s.industry,
    bankName: pay.bankName,
    branch: pay.branch,
    accountNo: pay.accountNo,
    ifsc: pay.ifsc,
    bankAddress: pay.bankAddress,
    upiId: pay.upiId,
    // Undefined (older share payload) keeps the HSN/SAC column on, matching
    // every other template's null-safe default.
    showHnSac: s.showHnSac,
    // The share page opens on the customer's device, which has none of the
    // owner's localStorage, so the seal/stamp must come from the payload.
    sealEnabled: s.sealEnabled,
    sealType: s.sealType,
    // Placement/size/tilt chosen in Settings — the share page runs on the
    // customer's device, so the configuration has to travel in the payload.
    sealConfig: s.sealConfig,
    // Configurable jurisdiction footer (V31): rendered text is whichever
    // city the business saved — the share page never assumes a city.
    jurisdictionEnabled: s.jurisdictionEnabled,
    jurisdictionRegion: s.jurisdictionRegion,
    jurisdictionCity: s.jurisdictionCity,
  };

  const customer = {
    name: b.name,
    gstIn: b.gstIn,
    phone: b.phone,
    email: b.email,
    billingAddress: b.billingAddress,
    city: b.city,
    state: b.state,
    country: b.country,
    pincode: b.pincode,
  };

  const form = {
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate,
    paymentTerms: data.paymentTerms,
    paymentMode: data.paymentMode,
    placeOfSupply: data.placeOfSupply,
    destination: data.destination,
    termsOfDelivery: data.termsOfDelivery,
    deliveryNote: data.deliveryNote,
    deliveryNoteDate: data.deliveryNoteDate,
    referenceNumber: data.referenceNumber,
    buyerOrderNumber: data.buyerOrderNumber,
    dispatchDocNumber: data.dispatchDocNumber,
    dispatchedThrough: data.dispatchedThrough,
    otherReferences: data.otherReferences,
    notes: data.notes,
    status: data.status,
    invoiceType: typeOverride || data.invoiceType,
    // V29 extended reference fields (rental/health) — templates read them from
    // form and emit value-driven rows only for their own industry.
    ...Object.fromEntries(ALL_EXTENDED_FIELDS.map((f) => [f, data[f]])),
  };

  const items = (data.items || []).map((i) => ({
    sno: i.sno,
    itemName: i.itemName,
    hsn: i.hsn,
    qty: i.qty,
    unit: i.unit,
    rate: i.rate,
    gstPercentage: i.gstPercentage,
    taxableValue: i.taxableValue,
    taxAmount: i.taxAmount,
    total: i.total,
  }));

  const discountPct = toNum(data.discountPercent);
  // Tax structure the saved invoice presents: the stored selection wins;
  // legacy links (no taxMode in the payload) fall back to seller state vs
  // place of supply, else the intra-state split (pre-V34 rendering).
  const taxMode = resolveTaxMode(data.taxMode, s.state, data.placeOfSupply);
  const calc = computeInvoiceTotals(items, discountPct, taxMode);
  const totals = {
    subtotal: calc.subtotal,
    discountAmount: calc.discountAmount,
    taxableAmount: calc.taxableAmount,
    taxAmount: calc.taxAmount,
    grandTotal: calc.grandTotal,
  };

  return { business, customer, form, items, totals, taxMode };
}

function StatusCard({ icon, title, body, action }) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
          {icon}
        </div>
        <h1 className="text-lg font-bold text-slate-800 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">{body}</p>
        {action}
        <p className="text-xs text-slate-400 mt-6">
          Powered by <span className="font-semibold text-slate-500">Inside Invoice</span>
        </p>
      </div>
    </div>
  );
}

const PAPER_WIDTH = { A4_PORTRAIT: 794, A4_LANDSCAPE: 1123, A5: 559, LETTER: 816 };

export default function PublicInvoicePage() {
  const { shareToken } = useParams();
  // ?type=PROFORMA_INVOICE (or TAX_INVOICE) renders the other document from the same
  // share link. Anything else is ignored so a mangled URL still shows the invoice.
  const [searchParams] = useSearchParams();
  const requestedType = (searchParams.get("type") || "").toUpperCase();
  const typeOverride = requestedType === "PROFORMA_INVOICE" || requestedType === "TAX_INVOICE"
    ? requestedType
    : null;
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  
  const pdfCaptureRef = useRef(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setActionError("");
    try {
      const res = await publicInvoiceAPI.getByToken(shareToken, typeOverride);
      setData(res.data.data);
      setStatus("ok");
    } catch (err) {
      const code = err?.response?.status;
      setData(null);
      setStatus(code === 404 ? "missing" : code === 429 ? "limited" : "error");
    }
  }, [shareToken, typeOverride]);

  useEffect(() => {
    load();
  }, [load]);

  // The viewer is an ISOLATED fixed container: the page itself must never
  // scroll or pan. A page-level scroll area is what previously let the
  // document drift while the in-page pan engine translated it — the source of
  // the "stuck, can't move freely after zooming" feel. With the document
  // locked, every gesture is owned by the viewer engine (<ZoomPanViewer>).
  useEffect(() => {
    document.documentElement.classList.add("pip-locked");
    return () => document.documentElement.classList.remove("pip-locked");
  }, []);

  const paperSize = data?.paperSize || "A4_PORTRAIT";
  const widthPx = PAPER_WIDTH[paperSize] || 794;

  const buildPdf = async () => {
    const el = pdfCaptureRef.current;
    if (!el) throw new Error("Invoice not rendered yet");
    const { buildInvoicePdf } = await import("../utils/invoicePdf");
    // fit = 1: the PDF is placed at the paper's exact natural geometry, so the
    // downloaded document is 1:1 with the paper on screen — same theme, same
    // rules, same layout, no 5% shrink.
    return buildInvoicePdf(el, paperSize, 1);
  };

  const generateExact = async (busyKey) => {
    if (actionBusy) return null;
    setActionBusy(busyKey);
    setActionError("");
    try {
      const pdf = await buildPdf();
      return pdf;
    } catch {
      setActionError("Could not prepare the PDF. Please try again.");
      return null;
    } finally {
      setActionBusy("");
    }
  };

  const downloadPdf = async () => {
    const pdf = await generateExact("download");
    if (!pdf) return;
    pdf.save(`Invoice_${data?.invoiceNumber || "shared"}.pdf`);
  };

  const printPdf = async () => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      navigator.standalone === true ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches);

    // iOS home-screen (standalone) web apps: window.print() is a no-op there,
    // and blob: URLs created in the PWA process don't survive into Safari.
    // Generate the PDF and hand it over as a self-contained data: URL so
    // Safari's native PDF viewer opens (with its own Print in the share sheet).
    if (isIOS && isStandalone) {
      const pdf = await generateExact("print");
      if (!pdf) return;
      const blob = pdf.output("blob");
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const win = window.open(dataUrl, "_blank");
        if (!win) window.location.href = dataUrl;
      };
      reader.readAsDataURL(blob);
      return;
    }

    // iOS Safari tab: window.print() lays the page out at the device viewport
    // and never shrink-to-fits the 794px-wide paper, so the right side of the
    // invoice is cut off in the print sheet (desktop browsers shrink-to-fit,
    // which is why only iPhone clipped the page). Hand Safari the real
    // generated PDF instead — the same route the logged-in viewer (InvoiceView)
    // uses: its native PDF viewer shows the exact A4 geometry and
    // Share → Print prints the document 1:1. Unlike the standalone branch
    // above, a blob: URL works here because the viewer shares this tab's
    // process.
    if (isIOS) {
      const pdf = await generateExact("print");
      if (!pdf) return;
      const blobUrl = URL.createObjectURL(pdf.output("blob"));
      // PDF generation is async, so the popup may be blocked: try a window
      // first, fall back to same-tab navigation (Back returns to the viewer).
      let win = null;
      try {
        win = window.open(blobUrl, "_blank");
      } catch {
        win = null;
      }
      if (!win) window.location.href = blobUrl;
      return;
    }

    const pdf = await generateExact("print");
    if (!pdf) return;
    const blobUrl = URL.createObjectURL(pdf.output("blob"));

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = blobUrl + "#toolbar=0&navpanes=0&scrollbar=0";
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        window.open(blobUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        iframe.remove();
      }, 60000);
    };
    document.body.appendChild(iframe);
  };

  const templateProps = useMemo(() => (data ? mapToTemplateProps(data, typeOverride) : null), [data, typeOverride]);
  const renderType = typeOverride || data?.invoiceType;

  if (status === "loading") {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <LoadingDots className="text-slate-400" />
      </div>
    );
  }

  if (status === "missing") {
    return (
      <StatusCard
        icon={<ShieldAlert className="w-6 h-6" />}
        title="Invoice link unavailable"
        body="This share link is invalid, has been revoked, or the invoice no longer exists. Ask the sender for an updated link."
        action={
          <Link to="/" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors">
            Go to Inside Invoice
          </Link>
        }
      />
    );
  }

  if (status === "limited") {
    return (
      <StatusCard
        icon={<Clock className="w-6 h-6" />}
        title="Too many requests"
        body="Please wait a minute and reload this page."
        action={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        }
      />
    );
  }

  if (status !== "ok" || !data) {
    return (
      <StatusCard
        icon={<ShieldAlert className="w-6 h-6" />}
        title="Something went wrong"
        body="The invoice could not be loaded right now. Please try again in a moment."
        action={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        }
      />
    );
  }

  const docKind = renderType === "PROFORMA_INVOICE" ? "Proforma invoice" : "Tax invoice";

  return (
    <div
      className="fixed inset-x-0 bottom-0 flex flex-col bg-white overflow-hidden"
      style={{ top: "var(--status-bar-offset, 0px)" }}
      // ISOLATED viewer: fixed to the viewport flush under the status-bar
      // strip, and the page itself can never scroll or pan. Everything the
      // user sees lives INSIDE this box — the slim top bar, then the document
      // surface, nothing else. Freehand pinch-zoom + pan happens here under
      // the engine's complete control — <ZoomPanViewer> owns every atom of
      // the surface (pinch/pan/zoom/elastic edges).
    >
      {/* Hidden unscaled renderer dedicated for 100% crisp PDF generation */}
      <div className="pip-print-source" style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}>
        <InvoiceTemplateRenderer
          ref={pdfCaptureRef}
          business={templateProps.business}
          customer={templateProps.customer}
          form={templateProps.form}
          items={templateProps.items}
          totals={templateProps.totals}
          discountPercent={data.discountPercent != null ? String(data.discountPercent) : "0"}
          taxMode={templateProps.taxMode}
          type={renderType}
          invoiceNumber={data.invoiceNumber}
          paperSize={paperSize}
          template={data.template || undefined}
        />
      </div>

      <header
        className="z-20 bg-white border-b border-slate-200"
      >
        <div className="w-full px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold truncate">
              {docKind} · ₹{Number(templateProps.totals.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm font-bold text-slate-800 truncate">{data.invoiceNumber}</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!!actionBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
              title="Download PDF"
            >
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={printPdf}
              disabled={!!actionBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs sm:text-sm font-medium hover:bg-slate-700 disabled:opacity-60 transition-colors"
              title="Print"
            >
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">{actionBusy === "print" ? "Working..." : "Print"}</span>
            </button>
          </div>
        </div>
        {actionError && (
          <div className="max-w-[1200px] mx-auto px-3 sm:px-4 pb-2">
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5">{actionError}</p>
          </div>
        )}
      </header>

      <main className="flex-1 w-full bg-white flex flex-col min-h-0">
        {/* The ONE viewer. Under the slim top bar there is nothing but the
            document surface: a flex-filling <ZoomPanViewer> (the shared
            engine behind the in-app modal too) renders the paper — EVERY
            page of the invoice as one absolutely-positioned element — at
            natural pixels and transforms it INSIDE the surface (pinch =
            zoom about the fingers, drag = freehand pan with flick momentum,
            double-tap = 2.5× at the point, ctrl+wheel, +/−/Reset on
            desktop). Touch-action is enforced across the whole subtree in
            index.css so the browser can never cancel a drag ("nothing can
            fight the pan"). */}
        <ZoomPanViewer
          paperWidth={widthPx}
          fitCap={0.8}
          minFit={0.2}
          controls="desktop"
          className="flex-1 w-full"
        >
          <InvoiceTemplateRenderer
            business={templateProps.business}
            customer={templateProps.customer}
            form={templateProps.form}
            items={templateProps.items}
            totals={templateProps.totals}
            discountPercent={data.discountPercent != null ? String(data.discountPercent) : "0"}
            taxMode={templateProps.taxMode}
            type={renderType}
            invoiceNumber={data.invoiceNumber}
            paperSize={paperSize}
            template={data.template || undefined}
          />
        </ZoomPanViewer>
      </main>
    </div>
  );
}
