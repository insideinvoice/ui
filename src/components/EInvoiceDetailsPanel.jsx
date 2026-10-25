import { useCallback, useEffect, useState } from "react";
import { FileCheck2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { eInvoiceAPI } from "../api/einvoice";

/**
 * View-Invoice panel for the GST E-Invoice (IRN) lifecycle.
 *
 * The IRN, acknowledgement number/date and signed QR are GOVERNMENT-GENERATED
 * values: they are set only by the backend from an actual IRP response (or a
 * clearly mock-stamped sandbox one) and render READ-ONLY here — never typed,
 * never edited. When e-invoicing is disabled for the business the panel does
 * not render at all, so non-e-invoice users see no change.
 */
const STATUS_LABEL = {
  DISABLED: "E-invoicing disabled",
  NOT_APPLICABLE: "Not applicable for this document type",
  READY_TO_REGISTER: "Ready to register",
  REGISTRATION_PENDING: "Registration pending",
  REGISTERED: "Registered",
  REGISTRATION_FAILED: "Registration failed",
  RECONCILIATION_REQUIRED: "Reconciliation required",
  CANCELLATION_PENDING: "Cancellation pending",
  CANCELLED: "Cancelled",
  CANCELLATION_FAILED: "Cancellation failed",
};

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");

export default function EInvoiceDetailsPanel({ invoiceId }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(() => {
    return eInvoiceAPI.getStatus(invoiceId)
      .then((res) => {
        setStatus(res.data.data);
        if (res.data.data?.derivedStatus === "DISABLED") setHidden(true);
      })
      .catch(() => setHidden(true));
  }, [invoiceId]);

  useEffect(() => {
    let alive = true;
    load().finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [load]);

  if (loading || hidden) return null;

  const reg = status?.registration;
  const derived = status?.derivedStatus;
  const registered = derived === "REGISTERED";
  const failed = derived === "REGISTRATION_FAILED";

  const register = async () => {
    setBusy(true);
    try {
      const res = await eInvoiceAPI.register(invoiceId);
      setStatus(res.data.data);
      const d = res.data.data?.derivedStatus;
      const mock = res.data.data?.registration?.mock;
      if (d === "REGISTERED") {
        toast.success(mock
          ? "Registered on the sandbox Mock provider (mock IRN — clearly stamped, no government submission)"
          : "Invoice registered — IRN and acknowledgement stored");
        window.setTimeout(() => window.location.reload(), 900);
      } else {
        toast.error(res.data.data?.registration?.errorMessage || "Registration failed — nothing was submitted successfully");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <FileCheck2 className="w-5 h-5 text-slate-600" />
        <h2 className="text-sm font-bold text-slate-800">GST E-Invoice Details</h2>
        <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full border ${
          registered ? "text-emerald-600 bg-emerald-50 border-emerald-200"
          : failed ? "text-red-600 bg-red-50 border-red-200"
          : "text-slate-500 bg-slate-50 border-slate-200"
        }`}>
          {STATUS_LABEL[derived] || derived}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        IRN and acknowledgement are government-generated — they appear here only after the IRP confirms registration.
      </p>

      {reg?.irn ? (
        <dl className="space-y-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <dt className="text-slate-400">IRN</dt>
            <dd className="font-mono text-slate-800 break-all">{reg.irn}{reg.mock && <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">MOCK</span>}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-slate-400">Ack No.</dt>
              <dd className="font-mono text-slate-800 break-all">{reg.ackNumber || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Ack Date</dt>
              <dd className="font-mono text-slate-800">{fmtDate(reg.ackDate)}</dd>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-slate-400">Provider</dt>
              <dd className="text-slate-700">{reg.provider}{reg.mock ? " (sandbox mock)" : ""}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Registered At</dt>
              <dd className="text-slate-700">{reg.registeredAt ? String(reg.registeredAt).slice(0, 16).replace("T", " ") : "—"}</dd>
            </div>
          </div>
          <div>
            <dt className="text-slate-400">Signed QR Code</dt>
            <dd className="text-slate-700">{reg.hasSignedQr ? "Stored — prints on the e-Invoice template" : "Not returned by the provider"}</dd>
          </div>
        </dl>
      ) : (
        <div className="text-xs text-slate-500 leading-relaxed">
          {failed && (reg?.errorMessage || reg?.errorCode) && (
            <p className="mb-3 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="font-semibold">{reg.errorCode}:</span> {reg.errorMessage}
            </p>
          )}
          {derived === "READY_TO_REGISTER" ? (
            <button
              type="button"
              onClick={register}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[40px]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? "Submitting to the IRP…" : "Register for IRN"}
            </button>
          ) : derived === "DISABLED" ? null : (
            <p>{STATUS_LABEL[derived] || derived}.</p>
          )}
        </div>
      )}
    </div>
  );
}
