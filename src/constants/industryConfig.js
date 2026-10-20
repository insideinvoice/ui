export const DEFAULT_INDUSTRY = "OTHER";

export const INDUSTRY_IDS = [
  "TRADING",
  "CONSTRUCTION",
  "MANUFACTURING",
  "PROFESSIONAL_SERVICES",
  "REPAIR",
  "TRANSPORT",
  "FOOD",
  "RENTAL",
  "TELECOM_IT",
  "HEALTHCARE",
  "EDUCATION",
  "AGRICULTURE",
  "OTHER",
];

export const CONFIGURABLE_FIELDS = [
  "destination",
  "deliveryNote",
  "deliveryNoteDate",
  "dispatchDocNumber",
  "dispatchedThrough",
  "termsOfDelivery",
];

const SERVICE_HIDDEN_FIELDS = [
  "deliveryNote",
  "deliveryNoteDate",
  "dispatchDocNumber",
  "dispatchedThrough",
  "termsOfDelivery",
  "destination",
];

export const INDUSTRY_PROFILES = {
  TRADING: {
    id: "TRADING",
    name: "Trading, Retail & Distribution",
    description:
      "Shops, wholesalers and distributors selling goods — electrical, electronics, hardware, furniture, garments, groceries, auto parts and building materials.",
    hiddenFields: [],
    labels: {
      otherReferences: "PO / Order References",
      referenceNumber: "Reference No.",
    },
    placeholders: {
      otherReferences: "e.g. PO-1042 / SO-887",
      referenceNumber: "e.g. RFQ / Quote ref",
    },
    documents: { deliveryChallan: true, shippingLabel: true, hazmatLabel: true },
  },
  CONSTRUCTION: {
    id: "CONSTRUCTION",
    name: "Construction & Contracting",
    description: "Civil contractors and construction service providers billing projects and sites.",
    hiddenFields: [],
    labels: {
      deliveryNote: "Work Order No.",
      destination: "Site / Work Location",
      otherReferences: "Project / P.O. No.",
      dispatchedThrough: "Site / Carried By",
    },
    placeholders: {
      deliveryNote: "e.g. WO-2026-14",
      otherReferences: "e.g. Project name or P.O. number",
      destination: "e.g. Bengaluru site",
    },
    documents: { deliveryChallan: true, shippingLabel: true, hazmatLabel: false },
  },
  MANUFACTURING: {
    id: "MANUFACTURING",
    name: "Manufacturing & Fabrication",
    description: "Factories, fabrication units and industrial production businesses.",
    hiddenFields: [],
    labels: {
      deliveryNote: "Dispatch Note No.",
      dispatchedThrough: "Vehicle / Transporter",
    },
    placeholders: {
      dispatchDocNumber: "e.g. LR / e-way bill no.",
      otherReferences: "e.g. Batch, lot or order ref",
    },
    documents: { deliveryChallan: true, shippingLabel: true, hazmatLabel: true },
  },
  PROFESSIONAL_SERVICES: {
    id: "PROFESSIONAL_SERVICES",
    name: "Professional & Business Services",
    description: "IT companies, software development, consulting, marketing and design agencies.",
    hiddenFields: SERVICE_HIDDEN_FIELDS,
    labels: {
      referenceNumber: "Engagement Ref.",
      otherReferences: "Client P.O. / Project Ref.",
      itemName: "Description of Services",
    },
    placeholders: {
      referenceNumber: "e.g. SOW / engagement reference",
      otherReferences: "e.g. Client PO or project code",
    },
    documents: { deliveryChallan: false, shippingLabel: false, hazmatLabel: false },
  },
  REPAIR: {
    id: "REPAIR",
    name: "Repair & Maintenance",
    description: "Equipment servicing, vehicle repair and maintenance workshops.",
    hiddenFields: [],
    labels: {
      referenceNumber: "Asset / Job Ref.",
      otherReferences: "Job Card / P.O. No.",
    },
    placeholders: {
      referenceNumber: "e.g. Vehicle reg. or asset ID",
      otherReferences: "e.g. Job card number",
    },
    documents: { deliveryChallan: true, shippingLabel: true, hazmatLabel: false },
  },
  TRANSPORT: {
    id: "TRANSPORT",
    name: "Transport & Logistics",
    description: "Freight, logistics, courier and transport operators.",
    hiddenFields: [],
    labels: {
      deliveryNote: "Consignment / LR No.",
      dispatchedThrough: "Vehicle / Carrier",
      destination: "Delivery Destination",
      dispatchDocNumber: "E-way Bill No.",
      referenceNumber: "Freight / Trip Ref.",
      otherReferences: "Shipper P.O. / Reference",
      itemName: "Description of Goods / Service",
    },
    placeholders: {
      deliveryNote: "e.g. LR-8891 / consignment no.",
      dispatchedThrough: "e.g. Truck MH-12-AB-1234",
      dispatchDocNumber: "e.g. EWB-3812 4490 1122",
      referenceNumber: "e.g. Trip / freight trip ref",
      otherReferences: "e.g. Shipper PO number",
      destination: "e.g. Pune distribution centre",
    },
    documents: { deliveryChallan: true, shippingLabel: true, hazmatLabel: true },
  },
  FOOD: {
    id: "FOOD",
    name: "Food & Hospitality",
    description: "Restaurants, catering, bakeries, food suppliers and hospitality businesses.",
    hiddenFields: ["dispatchDocNumber", "dispatchedThrough"],
    labels: {
      otherReferences: "Order / Event Reference",
      deliveryNote: "Delivery / Order Note",
      itemName: "Description of Items",
    },
    placeholders: {
      otherReferences: "e.g. Table, order or event ref",
      deliveryNote: "e.g. Delivery or catering order",
    },
    documents: { deliveryChallan: true, shippingLabel: false, hazmatLabel: false },
  },
  RENTAL: {
    id: "RENTAL",
    name: "Rental & Leasing",
    description: "Equipment, machinery and asset rental businesses.",
    hiddenFields: ["dispatchDocNumber"],
    labels: {
      deliveryNote: "Handover Note",
      referenceNumber: "Rental / Asset Ref.",
      otherReferences: "Agreement / P.O. No.",
      agreementNumber: "Rental Agreement No.",
      assetNumber: "Asset / Equipment ID",
      serialNumber: "Serial Number",
      vehicleNumber: "Vehicle Reg. No.",
      periodStart: "Rental Period Start",
      periodEnd: "Rental Period End",
      billingPeriodStart: "Billing Period Start",
      billingPeriodEnd: "Billing Period End",
      expectedReturnDate: "Expected Return Date",
      depositReference: "Deposit Reference",
    },
    placeholders: {
      referenceNumber: "e.g. Asset ID or agreement no.",
      otherReferences: "e.g. Rental agreement / customer PO",
      agreementNumber: "e.g. RA-2026-5566",
      assetNumber: "e.g. CRANE-12",
      serialNumber: "e.g. SN-8899",
      vehicleNumber: "e.g. KA-01-AB-1234",
      depositReference: "e.g. DEP-100",
    },
    documents: { deliveryChallan: true, shippingLabel: true, hazmatLabel: false },
  },
  TELECOM_IT: {
    id: "TELECOM_IT",
    name: "Telecom, IT & Subscriptions",
    description: "Telecom operators, internet providers and subscription/SaaS businesses.",
    hiddenFields: SERVICE_HIDDEN_FIELDS,
    labels: {
      referenceNumber: "Service / Account Ref.",
      otherReferences: "Subscription / Order Ref.",
      itemName: "Description of Services",
    },
    placeholders: {
      referenceNumber: "e.g. Account or service ID",
      otherReferences: "e.g. Subscription or order number",
    },
    documents: { deliveryChallan: false, shippingLabel: false, hazmatLabel: false },
  },
  HEALTHCARE: {
    id: "HEALTHCARE",
    name: "Healthcare & Wellness Services",
    description: "Clinics, wellness providers and allied healthcare services.",
    hiddenFields: SERVICE_HIDDEN_FIELDS,
    labels: {
      referenceNumber: "Visit / Case Ref.",
      otherReferences: "Appointment / Order Ref.",
      itemName: "Description of Services",
      patientReference: "Patient / Customer ID",
      serviceDate: "Service Date",
      treatmentReference: "Treatment / Session Ref.",
      referringDoctor: "Referring Doctor",
      billingPeriodStart: "Billing Period Start",
      billingPeriodEnd: "Billing Period End",
    },
    placeholders: {
      referenceNumber: "e.g. Visit or case reference",
      otherReferences: "e.g. Appointment or order number",
      patientReference: "e.g. PAT-2211 (reference only, no medical data)",
      treatmentReference: "e.g. Sess-14",
      referringDoctor: "e.g. Dr. Iyer",
    },
    documents: { deliveryChallan: false, shippingLabel: false, hazmatLabel: false },
  },
  EDUCATION: {
    id: "EDUCATION",
    name: "Training",
    description: "Training centres, tutors and training service providers.",
    hiddenFields: SERVICE_HIDDEN_FIELDS,
    labels: {
      referenceNumber: "Course / Batch Ref.",
      otherReferences: "Enrolment / P.O. Reference",
      itemName: "Description of Services",
    },
    placeholders: {
      referenceNumber: "e.g. Course or batch code",
      otherReferences: "e.g. Enrolment ID or client PO",
    },
    documents: { deliveryChallan: false, shippingLabel: false, hazmatLabel: false },
  },
  AGRICULTURE: {
    id: "AGRICULTURE",
    name: "Agriculture & Primary Goods",
    description: "Producers and traders of agricultural products and primary goods.",
    hiddenFields: [],
    labels: {
      deliveryNote: "Consignment / Lot Note",
      referenceNumber: "Lot / Grade Reference",
      dispatchDocNumber: "Mandi / Gate Receipt No.",
      destination: "Mandi / Delivery Point",
      dispatchedThrough: "Vehicle / Carrier",
      otherReferences: "Farm / Produce Reference",
      itemName: "Produce / Description",
    },
    placeholders: {
      deliveryNote: "e.g. Consignment / lot note",
      referenceNumber: "e.g. Lot-24 grade A",
      dispatchDocNumber: "e.g. Mandi receipt no.",
      destination: "e.g. APMC market, Bengaluru",
      otherReferences: "e.g. Farm, batch or produce ref",
    },
    documents: { deliveryChallan: true, shippingLabel: true, hazmatLabel: true },
  },
  OTHER: {
    id: "OTHER",
    name: "General Business",
    description:
      "A safe general-purpose configuration that keeps every existing invoice field available.",
    hiddenFields: [],
    labels: {},
    placeholders: {},
    documents: { deliveryChallan: true, shippingLabel: true, hazmatLabel: true },
  },
};

export const INDUSTRY_LIST = INDUSTRY_IDS.map((id) => INDUSTRY_PROFILES[id]);

export function isValidIndustryId(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(INDUSTRY_PROFILES, id);
}

export function resolveIndustryId(id) {
  return isValidIndustryId(id) ? id : DEFAULT_INDUSTRY;
}

const ALL_DOCUMENTS_ENABLED = { deliveryChallan: true, shippingLabel: true, hazmatLabel: true };

export function getIndustryConfig(id) {
  const profile = INDUSTRY_PROFILES[resolveIndustryId(id)] || INDUSTRY_PROFILES[DEFAULT_INDUSTRY];
  return {
    ...profile,
    hiddenFields: Array.isArray(profile.hiddenFields) ? [...profile.hiddenFields] : [],
    labels: { ...profile.labels },
    placeholders: { ...profile.placeholders },
    documents: { ...ALL_DOCUMENTS_ENABLED, ...(profile.documents || {}) },
  };
}

export function isFieldHidden(config, field) {
  return Boolean(config?.hiddenFields?.includes(field));
}

export function isAnyFieldHidden(config, fields) {
  return fields.some((field) => isFieldHidden(config, field));
}

export function fieldLabel(config, field, fallback) {
  return config?.labels?.[field] || fallback;
}

export function fieldPlaceholder(config, field) {
  return config?.placeholders?.[field] || "";
}

export function isDocumentEnabled(config, documentKey) {
  return config?.documents?.[documentKey] !== false;
}

export const REFERENCES_SECTION_FIELDS = [
  "deliveryNote",
  "deliveryNoteDate",
  "referenceNumber",
  "buyerOrderNumber",
  "dispatchDocNumber",
  "dispatchedThrough",
  "termsOfDelivery",
  "otherReferences",
];

export function isReferencesSectionVisible(config) {
  return REFERENCES_SECTION_FIELDS.some((field) => !isFieldHidden(config, field));
}

// ---------------------------------------------------------------- V29 extended
// Industry-extended invoice fields (Rental & Leasing, Healthcare & Wellness).
// Display-only reference/date columns: they never feed totals, tax or line
// items. Deliberately NOT in CONFIGURABLE_FIELDS / IndustryField catalogue —
// they exist only for their own industries. Labels live in the profiles above;
// the server (email + share PDF) mirrors the same ids in IndustryExtendedFields.

export const EXTENDED_FIELDS = {
  RENTAL: [
    "agreementNumber",
    "assetNumber",
    "serialNumber",
    "vehicleNumber",
    "periodStart",
    "periodEnd",
    "billingPeriodStart",
    "billingPeriodEnd",
    "expectedReturnDate",
    "depositReference",
  ],
  HEALTHCARE: [
    "patientReference",
    "serviceDate",
    "treatmentReference",
    "referringDoctor",
    "billingPeriodStart",
    "billingPeriodEnd",
  ],
};

export const EXTENDED_FIELD_TYPES = {
  periodStart: "date",
  periodEnd: "date",
  billingPeriodStart: "date",
  billingPeriodEnd: "date",
  expectedReturnDate: "date",
  serviceDate: "date",
};

/** Every extended field id across industries (for payload round-trips). */
export const ALL_EXTENDED_FIELDS = [
  ...new Set([...EXTENDED_FIELDS.RENTAL, ...EXTENDED_FIELDS.HEALTHCARE]),
];

/** Extended field ids exposed by an industry (empty array for all others). */
export function getExtendedFields(industryId) {
  return EXTENDED_FIELDS[resolveIndustryId(industryId)] || [];
}

/** Whether the industry exposes the given extended field id. */
export function isExtendedField(industryId, field) {
  return getExtendedFields(industryId).includes(field);
}

export function isExtendedFieldType(field, type) {
  return EXTENDED_FIELD_TYPES[field] === type;
}

const TEMPLATE_RIGHT_ROW_DEFS = [
  // key: form field it reads (also the industry-label override key).
  // protectedField rows are never hidden by any industry profile.
  { key: "invoiceNumber", protectedField: true, label: (isP) => (isP ? "Proforma Ref." : "Invoice No."), value: (form, displayInvNo, isP) => (isP ? `PF-${displayInvNo}` : displayInvNo) },
  { key: "deliveryNote", label: () => "Delivery Note", value: (form) => form?.deliveryNote },
  { key: "referenceNumber", label: () => "Reference No. & Date.", value: (form) => (form?.referenceNumber ? `${form.referenceNumber} / ${form.invoiceDate || ""}` : form?.invoiceDate) },
  { key: "buyerOrderNumber", label: () => "Buyer's Order No.", value: (form) => form?.buyerOrderNumber },
  { key: "dispatchDocNumber", label: () => "Dispatch Doc No.", value: (form) => form?.dispatchDocNumber },
  { key: "dispatchedThrough", label: () => "Dispatched through", value: (form) => form?.dispatchedThrough },
  { key: "termsOfDelivery", label: () => "Terms of Delivery", value: (form) => form?.termsOfDelivery },
  { key: "paymentDate", protectedField: true, label: (isP) => (isP ? "Valid Until" : "Payment Date"), value: (form) => form?.dueDate },
  { key: "paymentTerms", protectedField: true, label: () => "Mode/Terms of Payment", value: (form) => form?.paymentTerms },
  { key: "otherReferences", label: () => "Other References", value: (form) => form?.otherReferences },
  { key: "invoiceDate", protectedField: true, label: () => "Dated", value: (form) => form?.invoiceDate },
  { key: "deliveryNoteDate", label: () => "Delivery Note Date", value: (form) => form?.deliveryNoteDate },
  { key: "destination", label: () => "Destination", value: (form) => form?.destination },
];

// V29 extended right-column rows: value-driven AND industry-gated, appended
// after the base rows. An industry only ever sees its own fields, and rows
// with no value are never emitted — every existing invoice therefore renders
// byte-identically (golden template gate).
const RIGHT_ROW_CAP = 13;

function textOr(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function dateRange(start, end) {
  const s = textOr(start);
  const e = textOr(end);
  if (!s && !e) return null;
  if (!s) return e;
  if (!e) return s;
  return `${s} – ${e}`;
}

function rentalDetails(form) {
  return (
    [
      textOr(form?.agreementNumber),
      textOr(form?.assetNumber),
      textOr(form?.serialNumber),
      textOr(form?.vehicleNumber),
      dateRange(form?.periodStart, form?.periodEnd),
      textOr(form?.billingPeriodStart) || textOr(form?.billingPeriodEnd)
        ? `Billing ${dateRange(form?.billingPeriodStart, form?.billingPeriodEnd)}`
        : null,
      textOr(form?.expectedReturnDate) ? `Return ${textOr(form?.expectedReturnDate)}` : null,
      textOr(form?.depositReference) ? `Deposit ${textOr(form?.depositReference)}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null
  );
}

const EXTENDED_RIGHT_ROW_DEFS = {
  // RENTAL already uses 12 of the 13 slots — exactly one composite row.
  RENTAL: [{ key: "rentalDetails", label: () => "Rental Details", value: (form) => rentalDetails(form) }],
  // HEALTHCARE uses 7 slots — up to five value-driven rows (12 total).
  HEALTHCARE: [
    { key: "patientReference", label: (c) => fieldLabel(c, "patientReference", "Patient / Customer ID"), value: (form) => textOr(form?.patientReference) },
    { key: "serviceDate", label: (c) => fieldLabel(c, "serviceDate", "Service Date"), value: (form) => textOr(form?.serviceDate) },
    { key: "treatmentReference", label: (c) => fieldLabel(c, "treatmentReference", "Treatment / Session Ref."), value: (form) => textOr(form?.treatmentReference) },
    { key: "referringDoctor", label: (c) => fieldLabel(c, "referringDoctor", "Referring Doctor"), value: (form) => textOr(form?.referringDoctor) },
    { key: "billingPeriod", label: () => "Billing Period", value: (form) => dateRange(form?.billingPeriodStart, form?.billingPeriodEnd) },
  ],
};

// Right-side metadata rows for invoice templates. Hidden fields are dropped
// entirely (no label + "-" ghost rows); visible rows pick up the industry's
// label override where one exists. Extended rows are appended only when they
// carry a value for their own industry, and the total is capped at the right
// column's 13-row layout budget.
export function getTemplateRightRows(config, form, displayInvNo, isProforma) {
  const base = TEMPLATE_RIGHT_ROW_DEFS
    .filter((def) => def.protectedField || !isFieldHidden(config, def.key))
    .map((def) => ({
      key: def.key,
      label: def.protectedField
        ? def.label(isProforma)
        : fieldLabel(config, def.key, def.label(isProforma)),
      value: def.value(form, displayInvNo, isProforma),
    }));
  const extended = (EXTENDED_RIGHT_ROW_DEFS[config?.id || config?.industry] || [])
    .map((def) => ({ key: def.key, label: def.label(config), value: def.value(form) }))
    .filter((row) => Boolean(row.value));
  return [...base, ...extended].slice(0, RIGHT_ROW_CAP);
}
