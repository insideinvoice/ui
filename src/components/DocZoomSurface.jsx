import { useEffect, useRef, useState } from "react";
import {
  panBounds, clampPan, anchorZoom, toDocPoint, clampScale,
  decayVelocity, VELOCITY_EPS,
} from "../utils/panZoom";

// Zoom band, in multiples of the paper's natural size — the same 35%–500%
// range desktop browsers allow for page zoom (matches PublicInvoicePage).
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 5;

/**
 * DocZoomSurface — the app's professional document viewer (zoom issues 3/4).
 *
 * ENGINE ORIGIN: the gesture engine below is a VERBATIM copy of the
 * production-proven engine in src/pages/PublicInvoicePage.jsx (the /i/<token>
 * share viewer). It is deliberately duplicated instead of extracted so that
 * page keeps the exact shipped code — its pan/zoom contract is fragile,
 * battle-tested on iOS/Android, and must not be refactored. If a gesture bug
 * is ever fixed, fix BOTH copies. All pure math lives in src/utils/panZoom.js
 * (unit-tested by scripts/panZoom.test.mjs), shared by both.
 *
 * Gesture set (same contract as Chrome's / any system PDF viewer):
 *   pinch              → zoom about the pinch midpoint (two-finger pan too)
 *   ctrl/cmd + wheel   → zoom at the cursor (Mac trackpad pinch emits this)
 *   plain wheel        → pan the document (wheel deltaX/Y)
 *   double-tap / click → toggle fit ↔ 100%
 *   drag               → pan freehand in both axes, with flick inertia
 *   ctrl + / − / 0     → zoom in / out / fit
 *
 * Deliberately NO on-screen controls — no − / % / + / fit pill, no buttons
 * inside the surface at all. Enterprise-level zoom: gestures and shortcuts
 * only, nothing floating over the document.
 *
 * Host contract:
 *   - the surface must be the full visible box (pass sizing via `className`,
 *     e.g. `flex-1 min-h-0 w-full` or `absolute inset-0`);
 *   - the page behind must be scroll-locked while gestures run (add
 *     `pip-locked` to <html> — see index.css) or wheel/touch fights the page.
 *
 * Props:
 *   paperWidth — natural (unscaled) document width in CSS px (A4 = 794)
 *   fitCap     — maximum fit-to-width scale (1 = never upscale past 100%)
 *   minFit     — minimum fit scale (keeps a sheet legible on tiny viewports)
 */
export default function DocZoomSurface({
  paperWidth = 794,
  fitCap = 1,
  minFit = 0.2,
  className = "",
  children,
}) {
  const surfaceRef = useRef(null);
  const paperRef = useRef(null);
  // Interactive zoom state, owned by the gesture engine below and written
  // straight to the DOM (see apply): { s: scale, x, y: pan }.
  const viewRef = useRef({ s: 1, x: 0, y: 0 });
  // The fit scale, mirrored into a ref so gesture handlers (attached once)
  // never read a stale closure value.
  const fitScaleRef = useRef(1);
  const [containerW, setContainerW] = useState(0);
  // One-time gesture hint — fades on the first pointer down or after a few
  // seconds and never returns. Non-interactive (pointer-events-none) so it can
  // never swallow a pinch.
  const [hintVisible, setHintVisible] = useState(true);

  // The surface is the measuring stick. contentRect.width is the CONTENT box
  // (excludes border/padding) — the surface is kept padding-free so it equals
  // clientWidth, which is what the engine clamps against. ResizeObserver
  // reports the initial size immediately on observe, so this also covers the
  // first measurement. Re-fires on window resize and rotation (NOT on browser
  // ctrl/cmd zoom, which leaves CSS-pixel widths untouched — the user's own
  // zoom is never cancelled).
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setContainerW((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scale = container width / paper width, floored so a sheet stays legible on
  // a watch-sized viewport and capped at 100% (fit never UP-scales past the
  // document's natural print size — pinch takes it from there).
  const fitScale = containerW ? Math.min(fitCap, Math.max(minFit, containerW / paperWidth)) : 1;

  // Whenever the fit changes (mount, resize, rotation, paper size) the view
  // snaps back to fit — the same contract as every document viewer. React
  // re-renders the paper's transform here; after this point the gesture engine
  // owns it.
  useEffect(() => {
    fitScaleRef.current = fitScale;
    const v = viewRef.current;
    v.s = fitScale;
    v.y = 0; // top edge flush with the surface's top
    // A sheet narrower than the surface parks dead-centre, like a PDF viewer.
    // (The gesture engine re-clamps late-arriving content automatically.)
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
  }, [fitScale]);

  // ------------------------------------------------------------------ zoom
  // PDF-viewer zoom, isolated to the surface. The host page is scroll-locked
  // while this box is up, so the engine owns every pixel and one-finger drags
  // are FREEHAND in every direction the document actually overflows (both
  // axes once zoomed; the vertical axis even at fit for tall multi-page docs).
  //
  // All range/anchor math lives in src/utils/panZoom.js (unit-tested by
  // scripts/panZoom.test.mjs). The transform is written to the DOM inside one
  // rAF per gesture frame and React never re-renders mid-gesture, so a pinch
  // stays jank-free even on the largest invoices.
  useEffect(() => {
    if (!paperRef.current || !surfaceRef.current) return undefined;
    const paper = paperRef.current;
    const surface = surfaceRef.current;
    const view = viewRef.current;

    let raf = 0;

    // The paper is laid out at natural size, absolutely anchored at the
    // surface's top-left, so the surface's own box IS the whole viewing area —
    // measured live per frame (the box is fixed while gestures run, so
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
      view.y = 0;                      // top edge flush with the surface's top
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
      // The page is scroll-locked while this surface is up, so the wheel
      // always pans the sheet (PDF-viewer behaviour) — with the modifier it
      // zooms first.
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

    // Freehand pan in BOTH axes. The page behind is scroll-locked, so the
    // sheet inside the surface is the only thing that moves — like any PDF
    // viewer. (Previously one finger scrolled the PAGE at fit and panned the
    // sheet only when zoomed; the two worlds were what made panning feel
    // stuck.)
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
        // ADAPTATION vs PublicInvoicePage (whose surface spans the viewport,
        // so raw client coords == surface coords there): this surface sits
        // below headers/strips, so the tap must be projected into surface
        // space before it anchors the zoom — double-tap then zooms INTO the
        // spot the user tapped.
        const p = surf(e.clientX, e.clientY);
        toggleFromTap(p.x, p.y);
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
      // See the note in onUp: client → surface coordinates (no-op on the
      // viewport-spanning share page, required for surfaces below headers).
      const p = surf(e.clientX, e.clientY);
      toggleAt(p.x, p.y);
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
    };
  }, []);

  // Auto-dismiss the hint: first touch/drag on the surface, or the timeout.
  useEffect(() => {
    if (!hintVisible) return undefined;
    const el = surfaceRef.current;
    const hide = () => setHintVisible(false);
    el?.addEventListener("pointerdown", hide, { once: true });
    const t = setTimeout(() => setHintVisible(false), 4500);
    return () => {
      el?.removeEventListener("pointerdown", hide);
      clearTimeout(t);
    };
  }, [hintVisible]);

  const coarsePointer =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;

  return (
    <div
      ref={surfaceRef}
      data-testid="doc-zoom-surface"
      className={`doc-pan relative overflow-hidden select-none ${className}`}
    >
      <div
        ref={paperRef}
        data-testid="doc-zoom-paper"
        style={{
          width: `${paperWidth}px`,
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translate3d(0px, 0px, 0) scale(${fitScale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
      {/* One-time gesture hint (fades out, never interactive) — no zoom
          buttons anywhere near the document by design. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4 transition-opacity duration-700 ${hintVisible ? "opacity-100" : "opacity-0"}`}
      >
        <span className="rounded-full bg-slate-900/75 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-white shadow-md backdrop-blur">
          {coarsePointer
            ? "Pinch to zoom · Drag to move · Double-tap to fit"
            : "Scroll to pan · Ctrl + Scroll to zoom · Double-click to fit"}
        </span>
      </div>
    </div>
  );
}
