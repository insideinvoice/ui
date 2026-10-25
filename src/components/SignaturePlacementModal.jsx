import { useMemo, useRef, useState } from "react";
import { Eye, EyeOff, RotateCcw, X } from "lucide-react";
import toast from "react-hot-toast";
import InvoicePDF from "./InvoicePDF";
import SignatureOverlay from "./SignatureOverlay";
import {
  normalizeSealConfig,
  sealSpecAttribute,
  SEAL_MARGIN_MM,
  SIGNATURE_DEFAULTS,
  SIGNATURE_LIMITS,
} from "../utils/sealConfig";
import { businessAPI } from "../api/auth";
import { invalidateBusinessProfile } from "../utils/businessProfile";

/**
 * Signature placement modal — the signature's counterpart of the seal's
 * Position & size controls, inside a modal as requested: a real A4 invoice
 * preview where the signature can be dragged ANYWHERE and sized freely.
 *
 * Defaults land ON TOP of the Authorised Signatory band (bottom-right area),
 * and "Use inline" removes the placement so templates render the signature
 * exactly as they always have.
 */
const PREVIEW_WIDTH_PX = 340;
const PAPER_MM = { w: 210, h: 297 };
const PAPER_WIDTH_PX = 794; // InvoicePDF's A4 portrait
// The invoice frame is drawn at 794px and VISUALLY scaled down onto the
// 340px-wide sheet; drag maths works in sheet pixels (340px = 210mm).
const FRAME_SCALE = PREVIEW_WIDTH_PX / PAPER_WIDTH_PX;
const MM_PER_PX = PAPER_MM.w / PREVIEW_WIDTH_PX;

const PREVIEW_CUSTOMER = {
  name: "Preview Customer", gstIn: "29ABCDE1234F1Z5", state: "Karnataka",
  billingAddress: "123 Main Road, Bengaluru 560034",
};
const PREVIEW_FORM = {
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  paymentTerms: "Due on Receipt", paymentMode: "CASH", placeOfSupply: "Karnataka",
  invoiceNumber: "INV-2026-001",
};
const PREVIEW_ITEMS = [
  { itemName: "Sample Product", hsn: "998877", qty: "2", rate: "1000", gstPercentage: "18", unit: "Unit" },
];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const r2 = (v) => Math.round(v * 100) / 100;

export default function SignaturePlacementModal({ business, signature, onClose, onSaved }) {
  const saved = normalizeSealConfig(business?.sealConfig || null).signature;
  const [draft, setDraft] = useState(saved || SIGNATURE_DEFAULTS);
  const [placing, setPlacing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);
  const draggingRef = useRef(false);

  const sigSrc = useMemo(
    () => (signature ? `data:image/png;base64,${signature}` : null),
    [signature]
  );

  const placeFromPointer = (event) => {
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Pointer → mm from the FRAME's right/bottom edges (the frame sits at the
    // sheet's 10 mm margin, and the overlay measures from those edges too).
    const fromRightMm = (rect.right - event.clientX) * MM_PER_PX - SEAL_MARGIN_MM;
    const fromBottomMm = (rect.bottom - event.clientY) * MM_PER_PX - SEAL_MARGIN_MM;
    setDraft((d) => ({
      ...d,
      rightMm: r2(clamp(fromRightMm, SIGNATURE_LIMITS.minEdge, SIGNATURE_LIMITS.maxEdge)),
      bottomMm: r2(clamp(fromBottomMm, SIGNATURE_LIMITS.minEdge, SIGNATURE_LIMITS.maxEdge)),
    }));
  };

  const save = async (signaturePlacement) => {
    setSaving(true);
    try {
      // Explicit empty object = "remove the placement"; null/absent means
      // "keep whatever is stored" (seal-only saves rely on that).
      const merged = {
        ...normalizeSealConfig(business?.sealConfig || null),
        signature: signaturePlacement || {},
      };
      await businessAPI.update({ sealConfig: merged });
      invalidateBusinessProfile();
      toast.success(signaturePlacement
        ? "Signature placement saved — it prints on every invoice template"
        : "Signature restored to inline rendering");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save the signature placement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !placing) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92dvh] overflow-y-auto"
        data-ii-seal-spec={sealSpecAttribute(business)}>
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Position signature on the invoice</h3>
            <p className="text-[11px] text-slate-400">Drag anywhere on the page · default sits on the Authorised Signatory band</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 items-start">
          {/* Controls */}
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Position &amp; size</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Size (mm)", "sizeMm", SIGNATURE_LIMITS.minSize, SIGNATURE_LIMITS.maxSize, 1],
                  ["Tilt (°)", "tilt", SIGNATURE_LIMITS.minTilt, SIGNATURE_LIMITS.maxTilt, 1],
                  ["From right (mm)", "rightMm", SIGNATURE_LIMITS.minEdge, PAPER_MM.w, 1],
                  ["From bottom (mm)", "bottomMm", SIGNATURE_LIMITS.minEdge, PAPER_MM.h, 1],
                ].map(([label, field, min, max, step]) => (
                  <label key={field} className="text-[11px] text-slate-500">
                    {label}
                    <input
                      type="number"
                      value={draft[field]}
                      min={min}
                      max={max}
                      step={step}
                      onChange={(e) => setDraft((d) => ({
                        ...d,
                        [field]: r2(clamp(parseFloat(e.target.value) || 0,
                          field === "sizeMm" ? SIGNATURE_LIMITS.minSize : min,
                          field === "sizeMm" ? SIGNATURE_LIMITS.maxSize : max)),
                      }))}
                      className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400"
                    />
                  </label>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {draft.sizeMm}×mm wide · {draft.tilt}° · {draft.rightMm}/{draft.bottomMm} mm from the invoice's
              bottom-right corner. The placement prints on EVERY invoice template.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => save(draft)}
                disabled={saving}
                className="w-full px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                {saving ? "Saving…" : "Save placement"}
              </button>
              <button
                type="button"
                onClick={() => setDraft(SIGNATURE_DEFAULTS)}
                disabled={saving}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to signatory default
              </button>
              <button
                type="button"
                onClick={() => save(null)}
                disabled={saving}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Use inline rendering (remove placement)
              </button>
            </div>
          </div>

          {/* Draggable A4 preview */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="self-end flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              {showPreview ? <><EyeOff className="h-3.5 w-3.5" /> Hide preview</> : <><Eye className="h-3.5 w-3.5" /> Show preview</>}
            </button>
            {showPreview && (
              <div
                ref={sheetRef}
                onPointerDown={(e) => {
                  draggingRef.current = true;
                  setPlacing(true);
                  try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* nicety */ }
                  e.preventDefault();
                  placeFromPointer(e);
                }}
                onPointerMove={(e) => { if (draggingRef.current) placeFromPointer(e); }}
                onPointerUp={() => { draggingRef.current = false; setPlacing(false); }}
                onPointerCancel={() => { draggingRef.current = false; setPlacing(false); }}
                title="Click or drag to place the signature"
                style={{
                  position: "relative",
                  width: `${PREVIEW_WIDTH_PX}px`,
                  height: `${Math.round(PAPER_MM.h * (PREVIEW_WIDTH_PX / PAPER_MM.w))}px`,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
                  overflow: "hidden",
                  cursor: "crosshair",
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: `${SEAL_MARGIN_MM * (PREVIEW_WIDTH_PX / PAPER_MM.w)}px`,
                    top: `${SEAL_MARGIN_MM * (PREVIEW_WIDTH_PX / PAPER_MM.w)}px`,
                    transform: `scale(${FRAME_SCALE})`,
                    transformOrigin: "top left",
                    width: `${PAPER_WIDTH_PX}px`,
                    pointerEvents: "none",
                  }}
                >
                  <InvoicePDF
                    business={business}
                    customer={PREVIEW_CUSTOMER}
                    form={PREVIEW_FORM}
                    items={PREVIEW_ITEMS}
                    discountPercent="0"
                    type="TAX_INVOICE"
                    invoiceNumber="INV-2026-001"
                  />
                  <SignatureOverlay
                    business={{ ...business, sealConfig: JSON.stringify({ ...normalizeSealConfig(business?.sealConfig || null), signature: draft }) }}
                    sigSrc={sigSrc}
                    bleedMm={SEAL_MARGIN_MM}
                  />
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-400 italic">
              {placing ? "Release to drop the signature" : "Click or drag anywhere on the page to place the signature"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
