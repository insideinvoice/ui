import { useState, useEffect, useLayoutEffect, useRef, memo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import InvoicePDF from "../components/InvoicePDF";
import InvoiceTemplateVariants from "../components/InvoiceTemplateVariants";
import { TEMPLATE_THEMES } from "../constants/templateThemes";
import DeliveryChallanDoc from "../components/DeliveryChallanDoc";
import { DC_PAGE_W } from "../utils/deliveryChallanPdf";
import { ArrowLeft, Check, X, Eye, FileText, ClipboardList } from "lucide-react";
import toast from "react-hot-toast";

const ALL_TEMPLATES = [
  {
    id: "template-1",
    label: "Original",
    desc: "Default invoice template with classic black borders and clean layout",
    color: "#000000",
  },
  ...Object.values(TEMPLATE_THEMES),
];

const sampleBusiness = {
  businessName: "Acme Enterprises",
  addressLine1: "42, Industrial Layout",
  addressLine2: "Electronics City",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560100",
  phone: "+91 98765 43210",
  email: "info@acme.in",
  gstIn: "29ABCDE1234F1Z5",
};

const sampleCustomer = {
  name: "Good Luck Traders",
  billingAddress: "15, MG Road, Ashok Nagar, Bengaluru - 560001",
  phone: "+91 87654 32109",
  email: "orders@goodluck.in",
  gstIn: "29PQRST5678K1Z3",
};

const sampleForm = {
  invoiceDate: "2026-10-01",
  dueDate: "2026-10-31",
  placeOfSupply: "Karnataka",
  deliveryNote: "DN-2026-101",
  deliveryNoteDate: "2026-09-30",
  referenceNumber: "REF-001",
  buyerOrderNumber: "PO-2026-142",
  dispatchDocNumber: "DD-2026-101",
  dispatchedThrough: "Express Logistics",
  termsOfDelivery: "Free delivery",
  paymentTerms: "Net 30",
  otherReferences: "Quotation Q-2026-118",
  destination: "Bengaluru",
};

const sampleItems = [
  { itemName: "Premium Office Chair", hsn: "940130", qty: "5", rate: "8500", gstPercentage: "18", taxableValue: 42500, taxAmount: 7650, total: 50150 },
  { itemName: "Standing Desk (Electric)", hsn: "940310", qty: "3", rate: "22500", gstPercentage: "18", taxableValue: 67500, taxAmount: 12150, total: 79650 },
  { itemName: "LED Monitor 27 inch", hsn: "852852", qty: "8", rate: "18500", gstPercentage: "18", taxableValue: 148000, taxAmount: 26640, total: 174640 },
];

const sampleTotals = {
  subtotal: 258000,
  taxAmount: 46440,
  grandTotal: 304440,
};

const sampleDcItems = [
  { sno: 1, description: "Premium Teak Wood Plank 6ft", quantity: 12 },
  { sno: 2, description: "MDF Sheet 8ft x 4ft (18mm)", quantity: 5 },
  { sno: 3, description: "Bollywood Veneer Sheet - Walnut", quantity: 24 },
  { sno: 4, description: "Soft Close Drawer Channel 18in", quantity: 16 },
  { sno: 5, description: "Marine Plywood 19mm - BWP Grade", quantity: 8 },
  { sno: 6, description: "Edge Banding Tape 22mm - Oak", quantity: 30 },
];

const sampleDcChallan = {
  challanNumber: "DC-2026-1001",
  challanDate: "2026-10-06",
  poNumber: "PO-2026-142",
  poDate: "2026-10-01",
};

const DC_TEMPLATES = [
  {
    id: "classic",
    label: "Classic",
    desc: "Bold bordered layout with GST/PAN strip, M/s party box and signature footer",
  },
  {
    id: "royal",
    label: "Royal",
    desc: "Elegant serif layout with script company name, salutation block and remarks column",
  },
];

function DcPreviewDoc({ variant }) {
  return (
    <DeliveryChallanDoc
      variant={variant}
      business={sampleBusiness}
      customer={sampleCustomer}
      challanNumber={sampleDcChallan.challanNumber}
      challanDate={sampleDcChallan.challanDate}
      poNumber={sampleDcChallan.poNumber}
      poDate={sampleDcChallan.poDate}
      items={sampleDcItems}
      showSeal
    />
  );
}

function TemplatePreview({ templateId }) {
  const previewRef = useRef(null);
  const { industry } = useAuth();

  const commonProps = {
    business: { ...sampleBusiness, industry },
    customer: sampleCustomer,
    form: sampleForm,
    items: sampleItems,
    totals: sampleTotals,
    discountPercent: "0",
    type: "TAX_INVOICE",
    invoiceNumber: "INV-2026-001",
  };

  if (templateId === "template-1") {
    return <InvoicePDF ref={previewRef} {...commonProps} />;
  }
  return <InvoiceTemplateVariants ref={previewRef} theme={templateId} {...commonProps} />;
}

/* Invoice templates render at a fixed print width (~716px). Inside the preview
   modal nothing constrains that width, so on a phone the document is wider than
   the screen and a tap inside it triggers the browser's own smart-zoom — after
   which the modal is unusable. Scaling the document down to the available width
   keeps it fully readable and stops the viewport from ever overflowing. */
const PREVIEW_NATIVE_WIDTH = 832;

function ScaledPreview({ templateId }) {
  const wrapRef = useRef(null);
  const docRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
  // the document is out of flow, so the wrapper needs the measured width
  // explicitly — otherwise the modal collapses to its header width.
  const [native, setNative] = useState(PREVIEW_NATIVE_WIDTH);

  /* The document must be measured directly, and kept out of flow: if the
     scaled document still contributes its unscaled height, the reserved
     spacer + ResizeObserver feed each other and the modal grows without
     bound (infinite scrolling). Absolute positioning removes the document
     from the wrapper's layout, so the wrapper is exactly `height` tall. */
  useEffect(() => {
    const wrap = wrapRef.current;
    const doc = docRef.current;
    if (!wrap || !doc) return undefined;
    const measure = () => {
      const w = doc.offsetWidth || PREVIEW_NATIVE_WIDTH;
      const avail = wrap.clientWidth || w;
      if (!avail) return;
      const next = Math.min(1, avail / w);
      setNative(w);
      setScale(next);
      setHeight(Math.ceil(doc.offsetHeight * next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap); // modal width / page resize
    ro.observe(doc); // document content size (template switch)
    return () => ro.disconnect();
  }, [templateId]);

  return (
    <div
      ref={wrapRef}
      className="overflow-hidden"
      style={{ position: "relative", width: `${native}px`, maxWidth: "100%" }}
    >
      <div
        ref={docRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: "max-content",
          maxWidth: "none",
        }}
      >
        <TemplatePreview templateId={templateId} />
      </div>
      {/* reserve the scaled height so the scroll container sizes correctly */}
      <div style={{ height: `${height}px` }} aria-hidden="true" />
    </div>
  );
}

function DcScaledPreview({ variant }) {
  const wrapRef = useRef(null);
  const docRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
  const [native, setNative] = useState(DC_PAGE_W);

  // Same contract as ScaledPreview: measure the document itself (never the
  // wrapper, whose height includes the reserved spacer) and keep it out of
  // flow so the reserved height cannot feed back into the measurement.
  useEffect(() => {
    const wrap = wrapRef.current;
    const doc = docRef.current;
    if (!wrap || !doc) return undefined;
    const measure = () => {
      const w = doc.offsetWidth || DC_PAGE_W;
      const avail = wrap.clientWidth || w;
      if (!avail) return;
      const next = Math.min(1, avail / w);
      setNative(w);
      setScale(next);
      setHeight(Math.ceil(doc.offsetHeight * next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(doc);
    return () => ro.disconnect();
  }, [variant]);

  return (
    <div
      ref={wrapRef}
      className="overflow-hidden"
      style={{ position: "relative", width: `${native}px`, maxWidth: "100%" }}
    >
      <div
        ref={docRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: "max-content",
          maxWidth: "none",
        }}
      >
        <DcPreviewDoc variant={variant} />
      </div>
      <div style={{ height: `${height}px` }} aria-hidden="true" />
    </div>
  );
}

const DcTemplateCard = memo(function DcTemplateCard({ template, isSelected, onSelect, onPreview }) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  // Fit before paint and refit on resize: the scaled document still has its
  // unscaled layout width (714px), so the container must clip — never scroll —
  // otherwise every card gets its own horizontal scrollbar.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const fit = () => setScale(el.offsetWidth / DC_PAGE_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={`relative bg-white rounded-xl shadow-sm border-2 transition-all cursor-pointer overflow-hidden flex flex-col ${
        isSelected ? "border-teal-500 ring-2 ring-teal-200" : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-0 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800">{template.label}</h3>
          {isSelected && (
            <span className="flex items-center gap-1 text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> Active
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{template.desc}</p>
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg border border-slate-100 bg-white"
          style={{ height: "220px" }}
          onClick={() => onPreview(template.id)}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: `${DC_PAGE_W}px`,
            }}
            className="pointer-events-none"
          >
            <DcPreviewDoc variant={template.id} />
          </div>
        </div>
      </div>
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-slate-100 mt-3 flex items-center gap-2 justify-between">
        <button
          onClick={() => onPreview(template.id)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button
          onClick={() => onSelect(template.id)}
          className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${
            isSelected
              ? "bg-teal-100 text-teal-700 cursor-default"
              : "bg-slate-800 text-white hover:bg-slate-700"
          }`}
        >
          {isSelected ? "Selected" : "Use"}
        </button>
      </div>
    </div>
  );
});

const TemplateCard = memo(function TemplateCard({ template, isSelected, onSelect, onPreview }) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  // Same fit contract as DcTemplateCard: scale to the container before paint,
  // refit on resize, clip (never scroll) the unscaled 832px layout width.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const fit = () => setScale(el.offsetWidth / 832);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={`relative bg-white rounded-xl shadow-sm border-2 transition-all cursor-pointer overflow-hidden flex flex-col ${
        isSelected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-0 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">{template.label}</h3>
          {isSelected && (
            <span className="flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> Active
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{template.desc}</p>
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg border border-slate-100 bg-white"
          style={{ height: "220px" }}
          onClick={() => onPreview(template.id)}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: "832px",
            }}
            className="pointer-events-none"
          >
            <TemplatePreview templateId={template.id} />
          </div>
        </div>
      </div>
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-slate-100 mt-3 flex items-center gap-2 justify-between">
        <button
          onClick={() => onPreview(template.id)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button
          onClick={() => onSelect(template.id)}
          className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${
            isSelected
              ? "bg-indigo-100 text-indigo-700 cursor-default"
              : "bg-slate-800 text-white hover:bg-slate-700"
          }`}
        >
          {isSelected ? "Selected" : "Select"}
        </button>
      </div>
    </div>
  );
});

export default function InvoiceTemplates() {
  const { selectedTemplate, updateTemplate } = useAuth();
  const [selected, setSelected] = useState(selectedTemplate);
  const [previewId, setPreviewId] = useState(null);
  const [dcTemplate, setDcTemplate] = useState(
    () => localStorage.getItem("ii_dc_template") || "classic"
  );
  const [dcPreviewId, setDcPreviewId] = useState(null);

  const handleSelect = useCallback(async (id) => {
    setSelected(id);
    try {
      // updateTemplate clears stale per-type overrides before pushing
      // print_settings, so the server and downloads both switch to this template.
      await updateTemplate(id);
      toast.success(`"${ALL_TEMPLATES.find((t) => t.id === id)?.label}" template selected`);
    } catch {
      toast.error("Failed to save template preference");
      setSelected(selectedTemplate);
    }
  }, [updateTemplate, selectedTemplate]);

  const handleSelectDc = useCallback((id) => {
    setDcTemplate(id);
    localStorage.setItem("ii_dc_template", id);
    toast.success(`"${DC_TEMPLATES.find((t) => t.id === id)?.label}" template selected for delivery challans`);
  }, []);

  const previewTemplate = ALL_TEMPLATES.find((t) => t.id === previewId);
  const dcPreviewTemplate = DC_TEMPLATES.find((t) => t.id === dcPreviewId);

  // Lock background scroll while either preview modal is open (both desktop and
  // mobile) so only the modal body scrolls — a professional modal behaviour.
  const modalOpen = Boolean(previewId || dcPreviewId);
  useEffect(() => {
    if (!modalOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="max-w-[1900px] mx-auto px-4 sm:px-6 py-6">
        <PageHeader title="Templates" />
        <p className="text-xs text-slate-500 -mt-4 mb-6">Choose a template style for your invoices and delivery challans</p>

        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold text-slate-800">Invoices</h2>
          <span className="text-xs text-slate-400">{ALL_TEMPLATES.length} templates</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
          {ALL_TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isSelected={selected === t.id}
              onSelect={handleSelect}
              onPreview={setPreviewId}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-teal-500" />
          <h2 className="text-sm font-bold text-slate-800">Delivery Challan</h2>
          <span className="text-xs text-slate-400">{DC_TEMPLATES.length} templates</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DC_TEMPLATES.map((t) => (
            <DcTemplateCard
              key={t.id}
              template={t}
              isSelected={dcTemplate === t.id}
              onSelect={handleSelectDc}
              onPreview={setDcPreviewId}
            />
          ))}
        </div>
      </div>

      {/* Delivery Challan Preview Modal */}
      {dcPreviewId && dcPreviewTemplate && (
        <div
          className="fixed inset-0 z-[1200] bg-black/40 backdrop-blur-sm flex justify-center overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-10"
          style={{ touchAction: "pan-y" }}
          onClick={() => setDcPreviewId(null)}
        >
          <div className="relative w-full sm:w-auto m-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white shadow-2xl overflow-hidden rounded-xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh]" style={{ maxWidth: "900px", width: "100%" }}>
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 gap-2 shrink-0 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setDcPreviewId(null)}
                    aria-label="Close preview"
                    className="p-2.5 -ml-2 -my-1 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <ClipboardList className="w-5 h-5 text-teal-600 shrink-0" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                    {dcPreviewTemplate.label} Template
                  </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {dcTemplate !== dcPreviewId && (
                    <button
                      onClick={() => {
                        handleSelectDc(dcPreviewId);
                        setDcPreviewId(null);
                      }}
                      className="text-xs font-semibold px-3 sm:px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all whitespace-nowrap"
                    >
                      Use
                    </button>
                  )}
                  {dcTemplate === dcPreviewId && (
                    <span className="flex items-center gap-1 text-xs font-medium text-teal-600 bg-teal-50 px-3 py-2 rounded-lg">
                      <Check className="w-3.5 h-3.5" /> Active
                    </span>
                  )}
                </div>
              </div>
              <div
                className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden overscroll-contain flex-1 min-h-0"
                style={{ touchAction: "pan-y" }}
              >
                <DcScaledPreview variant={dcPreviewId} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Preview Modal */}
      {previewId && previewTemplate && (
        <div
          className="fixed inset-0 z-[1200] bg-black/40 backdrop-blur-sm flex justify-center overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-10"
          style={{ touchAction: "pan-y" }}
          onClick={() => setPreviewId(null)}
        >
          <div className="relative w-full sm:w-auto m-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white shadow-2xl overflow-hidden rounded-xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh]" style={{ maxWidth: "900px", width: "100%" }}>
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 gap-2 shrink-0 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setPreviewId(null)} aria-label="Close preview"
                    className="p-2.5 -ml-2 -my-1 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                  <FileText className="w-5 h-5 text-slate-600 shrink-0" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">{previewTemplate.label} Template</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selected !== previewId && (
                    <button
                      onClick={() => { handleSelect(previewId); setPreviewId(null); }}
                      className="text-xs font-semibold px-3 sm:px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all whitespace-nowrap"
                    >
                      Select
                    </button>
                  )}
                  {selected === previewId && (
                    <span className="flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
                      <Check className="w-3.5 h-3.5" /> Active
                    </span>
                  )}
                </div>
              </div>
              <div
                className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden overscroll-contain flex-1 min-h-0"
                style={{ touchAction: "pan-y" }}
              >
                <ScaledPreview templateId={previewId} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
