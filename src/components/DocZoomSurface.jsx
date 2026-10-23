import { useEffect, useState } from "react";
import ZoomPanViewer from "./ZoomPanViewer";

/**
 * DocZoomSurface — the app's professional document viewer (zoom issues 3/4).
 *
 * ENGINE ORIGIN: the gesture engine now lives ONCE in
 * src/hooks/usePinchZoomPan.js (driven by <ZoomPanViewer>); this component is
 * the InvoiceView-facing wrapper that keeps the historical DOM contract —
 * `data-testid` markers, the one-time gesture hint, pinch/pan/zoom, always
 * fit-capped at 100% natural size.
 */
export default function DocZoomSurface({
  paperWidth = 794,
  fitCap = 1,
  minFit = 0.2,
  className = "",
  children,
}) {
  const [hintVisible, setHintVisible] = useState(true);

  // Auto-dismiss the hint: first touch/drag on the surface, or the timeout.
  useEffect(() => {
    if (!hintVisible) return undefined;
    const t = setTimeout(() => setHintVisible(false), 4500);
    return () => clearTimeout(t);
  }, [hintVisible]);

  const coarsePointer =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;

  return (
    <ZoomPanViewer
      paperWidth={paperWidth}
      fitCap={fitCap}
      minFit={minFit}
      className={className}
      controls="none"
      surfaceTestId="doc-zoom-surface"
      paperTestId="doc-zoom-paper"
      onGesture={() => setHintVisible(false)}
      // One-time gesture hint (fades out, never interactive) — no zoom
      // buttons anywhere near the document by design (enterprise zoom).
      hint={
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
      }
    >
      {children}
    </ZoomPanViewer>
  );
}
