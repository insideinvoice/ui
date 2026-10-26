import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, RotateCcw, X } from "lucide-react";
import toast from "react-hot-toast";
import InvoicePDF, { INVOICE_PDF_WIDTH_PX } from "./InvoicePDF";
import SignatureOverlay from "./SignatureOverlay";
import {
  normalizeSealConfig,
  sealSpecAttribute,
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
 *
 * Preview geometry (the contract every part of this modal obeys):
 *
 *   · The sheet is the PAPER: 340 px = 210 mm, and the 794 px A4 frame is
 *     scaled onto it edge-to-edge (0..340), so nothing can ever be clipped.
 *   · InvoicePDF draws the 716 px CONTENT frame centred on that sheet —
 *     ~10.3 mm margins — and the content gets the same 39 px inset at the
 *     top, i.e. the invoice sits on the sheet exactly like the PDF path
 *     mounts it (10 mm frame origin).
 *   · rightMm/bottomMm are measured from the CONTENT frame's right/bottom
 *     edge (frameRef), because that is the box every real template anchors
 *     SignatureOverlay to. Pointer → mm and overlay rendering therefore use
 *     ONE origin: the signature tracks the cursor 1:1 and matches what the
 *     saved placement will print.
 *   · Drag bounds keep the signature's WHOLE box inside that content frame —
 *     the same box the templates render and the PDF captures — so it can
 *     never be cut off on the right (or any other side), preview or print.
 */
const PREVIEW_WIDTH_PX = 340;
const PAPER_MM = { w: 210, h: 297 };
const PAPER_WIDTH_PX = 794; // the A4 sheet at 96 dpi — InvoicePDF's own page
// The frame is drawn at 794px and VISUALLY scaled down onto the 340px sheet;
// drag maths works in sheet pixels (340px = 210mm).
const FRAME_SCALE = PREVIEW_WIDTH_PX / PAPER_WIDTH_PX;
const MM_PER_PX = PAPER_MM.w / PREVIEW_WIDTH_PX;
// InvoicePDF centres its 716px content in the 794px sheet → 39px = ~10.3mm.
// The same inset is applied at the top so the four margins are equal.
const CONTENT_INSET_PX = Math.round((PAPER_WIDTH_PX - INVOICE_PDF_WIDTH_PX) / 2);

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
  const frameRef = useRef(null);   // the CONTENT frame — the one origin for everything
  const overlayRef = useRef(null); // the draft <img>, for grab hit-testing
  const draggingRef = useRef(false);
  const grabRef = useRef({ x: 0, y: 0 });   // pointer − anchor, kept while dragging
  const rafRef = useRef(0);
  const pendingRef = useRef(null);

  const sigSrc = useMemo(
    () => (signature ? `data:image/png;base64,${signature}` : null),
    [signature]
  );

  // Stable identity → InvoicePDF (React.memo) is NEVER re-rendered during a
  // drag; only the small overlay and the four inputs update. Its own saved-
  // placement overlay is suppressed (signature: null in sealConfig) so the
  // preview shows exactly ONE signature — the draft being dragged — while the
  // inline band image (business.signature) stays, as on a real invoice.
  const previewBusiness = useMemo(() => {
    if (!business) return business;
    const cfg = normalizeSealConfig(business.sealConfig);
    return { ...business, sealConfig: JSON.stringify({ ...cfg, signature: null }) };
  }, [business]);

  const draftCfg = useMemo(
    () => ({ ...normalizeSealConfig(business?.sealConfig), signature: draft }),
    [business, draft]
  );

  const sealSpec = useMemo(() => sealSpecAttribute(business), [business]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  /**
   * Reachable range for the CURRENT draft, derived from the boxes actually on
   * screen: the signature's corner may reach every edge of the CONTENT frame
   * (what templates anchor to and what the PDF captures) but its whole box
   * stays inside it — so it can never be cut on the right (or any side), in
   * the preview or in the print.
   */
  const edgeBounds = (size = draft.sizeMm) => {
    const frame = frameRef.current?.getBoundingClientRect();
    if (!frame) {
      return {
        right: [SIGNATURE_LIMITS.minEdge, SIGNATURE_LIMITS.maxEdge],
        bottom: [SIGNATURE_LIMITS.minEdge, SIGNATURE_LIMITS.maxEdge],
      };
    }
    const contentWmm = frame.width * MM_PER_PX;
    const contentHmm = frame.height * MM_PER_PX;
    return {
      right: [SIGNATURE_LIMITS.minEdge, r2(Math.max(0, contentWmm - size))],
      // bottomMm grows upward from the frame's bottom edge; height follows the
      // image at render time, so the width (a conservative over-estimate for
      // any realistic signature ratio) keeps the whole box inside.
      bottom: [SIGNATURE_LIMITS.minEdge, r2(Math.max(0, contentHmm - size))],
    };
  };

  const placeFromPointer = (event) => {
    // Keep only the numbers (React events are consumed after handlers), and
    // coalesce to one update per animation frame — a mousemove storm must not
    // turn into a setState storm.
    pendingRef.current = {
      x: event.clientX - grabRef.current.x,
      y: event.clientY - grabRef.current.y,
    };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const target = pendingRef.current;
      if (!target) return;
      const frame = frameRef.current?.getBoundingClientRect();
      if (!frame) return;
      const bounds = edgeBounds();
      setDraft((d) => ({
        ...d,
        // ONE origin: mm from the CONTENT frame's right/bottom edge — the same
        // box SignatureOverlay measures from when it renders. That is why the
        // signature now tracks the cursor exactly instead of drifting ~20/48mm.
        rightMm: r2(clamp((frame.right - target.x) * MM_PER_PX, bounds.right[0], bounds.right[1])),
        bottomMm: r2(clamp((frame.bottom - target.y) * MM_PER_PX, bounds.bottom[0], bounds.bottom[1])),
      }));
    });
  };

  const onPointerDown = (event) => {
    // Grabbing the signature itself keeps its offset under the cursor (smooth,
    // no jump); clicking anywhere else PLACES it — corner lands on the point.
    const img = overlayRef.current?.getBoundingClientRect();
    const inside = !!img && event.clientX >= img.left && event.clientX <= img.right
      && event.clientY >= img.top && event.clientY <= img.bottom;
    grabRef.current = inside
      ? { x: event.clientX - img.right, y: event.clientY - img.bottom }
      : { x: 0, y: 0 };
    draggingRef.current = true;
    setPlacing(true);
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* nicety */ }
    event.preventDefault();
    placeFromPointer(event);
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
        data-ii-seal-spec={sealSpec}>
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
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value) || 0;
                        // Edge fields are clamped to what the content frame
                        // can hold (same bounds the drag uses) — typed values
                        // can't push the signature off the page either. A
                        // size change re-clamps the position too, since the
                        // footprint it must fit into just changed.
                        if (field === "sizeMm") {
                          const ns = r2(clamp(raw, SIGNATURE_LIMITS.minSize, SIGNATURE_LIMITS.maxSize));
                          setDraft((d) => {
                            const b = edgeBounds(ns);
                            return {
                              ...d,
                              sizeMm: ns,
                              rightMm: r2(clamp(d.rightMm, b.right[0], b.right[1])),
                              bottomMm: r2(clamp(d.bottomMm, b.bottom[0], b.bottom[1])),
                            };
                          });
                          return;
                        }
                        const bounds = edgeBounds();
                        const lo = field === "rightMm" ? bounds.right[0]
                          : field === "bottomMm" ? bounds.bottom[0] : min;
                        const hi = field === "rightMm" ? bounds.right[1]
                          : field === "bottomMm" ? bounds.bottom[1] : max;
                        setDraft((d) => ({ ...d, [field]: r2(clamp(raw, lo, hi)) }));
                      }}
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
                onPointerDown={onPointerDown}
                onPointerMove={(e) => { if (draggingRef.current) placeFromPointer(e); }}
                onPointerUp={() => { draggingRef.current = false; setPlacing(false); }}
                onPointerCancel={() => { draggingRef.current = false; setPlacing(false); }}
                title="Click or drag to place the signature"
                style={{
                  position: "relative",
                  width: `${PREVIEW_WIDTH_PX}px`,
                  height: `${Math.round(PAPER_MM.h * (PREVIEW_WIDTH_PX / PAPER_MM.w))}px`,
                  background: "#ffffff",
                  // Ring (not border): the sheet's border-box must BE the
                  // 340×481 paper so the scaled A4 layer fills it edge-to-
                  // edge — a real border would inset the paper by 1px per
                  // side and throw the margins (and clipping) off again.
                  borderRadius: 4,
                  boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px #cbd5e1",
                  overflow: "hidden",
                  cursor: "crosshair",
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
                {/* The A4 sheet, scaled edge-to-edge onto the 340px preview —
                    it IS the sheet's box, so nothing can overflow or clip. */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: `scale(${FRAME_SCALE})`,
                    transformOrigin: "top left",
                    width: `${PAPER_WIDTH_PX}px`,
                    pointerEvents: "none",
                  }}
                >
                  {/* Same 39px inset top as the sides → the invoice sits on
                      the sheet with four equal ~10mm margins. */}
                  <div
                    style={{
                      width: `${PAPER_WIDTH_PX}px`,
                      paddingTop: `${CONTENT_INSET_PX}px`,
                      boxSizing: "border-box",
                      textAlign: "center",
                    }}
                  >
                    {/* Shrink-wrapped content box = the box every real
                        template anchors SignatureOverlay to, so the drag
                        maths and the render share one origin. */}
                    <div
                      ref={frameRef}
                      style={{ position: "relative", display: "inline-block", verticalAlign: "top", textAlign: "left" }}
                    >
                      <InvoicePDF
                        business={previewBusiness}
                        customer={PREVIEW_CUSTOMER}
                        form={PREVIEW_FORM}
                        items={PREVIEW_ITEMS}
                        discountPercent="0"
                        type="TAX_INVOICE"
                        invoiceNumber="INV-2026-001"
                      />
                      {/* No bleedMm: templates pass none either, so the preview
                          shows exactly what will print. */}
                      <SignatureOverlay ref={overlayRef} config={draftCfg} sigSrc={sigSrc} />
                    </div>
                  </div>
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
