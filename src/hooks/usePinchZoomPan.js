import { useLayoutEffect, useRef } from "react";
import {
  panBounds, clampPan, anchorZoom, toDocPoint, clampScale,
  decayVelocity, rubberPan, easeOutCubic, VELOCITY_EPS,
} from "../utils/panZoom";

const ANIM_MS = 260;      // double-tap / buttons / snap-back easing duration
const DBL_TAP_FACTOR = 2.5; // "double-tap zooms to about 2.5x at the tap point"

/**
 * usePinchZoomPan — THE pan/zoom gesture engine (single source of truth;
 * extracted from the two previously-duplicated copies in PublicInvoicePage
 * and DocZoomSurface). Owns the pointer stream and writes ONE transform per
 * frame to the paper element:
 *
 *     translate3d(x, y, 0) scale(s)   with transform-origin 0 0
 *
 * Gesture set (PDF-viewer / Google-Photos contract):
 *   pinch                → zoom about the pinch midpoint, focal point nailed
 *   two-finger drag      → pans freely at the same time (focal follows)
 *   one-finger drag      → freehand pan with flick inertia
 *   double-tap (touch)   → animated toggle: fit ↔ 2.5×fit at the tap point
 *   double-click (mouse) → same animated toggle
 *   ctrl/cmd + wheel     → zoom at the cursor (Mac trackpad pinch emits this)
 *   plain wheel          → pan (wheel deltas)
 *   ctrl +/−/0           → step zoom / fit
 *   pinch past an edge   → elastic rubber overshoot, springs back on release
 *
 * Coordinates: view.x/y are the paper translate in surface pixels, with the
 * paper at its natural size anchored at the surface's top-left. All range
 * math lives in src/utils/panZoom.js (unit-tested).
 *
 * Contract: gesture state lives in refs during the gesture and the React
 * tree never re-renders for motion; the caller supplies three refs
 * (surface, paper, zoom band) and receives a stable api
 * { zoomAt, zoomStep, resetFit } for on-screen controls. All listeners are
 * removed on unmount.
 *
 * Options:
 *   animateMs — duration for programmatic zooms and the rubber snap-back
 *   onGesture — optional ("animating" | "gesture" | "settled") reporter
 */
export default function usePinchZoomPan({
  surfaceRef,
  paperRef,
  zoomBandRef,
  apiRef,          // REQUIRED: the caller's ref — receives { zoomAt, zoomStep, resetFit }
  onGesture = () => {},
  animateMs = ANIM_MS,
}) {  // view is written inside rAF callbacks and gesture handlers only — never
  // React state — so mid-gesture frames cost one style recalc, no re-render.
  const viewRef = useRef({ s: 1, x: 0, y: 0 });

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const paper = paperRef.current;
    if (!surface || !paper) return undefined;
    const view = viewRef.current;

    let raf = 0;

    // The paper is laid out at natural size absolutely anchored at the
    // surface's top-left, so the surface box IS the viewport — measured
    // live per frame (the box is fixed while a gesture runs, so
    // clientWidth/clientHeight are always exact without layout thrash).
    const boundsNow = (s) =>
      panBounds({
        surfaceW: surface.clientWidth,
        surfaceH: surface.clientHeight,
        contentW: Math.max(1, paper.offsetWidth),
        contentH: Math.max(1, paper.offsetHeight),
        scale: s ?? view.s,
      });

    // ---- transform plumbing -------------------------------------------------
    const paint = () => {
      paper.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`;
    };
    const apply = () => {
      raf = 0;
      const b = boundsNow(view.s);
      const c = clampPan(view, b);
      view.x = c.x;
      view.y = c.y;
      paint();
      const band = zoomBandRef.current;
      surface.classList.toggle("is-zoomed", view.s > band.min + 1e-3);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    // ---- programmatic (eased) moves ----------------------------------------
    let tween = null;   // { from, to, t0 }
    let tweenRaf = 0;
    const stopTween = () => {
      if (tweenRaf) cancelAnimationFrame(tweenRaf);
      tweenRaf = 0;
      tween = null;
    };
    const animateTo = (to, { anchorAt } = {}) => {
      stopInertia();
      stopTween();
      const from = { s: view.s, x: view.x, y: view.y };
      // keep the document point under `anchorAt` (a surface point) nailed
      // while the scale interpolates — the eased equivalent of anchorZoom
      if (anchorAt) {
        const docPoint = { nx: (anchorAt.x - from.x) / from.s, ny: (anchorAt.y - from.y) / from.s };
        to = {
          s: to.s,
          x: anchorAt.x - docPoint.nx * to.s,
          y: anchorAt.y - docPoint.ny * to.s,
        };
      }
      const b = boundsNow(to.s);
      const c = clampPan(to, b);
      to = { s: to.s, x: c.x, y: c.y };
      tween = { from, to, t0: performance.now() };
      onGesture?.("animating");      paper.classList.add("is-gesturing");
      const step = (t) => {
        if (!tween) return;
        const k = Math.min(1, (t - tween.t0) / animateMs);
        const e = easeOutCubic(k);
        view.s = tween.from.s + (tween.to.s - tween.from.s) * e;
        view.x = tween.from.x + (tween.to.x - tween.from.x) * e;
        view.y = tween.from.y + (tween.to.y - tween.from.y) * e;
        paint();
        surface.classList.toggle("is-zoomed", view.s > zoomBandRef.current.min + 1e-3);
        if (k < 1) {
          tweenRaf = requestAnimationFrame(step);
        } else {
          tween = null;
          tweenRaf = 0;
          paper.classList.remove("is-gesturing");
          apply();
          onGesture?.("settled");
        }
      };
      tweenRaf = requestAnimationFrame(step);
    };

    // ---- bounds helpers -----------------------------------------------------
    const doFit = (animated = false) => {
      const b = boundsNow(zoomBandRef.current.min);
      const target = {
        s: zoomBandRef.current.min,
        x: b.xMin, // pinned centre when narrower, flush-left if overflowing
        y: 0,      // top edge flush under the top bar
      };
      if (animated) animateTo(target);
      else {
        Object.assign(view, target);
        surface.classList.remove("is-zoomed", "is-grabbing");
        schedule();
      }
    };
    // Content height drifts (late fonts, images, multi-page splits):
    // re-clamp in place — the user's zoom is NEVER reset.
    const reclamp = () => {
      const c = clampPan(view, boundsNow(view.s));
      view.x = c.x;
      view.y = c.y;
      schedule();
    };
    const zoomAt = (fx, fy, sNextRaw, animated = false) => {
      const band = zoomBandRef.current;
      const sNext = clampScale(sNextRaw, band.min, band.max);
      if (animated) {
        animateTo({ s: sNext }, { anchorAt: { x: fx, y: fy } });
      } else {
        const docPoint = toDocPoint(view, fx, fy);
        Object.assign(view, anchorZoom(view, docPoint, fx, fy, sNext, boundsNow(sNext)));
        paint();
        surface.classList.toggle("is-zoomed", view.s > band.min + 1e-3);
      }
    };
    const zoomStep = (factor) => {
      zoomAt(surface.clientWidth / 2, surface.clientHeight / 2, view.s * factor, true);
    };
    // Double-tap contract: at fit → 2.5× fit at the tap point (eased);
    // anything zoomed → animated reset to fit.
    const toggleAt = (fx, fy) => {
      const band = zoomBandRef.current;
      if (view.s <= band.min + 1e-3) zoomAt(fx, fy, band.min * DBL_TAP_FACTOR, true);
      else doFit(true);
    };

    // ---- wheel ---------------------------------------------------------------
    const onWheel = (e) => {
      // The engine owns the box (the route/page scroll is locked around it),
      // so the wheel always pans the sheet — with a modifier it zooms first.
      e.preventDefault();
      stopTween();
      if (e.ctrlKey || e.metaKey) {
        const r = surface.getBoundingClientRect();
        zoomAt(e.clientX - r.left, e.clientY - r.top, view.s * Math.exp(-e.deltaY * 0.002), false);
        schedule();
      } else {
        view.x -= e.deltaX;
        view.y -= e.deltaY;
        reclamp();
      }
    };
    surface.addEventListener("wheel", onWheel, { passive: false });

    // ---- pointers ------------------------------------------------------------
    const pts = new Map();
    let pinch0 = null; // two-finger snapshot: { d, s, doc }
    let pan0 = null;   // one-finger snapshot
    let movedDist = 0; // travel since gesture start — under ~10px it's a tap
    let samples = [];  // recent pan samples for release velocity
    let inertia = null;
    let inertiaRaf = 0;
    let lastTapT = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let rubbered = false; // pinch ended while rubber past a bound

    const startGestureUI = () => {
      paper.classList.add("is-gesturing");
      onGesture?.("gesture");
    };
    const endGestureUI = () => {
      surface.classList.remove("is-grabbing");
      if (!tween) paper.classList.remove("is-gesturing");
    };

    // Flick inertia: keep the release velocity and glide with platform-style
    // decay, stopping the instant a bound (or rubber snap-back) takes over.
    // (Function declaration: animateTo is defined above and calls this.)
    function stopInertia() {
      if (inertiaRaf) cancelAnimationFrame(inertiaRaf);
      inertiaRaf = 0;
      inertia = null;
    }
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
      inertia.vx = cl.x !== wantX ? 0 : decayVelocity(inertia.vx, dt);
      inertia.vy = cl.y !== wantY ? 0 : decayVelocity(inertia.vy, dt);
      if (!inertia.vx && !inertia.vy) {
        inertia = null;
        paper.classList.remove("is-gesturing");
        onGesture?.("settled");
        return;
      }
      inertiaRaf = requestAnimationFrame(() => runInertia(now));
    };
    const fling = () => {
      const now = performance.now();
      const recent = samples.filter((s) => now - s.t <= 120);
      samples = [];
      if (recent.length < 2) return;
      const a = recent[0];
      const b = recent[recent.length - 1];
      const dt = b.t - a.t;
      if (dt < 8 || dt > 350) return;
      const vx = (b.x - a.x) / dt;
      const vy = (b.y - a.y) / dt;
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
      // UI overlays (controls) stop their React side too late for these NATIVE
      // listeners: by the time React's root-delegated handlers run, the surface
      // — an ancestor — has already seen the event. Native-time guard instead:
      // never pan/capture when the press began on our own UI, or the browser
      // retargets the release to the surface and the button's click never
      // synthesizes.
      if (e.target?.closest?.("[data-zp-ui]")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stopInertia();
      stopTween();
      rubbered = false;
      try {
        surface.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
      startGestureUI();
      const fresh = pts.size === 0;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fresh) movedDist = 0;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const r = surface.getBoundingClientRect();
        const ms = { x: mid.x - r.left, y: mid.y - r.top };
        pinch0 = {
          d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          s: view.s,
          doc: toDocPoint(view, ms.x, ms.y),
        };
        pan0 = null;
        movedDist = 100; // a pinch is never part of a double-tap
      } else if (pts.size === 1) {
        // Any single finger (or mouse drag) pans the sheet — at fit (where a
        // multi-page document overflows vertically) and zoomed (left/right).
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
        const r = surface.getBoundingClientRect();
        const ms = { x: mid.x - r.left, y: mid.y - r.top };
        const band = zoomBandRef.current;
        const sNext = clampScale(pinch0.s * (d / pinch0.d), band.min, band.max);
        // Zoom about the midpoint AND follow it — the document-point snapshot
        // means zero drift no matter how the fingers wander. BEFORE clamping,
        // though, let the translate run rubber-soft past the edges so the
        // zoom never feels like it hits a wall.
        const raw = {
          s: sNext,
          x: ms.x - pinch0.doc.nx * sNext,
          y: ms.y - pinch0.doc.ny * sNext,
        };
        const hard = clampPan(raw, boundsNow(sNext));
        const soft = rubberPan(raw, boundsNow(sNext), surface.clientWidth, surface.clientHeight);
        const rubberedNow = soft.x !== hard.x || soft.y !== hard.y;
        if (rubberedNow || rubbered) rubbered = true;
        view.s = raw.s;
        view.x = rubberedNow || rubbered ? soft.x : raw.x;
        view.y = rubberedNow || rubbered ? soft.y : raw.y;
        movedDist += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
        paint();
        schedule();
      } else if (pan0 && pts.size === 1) {
        movedDist += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
        // 1:1 with the finger: `prev` is the PREVIOUS entry of this pointer
        // (captured before the map update), so every move contributes its own
        // delta exactly once — measuring from the pointerdown anchor here
        // would re-apply the cumulative displacement per frame (quadratic
        // acceleration that flings the sheet).
        view.x += e.clientX - prev.x;
        view.y += e.clientY - prev.y;
        reclamp();
        notePan();
      }
    };

    // Buttons and other overlays stop their own pointerdown at the controls,
    // so their `pointerup`s still bubble here. A pointer the engine never saw
    // go down is NOT a gesture of ours — ignore it entirely (this is what
    // made double-tapping +/- look inverted: the tap-through UP fed the
    // double-tap toggle, which resets at a zoom → "+" "zoomed out").
    const onUp = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch0 = null;
      if (pts.size === 0) {
        const wasPan = !!pan0;
        pan0 = null;
        if (rubbered) {
          // release inside an overshoot: spring straight back into bounds
          rubbered = false;
          const b = boundsNow(view.s);
          const c = clampPan(view, b);
          animateTo({ s: view.s, x: c.x, y: c.y });
          samples = [];
        } else if (wasPan && e.type === "pointerup") {
          fling();
        } else {
          samples = [];
        }
        if (!inertia && !tween) paper.classList.remove("is-gesturing");
        endGestureUI();
      }
      if (e.type !== "pointerup" || e.pointerType !== "touch" || pts.size !== 0) return;
      if (movedDist >= 10) {
        lastTapT = 0; // a drag or pinch breaks the double-tap chain
        return;
      }
      const now = Date.now();
      const r = surface.getBoundingClientRect();
      const tapX = e.clientX - r.left;
      const tapY = e.clientY - r.top;
      if (now - lastTapT < 300 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 28) {
        toggleAt(tapX, tapY);
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
    const onLeave = (e) => {
      if (e.pointerType === "mouse" && pts.has(e.pointerId)) onUp(e);
    };
    surface.addEventListener("pointerleave", onLeave);

    // The browser can also synthesise `dblclick` for the same two taps —
    // swallow the duplicate right after our touch toggle fires (the synthetic
    // lands within ~100ms; real users' next deliberate double-click, ~500ms+,
    // must stay live).
    let suppressDblT = 0;
    const toggleFromTap = (fx, fy) => {
      suppressDblT = performance.now();
      toggleAt(fx, fy);
    };
    const onDblClick = (e) => {
      if (e.target?.closest?.("[data-zp-ui]")) return;
      if (performance.now() - suppressDblT < 300) return;
      const r = surface.getBoundingClientRect();
      toggleFromTap(e.clientX - r.left, e.clientY - r.top);
    };
    surface.addEventListener("dblclick", onDblClick);

    // iOS Safari fires these proprietary events for a system-level page
    // pinch; swallowing them keeps the page still while OUR pinch runs.
    const stopSysPinch = (e) => e.preventDefault();
    surface.addEventListener("gesturestart", stopSysPinch, { passive: false });
    surface.addEventListener("gesturechange", stopSysPinch, { passive: false });

    // ctrl + / − / 0 (only when the surface is actually in the page)
    const onKey = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (!surface.isConnected) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomStep(1.3);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomStep(1 / 1.3);
      } else if (e.key === "0") {
        e.preventDefault();
        doFit(true);
      }
    };
    window.addEventListener("keydown", onKey);

    // The paper's natural height shifts after mount (late fonts, images,
    // multi-page splits) → re-clamp in place; resize/rotation go the same
    // path (the component re-fits when the band changes).
    const paperRO = new ResizeObserver(() => reclamp());
    paperRO.observe(paper);

    apply();

    apiRef.current = {
      zoomAt: (fx, fy, s, animated) => {
        const r = surface.getBoundingClientRect();
        zoomAt(fx ?? r.width / 2, fy ?? r.height / 2, s, animated === true);
      },
      zoomStep: (factor) => zoomStep(factor),
      resetFit: (animated) => doFit(animated === true),
    };

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (tweenRaf) cancelAnimationFrame(tweenRaf);
      paperRO.disconnect();
      surface.removeEventListener("wheel", onWheel);
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("pointercancel", onUp);
      surface.removeEventListener("pointerleave", onLeave);
      surface.removeEventListener("dblclick", onDblClick);
      surface.removeEventListener("gesturestart", stopSysPinch);
      surface.removeEventListener("gesturechange", stopSysPinch);
      window.removeEventListener("keydown", onKey);
      stopInertia();
      stopTween();
      paper.classList.remove("is-gesturing");
      surface.classList.remove("is-zoomed", "is-grabbing");
    };
    // Attached once per surface/paper mount; refs (fit scale, zoom band) are
    // read live so no closure is ever stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceRef, paperRef, zoomBandRef, animateMs]);

  return viewRef;
}
