import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Printer, RefreshCw, ShieldAlert, Clock, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
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
const clampZoom = (z) => Math.min(2.5, Math.max(0.25, +z.toFixed(2)));
const fitZoomFor = (widthPx, padding = 24) =>
  clampZoom(Math.max(0.25, (window.innerWidth - padding) / widthPx));

export default function PublicInvoicePage() {
  const { shareToken } = useParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const invoiceRef = useRef(null);
  const wrapRef = useRef(null);

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
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!data) return;
    setZoom(1);
  }, [data, widthPx]);

  useEffect(() => {
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.1 : -0.1)));
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const buildPdf = async () => {
    const el = invoiceRef.current;
    if (!el) throw new Error("Invoice not rendered yet");
    const { buildInvoicePdf } = await import("../utils/invoicePdf");
    return buildInvoicePdf(el, paperSize);
  };

  const generateExact = async (busyKey) => {
    if (actionBusy) return null;
    setActionBusy(busyKey);
    setActionError("");
    try {
      const prevZoom = zoom;
      if (prevZoom !== 1) {
        setZoom(1);
        await new Promise((r) => setTimeout(r, 120));
      }
      const pdf = await buildPdf();
      setZoom(prevZoom);
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

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1100px] mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Shared invoice</p>
            <p className="text-sm font-bold text-slate-800 truncate">{data.invoiceNumber}</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!!actionBusy}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
              title="Download PDF"
            >
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={printPdf}
              disabled={!!actionBusy}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs sm:text-sm font-medium hover:bg-slate-700 disabled:opacity-60 transition-colors"
              title="Print"
            >
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">{actionBusy === "print" ? "Working..." : "Print"}</span>
            </button>
          </div>
        </div>
        {actionError && (
          <div className="max-w-[1100px] mx-auto px-3 sm:px-4 pb-2">
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5">{actionError}</p>
          </div>
        )}
      </header>

      <main className="max-w-[1100px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <div ref={wrapRef} style={{ zoom: String(zoom), margin: "0 auto", maxWidth: "100%" }}>
            <InvoiceTemplateRenderer
              ref={invoiceRef}
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
        <p className="text-center text-xs text-slate-400 mt-4">
          Computer-generated copy of a shared invoice &middot; Powered by Inside Invoice
        </p>
      </main>

      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full bg-white/95 shadow-lg border border-slate-200 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => setZoom((z) => clampZoom(z - 0.15))}
          className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="text-xs font-mono text-slate-600 px-1.5 min-w-[3rem] text-center"
          title="Reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => setZoom((z) => clampZoom(z + 0.15))}
          className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Fit to width"
          title="Fit invoice to screen width"
          onClick={() => setZoom(fitZoomFor(widthPx, 24))}
          className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
