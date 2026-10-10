import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import LoadingDots from "../components/LoadingDots";
import DeliveryChallanDoc from "../components/DeliveryChallanDoc";
import { renderDeliveryChallanPdf } from "../components/DeliveryChallanDownload";
import { chunkDcItems, DC_PAGE_W, DC_PAGE_H } from "../utils/deliveryChallanPdf";
import { deliveryChallanAPI, businessAPI } from "../api/auth";
import toast from "react-hot-toast";
import { Download, Trash2, ClipboardList, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

const clampZoom = (z) => Math.min(3, Math.max(0.2, +z.toFixed(2)));

export default function DeliveryChallanView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [dc, setDc] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const containerRef = useRef(null);
  const wrapRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [docHeight, setDocHeight] = useState(0);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const [template, setTemplate] = useState(
    () => localStorage.getItem("ii_dc_template") || "classic"
  );
  const [sealOn, setSealOn] = useState(
    () => localStorage.getItem("ii_dc_seal") !== "off"
  );
  // Round seal vs rectangular rubber stamp — same global preference the
  // invoice flow uses (localStorage.seal_type), defaulting to the round seal.
  const [sealType, setSealType] = useState(
    () => localStorage.getItem("seal_type") || "round"
  );

  useEffect(() => {
    Promise.all([
      deliveryChallanAPI.getById(id),
      businessAPI.getProfile(),
    ])
      .then(([dRes, bRes]) => {
        setDc(dRes.data.data);
        setBusiness(bRes.data.data);
      })
      .catch(() => toast.error("Failed to load delivery challan"))
      .finally(() => setLoading(false));
  }, [id]);

  // Derived props are computed once per data change (not on every spinner
  // toggle) and keep referential identity so the memoized document skips
  // re-renders when nothing it renders actually changed.
  const chunks = useMemo(() => chunkDcItems(dc?.items || []), [dc]);
  const previewCustomer = useMemo(() => ({
    name: dc?.customerName,
    billingAddress: dc?.customerAddress,
    phone: dc?.customerPhone,
    gstIn: dc?.customerGstIn,
  }), [dc]);

  const computeFitZoom = () => {
    const el = containerRef.current;
    const avail = el ? el.clientWidth - 16 : DC_PAGE_W;
    return clampZoom(avail / DC_PAGE_W);
  };

  // Fit-to-width on load and whenever the viewport rotates/resizes, so the
  // whole page is always readable on a phone.
  useEffect(() => {
    if (!dc) return undefined;
    const fit = () => setZoom(computeFitZoom());
    fit();
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        setZoom((prev) => (prev < 0.95 ? computeFitZoom() : prev));
      }, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [dc, template, chunks.length]);

  // Measure the unscaled document height so the scaled sizing wrapper can
  // reserve the correct scroll height (transform: scale does not affect layout).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const h = el.offsetHeight || el.scrollHeight;
      if (h > 0) setDocHeight(h);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    return () => ro && ro.disconnect();
  }, [dc, template, chunks.length, sealOn, sealType]);

  // Two-finger pinch zoom + double-tap to toggle fit/100%.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let startDist = 0;
    let startZoom = 1;
    let lastTap = 0;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        setIsPinching(true);
        startDist = dist(e.touches);
        startZoom = zoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 300) {
          setZoom(zoomRef.current < 0.95 ? computeFitZoom() : 1);
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 2 && startDist > 0) {
        if (e.cancelable) e.preventDefault();
        const d = dist(e.touches);
        if (d > 0) setZoom(clampZoom(startZoom * (d / startDist)));
      }
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) {
        startDist = 0;
        setIsPinching(false);
      }
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [dc]);

  // Desktop ctrl/cmd + wheel zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.08 : -0.08)));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleDownload = async () => {
    if (!dc || !business) return;
    setDownloading(true);
    try {
      const pdf = await renderDeliveryChallanPdf(dc, business, {
        variant: template,
        sealOn,
        sealType,
      });
      pdf.save(`Delivery_Challan_${dc.challanNumber}.pdf`);
      toast.success("Downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deliveryChallanAPI.delete(id);
      toast.success("Delivery challan deleted");
      navigate("/delivery-challans");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  if (loading || !dc) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <AppNavbar />
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100dvh - 80px)" }}
        >
          <LoadingDots className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-3 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1400px] mx-auto">
        <PageHeader title={`Challan ${dc.challanNumber}`} backTo="/delivery-challans" />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardList className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {dc.customerName}{" "}
                <span className="text-slate-400 font-normal">·</span>{" "}
                {dc.challanDate}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {dc.items?.length || 0} items
                {dc.poNumber ? ` · P.O No ${dc.poNumber}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleDownload}
                disabled={downloading}
                title="Download PDF"
                aria-label="Download PDF"
                className="flex items-center justify-center w-9 h-9 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-all"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                title="Delete challan"
                aria-label="Delete challan"
                className="flex items-center justify-center w-9 h-9 bg-white text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* One compact row: template · seal toggle · seal type */}
          <div className="flex items-center gap-2">
            <select
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                localStorage.setItem("ii_dc_template", e.target.value);
              }}
              aria-label="Template"
              className="grow basis-0 min-w-[100px] px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 bg-white min-h-[40px]"
            >
              <option value="classic">Classic</option>
              <option value="royal">Royal</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none px-0.5 shrink-0 min-h-[40px]">
              <input
                type="checkbox"
                checked={sealOn}
                onChange={(e) => {
                  setSealOn(e.target.checked);
                  localStorage.setItem(
                    "ii_dc_seal",
                    e.target.checked ? "on" : "off"
                  );
                }}
                className="w-4 h-4 accent-teal-600"
              />
              Seal
            </label>
            {sealOn && (
              <select
                value={sealType}
                onChange={(e) => {
                  setSealType(e.target.value);
                  localStorage.setItem("seal_type", e.target.value);
                }}
                className="grow basis-0 min-w-[92px] px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 bg-white min-h-[40px]"
                aria-label="Stamp type"
              >
                <option value="round">Round</option>
                <option value="stamp">Rubber</option>
              </select>
            )}
          </div>
        </div>

        {/* Scrollable, pinch-zoomable document viewer — the fixed 714px page is
            scaled to fit so it is readable and scrollable on phones instead of
            overflowing off-screen. */}
        <div
          ref={containerRef}
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto relative select-none touch-pan-x touch-pan-y"
          style={{
            minHeight: "50vh",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          <div className="min-w-full min-h-full flex justify-center items-start p-2 sm:p-4">
            <div
              style={{
                width: `${Math.round(DC_PAGE_W * zoom)}px`,
                height: docHeight > 0 ? `${Math.round(docHeight * zoom)}px` : "auto",
                position: "relative",
                margin: "0 auto",
                flexShrink: 0,
                transition: isPinching ? "none" : "width 0.15s ease-out, height 0.15s ease-out",
              }}
            >
              <div
                ref={wrapRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: `${DC_PAGE_W}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  transition: isPinching ? "none" : "transform 0.15s ease-out",
                }}
              >
                {chunks.map((chunk, i) => (
                  <div
                    key={i}
                    className="shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-slate-200 bg-white"
                    style={{ marginTop: i === 0 ? 0 : 16 }}
                  >
                    <DeliveryChallanDoc
                      variant={template}
                      business={business}
                      customer={previewCustomer}
                      challanNumber={dc.challanNumber}
                      challanDate={dc.challanDate}
                      poNumber={dc.poNumber}
                      poDate={dc.poDate}
                      items={chunk}
                      showSeal={sealOn}
                      sealType={sealType}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating mobile-friendly zoom controls */}
        <div className="fixed bottom-20 sm:bottom-6 right-4 z-40 flex items-center gap-1 rounded-full bg-white/95 shadow-xl border border-slate-200 px-2.5 py-1.5 backdrop-blur">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => setZoom((z) => clampZoom(z - 0.15))}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="text-xs font-mono text-slate-700 px-1.5 min-w-[2.8rem] text-center font-medium hover:text-teal-600 transition-colors"
            title="Reset zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => setZoom((z) => clampZoom(z + 0.15))}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Fit to screen width"
            title="Fit to screen width"
            onClick={() => setZoom(computeFitZoom())}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-16 sm:h-4" aria-hidden="true" />

        <ConfirmModal
          open={deleteOpen}
          title="Delete Delivery Challan"
          message={`Are you sure you want to delete "${dc.challanNumber}"? This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      </div>
    </div>
  );
}
