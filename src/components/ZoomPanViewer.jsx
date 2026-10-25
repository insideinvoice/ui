import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import usePinchZoomPan from "../hooks/usePinchZoomPan";
import { panBounds } from "../utils/panZoom";

// Zoom band is fit-relative: min = fit-to-width (1×), max = about 5× — the
// identical multiplier window at every screen size, per the viewer contract.
const MAX_ZOOM_FACTOR = 5;

/**
 * ZoomPanViewer — reusable document zoom surface (the single viewer engine
 * behind the /i/<token> share page and InvoiceView's PDF modal).
 *
 * Structure: a fixed `doc-pan` surface (host supplies layout via className)
 * containing the paper — the document at its NATURAL pixel size, absolutely
 * anchored top-left — plus optional desktop zoom controls and a hint slot.
 * <usePinchZoomPan> owns every gesture; this component owns the FIT:
 *
 *   fit = clamp((containerWidth − 2 × gutter) / paperWidth, [minFit, fitCap])
 *   band = [fit, 5 × fit]
 *
 * `gutter` reserves that many pixels on EACH side of the surface for the fit
 * maths only (the paper still pans freely across the full surface), so a host
 * can keep the sheet from going full-bleed on narrow screens. It defaults to
 * 0, which is exactly the old behaviour.
 *
 * The fit re-computes on resize/rotation via ResizeObserver on the surface's
 * CONTENT box (padding excluded, matching the old per-page measurement) and
 * deliberately NOT on browser ctrl/cmd zoom, which leaves CSS pixels alone.
 * Fit changes re-snap the view to fit (document-viewer contract) without
 * touching the engine.
 *
 * Props:
 *   paperWidth — natural pixel width of the sheet (794 = A4 portrait).
 *   fitCap     — maximum fit scale (1 = full-bleed; the share page caps it below 1).
 *   minFit     — legibility floor for absurdly small viewports.
 *   gutter     — px reserved on each side of the surface for the fit (default 0).
 *   className  — layout classes for the surface element itself.
 *   controls   — "none" | "desktop": on-screen +/−/Reset (fine pointers only).
 *   surfaceTestId / paperTestId — passthrough for the gesture tests.
 *   hint       — optional one-time hint overlay rendered inside the surface.
 *
 * Ref: { zoomIn, zoomOut, resetFit } — all animated.
 */
const ZoomPanViewer = forwardRef(function ZoomPanViewer(
  {
    paperWidth = 794,
    fitCap = 1,
    minFit = 0.2,
    gutter = 0,
    className = "",
    style,
    children,
    controls = "none",
    surfaceTestId,
    paperTestId,
    hint = null,
    onGesture,
  },
  ref,
) {
  const surfaceRef = useRef(null);
  const paperRef = useRef(null);
  const [containerW, setContainerW] = useState(0);

  // The measure→fit loop mirrors the old per-page code verbatim: content-box
  // width of the surface (minus the optional side gutters) over the paper's
  // natural width, floored so an A4 stays legible on a watch-sized viewport
  // and capped by fitCap — the share page opens a touch under full size so
  // the sheet never reads as edge-to-edge wide.
  const fitScale = containerW
    ? Math.min(fitCap, Math.max(minFit, (containerW - 2 * gutter) / paperWidth))
    : fitCap;

  // Live zoom band for the once-attached engine; refit on every fit change.
  const zoomBandRef = useRef({ min: fitScale, max: fitScale * MAX_ZOOM_FACTOR });
  const apiRef = useRef(null);
  const viewRef = usePinchZoomPan({ surfaceRef, paperRef, zoomBandRef, apiRef, onGesture });

  useLayoutEffect(() => {
    const paper = paperRef.current;
    const surface = surfaceRef.current;
    zoomBandRef.current = { min: fitScale, max: fitScale * MAX_ZOOM_FACTOR };
    if (paper && surface && !apiRef.current) {
      // First mount: paint the fit BEFORE the engine attaches — no flash of
      // the root transform before the band lands.
      const b = panBounds({
        surfaceW: surface.clientWidth,
        surfaceH: surface.clientHeight,
        contentW: Math.max(1, paper.offsetWidth),
        contentH: Math.max(1, paper.offsetHeight),
        scale: fitScale,
      });
      viewRef.current = { s: fitScale, x: b.xMin, y: 0 };
      paper.style.transform = `translate3d(${b.xMin}px, 0px, 0) scale(${fitScale})`;
      surface.classList.remove("is-zoomed", "is-grabbing");
    } else {
      apiRef.current?.resetFit(false);
    }
  }, [fitScale, viewRef]);

  // Measure the surface's CONTENT box (excludes px gutters). The observer
  // reports the initial size on observe and keeps up with resize/rotation.
  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setContainerW((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Desktop-only on-screen controls (spec: +, −, Reset). Coarse pointers use
  // gestures, so touch devices keep a control-free document. The buttons are
  // safe to render before the engine ref fills (optional chaining); a click
  // can only happen long after the layout-effect attach.
  const finePointer = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    [],
  );
  const showControls = controls === "desktop" && finePointer;

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => apiRef.current?.zoomStep(1.3),
      zoomOut: () => apiRef.current?.zoomStep(1 / 1.3),
      resetFit: () => apiRef.current?.resetFit(true),
    }),
    [],
  );

  const holdStill = (e) => e.stopPropagation(); // controls never pan the sheet

  return (
    <div
      ref={surfaceRef}
      data-testid={surfaceTestId || undefined}
      className={`doc-pan relative overflow-hidden select-none ${className}`}
      style={style}
    >
      <div
        ref={paperRef}
        data-testid={paperTestId || undefined}
        className="zp-paper"
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
      {hint}
      {showControls && (
        <div
          className="zp-controls absolute bottom-3 right-3 z-30 flex flex-col items-center gap-1.5"
          data-zp-ui=""
          onPointerDown={holdStill}
          onDoubleClick={holdStill}
        >
          <button
            type="button"
            aria-label="Increase zoom"
            title="Zoom in (Ctrl +)"
            onClick={() => apiRef.current?.zoomStep(1.3)}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur hover:bg-slate-50 active:bg-slate-100 transition-colors text-lg leading-none"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Decrease zoom"
            title="Zoom out (Ctrl −)"
            onClick={() => apiRef.current?.zoomStep(1 / 1.3)}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur hover:bg-slate-50 active:bg-slate-100 transition-colors text-lg leading-none"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Fit width"
            title="Reset to fit width (Ctrl 0)"
            onClick={() => apiRef.current?.resetFit(true)}
            className="h-9 rounded-full border border-slate-200 bg-white/95 px-3 text-slate-700 shadow-md backdrop-blur hover:bg-slate-50 active:bg-slate-100 transition-colors text-xs font-semibold"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
});

export default ZoomPanViewer;
