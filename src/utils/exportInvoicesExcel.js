import { invoiceAPI, customerAPI, businessAPI } from "../api/auth";
import { INDUSTRY_PROFILES, resolveIndustryId, EXTENDED_FIELD_TYPES } from "../constants/industryConfig";

// id (e.g. "MANUFACTURING") → human name ("Manufacturing & Fabrication").
// Unknown/legacy ids fall back to the raw id so nothing is ever blank.
export function industryName(id) {
  if (!id) return "";
  const profile = INDUSTRY_PROFILES?.[id];
  return profile?.name || id;
}

// Shared filter predicate so the on-screen table and the Excel export always
// agree on which invoices are "current" (search + month + year).
export function invoiceMatchesFilters(inv, search, selectedMonth, selectedYear) {
  if (search?.trim()) {
    const q = search.toLowerCase();
    const matchesSearch = (inv.invoiceNumber || "").toLowerCase().includes(q)
      || (inv.customerName || "").toLowerCase().includes(q);
    if (!matchesSearch) return false;
  }
  if (selectedMonth || selectedYear) {
    const { month, year } = parseIsoDate(inv.invoiceDate || "");
    if (!month && !year) return false;
    if (selectedMonth && month !== parseInt(selectedMonth, 10)) return false;
    if (selectedYear && year !== parseInt(selectedYear, 10)) return false;
  }
  return true;
}

// Backend LocalDate serialises as "YYYY-MM-DD".
function parseIsoDate(dateStr) {
  if (!dateStr) return { month: 0, year: 0 };
  const m = /^(\d{4})-(\d{2})/.exec(String(dateStr));
  if (!m) return { month: 0, year: 0 };
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
}

// Walk every page (backend clamps size at 1000) so the export is complete,
// not just the first screenful. Safety cap: 50 pages = 50,000 rows.
async function fetchAll(fetchPage) {
  const size = 1000;
  let page = 0;
  let totalPages = 1;
  let all = [];
  do {
    const res = await fetchPage({ page, size, sortBy: "createdAt", sortDir: "desc" });
    const data = res?.data?.data;
    all = all.concat(data?.content || []);
    totalPages = data?.totalPages ?? 1;
    page += 1;
  } while (page < totalPages && page < 50);
  return all;
}

// ExcelJS date cells are 1900-based serials; constructing with the local-time
// constructor (not Date.parse of "YYYY-MM-DD") avoids an off-by-one in IST.
function isoToDate(value) {
  if (!value) return null;
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoToDateTime(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const text = (v) => (v == null ? null : String(v));

// ---------------------------------------------------------------- column defs
// Identity / customer columns are shown for every industry. The item block
// comes immediately after Payment Mode (the layout the user asked for). Money
// columns (Taxable Value / Item Tax Amount / Item Total) are written as LIVE
// Excel formulas in the same row, so editing Qty / Rate / GST% / Discount%
// recalculates automatically. Reference columns are industry-tailored: fields
// in the profile's `hiddenFields` are dropped, and extended fields (Rental
// agreement/asset/period, Healthcare patient/treatment/doctor) only appear for
// their own industry.

const CORE_COLUMNS = [
  { header: "Invoice No", key: "invoiceNumber", width: 18, type: "text" },
  { header: "Type", key: "invoiceType", width: 20, type: "text" },
  { header: "Status", key: "status", width: 12, type: "text" },
  { header: "Invoice Date", key: "invoiceDate", width: 13, type: "date" },
  { header: "Due Date", key: "dueDate", width: 12, type: "date" },
  { header: "Customer", key: "customerName", width: 26, type: "text" },
  { header: "Customer GSTIN", key: "customerGstin", width: 18, type: "text" },
  { header: "Customer Email", key: "customerEmail", width: 26, type: "text" },
  { header: "Customer Phone", key: "customerPhone", width: 15, type: "text" },
  { header: "Customer Address", key: "customerAddress", width: 34, type: "text" },
  { header: "Customer City", key: "customerCity", width: 16, type: "text" },
  { header: "Customer State", key: "customerState", width: 16, type: "text" },
  { header: "Customer Pincode", key: "customerPincode", width: 14, type: "text" },
  { header: "Place of Supply", key: "placeOfSupply", width: 16, type: "text" },
  { header: "Payment Terms", key: "paymentTerms", width: 18, type: "text" },
  { header: "Payment Mode", key: "paymentMode", width: 14, type: "text" },
];

// Item block: placed directly after Payment Mode. `hsn` is dropped for Food
// (restaurants/catering never fill HSN/SAC on a GST invoice). The three money
// columns are formulas (see injectFormulas).
const ITEM_COLUMNS = [
  { header: "Item Name", key: "itemName", width: 30, type: "text" },
  { header: "HSN/SAC", key: "hsn", width: 12, type: "text" },
  { header: "Unit", key: "unit", width: 10, type: "text" },
  { header: "Qty", key: "qty", width: 10, type: "qty" },
  { header: "Rate", key: "rate", width: 12, type: "money" },
  { header: "GST %", key: "gstPercentage", width: 9, type: "pct" },
  { header: "Discount %", key: "discountPercent", width: 11, type: "pct" },
  { header: "Taxable Value", key: "taxableValue", width: 14, type: "money" },
  { header: "Item Tax Amount", key: "itemTaxAmount", width: 15, type: "money" },
  { header: "Item Total", key: "itemTotal", width: 13, type: "money" },
];

// Reference / dispatch columns. `delivery`, `buyerOrder`, `destination` etc.
// are dropped when the industry's `hiddenFields` says so (service industries
// hide the whole dispatch block). `otherReferences` is kept for every industry.
const REFERENCE_COLUMNS = [
  { header: "Delivery Note", key: "deliveryNote", width: 16, type: "text", hideIfHidden: true },
  { header: "Delivery Note Date", key: "deliveryNoteDate", width: 18, type: "date", hideIfHidden: true },
  { header: "Reference No", key: "referenceNumber", width: 16, type: "text", hideIfHidden: true },
  { header: "Buyer Order No", key: "buyerOrderNumber", width: 16, type: "text" },
  { header: "Dispatch Doc No", key: "dispatchDocNumber", width: 16, type: "text", hideIfHidden: true },
  { header: "Dispatched Through", key: "dispatchedThrough", width: 18, type: "text", hideIfHidden: true },
  { header: "Terms of Delivery", key: "termsOfDelivery", width: 18, type: "text", hideIfHidden: true },
  { header: "Destination", key: "destination", width: 18, type: "text", hideIfHidden: true },
  { header: "Other References", key: "otherReferences", width: 18, type: "text" },
];

const TAIL_COLUMNS = [
  { header: "Notes", key: "notes", width: 28, type: "text" },
  { header: "Created At", key: "createdAt", width: 18, type: "datetime" },
];

const NUM_FMTS = {
  money: "#,##0.00",
  qty: "#,##0.###",
  pct: "0.##",
  date: "yyyy-mm-dd",
  datetime: "yyyy-mm-dd hh:mm",
};

// Build the final column list for a given industry profile. `hidden` is the
// set of field ids the profile hides; extended fields (rental/healthcare) are
// appended only when the profile exposes them (EXTENDED_FIELDS in industryConfig).
function buildColumns(profile) {
  const hidden = new Set(profile?.hiddenFields || []);
  // Read the extended id list straight off a local map mirroring industryConfig
  // (keeps this util decoupled from every industry's field list).
  const extIds = EXTENDED_FIELDS_FOR[profile?.id] || [];

  const itemCols = ITEM_COLUMNS.filter((c) => !(c.key === "hsn" && profile?.id === "FOOD"));
  const refCols = REFERENCE_COLUMNS.filter((c) => !c.hideIfHidden || !hidden.has(c.key));

  const extCols = extIds.map((id) => ({
    header: EXTENDED_HEADERS[id] || id,
    key: id,
    width: EXTENDED_FIELD_TYPES[id] === "date" ? 14 : 16,
    type: EXTENDED_FIELD_TYPES[id] === "date" ? "date" : "text",
  }));

  return [...CORE_COLUMNS, ...itemCols, ...refCols, ...extCols, ...TAIL_COLUMNS];
}

// Extended-field ids per industry (mirrors EXTENDED_FIELDS in industryConfig).
const EXTENDED_FIELDS_FOR = {
  RENTAL: [
    "agreementNumber", "assetNumber", "serialNumber", "vehicleNumber",
    "periodStart", "periodEnd", "billingPeriodStart", "billingPeriodEnd",
    "expectedReturnDate", "depositReference",
  ],
  HEALTHCARE: [
    "patientReference", "serviceDate", "treatmentReference", "referringDoctor",
    "billingPeriodStart", "billingPeriodEnd",
  ],
};

const EXTENDED_HEADERS = {
  agreementNumber: "Agreement No",
  assetNumber: "Asset No",
  serialNumber: "Serial No",
  vehicleNumber: "Vehicle No",
  periodStart: "Period Start",
  periodEnd: "Period End",
  billingPeriodStart: "Billing Period Start",
  billingPeriodEnd: "Billing Period End",
  expectedReturnDate: "Expected Return Date",
  depositReference: "Deposit Reference",
  patientReference: "Patient Reference",
  serviceDate: "Service Date",
  treatmentReference: "Treatment Reference",
  referringDoctor: "Referring Doctor",
};

// One worksheet row per invoice (not per line item). A single-item invoice uses
// its real Qty / Rate / GST%. A multi-item invoice is collapsed to ONE synthetic
// line: Qty=1, Rate=subtotal, GST%=the blended effective rate
// (taxAmount / (subtotal - discount) * 100) so the row's formulas reproduce the
// invoice's true Subtotal / Tax / Grand Total while staying editable. This is
// what keeps 161 invoices at 161 rows instead of 2576.
function invoiceToRow(inv, customer) {
  const items = Array.isArray(inv.items) ? inv.items : [];
  const subtotal = num(inv.subtotal) ?? 0;
  const discount = num(inv.discountPercent) ?? 0;
  const taxAmount = num(inv.taxAmount) ?? 0;
  const discounted = subtotal - (subtotal * discount) / 100;

  let itemName = null;
  let hsn = null;
  let unit = null;
  let qty = null;
  let rate = null;
  let gstPercentage = null;

  if (items.length === 1) {
    const it = items[0];
    itemName = text(it.itemName);
    hsn = text(it.hsn);
    unit = text(it.unit) || "Piece";
    qty = num(it.qty);
    rate = num(it.rate);
    gstPercentage = num(it.gstPercentage);
  } else if (items.length > 1) {
    const first = items[0];
    itemName = `${text(first.itemName) || "Multiple items"} (+${items.length - 1} more)`;
    hsn = text(first.hsn);
    unit = text(first.unit) || "Piece";
    qty = 1;
    rate = subtotal;
    gstPercentage = discounted > 0 ? round2((taxAmount / discounted) * 100) : 0;
  }

  return {
    invoiceNumber: text(inv.invoiceNumber),
    invoiceType: text(inv.invoiceType),
    status: text(inv.status),
    invoiceDate: isoToDate(inv.invoiceDate),
    dueDate: isoToDate(inv.dueDate),
    customerName: text(inv.customerName || customer?.name),
    customerGstin: text(customer?.gstIn),
    customerEmail: text(customer?.email),
    customerPhone: text(customer?.phone),
    customerAddress: text(customer?.billingAddress),
    customerCity: text(customer?.city),
    customerState: text(customer?.state),
    customerPincode: text(customer?.pincode),
    placeOfSupply: text(inv.placeOfSupply),
    paymentTerms: text(inv.paymentTerms),
    paymentMode: text(inv.paymentMode),
    itemName,
    hsn,
    unit,
    qty,
    rate,
    gstPercentage,
    discountPercent: discount || null,
    taxableValue: subtotal || null,
    itemTaxAmount: taxAmount || null,
    itemTotal: num(inv.grandTotal) || null,
    deliveryNote: text(inv.deliveryNote),
    deliveryNoteDate: isoToDate(inv.deliveryNoteDate),
    referenceNumber: text(inv.referenceNumber),
    buyerOrderNumber: text(inv.buyerOrderNumber),
    dispatchDocNumber: text(inv.dispatchDocNumber),
    dispatchedThrough: text(inv.dispatchedThrough),
    termsOfDelivery: text(inv.termsOfDelivery),
    destination: text(inv.destination),
    otherReferences: text(inv.otherReferences),
    agreementNumber: text(inv.agreementNumber),
    assetNumber: text(inv.assetNumber),
    serialNumber: text(inv.serialNumber),
    vehicleNumber: text(inv.vehicleNumber),
    periodStart: isoToDate(inv.periodStart),
    periodEnd: isoToDate(inv.periodEnd),
    billingPeriodStart: isoToDate(inv.billingPeriodStart),
    billingPeriodEnd: isoToDate(inv.billingPeriodEnd),
    expectedReturnDate: isoToDate(inv.expectedReturnDate),
    depositReference: text(inv.depositReference),
    patientReference: text(inv.patientReference),
    serviceDate: isoToDate(inv.serviceDate),
    treatmentReference: text(inv.treatmentReference),
    referringDoctor: text(inv.referringDoctor),
    notes: text(inv.notes),
    createdAt: isoToDateTime(inv.createdAt),
  };
}

const BUSINESS_COLUMNS = [
  { header: "Business Name", key: "businessName", width: 28 },
  { header: "GSTIN", key: "gstIn", width: 18 },
  { header: "Industry", key: "industry", width: 24 },
  { header: "Email", key: "email", width: 28 },
  { header: "Phone", key: "phone", width: 15 },
  { header: "Website", key: "website", width: 24 },
  { header: "Address Line 1", key: "addressLine1", width: 30 },
  { header: "Address Line 2", key: "addressLine2", width: 26 },
  { header: "City", key: "city", width: 16 },
  { header: "State", key: "state", width: 16 },
  { header: "Country", key: "country", width: 14 },
  { header: "Pincode", key: "pincode", width: 10 },
  { header: "Bank Name", key: "bankName", width: 22 },
  { header: "Branch", key: "branch", width: 18 },
  { header: "Account No", key: "accountNo", width: 20 },
  { header: "IFSC", key: "ifsc", width: 12 },
  { header: "Bank Address", key: "bankAddress", width: 26 },
  { header: "UPI ID", key: "upiId", width: 22 },
];

function styleHeaderRow(row, columnCount) {
  row.height = 22;
  for (let c = 1; c <= columnCount; c += 1) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF1E293B" } },
    };
  }
}

function applyColumnTypes(sheet, columns) {
  columns.forEach((col, i) => {
    const column = sheet.getColumn(i + 1);
    column.width = col.width;
    if (NUM_FMTS[col.type]) column.numFmt = NUM_FMTS[col.type];
  });
}

// 0-based index → Excel column letter (0→A, 25→Z, 26→AA …).
function colLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// key → column letter, built from the final column list so formulas can't
// drift if columns are added / reordered later.
function buildColMap(columns) {
  const map = {};
  columns.forEach((c, i) => { map[c.key] = colLetter(i); });
  return map;
}

// Overwrite the three computed money cells with LIVE Excel formulas that
// mirror the backend totals engine (InvoiceMapper.calculateInvoiceTotals):
//   Taxable Value   = Qty × Rate
//   Item Tax Amount = Taxable × (1 − Discount%/100) × GST%/100
//   Item Total      = Taxable × (1 − Discount%/100) + Item Tax
// so editing Qty / Rate / GST% / Discount% recalculates immediately (user's
// 100 → 90 at 10% example). Guarded to real item rows (a valid qty or rate
// present) so empty rows stay blank instead of showing 0.
function injectFormulas(sheet, colMap, columns) {
  const colIndex = {};
  columns.forEach((c, i) => { colIndex[c.key] = i + 1; });

  sheet.eachRow({ includeEmpty: false }, (row, rn) => {
    if (rn <= 2) return; // banner (row 1) + header (row 2)
    const qty = row.getCell(colIndex.qty).value;
    const rate = row.getCell(colIndex.rate).value;
    if (num(qty) === null && num(rate) === null) return;

    const qtyCell = `${colMap.qty}${rn}`;
    const rateCell = `${colMap.rate}${rn}`;
    const gstCell = `${colMap.gstPercentage}${rn}`;
    const discCell = `${colMap.discountPercent}${rn}`;
    const tvCell = `${colMap.taxableValue}${rn}`;
    const taxCell = `${colMap.itemTaxAmount}${rn}`;

    // Taxable Value = Qty × Rate
    row.getCell(colIndex.taxableValue).value = {
      formula: `${qtyCell}*${rateCell}`,
      result: num(row.getCell(colIndex.taxableValue).value) ?? 0,
    };
    // Discounted taxable portion (used by both tax and total).
    const discounted = `${tvCell}*(1-${discCell}/100)`;
    // Item Tax = Discounted taxable × GST% ÷ 100
    row.getCell(colIndex.itemTaxAmount).value = {
      formula: `(${discounted})*${gstCell}/100`,
      result: num(row.getCell(colIndex.itemTaxAmount).value) ?? 0,
    };
    // Item Total = Discounted taxable + Item Tax
    row.getCell(colIndex.itemTotal).value = {
      formula: `(${discounted})+${taxCell}`,
      result: num(row.getCell(colIndex.itemTotal).value) ?? 0,
    };
  });
}

/**
 * Fetches every invoice (all pages) + customers + business profile, applies the
 * current screen filters, and downloads a styled .xlsx.
 *
 * Sheet "Invoices": one row per invoice, industry-tailored columns, live
 * money formulas. Sheet "Business": the seller profile snapshot. Sheet
 * "Industry Guide": which fields each industry needs (e.g. Food omits HSN).
 *
 * @returns {Promise<number>} how many invoices were written.
 */
export async function exportInvoicesExcel({ search = "", month = "", year = "" } = {}) {
  const [invoices, customers, businessRes] = await Promise.all([
    fetchAll((params) => invoiceAPI.getAll(params)),
    fetchAll((params) => customerAPI.getAll(params)),
    businessAPI.getProfile().catch(() => null),
  ]);

  const business = businessRes?.data?.data || null;
  const industryId = resolveIndustryId(business?.industry);
  const profile = INDUSTRY_PROFILES?.[industryId] || INDUSTRY_PROFILES?.OTHER;
  const columns = buildColumns(profile);
  const colMap = buildColMap(columns);

  const customerById = new Map();
  customers.forEach((c) => customerById.set(c.id, c));

  const filtered = invoices.filter((inv) => invoiceMatchesFilters(inv, search, month, year));

  // Dynamic import keeps exceljs (~1 MB) out of the main bundle; it only
  // loads when someone actually clicks Export.
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Inside Invoice";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Invoices", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  applyColumnTypes(sheet, columns);
  styleHeaderRow(sheet.getRow(1), columns.length);

  // Row 1 is the header; insert a slim banner ABOVE it naming the industry so
  // the filler knows which field set applies (one file = one business).
  sheet.spliceRows(1, 0, [`Industry: ${profile?.name || industryId}`]);
  const banner = sheet.getRow(1);
  banner.height = 20;
  const bannerCell = banner.getCell(1);
  bannerCell.font = { bold: true, color: { argb: "FF1E293B" }, size: 11 };
  bannerCell.alignment = { vertical: "middle" };
  // Merge the banner across all columns for a clean look.
  if (columns.length > 1) {
    sheet.mergeCells(1, 1, 1, columns.length);
  }
  // Freeze below both the banner and the header row.
  sheet.views = [{ state: "frozen", ySplit: 2 }];

  filtered.forEach((inv) => {
    sheet.addRow(invoiceToRow(inv, customerById.get(inv.customerId)));
  });
  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: columns.length },
  };

  // Live formulas on the three computed money columns.
  injectFormulas(sheet, colMap, columns);

  // Force Excel/LibreOffice to recalculate the formulas on open so totals are
  // always correct even if a cached `result` is stale after an edit.
  workbook.calcProperties.fullCalcOnLoad = true;

  if (business) {
    const bizSheet = workbook.addWorksheet("Business", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    bizSheet.columns = BUSINESS_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    styleHeaderRow(bizSheet.getRow(1), BUSINESS_COLUMNS.length);
    bizSheet.addRow({
      businessName: text(business.businessName),
      gstIn: text(business.gstIn),
      industry: text(business.industry),
      email: text(business.email),
      phone: text(business.phone),
      website: text(business.website),
      addressLine1: text(business.addressLine1),
      addressLine2: text(business.addressLine2),
      city: text(business.city),
      state: text(business.state),
      country: text(business.country),
      pincode: text(business.pincode),
      bankName: text(business.bankName),
      branch: text(business.branch),
      accountNo: text(business.accountNo),
      ifsc: text(business.ifsc),
      bankAddress: text(business.bankAddress),
      upiId: text(business.upiId),
    });
  }

  // "Industry Guide" reference sheet: for each industry, which fields are
  // required vs not. E.g. Food omits HSN/SAC, General Business requires it.
  const guideSheet = workbook.addWorksheet("Industry Guide", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const guideCols = [
    { header: "Industry", key: "industry", width: 30 },
    { header: "HSN/SAC", key: "hsn", width: 16 },
    { header: "Unit", key: "unit", width: 30 },
    { header: "GST %", key: "gst", width: 12 },
  ];
  guideSheet.columns = guideCols;
  styleHeaderRow(guideSheet.getRow(1), guideCols.length);
  Object.values(INDUSTRY_PROFILES || {}).forEach((p) => {
    guideSheet.addRow({
      industry: p.name,
      hsn: p.id === "FOOD" ? "Not required" : "Required",
      unit: "Required (Piece/Kg/Ltr/Hour/Day)",
      gst: "Required",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `inside-invoices-${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filtered.length;
}
