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
      otherReferences: "Shipper P.O. / Reference",
    },
    placeholders: {
      deliveryNote: "e.g. LR-8891 / consignment no.",
      dispatchedThrough: "e.g. Truck MH-12-AB-1234",
      otherReferences: "e.g. Shipper PO number",
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
    },
    placeholders: {
      referenceNumber: "e.g. Asset ID or agreement no.",
      otherReferences: "e.g. Rental agreement / customer PO",
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
    },
    placeholders: {
      referenceNumber: "e.g. Visit or case reference",
      otherReferences: "e.g. Appointment or order number",
    },
    documents: { deliveryChallan: false, shippingLabel: false, hazmatLabel: false },
  },
  EDUCATION: {
    id: "EDUCATION",
    name: "Education & Training",
    description: "Training centres, tutors and educational service providers.",
    hiddenFields: SERVICE_HIDDEN_FIELDS,
    labels: {
      referenceNumber: "Course / Batch Ref.",
      otherReferences: "Enrolment / P.O. Reference",
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
      deliveryNote: "Consignment Note",
      otherReferences: "Lot / Grade Reference",
    },
    placeholders: {
      otherReferences: "e.g. Lot, grade or produce ref",
      deliveryNote: "e.g. Consignment / lot note",
    },
    documents: { deliveryChallan: true, shippingLabel: true, hazmatLabel: true },
  },
  OTHER: {
    id: "OTHER",
    name: "Other / General Business",
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
  "dispatchDocNumber",
  "dispatchedThrough",
  "termsOfDelivery",
  "otherReferences",
];

export function isReferencesSectionVisible(config) {
  return REFERENCES_SECTION_FIELDS.some((field) => !isFieldHidden(config, field));
}

const TEMPLATE_REFERENCE_FIELDS = {
  deliveryNote: (form) => form?.deliveryNote,
  referenceNumber: (form) =>
    form?.referenceNumber ? `${form.referenceNumber} / ${form.invoiceDate || ""}` : form?.invoiceDate,
  buyerOrderNumber: (form) => form?.buyerOrderNumber,
  dispatchDocNumber: (form) => form?.dispatchDocNumber,
  dispatchedThrough: (form) => form?.dispatchedThrough,
  termsOfDelivery: (form) => form?.termsOfDelivery,
  otherReferences: (form) => form?.otherReferences,
  deliveryNoteDate: (form) => form?.deliveryNoteDate,
  destination: (form) => form?.destination,
};

export function getTemplateRightValues(config, form, displayInvNo, isProforma) {
  const val = (field, fallback) => (isFieldHidden(config, field) ? undefined : (fallback ?? undefined));
  return [
    isProforma ? `PF-${displayInvNo}` : displayInvNo,
    val("deliveryNote", TEMPLATE_REFERENCE_FIELDS.deliveryNote(form)),
    TEMPLATE_REFERENCE_FIELDS.referenceNumber(form),
    val("buyerOrderNumber", TEMPLATE_REFERENCE_FIELDS.buyerOrderNumber(form)),
    val("dispatchDocNumber", TEMPLATE_REFERENCE_FIELDS.dispatchDocNumber(form)),
    val("dispatchedThrough", TEMPLATE_REFERENCE_FIELDS.dispatchedThrough(form)),
    val("termsOfDelivery", TEMPLATE_REFERENCE_FIELDS.termsOfDelivery(form)),
    form?.dueDate,
    form?.paymentTerms,
    val("otherReferences", TEMPLATE_REFERENCE_FIELDS.otherReferences(form)),
    form?.invoiceDate,
    val("deliveryNoteDate", TEMPLATE_REFERENCE_FIELDS.deliveryNoteDate(form)),
    val("destination", TEMPLATE_REFERENCE_FIELDS.destination(form)),
  ];
}
