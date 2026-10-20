import DocZoomSurface from "../components/DocZoomSurface";

// DEV-ONLY gesture test bench for DocZoomSurface, driven by
// scripts/zoomGesture.test.mjs (puppeteer, 10 fresh iterations on mobile
// touch + desktop viewports). It renders a synthetic tall multi-page A4-size
// document inside the REAL zoom surface, so pinch/pan/wheel/double-tap can be
// exercised end-to-end with no auth, backend or invoice data.
//
// The route ("/__zoomlab") is registered in App.jsx only when
// import.meta.env.DEV, so it never exists in a production build.
export default function ZoomLab() {
  const page = (n) => (
    <div
      key={n}
      className="mb-6 rounded-lg border border-slate-300 bg-white shadow-sm"
      style={{ minHeight: 1000, padding: 48 }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Inside Invoice — Lab Page {n} / 3
      </p>
      <h1 className="mt-6 text-3xl font-bold text-slate-800">INV-LAB-00{n}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Synthetic document used to verify pinch, pan, flick, double-tap, wheel
        and clamping inside DocZoomSurface.
      </p>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex justify-between border-b border-slate-100 pb-2 text-sm">
            <span className="text-slate-600">Line item {i + 1}</span>
            <span className="font-mono text-slate-700">Rs. {(i + 1) * 1250}.00</span>
          </div>
        ))}
      </div>
      <div className="mt-10 border-t-2 border-slate-800 pt-4 text-right text-lg font-bold text-slate-800">
        Total: Rs. 54,000.00
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-200">
      <header
        data-testid="lab-header"
        className="shrink-0 border-b border-slate-300 bg-white px-4 py-3"
      >
        <p className="text-sm font-bold text-slate-800">INV-LAB-001 · Zoom bench</p>
        <p className="text-xs text-slate-500">
          Gesture harness target — DocZoomSurface with no on-screen controls
        </p>
      </header>
      <DocZoomSurface paperWidth={794} fitCap={1} className="min-h-0 w-full flex-1 bg-slate-100/70">
        <div style={{ width: "100%", padding: "24px 32px" }}>
          {page(1)}
          {page(2)}
          {page(3)}
        </div>
      </DocZoomSurface>
    </div>
  );
}
