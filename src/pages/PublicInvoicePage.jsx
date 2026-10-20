import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer, RefreshCw, ShieldAlert, Clock, ZoomIn, ZoomOut, Scan } from "lucide-react";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import LoadingDots from "../components/LoadingDots";
import { publicInvoiceAPI } from "../api/public";
import { computeInvoiceTotals } from "../utils/invoiceTotals";
import { resolveTaxMode } from "../utils/taxMode";
import { panBounds, clampPan, anchorZoom, toDocPoint, clampScale, decayVelocity, VELOCITY_EPS } from "../utils/panZoom";
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

// Interactive viewer zoom band, in multiples of the paper's natural size —
// the same 35%–500% range desktop browsers allow for page zoom.
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 5;

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
  // Interactive zoom state, owned by the gesture engine below and written
  // straight to the DOM (see apply): { s: scale, x, y: pan }.
  const viewRef = useRef({ s: 1, x: 0, y: 0 });
  const engineRef = useRef(null);   // zoomBy/fit handles for the on-screen controls
  const pctRef = useRef(null);      // live percentage label (DOM text, no re-render)
  const surfaceRef = useRef(null);  // gesture surface
  // The viewer container is the measuring stick: the paper scales to ITS exact
  // width, so it always fills the page and stays perfectly centred — no fixed
  // gutters to drift out of sync with the responsive padding. The observer
  // re-measures on window resize and rotation, and deliberately NOT on browser
  // (ctrl/cmd) zoom, which leaves CSS-pixel widths untouched — so the user's
  // own zoom is never cancelled.
  const containerRef = useRef(null);
  const [containerW, setContainerW] = useState(0);
  // The fit scale, mirrored into a ref so gesture handlers (attached once)
  // never read a stale closure value.
  const fitScaleRef = useRef(1);

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
  // locked, every gesture is owned by the engine below.
  useEffect(() => {
    document.documentElement.classList.add("pip-locked");
    return () => document.documentElement.classList.remove("pip-locked");
  }, []);

  const paperSize = data?.paperSize || "A4_PORTRAIT";
  const widthPx = PAPER_WIDTH[paperSize] || 794;

  useEffect(() => {
    if (!data || !containerRef.current) return undefined;
    // contentRect.width is the CONTENT box — it excludes the surface's
    // px-2 / sm:px-4 padding. `clientWidth` (used before) includes padding, so
    // `fit` was computed against a strip 16–32px wider than the sheet actually
    // has: the sheet overflowed its own footprint (right edge ran off-screen
    // at default zoom on phones) and below-fit recentring sat half that error
    // — a visible ~8px — off-centre. ResizeObserver reports the initial size
    // immediately on observe, so this also covers the first measurement.
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setContainerW((prev) => (prev === w ? prev : w));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [data]);

  // Scale = container width / paper width, floored so an A4 stays legible on
  // a watch-sized viewport, and CAPPED at 80% — the customer's chosen default
  // — so a wide monitor opens on the sheet at exactly 80% with breathing room
  // around it instead of a near-full-bleed wall of type. Narrow screens still
  // fall below the cap and fit their width.
  const MAX_FIT_SCALE = 0.8;
  const fitScale = containerW ? Math.min(MAX_FIT_SCALE, Math.max(0.2, containerW / widthPx)) : 1;

  // Whenever the fit changes (load, resize, rotation) the view snaps back to
  // fit — the same contract as every document viewer. React re-renders the
  // paper's transform here; after this point the gesture engine owns it.
  useEffect(() => {
    fitScaleRef.current = fitScale;
    const v = viewRef.current;
    v.s = fitScale;
    v.y = 0; // top edge flush under the top bar
    // A sheet narrower than the surface parks dead-centre, like a PDF viewer.
    // (The gesture re-clamps centre late-arriving content automatically.)
    if (paperRef.current && surfaceRef.current) {
      const b = panBounds({
        surfaceW: surfaceRef.current.clientWidth,
        surfaceH: surfaceRef.current.clientHeight,
        contentW: Math.max(1, paperRef.current.offsetWidth),
        contentH: Math.max(1, paperRef.current.offsetHeight),
        scale: fitScale,
      });
      v.x = b.xMin;
    } else {
      v.x = 0;
    }
    if (paperRef.current) {
      paperRef.current.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`;
    }
    if (surfaceRef.current) surfaceRef.current.classList.remove("is-zoomed", "is-grabbing");
    if (pctRef.current) pctRef.current.textContent = `${Math.round(fitScale * 100)}%`;
  }, [fitScale, data]);

  // ------------------------------------------------------------------ zoom
  // PDF-viewer zoom, isolated to a fixed surface. The PAGE never scrolls or
  // pans on this route — the engine owns every pixel, so one-finger drags are
  // FREEHAND in every direction the document actually overflows (both axes
  // once zoomed; the vertical axis even at fit for tall multi-page docs).
  // Same gesture set as Chrome / any PDF viewer:
  //
  //   pinch              → zoom about the pinch midpoint (two-finger pan too)
  //   ctrl/cmd + wheel   → zoom at the cursor (Mac trackpad pinch emits this)
  //   plain wheel        → pan the sheet (wheel deltaX/Y)
  //   double-tap / click → toggle fit ↔ 100%
  //   drag               → pan, with platform-style flick inertia on release
  //   ctrl + / − / 0     → zoom in / out / fit
  //
  // All range/anchor math lives in src/utils/panZoom.js (unit-tested by
  // scripts/panZoom.test.mjs). The transform is written to the DOM inside one
  // rAF per gesture frame and React never re-renders mid-gesture, so a pinch
  // stays jank-free even on the 300-item invoices.
  useEffect(() => {
    if (!data || !paperRef.current || !surfaceRef.current) return undefined;
    const paper = paperRef.current;
    const surface = surfaceRef.current;
    const view = viewRef.current;

    let raf = 0;

    // The paper is laid out at natural size, absolutely anchored at the
    // surface's top-left, so the surface's own box IS the whole viewing area —
    // measured live per frame (fixed container: it never scrolls, so
    // clientWidth/clientHeight are always exact).
    const boundsNow = (s) =>
      panBounds({
        surfaceW: surface.clientWidth,
        surfaceH: surface.clientHeight,
        contentW: paper.offsetWidth,
        contentH: paper.offsetHeight,
        scale: s ?? view.s,
      });

    const apply = () => {
      raf = 0;
      const b = boundsNow(view.s);
      const c = clampPan(view, b);
      view.x = c.x;
      view.y = c.y;
      paper.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`;
      const zoomed = view.s > fitScaleRef.current + 1e-3;
      surface.classList.toggle("is-zoomed", zoomed);
      if (pctRef.current) pctRef.current.textContent = `${Math.round(view.s * 100)}%`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    // Screen (client) coordinates → surface coordinates.
    const surf = (clientX, clientY) => {
      const r = surface.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };

    // Zoom to `sNext` keeping the document point under the focal surface
    // point nailed to that spot — zoom feels like the system zoom, never
    // like a resize.
    const zoomAt = (fx, fy, sNextRaw) => {
      const sNext = clampScale(sNextRaw, MIN_ZOOM, MAX_ZOOM);
      const docPoint = toDocPoint(view, fx, fy);
      Object.assign(view, anchorZoom(view, docPoint, fx, fy, sNext, boundsNow(sNext)));
      schedule();
    };

    const doFit = () => {
      view.s = fitScaleRef.current;
      view.x = boundsNow(view.s).xMin; // pinned centre when narrower, flush-left if overflowing
      view.y = 0;                      // top edge flush under the top bar
      schedule();
    };

    // Content height drifts (late fonts, chart images, multi-page splits):
    // re-clamp in place — the user's zoom level is never reset.
    const reclamp = () => {
      const c = clampPan(view, boundsNow(view.s));
      view.x = c.x;
      view.y = c.y;
      schedule();
    };

    const toggleAt = (fx, fy) => {
      if (view.s > 0.97) doFit();
      else zoomAt(fx, fy, 1); // 100% — the paper's natural print size
    };

    const zoomStep = (factor) => {
      zoomAt(surface.clientWidth / 2, surface.clientHeight / 2, view.s * factor);
    };

    // ---------------------------------------------------------- wheel
    const onWheel = (e) => {
      // The page is scroll-locked on this route, so the wheel always pans the
      // sheet (PDF-viewer behaviour) — with the modifier it zooms first.
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const p = surf(e.clientX, e.clientY);
        zoomAt(p.x, p.y, view.s * Math.exp(-e.deltaY * 0.002));
      } else {
        view.x -= e.deltaX;
        view.y -= e.deltaY;
        reclamp();
      }
    };
    surface.addEventListener("wheel", onWheel, { passive: false });

    // ---------------------------------------------------------- pointers
    const pts = new Map();
    let pinch0 = null; // two-finger gesture snapshot
    let pan0 = null;   // one-finger drag snapshot (the sheet, any zoom level)
    let movedDist = 0; // travel since gesture start — under ~10px it's a tap
    let samples = [];  // recent pan samples for release velocity
    let inertia = null; // flick glide: { vx, vy } px/ms
    let inertiaRaf = 0;
    let lastTapT = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    // Freehand pan in BOTH axes. The page itself is scroll-locked on this
    // route, so the sheet inside the fixed surface is the only thing that
    // moves — like any PDF viewer. (Previously one finger scrolled the PAGE
    // at fit and panned the sheet only when zoomed; the two worlds were what
    // made panning feel stuck.)
    const driftPan = (dx, dy) => {
      view.x += dx;
      view.y += dy;
      reclamp();
    };

    // Flick inertia on release: keep the departure velocity and glide with
    // platform-style decay, stopping the instant the sheet reaches a bound.
    const stopInertia = () => {
      if (inertiaRaf) cancelAnimationFrame(inertiaRaf);
      inertiaRaf = 0;
      inertia = null;
    };
    const runInertia = (lastT) => {
      inertiaRaf = 0;
      if (!inertia || (!inertia.vx && !inertia.vy)) {
        inertia = null;
        return;
      }
      const now = performance.now();
      const dt = Math.max(1, Math.min(64, now - lastT));
      const b = boundsNow(view.s);
      const wantX = view.x + inertia.vx * dt;
      const wantY = view.y + inertia.vy * dt;
      const cl = clampPan({ x: wantX, y: wantY }, b);
      view.x = cl.x;
      view.y = cl.y;
      schedule();
      // A clamp eating the motion means that axis has hit its bound — kill
      // its velocity and let the other axis finish gliding.
      inertia.vx = cl.x !== wantX ? 0 : decayVelocity(inertia.vx, dt);
      inertia.vy = cl.y !== wantY ? 0 : decayVelocity(inertia.vy, dt);
      if (!inertia.vx && !inertia.vy) {
        inertia = null;
        return;
      }
      inertiaRaf = requestAnimationFrame(() => runInertia(now));
    };
    // Departure velocity from the last ~120ms of drag samples.
    const fling = () => {
      const now = performance.now();
      const recent = samples.filter((s) => now - s.t <= 120);
      samples = [];
      if (recent.length < 2) return;
      const a = recent[0];
      const b2 = recent[recent.length - 1];
      const dt = b2.t - a.t;
      if (dt < 8 || dt > 350) return;
      const vx = (b2.x - a.x) / dt;
      const vy = (b2.y - a.y) / dt;
      if (Math.hypot(vx, vy) > VELOCITY_EPS * 3) {
        stopInertia();
        inertia = { vx, vy };
        inertiaRaf = requestAnimationFrame(() => runInertia(now));
      }
    };
    const notePan = () => {
      samples.push({ t: performance.now(), x: view.x, y: view.y });
      if (samples.length > 8) samples.shift();
    };

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stopInertia();
      try {
        surface.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
      const fresh = pts.size === 0;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fresh) movedDist = 0;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const ms = surf(mid.x, mid.y);
        pinch0 = {
          d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          s: view.s,
          doc: toDocPoint(view, ms.x, ms.y),
        };
        pan0 = null;
        movedDist = 100; // a pinch is never part of a double-tap
      } else if (pts.size === 1) {
        // Any single finger (or mouse drag) pans the sheet — at fit, where
        // tall multi-page documents still overflow vertically, and once
        // zoomed, where left/right freehand is exactly what the viewer is for.
        pan0 = { x: view.x, y: view.y, px: e.clientX, py: e.clientY };
        samples = [];
        surface.classList.add("is-grabbing");
      }
    };

    const onMove = (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2 && pinch0) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const ms = surf(mid.x, mid.y);
        // Zoom about the pinch midpoint AND follow it — the document-point
        // snapshot from gesture start means zero drift no matter how the
        // fingers wander.
        const sNext = clampScale(pinch0.s * (d / pinch0.d), MIN_ZOOM, MAX_ZOOM);
        Object.assign(
          view,
          anchorZoom(
            { s: view.s, x: view.x, y: view.y },
            pinch0.doc, ms.x, ms.y, sNext, boundsNow(sNext),
          ),
        );
        movedDist += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
        schedule();
      } else if (pan0 && pts.size === 1) {
        movedDist += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
        driftPan(e.clientX - pan0.px, e.clientY - pan0.py);
        notePan();
      }
    };

    const onUp = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch0 = null;
      if (pts.size === 0) {
        const wasPan = !!pan0;
        pan0 = null;
        surface.classList.remove("is-grabbing");
        if (wasPan && e.type === "pointerup") fling();
        else samples = [];
      }
      if (e.pointerType !== "touch" || pts.size !== 0) return;
      if (movedDist >= 10) {
        lastTapT = 0; // a drag or pinch breaks the double-tap chain
        return;
      }
      const now = Date.now();
      if (now - lastTapT < 300 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 28) {
        toggleFromTap(e.clientX, e.clientY);
        lastTapT = 0;
      } else {
        lastTapT = now;
        lastTapX = e.clientX;
        lastTapY = e.clientY;
      }
    };

    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("pointercancel", onUp);
    // A mouse leaves the surface captured mid-drag → treat as pointer-up.
    surface.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse" && pan0) onUp(e);
    });

    // A manual touch double-tap toggles the zoom; the browser can ALSO emit
    // `dblclick` for the same two taps, and letting it through would toggle
    // straight back. Swallow the duplicate for a moment after ours fires.
    let suppressDblT = 0;
    const toggleFromTap = (fx, fy) => {
      suppressDblT = performance.now();
      toggleAt(fx, fy);
    };
    const onDblClick = (e) => {
      if (performance.now() - suppressDblT < 600) return;
      toggleAt(e.clientX, e.clientY);
    };
    surface.addEventListener("dblclick", onDblClick);

    // iOS Safari fires these proprietary events for a system-level pinch of
    // the whole page; swallowing them keeps the page still while OUR pinch
    // runs (they are non-standard, hence the string names).
    const stopSysPinch = (e) => e.preventDefault();
    surface.addEventListener("gesturestart", stopSysPinch, { passive: false });
    surface.addEventListener("gesturechange", stopSysPinch, { passive: false });

    // ---------------------------------------------------------- keyboard
    const onKey = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomStep(1.3);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomStep(1 / 1.3);
      } else if (e.key === "0") {
        e.preventDefault();
        doFit();
      }
    };
    window.addEventListener("keydown", onKey);

    // On-screen controls (the pill) read their handlers off the ref.
    engineRef.current = { zoomIn: () => zoomStep(1.3), zoomOut: () => zoomStep(1 / 1.3), fit: doFit, reclamp };

    // The paper's natural height shifts after mount (late fonts, images,
    // multi-page splits): re-clamp in place — the user's zoom is never reset.
    const paperRO = new ResizeObserver(() => reclamp());
    paperRO.observe(paper);

    apply();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      paperRO.disconnect();
      surface.removeEventListener("wheel", onWheel);
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("pointercancel", onUp);
      surface.removeEventListener("dblclick", onDblClick);
      surface.removeEventListener("gesturestart", stopSysPinch);
      surface.removeEventListener("gesturechange", stopSysPinch);
      window.removeEventListener("keydown", onKey);
      stopInertia();
      engineRef.current = null;
    };
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

  const docKind = renderType === "PROFORMA_INVOICE" ? "Proforma invoice" : "Tax invoice";

  return (
    <div
      className="fixed inset-x-0 bottom-0 flex flex-col bg-white overflow-hidden"
      style={{ top: "var(--status-bar-offset, 0px)" }}
      // ISOLATED viewer: fixed to the viewport flush under the status-bar
      // strip, and the page itself can never scroll or pan. Everything the
      // user sees lives INSIDE this box — the slim top bar, then the document
      // surface, nothing else. Freehand pinch-zoom + pan happens here under
      // the engine's complete control (see the zoom effect above).
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
        {/* The ONE container. Under the slim top bar there is nothing but the
            document surface: a flex-filling box inside the scroll-locked
            fixed root, and the paper — EVERY page of the invoice as one
            absolutely-positioned element — is transformed INSIDE it by the
            gesture engine (pinch = zoom about the fingers, drag = freehand
            pan, flick = momentum, double-tap = 100%). No sizer, no margins,
            no page-level scrolling: nothing can fight the pan, which is what
            made the previous viewer feel stuck after zooming. */}
        <div
          ref={(el) => {
            containerRef.current = el;
            surfaceRef.current = el;
          }}
          className="doc-pan flex-1 w-full relative overflow-hidden"
        >
          <div
            ref={paperRef}
            style={{
              width: `${widthPx}px`,
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate3d(0px, 0px, 0) scale(${fitScale})`,
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
              taxMode={templateProps.taxMode}
              type={renderType}
              invoiceNumber={data.invoiceNumber}
              paperSize={paperSize}
              template={data.template || undefined}
            />
          </div>
        </div>
      </main>

      {/* Zoom controls — same affordance as a system/PDF viewer, for pointers
          and keyboards that have no pinch gesture. Floating, small, and above
          everything; the document itself is the only content below the bar.
          Live % label is written straight to the DOM by the engine. */}
      <div className="fixed bottom-4 z-30 flex justify-center pointer-events-none inset-x-0 px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => engineRef.current?.zoomOut()}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span ref={pctRef} className="w-12 text-center text-xs font-semibold text-slate-700 tabular-nums select-none">
            {Math.round(fitScale * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => engineRef.current?.zoomIn()}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-0.5" />
          <button
            type="button"
            aria-label="Fit to screen"
            onClick={() => engineRef.current?.fit()}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
            title="Fit to screen"
          >
            <Scan className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
