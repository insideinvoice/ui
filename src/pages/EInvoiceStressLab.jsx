import { useEffect, useMemo, useRef } from "react";
import InvoiceTemplateVariants from "../components/InvoiceTemplateVariants";
import { buildInvoicePdf } from "../utils/invoicePdf";
import { INDUSTRY_PROFILES } from "../constants/industryConfig";

// DEV-ONLY stress bench for template-33 (e-Invoice), driven by
// scripts/einvoice-stress.mjs (puppeteer). It renders the REAL template with
// synthetic data pushed to the extremes and exposes the real PDF builder, so
// the harness can rasterise + slice a document exactly the way Print/Download
// does and then inspect every page it produced.
//
// Query params:
//   rows=40    item count                      (default 12)
//   long=1     long business/customer/item text
//   big=1      crore-scale rates and amounts
//   igst=1     IGST tax mode instead of CGST/SGST
//   nohsn=1    HSN/SAC column switched off
//   mega=1     one item with a multi-thousand-character description
//   rates=1    every line a different GST rate (tall HSN breakup)
//   sparse=1   industry profile that fills almost nothing optional — no GSTIN,
//              no pincode, no references, no e-Way Bill, no notes, no terms
//   dense=1    every field filled with values long enough to need ellipsis
//   industry=<ID>
//              render as a configured sector (TRADING, CONSTRUCTION,
//              MANUFACTURING, PROFESSIONAL_SERVICES, REPAIR, TRANSPORT, FOOD,
//              RENTAL, TELECOM_IT, HEALTHCARE, EDUCATION, AGRICULTURE, OTHER):
//              the profile's hiddenFields blank out the fields that industry
//              never collects, and its item shape drives units / HSN-SAC /
//              GST rates / description style
//   paper=A5   paper size handed to buildInvoicePdf (default A4_PORTRAIT)
//
// The route ("/__einv-lab") is registered in App.jsx only when
// import.meta.env.DEV, so it never exists in a production build.

const LONG_BITS = [
  "Manufacturing Trading and Export of Industrial Automation Equipment spares consumables and allied engineering services",
  "Unit 7-B, Prestige Techno Park, Outer Ring Road, Marathahalli, Bengaluru, Karnataka 560037, India",
  "Plot 42 Phase III, Bengaluru Industrial Area, Bommasandra, Bengaluru, Karnataka 560099, India",
];

const LOREM =
  "Heavy duty weatherproof industrial connector assembly supplied with brass contacts, nylon housing, IP67 gland kit and stainless fasteners tested to IS/IEC standards ";

// Per-industry item shapes: what a line item looks like in that sector —
// units (mixing them exercises the Total row's "drop the unit" rule), HSN/SAC
// codes, GST rates and description style. The template's printed labels stay
// the Tally/NIC ones regardless of industry; what varies per industry is
// WHICH fields exist (industryConfig.hiddenFields) and what fills them.
const INDUSTRY_SHAPE = {
  TRADING: {
    biz: "Shree Balaji Traders",
    cust: "Kalyani Hardware Stores",
    units: ["Piece", "Box", "Kg", "Set"],
    hsn: ["8536", "8471", "3926", "7319"],
    gst: ["12", "18", "18", "28"],
    names: ["MCB Switch 63A", "LED Panel Light 18W", "PVC Conduit Pipe 25mm", "Copper Wire 90m Coil"],
  },
  CONSTRUCTION: {
    biz: "Sankalp Infracon Private Limited",
    cust: "Bengaluru Metro Rail Corporation Limited",
    units: ["Bag", "Quintal", "Square Metre", "Day"],
    hsn: ["2523", "7216", "3824", "995411"],
    gst: ["18", "18", "18", "18"],
    names: ["OPC Cement 53 Grade", "TMT Bar Fe500D 12mm", "Ready Mix Concrete M25", "Site Labour Charges"],
  },
  MANUFACTURING: {
    biz: "Precision Tools and Fabrication Works",
    cust: "Ashok Leyland Limited",
    units: ["Piece", "Kg", "Set", "Litre"],
    hsn: ["8479", "8481", "8483", "8708"],
    gst: ["18", "18", "18", "28"],
    names: ["Hydraulic Press Assembly", "Gate Valve DN80", "Spur Gear Module 3", "Engine Oil 15W40"],
  },
  PROFESSIONAL_SERVICES: {
    biz: "Northline Technologies LLP",
    cust: "Crimson Retail India Private Limited",
    units: ["Hour", "Month", "Service"],
    hsn: ["998311", "998312", "998314"],
    gst: ["18"],
    names: [
      "Application maintenance retainer for the billing platform",
      "Cloud infrastructure migration and cut-over support",
      "UX research and design sprint for the customer portal",
    ],
  },
  REPAIR: {
    biz: "Auto Care Service Centre",
    cust: "Swift Fleet Services Private Limited",
    units: ["Job", "Hour", "Piece"],
    hsn: ["998711", "998719", "998713"],
    gst: ["18"],
    names: ["Periodic service - sedan", "Brake pad replacement front axle", "Alternator overhaul with bearings"],
  },
  TRANSPORT: {
    biz: "Sampark Roadlines and Logistics",
    cust: "VRL Logistics Limited",
    units: ["Quintal", "Ton", "Day"],
    hsn: ["996511", "996512", "996791"],
    gst: ["12", "18", "5"],
    names: [
      "Full truck load Bengaluru to Chennai",
      "Part load consignment with door delivery",
      "Waiting charges at delivery point",
    ],
  },
  FOOD: {
    biz: "Sattvik Caterers and Confections",
    cust: "Prestige Convention Hall",
    units: ["Plate", "Kg", "Box", "Serving"],
    hsn: ["996311", "996322", "996329"],
    gst: ["5", "12", "18"],
    names: ["Veg buffet plate", "Sweet box 1 kg", "Live counter service charge"],
  },
  RENTAL: {
    biz: "Sunrise Equipment Rentals",
    cust: "Omkar Constructions",
    units: ["Day", "Month", "Hour"],
    hsn: ["997311", "997312", "997314"],
    gst: ["18"],
    names: ["Tower crane on hire", "Tandem vibratory roller on hire", "Generator 250 kVA rental"],
  },
  TELECOM_IT: {
    biz: "Fiberlink Networks Private Limited",
    cust: "Zenith Business Solutions",
    units: ["Month", "User", "Connection"],
    hsn: ["998411", "998412", "998413"],
    gst: ["18"],
    names: ["Dedicated internet 500 Mbps", "Managed firewall subscription", "SIP trunk channels 30"],
  },
  HEALTHCARE: {
    biz: "Aarogya Multispeciality Hospital",
    cust: "Star Health Insurance Limited",
    units: ["Service", "Session", "Piece", "Day"],
    hsn: ["999311", "999312", "999316"],
    gst: ["0", "5", "12"],
    names: ["Consultation - orthopaedics", "MRI scan right knee with contrast", "Consumables - dressing kit"],
  },
  EDUCATION: {
    biz: "Vidya Institute of Technology",
    cust: "Infosys Springboard",
    units: ["Course", "Month", "Hour"],
    hsn: ["999211", "999212", "999293"],
    gst: ["0", "18"],
    names: ["Advanced data analytics batch", "Laboratory usage fee", "Certification examination fee"],
  },
  AGRICULTURE: {
    biz: "Nandi Agro Produce Exporters",
    cust: "FreshMart Hypermarket Private Limited",
    units: ["Kg", "Quintal", "Bag", "Box"],
    hsn: ["0806", "0702", "0910", "1005"],
    gst: ["0", "0", "5"],
    names: ["Export grade banana", "Frozen green peas", "Turmeric finger 500g pouch"],
  },
  OTHER: {
    biz: "Acme Enterprises",
    cust: "Good Luck Traders",
    units: ["Piece", "Set", "Service"],
    hsn: ["999999", "998399", "998719"],
    gst: ["18"],
    names: ["Bundled service package", "Consumable kit", "Annual maintenance visit"],
  },
};

const clampRows = (v) => Math.max(1, Math.min(400, parseInt(v, 10) || 12));

function buildScenario(params) {
  const rows = clampRows(params.get("rows"));
  const long = params.get("long") === "1";
  const big = params.get("big") === "1";
  const igst = params.get("igst") === "1";
  const nohsn = params.get("nohsn") === "1";
  const mega = params.get("mega") === "1";
  const rates = params.get("rates") === "1";
  // sparse = an industry profile that fills almost NOTHING optional (no GSTIN,
  // no pincode, no references, no terms, no notes) — the worst case for
  // "fields may decrease".
  // dense  = every field populated with values long enough to need ellipsis —
  // the worst case for "fields may increase".
  const sparse = params.get("sparse") === "1";
  const dense = params.get("dense") === "1";
  // industry = render as a real configured sector: the profile's hiddenFields
  // blank out exactly the fields that industry's users never see (services
  // industries drop six of them at once), and its item shape drives units,
  // HSN/SAC codes and rates.
  const industry = (params.get("industry") || "").toUpperCase();
  const profile = INDUSTRY_PROFILES[industry] || null;
  const shape = INDUSTRY_SHAPE[industry] || INDUSTRY_SHAPE.OTHER;
  const hidden = new Set(profile?.hiddenFields || []);
  const on = (f) => !hidden.has(f);

  const business = {
    businessName: long
      ? `${LONG_BITS[0]} Private Limited`
      : profile
        ? shape.biz
        : "Acme Enterprises",
    addressLine1: long ? LONG_BITS[1] : "42, Industrial Layout, Electronics City",
    addressLine2: long ? LONG_BITS[2] : "",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: sparse ? "" : "560100",
    gstIn: sparse ? "" : "29ABCDE1234F1Z5",
    showHnSac: !nohsn,
    // Saved Terms & Conditions — drives the new Terms block above Declaration.
    // Empty for `noterms=1` and for the whole `sparse` profile, so the
    // "hidden when empty" path is testable both ways.
    termsConditions:
      sparse || params.get("noterms") === "1"
        ? ""
        : JSON.stringify([
            "Goods once sold will not be taken back or exchanged.",
            "Payment due within 30 days from date of invoice.",
            "Interest @18% p.a. is charged on all overdue bills.",
            "E. & O.E.",
          ]),
  };

  const customer = {
    name: long
      ? `${LONG_BITS[0]} Client Services LLP`
      : profile
        ? shape.cust
        : "Good Luck Traders",
    billingAddress: long ? LONG_BITS[1] : "15, MG Road, Ashok Nagar, Bengaluru - 560001",
    gstIn: sparse ? "" : "29PQRST5678K1Z3",
    state: "Karnataka",
  };

  const gstRates = rates ? ["5", "12", "18", "28"] : shape.gst;
  const units = shape.units;
  const hsns = shape.hsn;
  const names = shape.names;
  const items = Array.from({ length: rows }, (_, i) => {
    let itemName = long
      ? `Item ${i + 1} — ${LOREM}`
      : `${names[i % names.length]}${rows > names.length ? ` — lot ${i + 1}` : ""}`;
    if (mega && i === Math.floor(rows / 2)) {
      itemName = `Mega description ${LOREM.repeat(70)}`;
    }
    return {
      itemName,
      hsn: rates ? ["8536", "8471", "9403", "7326"][i % 4] : hsns[i % hsns.length],
      // mixed integer/decimal quantities — the Total row has to sum them and
      // only print a unit when every line shares one.
      qty: i % 4 === 3 ? "10.5" : String((i % 5) + 1),
      rate: big
        ? (98765432.1 + i * 111111.11).toFixed(2)
        : String(300 + i * 10),
      gstPercentage: gstRates[i % gstRates.length],
      unit: units[i % units.length],
      taxableValue: big ? (i + 1) * 10000000 : (i + 1) * 500,
    };
  });

  return {
    business,
    customer,
    items,
    rows,
    long,
    big,
    igst,
    nohsn,
    mega,
    rates,
    sparse,
    dense,
    industry,
    profile,
    hidden,
    on,
    paper: params.get("paper") || "A4_PORTRAIT",
  };
}

export default function EInvoiceStressLab() {
  const ref = useRef(null);
  const params = useMemo(
    () => new URLSearchParams(window.location.search),
    []
  );
  const s = useMemo(() => buildScenario(params), [params]);

  // `s.on(field)` is false when the selected industry hides that field — its
  // value stays blank exactly the way the real form would, so the template has
  // to hold its ruled grid together over a half-empty column.
  const form = {
    invoiceDate: "2026-10-01",
    dueDate: "2026-10-31",
    deliveryNote: s.sparse || !s.on("deliveryNote") ? "" : "DN-2026-101",
    deliveryNoteDate: s.sparse || !s.on("deliveryNoteDate") ? "" : "2026-09-30",
    referenceNumber: s.sparse ? "" : "REF-001",
    buyerOrderNumber: s.sparse ? "" : "PO-2026-142",
    dispatchDocNumber: s.sparse || !s.on("dispatchDocNumber") ? "" : "DD-2026-101",
    dispatchedThrough: s.sparse || !s.on("dispatchedThrough") ? "" : "Express Logistics",
    termsOfDelivery:
      s.sparse || !s.on("termsOfDelivery")
        ? ""
        : s.dense
          ? "Free delivery up to site with unloading, 7 days return window against this order"
          : "Free delivery",
    paymentTerms: s.sparse ? "" : "Net 30",
    paymentMode: s.sparse ? "" : "UPI",
    otherReferences: s.sparse
      ? ""
      : s.dense
        ? "Quotation Q-2026-118 dated 12-Sep-2026 against Enquiry ENQ-4471 / RFQ-9982"
        : "Quotation Q-2026-118",
    destination: s.sparse || !s.on("destination") ? "" : "Bengaluru",
    placeOfSupply: "Karnataka",
    // Rule 46 extras now printed as meta rows (Reverse Charge / e-Way Bill /
    // Notes) plus the compensation-cess leg (scenario `cess=1`).
    reverseCharge: false,
    ewayBillNumber: s.sparse || params.get("noeway") === "1"
      ? ""
      : s.dense
        ? "1212 3434 5656 7878 9900 1212"
        : "1212 3434 5656 7878",
    vehicleNumber: s.sparse || params.get("noeway") === "1" ? "" : "KA05 MJ 4521",
    notes: s.sparse || params.get("nonotes") === "1"
      ? ""
      : s.dense
        ? "Delivery within 7 working days against this order; goods must be checked at the time of unloading."
        : "Delivery within 7 working days against this order.",
    cessPercent: params.get("cess") === "1" ? "1" : "",
    irn: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    ackNo: "1220262418754",
    ackDate: "2026-10-01",
    ...(s.long ? { shippingAddress: LONG_BITS[1] } : {}),
  };

  useEffect(() => {
    window.__iiStress = {
      build: buildInvoicePdf,
      getElement: () => ref.current,
      paper: s.paper,
      scenario: {
        rows: s.rows,
        long: s.long,
        big: s.big,
        igst: s.igst,
        nohsn: s.nohsn,
        mega: s.mega,
        rates: s.rates,
        sparse: s.sparse,
        dense: s.dense,
        industry: s.industry,
        paper: s.paper,
      },
    };
  }, [s]);

  return (
    <div style={{ padding: 16, background: "#e5e7eb", minHeight: "100vh" }}>
      <div
        id="stress-meta"
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          marginBottom: 8,
          color: "#111827",
        }}
      >
        e-Invoice stress — rows={s.rows} long={String(s.long)} big={String(s.big)} igst=
        {String(s.igst)} nohsn={String(s.nohsn)} mega={String(s.mega)} rates=
        {String(s.rates)} industry={s.industry || "-"} paper={s.paper}
      </div>
      <div id="stress-frame" style={{ width: "716px", margin: "0 auto" }}>
        <InvoiceTemplateVariants
          ref={ref}
          theme="template-33"
          business={s.business}
          customer={s.customer}
          form={form}
          items={s.items}
          discountPercent="0"
          type="TAX_INVOICE"
          invoiceNumber="INV-2026-001"
          taxMode={s.igst ? "IGST" : "CGST_SGST"}
        />
      </div>
    </div>
  );
}
