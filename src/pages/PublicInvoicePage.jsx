import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer, RefreshCw, ShieldAlert, Clock } from "lucide-react";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import LoadingDots from "../components/LoadingDots";
import { publicInvoiceAPI } from "../api/public";
import { computeInvoiceTotals } from "../utils/invoiceTotals";
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
  const calc = computeInvoiceTotals(items, discountPct);
  const totals = {
    subtotal: calc.subtotal,
    discountAmount: calc.discountAmount,
    taxableAmount: calc.taxableAmount,
    taxAmount: calc.taxAmount,
    grandTotal: calc.grandTotal,
  };

  return { business, customer, form, items, totals };
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
  // The visible paper: laid out at natural A4 pixels and scaled VISUALLY with
  // `transform` (never CSS `zoom`). At fit-scale 0.48 a zoomed `border: 1px`
  // rounds to 0px in WebKit/Android layout, so every divider disappeared on
  // phones while text kept painting. With transform the layout stays exactly
  // 794px wide with true 1px rules, and only the rendered surface is scaled —
  // hairlines antialias instead of vanishing, identically on every device.
  const paperRef = useRef(null);
  const [naturalH, setNaturalH] = useState(0);
  // The viewer container is the measuring stick: the paper scales to ITS exact
  // width, so it always fills the page and stays perfectly centred — no fixed
  // gutters to drift out of sync with the responsive padding. The observer
  // re-measures on window resize and rotation, and deliberately NOT on browser
  // (ctrl/cmd) zoom, which leaves CSS-pixel widths untouched — so the user's
  // own zoom is never cancelled.
  const containerRef = useRef(null);
  const [containerW, setContainerW] = useState(0);

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

  // Document routes release the app-wide horizontal overflow clip (see the
  // html.public-docs-zoomable rule in index.css): a zoomed-in paper extends
  // past the layout viewport, and a CLIPPED html can never be panned by
  // WebKit — the zoomed page would stay stuck, exactly what the customer
  // reports against the needle-sharp print dialog which CAN pan.
  useEffect(() => {
    document.documentElement.classList.add("public-docs-zoomable");
    return () => document.documentElement.classList.remove("public-docs-zoomable");
  }, []);

  const paperSize = data?.paperSize || "A4_PORTRAIT";
  const widthPx = PAPER_WIDTH[paperSize] || 794;

  useEffect(() => {
    if (!data || !containerRef.current) return undefined;
    const el = containerRef.current;
    const measure = () => {
      const w = el.clientWidth;
      setContainerW((prev) => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // Scale = container width / paper width, floored so an A4 stays legible on
  // a watch-sized viewport, and CAPPED so a wide monitor shows the sheet as a
  // page with breathing room instead of a 2.4x wall of type bleeding off both
  // edges (the customer's PDF-in-hand reference is a page, not a mural).
  const MAX_FIT_SCALE = 0.9;
  const fitScale = containerW ? Math.min(MAX_FIT_SCALE, Math.max(0.2, containerW / widthPx)) : 1;

  // Measure the paper's natural (unscaled) height so the layout container can
  // reserve exactly the scaled footprint — the scaled paper is absolutely
  // positioned and would otherwise leave a full natural-height hole below it.
  useEffect(() => {
    if (!data || !paperRef.current) return undefined;
    const el = paperRef.current;
    const measure = () => {
      const h = el.offsetHeight;
      setNaturalH((prev) => (prev === h ? prev : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

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

    // iOS Safari tab: window.print() opens the native print sheet. It must run
    // synchronously inside the tap gesture, so we print the DOM (the hidden
    // unscaled renderer) instead of an async-generated PDF.
    if (isIOS) {
      document.body.classList.add("pip-printing");
      const cleanup = () => document.body.classList.remove("pip-printing");
      window.addEventListener("afterprint", cleanup, { once: true });
      setTimeout(cleanup, 60_000);
      try {
        window.print();
      } catch {
        cleanup();
      }
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

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100 flex flex-col">
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
          type={renderType}
          invoiceNumber={data.invoiceNumber}
          paperSize={paperSize}
          template={data.template || undefined}
        />
      </div>

      <header className="sticky z-20 bg-white/95 backdrop-blur border-b border-slate-200"
        style={{
          // Pin below the status-bar strip like the other top bars: a layer
          // spanning the under-status-bar region rasterizes blurry in iOS
          // standalone PWAs, and iOS 27's system blur feather extends past
          // the strip into it.
          top: "var(--status-bar-offset, 0px)",
        }}>
        <div className="w-full px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Shared invoice</p>
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

      <main className="flex-1 w-full px-2 sm:px-4 py-5 sm:py-8">
        {/* Full-page viewer: the paper takes the whole container width, sits
            centred with breathing room above and below, and is scaled with
            `transform` (see paperRef) so its 1px rules survive at every size.
            The sizer reserves the paper's exact scaled footprint; the browser's
            native pinch / double-tap zoom does the rest — no inner scroll box
            to trap gestures. */}
        <div ref={containerRef} className="w-full flex justify-center">
          <div
            style={{
              width: naturalH ? `${widthPx * fitScale}px` : `${widthPx}px`,
              height: naturalH ? `${naturalH * fitScale}px` : undefined,
              position: "relative",
              background: "#ffffff",
              boxShadow: "0 12px 32px -10px rgba(15, 23, 42, 0.25), 0 2px 8px -2px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div
              ref={paperRef}
              style={{
                width: `${widthPx}px`,
                position: "absolute",
                top: 0,
                left: 0,
                transform: `scale(${fitScale})`,
                transformOrigin: "top left",
              }}
            >
              <InvoiceTemplateRenderer
                business={templateProps.business}
                customer={templateProps.customer}
                form={templateProps.form}
                items={templateProps.items}
                totals={templateProps.totals}
                discountPercent={data.discountPercent != null ? String(data.discountPercent) : "0"}
                type={renderType}
                invoiceNumber={data.invoiceNumber}
                paperSize={paperSize}
                template={data.template || undefined}
              />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 sm:mt-5">
          Computer-generated copy of a shared invoice &middot; Powered by Inside Invoice
          <span className="block mt-1 text-[10px] text-slate-300">Pinch to zoom &middot; double-tap to fit</span>
        </p>
      </main>
    </div>
  );
}
