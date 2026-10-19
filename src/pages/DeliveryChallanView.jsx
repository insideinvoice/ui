import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import LoadingDots from "../components/LoadingDots";
import DeliveryChallanDoc from "../components/DeliveryChallanDoc";
import SelectMenu from "../components/SelectMenu";
import { renderDeliveryChallanPdf } from "../components/DeliveryChallanDownload";
import { chunkDcItems, DC_PAGE_W, DC_PAGE_H } from "../utils/deliveryChallanPdf";
import { deliveryChallanAPI, businessAPI } from "../api/auth";
import toast from "react-hot-toast";
import {
  Download,
  Trash2,
  ClipboardList,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ScrollText,
  Crown,
  CircleDot,
  Stamp,
} from "lucide-react";

// "2026-10-11" (or an ISO timestamp) → "11 Oct 2026", timezone-safe: the
// parts are parsed by hand so an evening-UTC timestamp can't shift the day.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = String(d).split("-");
  const mi = parseInt(m, 10) - 1;
  if (!y || !MONTHS[mi]) return d;
  return `${parseInt(day, 10)} ${MONTHS[mi]} ${y}`;
};

// Scale the fixed-width challan page down so it fits the viewport on
// phones/tablets. Capped at 1 so wide screens never upscale the document.
const computeFitScale = (pageWidthPx) => {
  const padding = window.innerWidth < 640 ? 24 : 48;
  const availableWidth = window.innerWidth - padding;
  return Math.min(1, Math.max(0.2, availableWidth / pageWidthPx));
};

// Discrete zoom levels the +/- buttons step through (25% … 300%).
const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const ZOOM_MIN = ZOOM_LEVELS[0];
const ZOOM_MAX = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

export default function DeliveryChallanView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [dc, setDc] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [fitScale, setFitScale] = useState(1);
  // Applied scale = what the +/- toolbar controls; defaults to fit-to-width
  // and is re-fitted on load and rotation.
  const [scale, setScale] = useState(1);

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

  // Fit-to-width on load and when the screen rotates so the whole page is
  // always readable on a phone. Rotation resets any manual zoom back to fit.
  useEffect(() => {
    if (!dc) return undefined;
    const fit = computeFitScale(DC_PAGE_W);
    setFitScale(fit);
    setScale(fit);
    const mq = window.matchMedia("(orientation: portrait)");
    const onOrientationChange = () => {
      const next = computeFitScale(DC_PAGE_W);
      setFitScale(next);
      setScale(next);
    };
    mq.addEventListener("change", onOrientationChange);
    return () => mq.removeEventListener("change", onOrientationChange);
  }, [dc]);

  // Step zoom one level up/down through ZOOM_LEVELS, starting from the
  // current value so fit-scale (which is rarely a level) moves smoothly.
  const stepZoom = (dir) =>
    setScale((s) => {
      const next =
        dir > 0
          ? ZOOM_LEVELS.find((l) => l > s + 0.001)
          : [...ZOOM_LEVELS].reverse().find((l) => l < s - 0.001);
      return next ?? s;
    });

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
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deliveryChallanAPI.delete(id);
      toast.success("Delivery challan deleted");
      navigate("/delivery-challans");
    } catch (err) {
      // Already deleted (double-tap / another device) — same end state.
      if (err.response?.status === 404) {
        toast.success("Delivery challan deleted");
        navigate("/delivery-challans");
      } else {
        toast.error(err.response?.data?.message || "Failed to delete");
        setDeleteBusy(false);
      }
    }
  };

  if (loading || !dc) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
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
      <div className="px-3 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1400px] mx-auto">
        <PageHeader title={`Challan ${dc.challanNumber}`} backTo="/delivery-challans" />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          {/* Summary row — icon, customer + meta, primary actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                {dc.customerName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {formatDate(dc.challanDate)}
                <span className="mx-1.5 text-slate-300">·</span>
                {dc.items?.length || 0} item{dc.items?.length === 1 ? "" : "s"}
                {dc.poNumber ? (
                  <>
                    <span className="mx-1.5 text-slate-300">·</span>P.O {dc.poNumber}
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownload}
                disabled={downloading}
                title="Download PDF"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 active:scale-[0.98] disabled:opacity-50 transition-all shadow-sm min-h-[40px]"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                title="Delete challan"
                aria-label="Delete challan"
                className="flex items-center justify-center w-10 h-10 bg-white text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Document options — template dropdown · seal switch · stamp dropdown */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <SelectMenu
              value={template}
              onChange={(v) => {
                setTemplate(v);
                localStorage.setItem("ii_dc_template", v);
              }}
              options={[
                { value: "classic", label: "Classic", icon: ScrollText },
                { value: "royal", label: "Royal", icon: Crown },
              ]}
              ariaLabel="Template"
              minWidth={130}
            />
            <button
              type="button"
              role="switch"
              aria-checked={sealOn}
              onClick={() => {
                const next = !sealOn;
                setSealOn(next);
                localStorage.setItem("ii_dc_seal", next ? "on" : "off");
              }}
              className={`inline-flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-lg border text-xs font-semibold transition-colors ${
                sealOn
                  ? "bg-teal-50 border-teal-200 text-teal-700"
                  : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`relative w-7 h-4 rounded-full transition-colors shrink-0 ${
                  sealOn ? "bg-teal-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${
                    sealOn ? "left-3.5" : "left-0.5"
                  }`}
                />
              </span>
              Seal
            </button>
            {sealOn && (
              <SelectMenu
                value={sealType}
                onChange={(v) => {
                  setSealType(v);
                  localStorage.setItem("seal_type", v);
                }}
                options={[
                  { value: "round", label: "Round", icon: CircleDot },
                  { value: "stamp", label: "Rubber", icon: Stamp },
                ]}
                ariaLabel="Stamp type"
                minWidth={115}
              />
            )}
          </div>
        </div>

        {/* Document viewer — toolbar (page count + zoom in/out/fit) above a
            scrollable area holding the fixed 714px page scaled by `scale`.
            Pinch / ctrl+scroll browser zoom still works for free-hand zoom. */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-slate-200 bg-slate-50">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">
              {chunks.length} page{chunks.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => stepZoom(-1)}
                disabled={scale <= ZOOM_MIN + 0.001}
                title="Zoom out"
                aria-label="Zoom out"
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="w-12 text-center text-xs font-bold text-slate-600 tabular-nums select-none">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => stepZoom(1)}
                disabled={scale >= ZOOM_MAX - 0.001}
                title="Zoom in"
                aria-label="Zoom in"
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setScale(fitScale)}
                disabled={Math.abs(scale - fitScale) < 0.001}
                title="Fit to width"
                aria-label="Fit to width"
                className="flex items-center justify-center w-8 h-8 ml-1 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="min-w-full flex items-start justify-center p-2 sm:p-4">
            <div
              style={{
                width: `${DC_PAGE_W}px`,
                zoom: scale,
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

        {/* Clear the fixed mobile bottom navigation */}
        <div className="h-16 sm:h-4" aria-hidden="true" />

        <ConfirmModal
          open={deleteOpen}
          title="Delete Delivery Challan"
          message={`Are you sure you want to delete "${dc.challanNumber}"? This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          busy={deleteBusy}
          onCancel={() => setDeleteOpen(false)}
        />
      </div>
    </div>
  );
}
