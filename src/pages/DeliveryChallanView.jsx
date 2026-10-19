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
import { Download, Trash2, ClipboardList } from "lucide-react";

// Scale the fixed-width challan page down so it fits the viewport on
// phones/tablets. Capped at 1 so wide screens never upscale the document.
// All interactive zoom (pinch, ctrl/cmd+scroll, double-tap) is left to the
// native browser gestures, which work identically on every device.
const computeFitScale = (pageWidthPx) => {
  const padding = window.innerWidth < 640 ? 24 : 48;
  const availableWidth = window.innerWidth - padding;
  return Math.min(1, Math.max(0.2, availableWidth / pageWidthPx));
};

export default function DeliveryChallanView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [dc, setDc] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const containerRef = useRef(null);
  const wrapRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);
  const [docHeight, setDocHeight] = useState(0);

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
  // always readable on a phone. Deliberately NOT re-fitting on every resize:
  // browser (ctrl/cmd) zoom fires resize and re-fitting then would cancel the
  // user's zoom.
  useEffect(() => {
    if (!dc) return undefined;
    setFitScale(computeFitScale(DC_PAGE_W));
    const mq = window.matchMedia("(orientation: portrait)");
    const onOrientationChange = () => setFitScale(computeFitScale(DC_PAGE_W));
    mq.addEventListener("change", onOrientationChange);
    return () => mq.removeEventListener("change", onOrientationChange);
  }, [dc]);

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

        {/* Scrollable document viewer — the fixed 714px page is scaled to fit
            so it is readable and scrollable on phones instead of overflowing
            off-screen. Pinch / ctrl+scroll zoom are left to the browser. */}
        <div
          ref={containerRef}
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto relative select-none"
          style={{
            minHeight: "50vh",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          <div className="min-w-full min-h-full flex justify-center items-start p-2 sm:p-4">
            <div
              style={{
                width: `${Math.round(DC_PAGE_W * fitScale)}px`,
                height: docHeight > 0 ? `${Math.round(docHeight * fitScale)}px` : "auto",
                position: "relative",
                margin: "0 auto",
                flexShrink: 0,
              }}
            >
              <div
                ref={wrapRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: `${DC_PAGE_W}px`,
                  transform: `scale(${fitScale})`,
                  transformOrigin: "top left",
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
