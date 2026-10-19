import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer, RefreshCw, RotateCcw, ShieldAlert, Clock } from "lucide-react";
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

// Scale the fixed-width paper down so it fits the viewport on phones/tablets.
// Capped at 1 so wide screens never upscale the document. All interactive
// zoom (pinch, ctrl/cmd+scroll, double-tap) is left to the native browser
// gestures, which work identically on every device.
const computeFitScale = (widthPx) => {
  if (typeof window === "undefined") return 1;
  const padding = window.innerWidth < 640 ? 24 : 48;
  const availableWidth = window.innerWidth - padding;
  return Math.min(1, Math.max(0.2, availableWidth / widthPx));
};

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
  
  const containerRef = useRef(null);
  const wrapRef = useRef(null);
  const pdfCaptureRef = useRef(null);

  const [invoiceHeight, setInvoiceHeight] = useState(0);
  const [fitScale, setFitScale] = useState(1);
  // Manual zoom on top of the fit-to-width scale (1 = exactly fit). Native
  // pinch/pan is unreliable in several places this link gets opened (iOS
  // home-screen web apps, WhatsApp/in-app webviews, and any page whose html
  // clips lateral overflow can't pan beyond the viewport at all), so the
  // share page runs its OWN gesture engine: two-finger pinch-zoom, one-finger
  // horizontal pan, double-tap zoom, ctrl/cmd+wheel zoom on desktop — plus
  // the −/+/reset control for anything the device swallows.
  const [zoom, setZoom] = useState(1);
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 6;
  const ZOOM_STEP = 0.25;
  const effScale = fitScale * zoom;

  // zoomRef mirrors `zoom` for the gesture handlers: they run between React
  // renders, where a stale state value would fight the gesture.
  const zoomRef = useRef(1);
  // active pointers (id -> last position); two of them mean "pinch"
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const dragRef = useRef(null);
  const inertiaRef = useRef(0);
  const lastTapRef = useRef({ t: 0, x: 0, y: 0 });
  // pending focal point for the next scale commit (client coords + the paper
  // coordinates under it) — applied right after React commits the new scale
  const focalRef = useRef(null);

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

  const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  /* ---------------------------------------------------------- gestures */

  // The paper's scale lives in a CSS variable (--ds) on the sizing wrapper.
  // The animation writes it frame by frame, so zooming NEVER re-renders the
  // invoice — only its transform and the scroll offset move. That is what
  // makes the zoom glide instead of jump.
  const sizerRef = useRef(null);
  const animRef = useRef(0);
  const scaleRef = useRef(1);        // live effective scale (screen px per paper px)
  const zoomLabelRef = useRef(null); // the "%" readout, updated mid-animation

  // Keep the paper coordinate under the focal point pinned to that point for
  // ANY scale — run on every animation frame and after every commit.
  const applyFocal = useCallback((scale) => {
    const f = focalRef.current;
    const el = containerRef.current;
    const paper = wrapRef.current;
    const sizer = sizerRef.current;
    if (!f || !el || !paper || !sizer) return;
    const pRect = paper.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const sRect = sizer.getBoundingClientRect();
    // paper origin in the scroller's content coordinates (scroll-independent)
    const contentX = pRect.left - rect.left + el.scrollLeft;
    const contentY = pRect.top - rect.top + el.scrollTop;
    // Where the reader is pointing stays under their finger/cursor. Normally
    // the scroll offset does it; while the paper still FITS the viewport
    // there is nothing to scroll, so a small translate holds the anchor
    // instead (the whole paper is on screen anyway).
    let panX = 0;
    let panY = 0;
    if (el.scrollWidth > el.clientWidth + 1) {
      el.scrollLeft = contentX - (f.clientX - rect.left) + f.u * scale;
    } else {
      panX = f.clientX - sRect.left - f.u * scale;
    }
    if (el.scrollHeight > el.clientHeight + 1) {
      el.scrollTop = contentY - (f.clientY - rect.top) + f.v * scale;
    } else {
      panY = f.clientY - sRect.top - f.v * scale;
    }
    sizer.style.setProperty("--panx", `${panX}px`);
    sizer.style.setProperty("--pany", `${panY}px`);
  }, []);

  // Remember the paper coordinates under a client point — that point becomes
  // the zoom anchor: whatever is under the finger/cursor stays there.
  const setFocal = useCallback((clientX, clientY) => {
    const paper = wrapRef.current;
    if (!paper) return;
    const pRect = paper.getBoundingClientRect();
    const eff = scaleRef.current || 1;
    focalRef.current = {
      clientX,
      clientY,
      u: (clientX - pRect.left) / eff,
      v: (clientY - pRect.top) / eff,
    };
  }, []);

  // Write the scale straight to the DOM (no React render) — every animation
  // frame and every live gesture frame goes through here.
  const setScaleLive = useCallback((target) => {
    const sizer = sizerRef.current;
    if (sizer) sizer.style.setProperty("--ds", String(target));
    scaleRef.current = target;
    applyFocal(target);
    if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = `${Math.round((target / fitScale) * 100)}%`;
    }
  }, [fitScale, applyFocal]);

  // Animated zoom to a target (relative to fit). `instant` tracks a live
  // gesture 1:1; otherwise the scale eases into place over `duration`.
  const animateScale = useCallback((targetZoom, opts = {}) => {
    const { clientX, clientY, duration = 260, instant = false } = opts;
    const z = clampZoom(targetZoom);
    const target = fitScale * z;
    if (clientX != null && clientY != null) {
      setFocal(clientX, clientY);
    } else {
      // no anchor requested (reset / programmatic zoom): drop any stale one,
      // or the paper would stay pinned to a point from an earlier gesture
      focalRef.current = null;
    }

    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
    const from = scaleRef.current;
    if (instant || duration <= 0 || Math.abs(target - from) < 0.0005) {
      setScaleLive(target);
      zoomRef.current = z;
      setZoom(z);
      focalRef.current = null;
      return;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3); // ease-out cubic
      setScaleLive(from + (target - from) * e);
      if (k < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = 0;
        zoomRef.current = z;
        setZoom(z);
        focalRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, [fitScale, setFocal, setScaleLive]);

  // After every scale change: put the paper back under the focal point.
  useLayoutEffect(() => {
    applyFocal(effScale);
  }, [effScale, applyFocal]);

  const stopInertia = () => {
    if (inertiaRef.current) {
      cancelAnimationFrame(inertiaRef.current);
      inertiaRef.current = 0;
    }
  };

  // Zoom buttons keep the middle of the view fixed; reset returns to the
  // fit-to-width view at the top-left of the paper.
  const zoomBy = (delta) => {
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    animateScale(zoomRef.current + delta, {
      duration: 260,
      clientX: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      clientY: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
    });
  };

  const resetView = () => {
    animateScale(1, { duration: 260 });
    const el = containerRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  };

  // Pointer gesture engine. Mouse drags pan both axes; touch keeps native
  // vertical scrolling (momentum, rubber-band) and only the horizontal axis
  // is ours, so the page never feels "stuck"; two fingers pinch-zoom.
  const onPanStart = (e) => {
    const el = containerRef.current;
    if (!el) return;
    stopInertia();
    // Prune pointers that stopped reporting — some webviews swallow the
    // pointerup of a lifted finger, and a stale entry would poison the next
    // pinch with an old position.
    const now = Date.now();
    for (const [id, p] of pointersRef.current) {
      if (now - (p.at || 0) > 800) pointersRef.current.delete(id);
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, at: now });

    const pts = [...pointersRef.current.values()];
    if (pts.length === 2) {
      // pinch starts: remember the opening distance, zoom and scroll offset
      const [p1, p2] = pts;
      pinchRef.current = {
        dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        z0: zoomRef.current,
        sl: el.scrollLeft,
        st: el.scrollTop,
      };
      dragRef.current = null;
      el.classList.remove("is-grabbing");
      try { el.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      return;
    }
    if (pts.length > 2) return;

    const isMouse = e.pointerType === "mouse";
    if (isMouse && e.button !== 0) return;
    // touch: pan horizontally when there is room to pan (zoomed in); at fit
    // width there is nothing sideways to move and native scrolling wins
    if (!isMouse && zoomRef.current <= 1.02) return;
    dragRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sl: el.scrollLeft,
      st: el.scrollTop,
      dx: 0,
      t: Date.now(),
    };
    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    if (isMouse) {
      el.classList.add("is-grabbing");
      e.preventDefault();
    }
  };

  const onPanMove = (e) => {
    const el = containerRef.current;
    if (!el) return;
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, at: Date.now() });
    }

    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()].slice(0, 2);
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      // the browser may still scroll vertically during a two-finger gesture
      // (touch-action allows pan-y) — pin the offset back so only the zoom
      // and the focal point move
      el.scrollLeft = pinch.sl;
      el.scrollTop = pinch.st;
      if (pinch.dist > 8 && dist > 8) {
        // scale from the OPENING distance (cumulative) and keep the midpoint
        // under the fingers: zoom and pan in one gesture. Written straight to
        // the DOM so the paper tracks the fingers 1:1 (no React render, no lag)
        setFocal(mid.x, mid.y);
        setScaleLive(fitScale * clampZoom(pinch.z0 * (dist / pinch.dist)));
      }
      return;
    }

    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (e.pointerType === "mouse") {
      if (e.buttons === 0) { onPanEnd(e); return; }
      el.scrollLeft = d.sl - dx;
      el.scrollTop = d.st - dy;
      d.dx = dx;
      d.t = Date.now();
      e.preventDefault();
    } else {
      // touch: horizontal only — the browser owns the vertical axis
      el.scrollLeft = d.sl - dx;
      // per-frame delta (not the cumulative one) — that is the real velocity
      d.lastDx = dx - (d.prevDx ?? dx);
      d.prevDx = dx;
      d.lastT = Date.now();
      d.t = Date.now();
    }
  };

  const onPanEnd = (e) => {
    const el = containerRef.current;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2 && pinchRef.current) {
      // the pinch is over: hand the live scale over to React (the DOM and the
      // state agree from here on) — no jump, the paper is already there
      const z = clampZoom(scaleRef.current / fitScale);
      zoomRef.current = z;
      setZoom(z);
      pinchRef.current = null;
    }

    const d = dragRef.current;
    if (d && d.id === e.pointerId) {
      dragRef.current = null;
      // touch fling: a short glide keeps momentum after the finger lifts. The
      // velocity comes from the LAST frame's delta (the cumulative one would
      // fling the paper across the whole page) and is capped both per frame
      // and in total.
      const dt = Math.max(1, Date.now() - (d.lastT || d.t));
      const v0 = Math.max(-24, Math.min(24, -((d.lastDx || 0) / dt) * 16));
      if (e.pointerType !== "mouse" && el && Math.abs(v0) > 1.2) {
        let v = v0;
        let moved = 0;
        const step = () => {
          if (!containerRef.current) return;
          v *= 0.93;
          moved += v;
          if (Math.abs(moved) > 600) { containerRef.current.scrollLeft -= v; return; }
          containerRef.current.scrollLeft += v;
          inertiaRef.current = requestAnimationFrame(step);
        };
        inertiaRef.current = requestAnimationFrame(step);
      }
    }

    // touch double-tap: fit <-> 2x at the tap point
    if (e.pointerType === "touch") {
      const now = Date.now();
      const lt = lastTapRef.current;
      if (now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 32) {
        lastTapRef.current = { t: 0, x: 0, y: 0 };
        animateScale(zoomRef.current > 1.05 ? 1 : 2, {
          clientX: e.clientX,
          clientY: e.clientY,
          duration: 280,
        });
      } else {
        lastTapRef.current = { t: now, x: e.clientX, y: e.clientY };
      }
    }

    if (el) {
      el.classList.remove("is-grabbing");
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }
  };

  // Desktop double-click zooms in on that point (double-tap does the same on
  // touch) — the shortcut people expect from a PDF viewer.
  const onDoubleClick = (e) => {
    animateScale(zoomRef.current > 1.05 ? 1 : 2, {
      clientX: e.clientX,
      clientY: e.clientY,
      duration: 280,
    });
  };

  // Trackpad pinch / ctrl+cmd wheel zooms the document itself (like the
  // print dialog), instead of the whole browser page.
  useEffect(() => {
    if (status !== "ok") return undefined;
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      // ctrl/cmd + scroll (and the trackpad pinch, which arrives as a
      // ctrl-wheel) zooms the paper around the cursor, smoothly
      animateScale(zoomRef.current * factor, {
        clientX: e.clientX,
        clientY: e.clientY,
        duration: 170,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [status, animateScale]);

  const paperSize = data?.paperSize || "A4_PORTRAIT";
  const widthPx = PAPER_WIDTH[paperSize] || 794;

  // Fit-to-width when the document loads and when the screen rotates so the
  // paper is always readable on phones/tablets. Deliberately NOT re-fitting on
  // every window resize: browser (ctrl/cmd) zoom fires resize, and re-fitting
  // then would cancel the user's zoom.
  useEffect(() => {
    if (!data) return undefined;
    const applyFit = () => {
      const s = computeFitScale(widthPx);
      setFitScale(s);
      // the paper is re-scaled to the new fit — keep the live scale (used by
      // the focal math) in step with it
      const eff = s * zoomRef.current;
      scaleRef.current = eff;
      const sizer = sizerRef.current;
      if (sizer) sizer.style.setProperty("--ds", String(eff));
    };
    applyFit();
    const mq = window.matchMedia("(orientation: portrait)");
    const onOrientationChange = () => applyFit();
    mq.addEventListener("change", onOrientationChange);
    return () => mq.removeEventListener("change", onOrientationChange);
  }, [data, widthPx]);

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

  const buildPdf = async () => {
    const el = pdfCaptureRef.current;
    if (!el) throw new Error("Invoice not rendered yet");
    const { buildInvoicePdf } = await import("../utils/invoicePdf");
    return buildInvoicePdf(el, paperSize, 0.95);
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
        {/* Document viewer — the paper is pre-scaled to fit the screen; the
            floating pill gives deterministic zoom in/out/reset, and native
            gestures (pinch, ctrl/cmd+scroll, double-tap) still work where
            the browser supports them. */}
        <div className="relative flex-1">
          <div
            ref={containerRef}
            className="flex-1 bg-slate-100/60 sm:bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto relative select-none doc-pan"
            style={{
              minHeight: "65vh",
              height: "100%",
              maxHeight: "calc(100dvh - 120px)",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              // pan-y keeps the native vertical scroll (with its momentum and
              // rubber-band) while WITHHOLDING pinch-zoom from the browser —
              // so the two-finger gesture reaches our own pinch handler, and
              // the page can never zoom itself out of the way.
              touchAction: "pan-y",
            }}
            onPointerDown={onPanStart}
            onPointerMove={onPanMove}
            onPointerUp={onPanEnd}
            onPointerCancel={onPanEnd}
            onDoubleClick={onDoubleClick}
          >
            {/* start-align so an over-wide zoomed paper stays scrollable in
                BOTH directions (justify-center would clip the left edge);
                "safe center" keeps it centred while it still fits and falls
                back to start-alignment once it overflows */}
            <div
              className="min-w-full min-h-full flex items-start p-2 sm:p-5"
              style={{ justifyContent: "safe center" }}
            >
              {/* Scaled invoice sizing wrapper — the scale lives in the --ds
                  custom property, so the zoom animation can drive it frame by
                  frame (see animateScale) without re-rendering the invoice. */}
              <div
                ref={sizerRef}
                style={{
                  "--ds": effScale,
                  "--panx": "0px",
                  "--pany": "0px",
                  width: `calc(${widthPx}px * var(--ds))`,
                  height: invoiceHeight > 0 ? `calc(${invoiceHeight}px * var(--ds))` : "auto",
                  position: "relative",
                  margin: 0,
                  flexShrink: 0,
                }}
              >
                <div
                  ref={wrapRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: `${widthPx}px`,
                    transform: "translate(var(--panx, 0px), var(--pany, 0px)) scale(var(--ds))",
                    transformOrigin: "top left",
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
                  discountPercent={data.discountPercent != null ? String(data.discountPercent) : "0"}
                  type={renderType}
                  invoiceNumber={data.invoiceNumber}
                  paperSize={paperSize}
                  template={data.template || undefined}
                />
                </div>
              </div>
            </div>
          </div>

          {/* Floating zoom pill — a child of the positioned wrapper (NOT the
              scroller) so it never scrolls away and anchors to the viewer's
              corner; deterministic zoom on any device or webview where the
              native pinch clamp is broken or unavailable. */}
          <div
            className="absolute bottom-3 right-3 z-[1000] flex items-center gap-0.5 rounded-full bg-white/95 border border-slate-200 shadow-lg px-1 py-1"
            style={{ touchAction: "manipulation" }}
          >
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM + 0.001}
              className="w-9 h-9 rounded-full text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 transition-colors text-xl leading-none flex items-center justify-center"
            >
              &minus;
            </button>
            <span
              ref={zoomLabelRef}
              className="min-w-[3.25rem] text-center text-[11px] font-semibold text-slate-700 select-none"
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM - 0.001}
              className="w-9 h-9 rounded-full text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 transition-colors text-xl leading-none flex items-center justify-center"
            >
              +
            </button>
            <button
              type="button"
              aria-label="Fit to screen"
              title="Fit to screen"
              onClick={resetView}
              disabled={Math.abs(zoom - 1) < 0.001}
              className="w-9 h-9 rounded-full text-slate-500 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 transition-colors flex items-center justify-center"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-3 sm:mt-4">
          Computer-generated copy of a shared invoice &middot; Powered by Inside Invoice
        </p>
      </main>
    </div>
  );
}
