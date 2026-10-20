import { useState, useEffect, useLayoutEffect, useRef, memo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import InvoicePDF from "../components/InvoicePDF";
import InvoiceTemplateVariants from "../components/InvoiceTemplateVariants";
import { TEMPLATE_THEMES } from "../constants/templateThemes";
import DeliveryChallanDoc from "../components/DeliveryChallanDoc";
import { DC_PAGE_W } from "../utils/deliveryChallanPdf";
import { ArrowLeft, Check, X, Eye, FileText, ClipboardList } from "lucide-react";
import toast from "react-hot-toast";
import { resolveIndustryId } from "../constants/industryConfig";

const ALL_TEMPLATES = [
  {
    id: "template-1",
    label: "Original",
    desc: "Default invoice template with classic black borders and clean layout",
    color: "#000000",
  },
  ...Object.values(TEMPLATE_THEMES),
];

// Gallery sample logo — a plain B&W geometric mark (SVG data URI) so the
// Enterprise template's letterhead shows a logo in previews without shipping
// a binary asset. Real businesses upload their own from Settings.
const SAMPLE_LOGO_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='264' height='112' viewBox='0 0 264 112'>" +
  "<rect width='264' height='112' rx='14' fill='#111111'/>" +
  "<circle cx='56' cy='56' r='26' fill='none' stroke='#ffffff' stroke-width='7'/>" +
  "<rect x='108' y='34' width='14' height='44' fill='#ffffff'/>" +
  "<rect x='136' y='34' width='14' height='44' fill='#ffffff'/>" +
  "<rect x='164' y='34' width='14' height='44' fill='#ffffff' opacity='0.85'/>" +
  "</svg>";
const SAMPLE_LOGO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SAMPLE_LOGO_SVG)}`;

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
  logo: SAMPLE_LOGO,
  // Demo VPA so the gallery previews render the Scan-to-Pay QR exactly like a
  // real invoice whose owner entered a UPI id in Settings; real invoices
  // always read the persisted business profile instead.
  upiId: "acme@okaxis",
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

// Per-industry demo content for the template gallery so previews reflect the
// selected industry (names, references and line items), not a fixed trading set.
const SAMPLE_CONTENT = {
  FOOD: {
    business: { businessName: "Spice Garden Restaurant", addressLine1: "12, Food Street", addressLine2: "Indiranagar", city: "Bengaluru", pincode: "560038", phone: "+91 98450 11223", email: "orders@spicegarden.in", gstIn: "29AAACS1234A1Z5" },
    customer: { name: "Sunrise Corporate Events", billingAddress: "8, MG Road, Bengaluru - 560001", phone: "+91 99887 76655", email: "events@sunrise.in", gstIn: "29PQRS9876L1Z1" },
    form: { deliveryNote: "ORD-2026-8841", buyerOrderNumber: "EVT-2026-77", paymentTerms: "Net 15", otherReferences: "Catering Order EVT-2026-77", termsOfDelivery: "Delivered to venue" },
    items: [
      { itemName: "Veg Thali (Catering Bulk)", hsn: "9963", qty: "80", rate: "320", gstPercentage: "5", taxableValue: 25600, taxAmount: 1280, total: 26880 },
      { itemName: "Fresh Fruit Juice (1 Ltr)", hsn: "2009", qty: "40", rate: "120", gstPercentage: "12", taxableValue: 4800, taxAmount: 576, total: 5376 },
      { itemName: "Bakery Assortment Box", hsn: "1905", qty: "15", rate: "450", gstPercentage: "18", taxableValue: 6750, taxAmount: 1215, total: 7965 },
    ],
  },
  PROFESSIONAL_SERVICES: {
    business: { businessName: "Nexora Consulting LLP", addressLine1: "5th Floor, Prestige Tower", addressLine2: "Residency Road", city: "Bengaluru", pincode: "560025", phone: "+91 98860 22114", email: "billing@nexora.in", gstIn: "29AAXFN5678M1ZQ" },
    customer: { name: "Vertex Retail Pvt Ltd", billingAddress: "22, Cunningham Road, Bengaluru - 560052", phone: "+91 99450 33221", email: "accounts@vertex.in", gstIn: "29VVCD2468P1Z9" },
    form: { referenceNumber: "SOW-2026-12", buyerOrderNumber: "PO-4410", paymentTerms: "Net 30", otherReferences: "Client PO PO-4410", deliveryNote: undefined, deliveryNoteDate: undefined, dispatchDocNumber: undefined, dispatchedThrough: undefined, termsOfDelivery: undefined, destination: undefined },
    items: [
      { itemName: "Software Development (Retainer)", hsn: "998314", qty: "1", rate: "150000", gstPercentage: "18", taxableValue: 150000, taxAmount: 27000, total: 177000 },
      { itemName: "UI/UX Design Sprint", hsn: "998391", qty: "2", rate: "45000", gstPercentage: "18", taxableValue: 90000, taxAmount: 16200, total: 106200 },
      { itemName: "Cloud Infrastructure Setup", hsn: "998315", qty: "1", rate: "35000", gstPercentage: "18", taxableValue: 35000, taxAmount: 6300, total: 41300 },
    ],
  },
  HEALTHCARE: {
    business: { businessName: "Aarogya Wellness Clinic", addressLine1: "3, Health Avenue", addressLine2: "Jayanagar", city: "Bengaluru", pincode: "560041", phone: "+91 99001 44556", email: "care@aarogyaclinic.in", gstIn: "29CCQRS1357H1Z2" },
    customer: { name: "Healthy Minds Corporate", billingAddress: "41, Industrial Suburb, Bengaluru - 560068", phone: "+91 98450 99887", email: "hr@healthyminds.in", gstIn: "29HHM2468F1Z7" },
    form: { referenceNumber: "Visit Ref. VC-2026-88", buyerOrderNumber: "HR-PO-221", paymentTerms: "Net 15", otherReferences: "Corporate Order PO-221" },
    items: [
      { itemName: "Health Check-up Package", hsn: "999311", qty: "25", rate: "1800", gstPercentage: "0", taxableValue: 45000, taxAmount: 0, total: 45000 },
      { itemName: "Physiotherapy Session", hsn: "999312", qty: "10", rate: "1200", gstPercentage: "18", taxableValue: 12000, taxAmount: 2160, total: 14160 },
      { itemName: "Wellness Workshop (2 hrs)", hsn: "999293", qty: "1", rate: "15000", gstPercentage: "18", taxableValue: 15000, taxAmount: 2700, total: 17700 },
    ],
  },
  TRANSPORT: {
    business: { businessName: "Swift Freight Carriers", addressLine1: "Plot 7, Transport Nagar", addressLine2: "Peenya", city: "Bengaluru", pincode: "560058", phone: "+91 97400 55667", email: "dispatch@swiftfreight.in", gstIn: "29DDSFG3579K1Z4" },
    customer: { name: "Global Parts India Ltd", billingAddress: "19, Hosur Road, Bengaluru - 560068", phone: "+91 99860 11224", email: "logistics@globalparts.in", gstIn: "29GGPL9753J1Z8" },
    form: { deliveryNote: "LR-2026-8891", deliveryNoteDate: "2026-09-29", dispatchDocNumber: "EWB-2026-4412", dispatchedThrough: "Truck MH-12-AB-1234", destination: "Chennai", buyerOrderNumber: "PO-5521", paymentTerms: "Net 15", otherReferences: "Shipper PO PO-5521", termsOfDelivery: "Freight prepaid" },
    items: [
      { itemName: "Freight — Bengaluru to Chennai", hsn: "996511", qty: "1", rate: "18500", gstPercentage: "5", taxableValue: 18500, taxAmount: 925, total: 19425 },
      { itemName: "Loading & Unloading Charges", hsn: "999799", qty: "1", rate: "2500", gstPercentage: "18", taxableValue: 2500, taxAmount: 450, total: 2950 },
      { itemName: "Transit Insurance", hsn: "9971", qty: "1", rate: "1200", gstPercentage: "18", taxableValue: 1200, taxAmount: 216, total: 1416 },
    ],
  },
  CONSTRUCTION: {
    business: { businessName: "Shree Balaji Constructions", addressLine1: "Site Office, Plot 14", addressLine2: "Whitefield Main Road", city: "Bengaluru", pincode: "560066", phone: "+91 98801 77889", email: "projects@sbc.in", gstIn: "29DDSPC4680N1Z6" },
    customer: { name: "Prestige Developers", billingAddress: "Prestige Towers, MG Road, Bengaluru - 560001", phone: "+91 99720 33445", email: "procurement@prestige.in", gstIn: "29PPDL1357R1Z0" },
    form: { deliveryNote: "WO-2026-14", deliveryNoteDate: "2026-09-20", dispatchDocNumber: undefined, dispatchedThrough: "Site Transport", destination: "Whitefield Site", buyerOrderNumber: "PRJ-WF-22", paymentTerms: "Net 45", otherReferences: "Project PRJ-WF-22", termsOfDelivery: "At site" },
    items: [
      { itemName: "Civil Work — Foundation (RCC)", hsn: "995421", qty: "1", rate: "450000", gstPercentage: "18", taxableValue: 450000, taxAmount: 81000, total: 531000 },
      { itemName: "Steel Reinforcement Supply", hsn: "7214", qty: "5", rate: "62000", gstPercentage: "18", taxableValue: 310000, taxAmount: 55800, total: 365800 },
      { itemName: "Site Labour Charges (Monthly)", hsn: "998596", qty: "1", rate: "85000", gstPercentage: "18", taxableValue: 85000, taxAmount: 15300, total: 100300 },
    ],
  },
  MANUFACTURING: {
    business: { businessName: "Precision Fabricators", addressLine1: "Unit 4, MIDC Phase II", addressLine2: "Hoskote", city: "Bengaluru", pincode: "562114", phone: "+91 97310 22446", email: "sales@precisionfab.in", gstIn: "29EEEPF2468L1Z3" },
    customer: { name: "AutoTech Components Pvt Ltd", billingAddress: "Plot 9, Auto Nagar, Bengaluru - 560091", phone: "+91 99002 88990", email: "purchase@autotech.in", gstIn: "29AATC8642M1Z5" },
    form: { deliveryNote: "DN-2026-331", deliveryNoteDate: "2026-09-28", dispatchDocNumber: "EWB-2026-5510", dispatchedThrough: "Tata Ace MH-04-KL-9087", destination: "Auto Nagar", buyerOrderNumber: "AT-PO-778", paymentTerms: "Net 30", otherReferences: "Batch LOT-2026-77", termsOfDelivery: "Ex-works" },
    items: [
      { itemName: "CNC Machined Parts (Batch A)", hsn: "8466", qty: "200", rate: "450", gstPercentage: "18", taxableValue: 90000, taxAmount: 16200, total: 106200 },
      { itemName: "Sheet Metal Fabrication", hsn: "7326", qty: "50", rate: "1200", gstPercentage: "18", taxableValue: 60000, taxAmount: 10800, total: 70800 },
      { itemName: "Powder Coating Service", hsn: "9988", qty: "200", rate: "85", gstPercentage: "18", taxableValue: 17000, taxAmount: 3060, total: 20060 },
    ],
  },
  REPAIR: {
    business: { businessName: "AutoCare Service Centre", addressLine1: "Shop 8, Service Road", addressLine2: "Koramangala", city: "Bengaluru", pincode: "560095", phone: "+91 98451 66778", email: "service@autocare.in", gstIn: "29FFAAC3579P1Z1" },
    customer: { name: "Rahul Sharma", billingAddress: "17, 5th Block, Koramangala, Bengaluru - 560095", phone: "+91 99800 11225", email: "rahul.s@email.in", gstIn: "" },
    form: { referenceNumber: "KA-05-MJ-2211", deliveryNote: "Job Card JC-2026-441", deliveryNoteDate: "2026-09-30", paymentTerms: "On Delivery", otherReferences: "Job Card JC-2026-441", termsOfDelivery: "Vehicle released after payment" },
    items: [
      { itemName: "Engine Oil Change + Filter", hsn: "9987", qty: "1", rate: "2800", gstPercentage: "18", taxableValue: 2800, taxAmount: 504, total: 3304 },
      { itemName: "Brake Pad Replacement (Pair)", hsn: "8708", qty: "1", rate: "3500", gstPercentage: "28", taxableValue: 3500, taxAmount: 980, total: 4480 },
      { itemName: "Labour Charges (2 hrs)", hsn: "9987", qty: "2", rate: "750", gstPercentage: "18", taxableValue: 1500, taxAmount: 270, total: 1770 },
    ],
  },
  RENTAL: {
    business: { businessName: "Prime Equipment Rentals", addressLine1: "Depot 2,NH-4 Highway", addressLine2: "Tumkur Road", city: "Bengaluru", pincode: "562123", phone: "+91 97410 33557", email: "hire@primerentals.in", gstIn: "29GGGPR7531Q1Z8" },
    customer: { name: "Metro Infra Projects", billingAddress: "Tower B, Tech Park, Bengaluru - 560103", phone: "+91 99801 44668", email: "ops@metroinfra.in", gstIn: "29MIPP8642T1Z2" },
    form: { deliveryNote: "Handover HO-2026-91", deliveryNoteDate: "2026-09-25", referenceNumber: "EQ-0042", dispatchedThrough: "Rental Transporter", destination: "Metro Infra Site", buyerOrderNumber: "MI-RA-31", paymentTerms: "Advance + Monthly", otherReferences: "Agreement RA-2026-31", termsOfDelivery: "On rental agreement" },
    items: [
      { itemName: "Excavator Rental (Weekly)", hsn: "9973", qty: "2", rate: "45000", gstPercentage: "18", taxableValue: 90000, taxAmount: 16200, total: 106200 },
      { itemName: "Generator 5 kVA (Monthly)", hsn: "9973", qty: "1", rate: "12000", gstPercentage: "18", taxableValue: 12000, taxAmount: 2160, total: 14160 },
      { itemName: "Operator Charges", hsn: "9985", qty: "10", rate: "1500", gstPercentage: "18", taxableValue: 15000, taxAmount: 2700, total: 17700 },
    ],
  },
  TELECOM_IT: {
    business: { businessName: "ConnectWave Broadband", addressLine1: "Gateway Park, Tower C", addressLine2: "Outer Ring Road", city: "Bengaluru", pincode: "560103", phone: "+91 99003 77881", email: "billing@connectwave.in", gstIn: "29HHCW1357V1Z6" },
    customer: { name: "Skyline Offices LLP", billingAddress: "6th Floor, Galaxy Plaza, Bengaluru - 560071", phone: "+91 98861 22335", email: "admin@skyline.in", gstIn: "29SSLO2468W1Z4" },
    form: { referenceNumber: "ACC-77821", buyerOrderNumber: "SO-2026-441", paymentTerms: "Annual Advance", otherReferences: "Subscription SUB-2026-441" },
    items: [
      { itemName: "Leased Line 100 Mbps (Annual)", hsn: "998411", qty: "1", rate: "180000", gstPercentage: "18", taxableValue: 180000, taxAmount: 32400, total: 212400 },
      { itemName: "Managed Wi-Fi Setup", hsn: "998412", qty: "1", rate: "35000", gstPercentage: "18", taxableValue: 35000, taxAmount: 6300, total: 41300 },
      { itemName: "Static IP Add-on (Quarterly)", hsn: "998411", qty: "4", rate: "4500", gstPercentage: "18", taxableValue: 18000, taxAmount: 3240, total: 21240 },
    ],
  },
  EDUCATION: {
    business: { businessName: "SkillUp Training Institute", addressLine1: "2nd Floor, Knowledge Park", addressLine2: "HSR Layout", city: "Bengaluru", pincode: "560102", phone: "+91 99802 55669", email: "admin@skillup.in", gstIn: "29IISU3579X1Z9" },
    customer: { name: "FutureTech Students (Batch A)", billingAddress: "Batch A, HSR Layout, Bengaluru - 560102", phone: "+91 97401 88992", email: "batcha@futuretech.in", gstIn: "" },
    form: { referenceNumber: "BATCH-A-2026", buyerOrderNumber: "FT-BATCH-A", paymentTerms: "Instalment Plan", otherReferences: "Enrolment ENR-2026-512" },
    items: [
      { itemName: "Full Stack Development Course", hsn: "999293", qty: "20", rate: "15000", gstPercentage: "18", taxableValue: 300000, taxAmount: 54000, total: 354000 },
      { itemName: "Course Material & Lab Access", hsn: "999293", qty: "20", rate: "2000", gstPercentage: "18", taxableValue: 40000, taxAmount: 7200, total: 47200 },
      { itemName: "Certification Exam Fee", hsn: "999293", qty: "20", rate: "1500", gstPercentage: "18", taxableValue: 30000, taxAmount: 5400, total: 35400 },
    ],
  },
  AGRICULTURE: {
    business: { businessName: "GreenField Agro Producers", addressLine1: "Farm Gate, Survey 44", addressLine2: "Doddaballapur Road", city: "Bengaluru", pincode: "561203", phone: "+91 97420 11335", email: "mandi@greenfieldagro.in", gstIn: "29JJGA4680Y1Z1" },
    customer: { name: "Metro Wholesale Mandi", billingAddress: "Mandi Yard, Anekal Road, Bengaluru - 562106", phone: "+91 99004 66778", email: "buy@metromandi.in", gstIn: "29MWMH8642Z1Z7" },
    form: { deliveryNote: "CONSIGN-2026-118", deliveryNoteDate: "2026-09-30", dispatchDocNumber: "EWB-2026-6620", dispatchedThrough: "Tempo KA-51-C-4412", destination: "Mandi Yard", buyerOrderNumber: "MW-PO-881", paymentTerms: "Net 7", otherReferences: "Lot LOT-TP-22A Grade A", termsOfDelivery: "Farm gate loading" },
    items: [
      { itemName: "Tomatoes (Grade A) — 20 kg Crates", hsn: "0702", qty: "120", rate: "380", gstPercentage: "0", taxableValue: 45600, taxAmount: 0, total: 45600 },
      { itemName: "Basmati Rice (Premium) — 25 kg Bag", hsn: "1006", qty: "80", rate: "2400", gstPercentage: "5", taxableValue: 192000, taxAmount: 9600, total: 201600 },
      { itemName: "Fresh Onions — 50 kg Sack", hsn: "0703", qty: "40", rate: "1250", gstPercentage: "0", taxableValue: 50000, taxAmount: 0, total: 50000 },
    ],
  },
};

function sampleContentFor(industry) {
  const id = resolveIndustryId(industry);
  const override = SAMPLE_CONTENT[id];
  return {
    business: { ...sampleBusiness, ...(override?.business || {}), industry: id },
    customer: override?.customer || sampleCustomer,
    form: { ...sampleForm, ...(override?.form || {}) },
    items: override?.items || sampleItems,
  };
}

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
  const sample = sampleContentFor(industry);

  const commonProps = {
    // Gallery previews are static sample businesses, so sample the line from
    // the sample's own city (all samples bill from their own city). Real
    // invoices always read the persisted configuration instead.
    business: {
      ...sample.business,
      jurisdictionEnabled: true,
      jurisdictionCity: sample.business.city || "",
    },
    customer: sample.customer,
    form: sample.form,
    items: sample.items,
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
  const { selectedTemplate, updateTemplate, documentAccess } = useAuth();
  const dcEnabled = documentAccess?.deliveryChallan !== false;
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

        {dcEnabled && (
        <>
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
        </>
        )}
      </div>

      {/* Delivery Challan Preview Modal */}
      {dcEnabled && dcPreviewId && dcPreviewTemplate && (
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
