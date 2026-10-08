import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, ExternalLink, Printer, RefreshCw, ShieldAlert, Clock } from "lucide-react";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import LoadingDots from "../components/LoadingDots";
import { publicInvoiceAPI } from "../api/public";

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

// Maps the allowlisted public DTO onto the prop contract every invoice template
// expects (business/customer/form/items/totals) - deliberately explicit, so a new
// backend field can never leak into the page by accident.
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

  // Server-side totals are authoritative - the same numbers the on-demand PDF renders.
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

export default function PublicInvoicePage() {
  const { shareToken } = useParams();
  const [status, setStatus] = useState("loading"); // loading | ok | missing | limited | error
  const [data, setData] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState("");

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

  const pdfUrl = publicInvoiceAPI.pdfUrl(shareToken);

  // Memoized above the early returns (hooks must run unconditionally): keeps a
  // stable prop identity so the rendered document isn't rebuilt on every
  // actionBusy/actionError toggle.
  const templateProps = useMemo(() => (data ? mapToTemplateProps(data) : null), [data]);

  const openPdf = () => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const withPdfBlob = async (busyKey, handler) => {
    if (actionBusy) return;
    setActionBusy(busyKey);
    setActionError("");
    try {
      const res = await publicInvoiceAPI.pdfBlob(shareToken);
      handler(res.data);
    } catch {
      setActionError("Could not prepare the PDF. Please try again.");
    } finally {
      setActionBusy("");
    }
  };

  const downloadPdf = () =>
    withPdfBlob("download", (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${data?.invoiceNumber || "shared"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });

  const printPdf = () =>
    withPdfBlob("print", (blob) => {
      // Blob URLs are same-origin, so the iframe's PDF viewer can be printed programmatically.
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch {
          window.open(pdfUrl, "_blank", "noopener,noreferrer");
        }
        setTimeout(() => {
          URL.revokeObjectURL(url);
          iframe.remove();
        }, 60000);
      };
      document.body.appendChild(iframe);
    });

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
              onClick={openPdf}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 transition-colors"
              title="View PDF"
            >
              <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">View PDF</span>
            </button>
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
          <InvoiceTemplateRenderer
            business={templateProps.business}
            customer={templateProps.customer}
            form={templateProps.form}
            items={templateProps.items}
            totals={templateProps.totals}
            discountPercent="0"
            type={data.invoiceType}
            invoiceNumber={data.invoiceNumber}
            paperSize="A4_PORTRAIT"
          />
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          Computer-generated copy of a shared invoice &middot; Powered by Inside Invoice
        </p>
      </main>
    </div>
  );
}
