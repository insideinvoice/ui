import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import InvoicePDF from "../components/InvoicePDF";
import InvoiceTemplateVariants, { TEMPLATE_THEMES } from "../components/InvoiceTemplateVariants";
import { ArrowLeft, Check, X, Eye, FileText } from "lucide-react";
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

function TemplatePreview({ templateId }) {
  const previewRef = useRef(null);

  const commonProps = {
    business: sampleBusiness,
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
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const avail = el.clientWidth;
      if (!avail) return;
      const next = Math.min(1, avail / PREVIEW_NATIVE_WIDTH);
      setScale(next);
      setHeight(el.scrollHeight * next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [templateId]);

  return (
    <div ref={wrapRef} className="w-full overflow-hidden">
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${PREVIEW_NATIVE_WIDTH}px`,
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

function TemplateCard({ template, isSelected, onSelect, onPreview }) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const w = containerRef.current.offsetWidth;
      setScale(w / 832);
    }
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
          className="relative overflow-x-auto overflow-y-hidden rounded-lg border border-slate-100 bg-white"
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
}

export default function InvoiceTemplates() {
  const navigate = useNavigate();
  const { selectedTemplate, updateTemplate } = useAuth();
  const [selected, setSelected] = useState(selectedTemplate);
  const [previewId, setPreviewId] = useState(null);

  const handleSelect = async (id) => {
    setSelected(id);
    try {
      await updateTemplate(id);
      toast.success(`"${ALL_TEMPLATES.find((t) => t.id === id)?.label}" template selected`);
    } catch {
      toast.error("Failed to save template preference");
      setSelected(selectedTemplate);
    }
  };

  const previewTemplate = ALL_TEMPLATES.find((t) => t.id === previewId);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="max-w-[1900px] mx-auto px-4 sm:px-6 py-6">
        <PageHeader title="Invoice Templates" />
        <p className="text-xs text-slate-500 -mt-4 mb-6">Choose a template style for your invoices</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
      </div>

      {/* Full-size Preview Modal */}
      {previewId && previewTemplate && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto overflow-x-hidden overscroll-contain py-0 sm:py-10"
          style={{ touchAction: "pan-y" }}
          onClick={() => setPreviewId(null)}
        >
          <div className="relative w-full sm:w-auto mx-0 sm:mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewId(null)}
              className="absolute -top-2 -right-2 z-10 w-10 h-10 bg-white rounded-full shadow-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="bg-white shadow-2xl overflow-hidden rounded-none sm:rounded-xl" style={{ maxWidth: "900px" }}>
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 gap-2 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setPreviewId(null)}
                    className="sm:hidden p-1.5 -ml-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
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
                className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden overscroll-contain max-h-[calc(100dvh-4rem)] sm:max-h-[80vh]"
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
