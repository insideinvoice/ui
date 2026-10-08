import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Printer, RefreshCw, ShieldAlert, Clock, ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import LoadingDots from "../components/LoadingDots";
import { publicInvoiceAPI } from "../api/public";

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

function mapToTemplateProps(data) {
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
    signature: s.signature,
    specialistIn: s.specialistIn,
    specialistInEnabled: s.specialistInEnabled,
    bankName: pay.bankName,
    branch: pay.branch,
    accountNo: pay.accountNo,
    ifsc: pay.ifsc,
    bankAddress: pay.bankAddress,
    upiId: pay.upiId,
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
    invoiceType: data.invoiceType,
  };

  const items = (data.items || []).map((i) => ({
    sno: i.sno,
    itemName: i.itemName,
    hsn: i.hsn,
    qty: i.qty,
    rate: i.rate,
    gstPercentage: i.gstPercentage,
    taxableValue: i.taxableValue,
    taxAmount: i.taxAmount,
    total: i.total,
  }));

  const totals = {
    subtotal: toNum(data.subtotal),
    discountAmount: 0,
    taxableAmount: toNum(data.subtotal),
    taxAmount: toNum(data.taxAmount),
    grandTotal: toNum(data.grandTotal),
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
const clampZoom = (z) => Math.min(2.5, Math.max(0.2, +z.toFixed(2)));

const computeFitZoom = (widthPx) => {
  if (typeof window === "undefined") return 1;
  const padding = window.innerWidth < 640 ? 16 : 32;
  const availableWidth = window.innerWidth - padding;
  return clampZoom(availableWidth / widthPx);
};

export default function PublicInvoicePage() {
  const { shareToken } = useParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  
  const containerRef = useRef(null);
  const wrapRef = useRef(null);
  const pdfCaptureRef = useRef(null);

  const [invoiceHeight, setInvoiceHeight] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const load = useCallback(async () => {
    setStatus("loading");
    setActionError("");
    try {
      const res = await publicInvoiceAPI.getByToken(shareToken);
      setData(res.data.data);
      setStatus("ok");
    } catch (err) {
      const code = err?.response?.status;
      setData(null);
      setStatus(code === 404 ? "missing" : code === 429 ? "limited" : "error");
    }
  }, [shareToken]);

  useEffect(() => {
    load();
  }, [load]);

  const paperSize = data?.paperSize || "A4_PORTRAIT";
  const widthPx = PAPER_WIDTH[paperSize] || 794;

  // Auto-fit on mobile screens on initial load
  useEffect(() => {
    if (!data) return;
    const isMobileOrSmall = typeof window !== "undefined" && window.innerWidth < widthPx + 48;
    if (isMobileOrSmall) {
      setZoom(computeFitZoom(widthPx));
    } else {
      setZoom(1);
    }
  }, [data, widthPx]);

  // Handle window resize / orientation change for responsive fit
  useEffect(() => {
    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth < 768) {
          // If on mobile and already fitted or close to fitted, update zoom to match new width
          setZoom((prev) => {
            const fitZ = computeFitZoom(widthPx);
            return prev < 0.9 ? fitZ : prev;
          });
        }
      }, 150);
    };

    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, [widthPx]);

  // Measure rendered invoice height dynamically using ResizeObserver
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.offsetHeight || el.scrollHeight;
      if (h > 0) setInvoiceHeight(h);
    };

    measure();

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }

    return () => {
      if (ro) ro.disconnect();
    };
  }, [data, status]);

  // Touch gesture handler: 2-finger pinch to zoom & double-tap to zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartDist = 0;
    let touchStartZoom = 1;
    let lastTap = 0;

    const getTouchDist = (touches) => {
      if (touches.length < 2) return 0;
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        setIsPinching(true);
        touchStartDist = getTouchDist(e.touches);
        touchStartZoom = zoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 300) {
          // Double tapped: toggle between fit-to-width and 100%
          const fitZ = computeFitZoom(widthPx);
          if (zoomRef.current < 0.9) {
            setZoom(1);
          } else {
            setZoom(fitZ);
          }
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2 && touchStartDist > 0) {
        // Prevent entire webpage from zooming in mobile browser
        if (e.cancelable) e.preventDefault();
        const currentDist = getTouchDist(e.touches);
        if (currentDist > 0) {
          const factor = currentDist / touchStartDist;
          const next = clampZoom(touchStartZoom * factor);
          setZoom(next);
        }
      }
    };

    const onTouchEnd = (e) => {
      if (e.touches.length < 2) {
        touchStartDist = 0;
        setIsPinching(false);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [widthPx]);

  // Desktop / trackpad pinch or wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.08 : -0.08)));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const buildPdf = async () => {
    const el = pdfCaptureRef.current;
    if (!el) throw new Error("Invoice not rendered yet");
    const { buildInvoicePdf } = await import("../utils/invoicePdf");
    return buildInvoicePdf(el, paperSize);
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

  const templateProps = useMemo(() => (data ? mapToTemplateProps(data) : null), [data]);

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

  const fitZoom = computeFitZoom(widthPx);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100 flex flex-col">
      {/* Hidden unscaled renderer dedicated for 100% crisp PDF generation */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}>
        <InvoiceTemplateRenderer
          ref={pdfCaptureRef}
          business={templateProps.business}
          customer={templateProps.customer}
          form={templateProps.form}
          items={templateProps.items}
          totals={templateProps.totals}
          discountPercent="0"
          type={data.invoiceType}
          invoiceNumber={data.invoiceNumber}
          paperSize={paperSize}
          template={data.template || undefined}
        />
      </div>

      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
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

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-2 sm:px-4 py-3 sm:py-6 flex flex-col">
        {/* Mobile touch-gesture-enabled viewer container */}
        <div
          ref={containerRef}
          className="flex-1 bg-slate-100/60 sm:bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto relative select-none touch-pan-x touch-pan-y"
          style={{
            minHeight: "65vh",
            maxHeight: "calc(100dvh - 120px)",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          <div className="min-w-full min-h-full flex justify-center items-start p-2 sm:p-5">
            {/* Scaled invoice sizing wrapper */}
            <div
              style={{
                width: `${Math.round(widthPx * zoom)}px`,
                height: invoiceHeight > 0 ? `${Math.round(invoiceHeight * zoom)}px` : "auto",
                position: "relative",
                margin: "0 auto",
                flexShrink: 0,
                transition: isPinching ? "none" : "width 0.15s ease-out, height 0.15s ease-out",
              }}
            >
              <div
                ref={wrapRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: `${widthPx}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  transition: isPinching ? "none" : "transform 0.15s ease-out",
                  background: "#ffffff",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.06)",
                }}
              >
                <InvoiceTemplateRenderer
                  business={templateProps.business}
                  customer={templateProps.customer}
                  form={templateProps.form}
                  items={templateProps.items}
                  totals={templateProps.totals}
                  discountPercent="0"
                  type={data.invoiceType}
                  invoiceNumber={data.invoiceNumber}
                  paperSize={paperSize}
                  template={data.template || undefined}
                />
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-3 sm:mt-4">
          Computer-generated copy of a shared invoice &middot; Powered by Inside Invoice
        </p>
      </main>

      {/* Floating mobile-friendly zoom controls */}
      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-1 rounded-full bg-white/95 shadow-xl border border-slate-200 px-2.5 py-1.5 backdrop-blur">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => setZoom((z) => clampZoom(z - 0.15))}
          className="p-1.5 sm:p-2 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ZoomOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </button>

        <button
          type="button"
          onClick={() => setZoom(1)}
          className="text-xs font-mono text-slate-700 px-1.5 min-w-[2.8rem] text-center font-medium hover:text-indigo-600 transition-colors"
          title="Reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => setZoom((z) => clampZoom(z + 0.15))}
          className="p-1.5 sm:p-2 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ZoomIn className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </button>

        <button
          type="button"
          aria-label="Fit to screen width"
          title="Fit invoice to screen width"
          onClick={() => setZoom(fitZoom)}
          className={`p-1.5 sm:p-2 rounded-full transition-colors ${
            Math.abs(zoom - fitZoom) < 0.05
              ? "text-indigo-600 bg-indigo-50"
              : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"
          }`}
        >
          <Maximize2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </button>
      </div>
    </div>
  );
}
