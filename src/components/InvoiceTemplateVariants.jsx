import React from "react";
import CompanySeal from "./CompanySeal";
import CompanyStamp from "./CompanyStamp";
import InvoiceTemplateRetro from "./InvoiceTemplateRetro";
import { numberToWords, formatINR } from "../utils/invoiceFormat";

const cell = (width) => ({
  width: `${width}px`,
  minWidth: `${width}px`,
  maxWidth: `${width}px`,
  boxSizing: "border-box",
});

const ITEM_COLS = [
  { w: 52, key: "sl" },
  { w: 262, key: "desc" },
  { w: 76, key: "hsn" },
  { w: 62, key: "gst" },
  { w: 72, key: "qty" },
  { w: 76, key: "rate" },
  { w: 42, key: "per" },
  { w: 72, key: "amt" },
];
const TABLE_W = ITEM_COLS.reduce((s, c) => s + c.w, 0);

const tStyle = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  boxSizing: "border-box",
};

const tStyleSep = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "fixed",
  boxSizing: "border-box",
};

const L = {
  classic: "classic",
  split: "split",
  stacked: "stacked",
  cards: "cards",
  compact: "compact",
  modern: "modern",
  centered: "centered",
  executive: "executive",
  divided: "divided",
  "minimal-bar": "minimal-bar",
  letterhead: "letterhead",
  panel: "panel",
  "clean-white": "clean-white",
  "bold-corporate": "bold-corporate",
  "classic-formal": "classic-formal",
  "dark-modern": "dark-modern",
  retro: "retro",
};

const TEMPLATE_THEMES = {
  "template-31": {
    id: "template-31", label: "Retro", desc: "Fixed A4 page in classic shop-bill style — No / Particulars / Qty / Rate / Amount",
    layout: L.retro, font: "Arial, Helvetica, sans-serif", bodyBg: "#ffffff",
    borderColor: "#000000", borderWidth: "2px", borderStyle: "solid", primary: "#000000",
    headerBg: "#ffffff", headerText: "#000000", accentBg: "#000000", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#d6d6d6", tableHeaderText: "#000000",
    tableRowHeight: 26, compact: false, labelStyle: "normal",
  },
  "template-3": {
    id: "template-3", label: "Corporate Blue", desc: "Professional navy blue accents",
    layout: L.classic, font: "'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#2b4c7e", borderWidth: "1px", borderStyle: "solid", primary: "#1e3a5f",
    headerBg: "#1e3a5f", headerText: "#ffffff", accentBg: "#1e3a5f", accentText: "#ffffff",
    sectionTitleBorder: false, tableHeaderBg: "#1e3a5f", tableHeaderText: "#ffffff",
    tableRowHeight: 28, compact: false, labelStyle: "normal",
  },
  "template-5": {
    id: "template-5", label: "Minimalist", desc: "Borderless design with maximum whitespace",
    layout: L.classic, font: "'Inter', 'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#cbd5e1", borderWidth: "1px", borderStyle: "solid", primary: "#334155",
    headerBg: "#ffffff", headerText: "#334155", accentBg: "#334155", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#ffffff", tableHeaderText: "#94a3b8",
    tableRowHeight: 28, compact: false, labelStyle: "uppercase-light",
  },
  "template-8": {
    id: "template-8", label: "Premium Gold", desc: "Elegant navy and gold luxury style",
    layout: L.classic, font: "'Playfair Display', Georgia, 'Times New Roman', serif", bodyBg: "#fdfcf8",
    borderColor: "#b8860b", borderWidth: "1px", borderStyle: "solid", primary: "#1a1a2e",
    headerBg: "#1a1a2e", headerText: "#ffffff", accentBg: "#b8860b", accentText: "#1a1a2e",
    sectionTitleBorder: true, tableHeaderBg: "#1a1a2e", tableHeaderText: "#ffffff",
    tableRowHeight: 28, compact: false, labelStyle: "normal",
  },
  "template-10": {
    id: "template-10", label: "Slate Professional", desc: "Clean slate-grey corporate style",
    layout: L.classic, font: "'Inter', 'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#475569", borderWidth: "2px", borderStyle: "solid", primary: "#334155",
    headerBg: "#334155", headerText: "#ffffff", accentBg: "#475569", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#334155", tableHeaderText: "#ffffff",
    tableRowHeight: 28, compact: false, labelStyle: "normal",
  },
  "template-18": {
    id: "template-18", label: "Executive", desc: "Company name in bold header band, buyer + details below",
    layout: L.executive, font: "'Inter', 'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#1e3a5f", borderWidth: "1px", borderStyle: "solid", primary: "#1e3a5f",
    headerBg: "#1e3a5f", headerText: "#ffffff", accentBg: "#c9a84c", accentText: "#1e3a5f",
    sectionTitleBorder: true, tableHeaderBg: "#f0f4f8", tableHeaderText: "#1e3a5f",
    tableRowHeight: 28, compact: false, labelStyle: "normal",
  },
  "template-19": {
    id: "template-19", label: "Divided", desc: "Three-column grid: seller | buyer | details",
    layout: L.divided, font: "'Inter', 'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#64748b", borderWidth: "1px", borderStyle: "solid", primary: "#475569",
    headerBg: "#475569", headerText: "#ffffff", accentBg: "#0ea5e9", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#f1f5f9", tableHeaderText: "#334155",
    tableRowHeight: 28, compact: false, labelStyle: "normal",
  },
  "template-23": {
    id: "template-23", label: "Clean White", desc: "Ultra minimal greyscale with maximum whitespace",
    layout: L["clean-white"], font: "'Inter', 'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#e5e5e5", borderWidth: "1px", borderStyle: "solid", primary: "#333333",
    headerBg: "#f5f5f5", headerText: "#333333", accentBg: "#333333", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#fafafa", tableHeaderText: "#555555",
    tableRowHeight: 30, compact: false, labelStyle: "normal",
  },
  "template-24": {
    id: "template-24", label: "Ironclad", desc: "Steel-grey structure with forge-amber accents — iron & steel works",
    layout: L.classic, font: "'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#94a3b8", borderWidth: "1px", borderStyle: "solid", primary: "#334155",
    headerBg: "#334155", headerText: "#ffffff", accentBg: "#d97706", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#334155", tableHeaderText: "#ffffff",
    tableRowHeight: 28, compact: false, labelStyle: "uppercase-light",
  },
  "template-25": {
    id: "template-25", label: "Copper Circuit", desc: "Deep navy header with copper highlights — electricals & electronics",
    layout: L.classic, font: "'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#94a3b8", borderWidth: "1px", borderStyle: "solid", primary: "#0c4a6e",
    headerBg: "#0c4a6e", headerText: "#ffffff", accentBg: "#b45309", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#0c4a6e", tableHeaderText: "#ffffff",
    tableRowHeight: 28, compact: false, labelStyle: "normal",
  },
  "template-26": {
    id: "template-26", label: "Timber Line", desc: "Warm walnut serif styling — wood, plywood & furniture",
    layout: L.classic, font: "Georgia, 'Times New Roman', serif", bodyBg: "#fffdf7",
    borderColor: "#c9b6a0", borderWidth: "1px", borderStyle: "solid", primary: "#4a3527",
    headerBg: "#4a3527", headerText: "#ffffff", accentBg: "#8b5e34", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#f3ead9", tableHeaderText: "#4a3527",
    tableRowHeight: 28, compact: false, labelStyle: "normal",
  },
  "template-27": {
    id: "template-27", label: "Carbon Grid", desc: "Bold black grid with brand-red accent — hardware, tools & fasteners",
    layout: L.classic, font: "Arial, Helvetica, sans-serif", bodyBg: "#ffffff",
    borderColor: "#111111", borderWidth: "1px", borderStyle: "solid", primary: "#111111",
    headerBg: "#111111", headerText: "#ffffff", accentBg: "#b91c1c", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#111111", tableHeaderText: "#ffffff",
    tableRowHeight: 26, compact: false, labelStyle: "uppercase-light",
  },
  "template-28": {
    id: "template-28", label: "Blueprint Pro", desc: "Engineering blue with light spec-sheet table — fabrication & industrial supply",
    layout: L.classic, font: "'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#93c5fd", borderWidth: "1px", borderStyle: "solid", primary: "#1e40af",
    headerBg: "#1e40af", headerText: "#ffffff", accentBg: "#1d4ed8", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#dbeafe", tableHeaderText: "#1e3a8a",
    tableRowHeight: 28, compact: false, labelStyle: "normal",
  },
  "template-29": {
    id: "template-29", label: "Trade Command", desc: "Gunmetal three-column trade layout with gold accent — distribution & contracting",
    layout: L.divided, font: "'Segoe UI', Arial, sans-serif", bodyBg: "#ffffff",
    borderColor: "#a8a29e", borderWidth: "1px", borderStyle: "solid", primary: "#292524",
    headerBg: "#292524", headerText: "#ffffff", accentBg: "#a16207", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#292524", tableHeaderText: "#ffffff",
    tableRowHeight: 28, compact: false, labelStyle: "uppercase-light",
  },
  "template-30": {
    id: "template-30", label: "Ledger Formal", desc: "Traditional double-rule ledger with oxblood accents — established merchants",
    layout: L["classic-formal"], font: "Georgia, 'Times New Roman', serif", bodyBg: "#ffffff",
    borderColor: "#52525b", borderWidth: "1px", borderStyle: "solid", primary: "#18181b",
    headerBg: "#18181b", headerText: "#ffffff", accentBg: "#7f1d1d", accentText: "#ffffff",
    sectionTitleBorder: true, tableHeaderBg: "#f4f4f5", tableHeaderText: "#18181b",
    tableRowHeight: 28, compact: false, labelStyle: "normal",
  },
};

const InvoiceTemplateVariants = React.memo(React.forwardRef(({ theme, business, customer, form, items, totals, discountPercent, type, invoiceNumber }, ref) => {
  const t = TEMPLATE_THEMES[theme] || TEMPLATE_THEMES["template-3"];
  // The retro shop-bill layout is a self-contained fixed page (repeated per
  // overflow page), so it renders outside the shared table skeleton.
  if (t.layout === L.retro) {
    return (
      <InvoiceTemplateRetro
        ref={ref}
        business={business}
        customer={customer}
        form={form}
        items={items}
        totals={totals}
        discountPercent={discountPercent}
        type={type}
        invoiceNumber={invoiceNumber}
      />
    );
  }
  const S = { border: `${t.borderWidth} ${t.borderStyle} ${t.borderColor}` };
  const displayInvNo = invoiceNumber || "DRAFT";
  const isProforma = type === "PROFORMA_INVOICE";
  const pl = (label) => isProforma ? ({ "Invoice No.": "Proforma Ref", "Invoice#": "Proforma Ref", "Due Date": "Valid Until", "Due": "Valid Until" }[label] || label) : label;
  const validItems = (items || []).filter((i) => i.itemName?.trim() && parseFloat(i.qty) > 0);
  const sigSrc = business?.signature ? `data:image/png;base64,${business.signature}` : null;
  const discPct = parseFloat(discountPercent) || 0;
  const discAmt = totals.subtotal * Math.min(discPct, 100) / 100;
  const taxableAmount = totals.subtotal - discAmt;
  const discRatio = totals.subtotal > 0 ? (taxableAmount / totals.subtotal) : 0;

  let cgstTotal = 0, sgstTotal = 0;
  validItems.forEach((item) => {
    const gst = parseFloat(item.gstPercentage) || 0;
    const taxable = (parseFloat(item.taxableValue) || parseFloat(item.qty || 0) * parseFloat(item.rate || 0)) * discRatio;
    const halfGst = gst / 2;
    cgstTotal += (taxable * halfGst) / 100;
    sgstTotal += (taxable * halfGst) / 100;
  });

  const rightLabels = isProforma
    ? ["Proforma Ref.", "Delivery Note", "Reference No. & Date.", "Buyer's Order No.",
       "Dispatch Doc No.", "Dispatched through", "Terms of Delivery", "Valid Until",
       "Mode/Terms of Payment", "Other References", "Dated", "Delivery Note Date", "Destination"]
    : [pl("Invoice No."), "Delivery Note", "Reference No. & Date.", "Buyer's Order No.",
       "Dispatch Doc No.", "Dispatched through", "Terms of Delivery", "Payment Date",
       "Mode/Terms of Payment", "Other References", "Dated", "Delivery Note Date", "Destination"];
  const rightValues = [
    isProforma ? `PF-${displayInvNo}` : displayInvNo, form?.deliveryNote,
    form?.referenceNumber ? `${form.referenceNumber} / ${form.invoiceDate || ""}` : form?.invoiceDate,
    form?.buyerOrderNumber, form?.dispatchDocNumber, form?.dispatchedThrough,
    form?.termsOfDelivery, form?.dueDate, form?.paymentTerms, form?.otherReferences,
    form?.invoiceDate, form?.deliveryNoteDate, form?.destination,
  ];

  const sealVisible = typeof window !== "undefined" && localStorage.getItem("show_seal") === "true";
  const sealType = typeof window !== "undefined" ? localStorage.getItem("seal_type") || "round" : "round";
  const stampAddress1 = business?.addressLine1 || "";
  const stampAddress2 = [business?.addressLine2, business?.city, business?.state, business?.pincode ? "-" + business.pincode : ""].filter(Boolean).join(", ");
  const stampPhone = business?.phone ? `Ph: ${business.phone}` : "";
  const stampEmail = business?.email ? `E-Mail: ${business.email}` : "";

  const basePad = t.compact ? "3px 4px" : "5px 6px";
  const basePadH = t.compact ? "4px 4px 5px 4px" : "6px 6px 7px 6px";
  const baseFS = t.compact ? "9px" : "10px";
  const titleFS = t.compact ? "13px" : "14px";

  const titleRow = () => (
    <tr>
      <td colSpan={2} style={{ borderBottom: S.border, padding: 0, background: t.primary !== "#ffffff" ? t.primary : "transparent", borderLeft: `${t.borderWidth} ${t.borderStyle} ${t.primary !== "#ffffff" ? t.primary : "transparent"}`, borderRight: `${t.borderWidth} ${t.borderStyle} ${t.primary !== "#ffffff" ? t.primary : "transparent"}` }}>
        <div style={{
          position: "relative", textAlign: "center", fontSize: titleFS, fontWeight: "bold",
          padding: t.compact ? "4px 8px" : "6px 10px",
          color: t.primary === t.headerText ? "#ffffff" : (t.headerText !== "#1e293b" ? t.headerText : "#000"),
        }}>
          {isProforma ? "PROFORMA INVOICE" : "Tax Invoice"}
          {isProforma ? (
            <div style={{ fontSize: "9px", fontWeight: "normal", fontStyle: "italic", opacity: 0.8 }}>
              — NOT A TAX INVOICE —
            </div>
          ) : (
            <span style={{
              position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
              fontSize: "11px", fontStyle: "italic", fontWeight: "normal",
              color: t.primary === t.headerText ? "#ffffff" : (t.headerText !== "#1e293b" ? t.headerText : "#000"),
            }}>
              (ORIGINAL FOR RECIPIENT)
            </span>
          )}
        </div>
      </td>
    </tr>
  );

  const sellerBlock = (
    <div>
      <div style={{ fontSize: t.compact ? "14px" : "18px", fontWeight: "bold", marginBottom: "4px", color: t.accentBg !== "#ffffff" ? t.accentBg : "#000" }}>
        {business?.businessName || "Business Name"}
      </div>
      <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>
        {business?.addressLine1 || ""}{business?.addressLine2 ? ", " + business.addressLine2 : ""}
      </div>
      <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>
        {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
      </div>
      {business?.phone ? <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>Ph: {business.phone}</div> : null}
      {business?.email ? <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>{business.email}</div> : null}
      {business?.gstIn ? <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>GSTIN/UIN: {business.gstIn}</div> : null}
      {business?.state ? <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>State: {business.state} Code: {business.gstIn?.substring(0, 2) || ""}</div> : null}
    </div>
  );

  const buyerBlock = (
    <div>
      <div style={{
        fontSize: t.compact ? "10px" : "11px", fontWeight: "bold", marginBottom: "4px",
        color: t.primary,
        textTransform: t.labelStyle === "uppercase-light" ? "uppercase" : "none",
        letterSpacing: t.labelStyle === "uppercase-light" ? "1px" : "normal",
      }}>
        Buyer (Bill to)
      </div>
      <div style={{ fontSize: t.compact ? "13px" : "16px", fontWeight: "bold", marginBottom: "3px" }}>
        {customer?.name || "Customer Name"}
      </div>
      {customer?.billingAddress ? <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>{customer.billingAddress}</div> : null}
      {customer?.phone ? <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>Ph: {customer.phone}</div> : null}
      {customer?.email ? <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>{customer.email}</div> : null}
      {customer?.gstIn ? <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>GSTIN/UIN: {customer.gstIn}</div> : null}
      {customer?.state ? <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>State: {customer.state}</div> : null}
    </div>
  );

  const metadataBlock = (compactMode) => (
    <table style={tStyle}>
      <tbody>
        {rightLabels.map((label, idx) => (
          <tr key={idx} style={{ height: compactMode ? "20px" : t.compact ? "22px" : "25px" }}>
            <td style={{
              width: compactMode ? "35%" : "52%",
              borderBottom: idx < rightLabels.length - 1 ? S.border : 0,
              borderRight: S.border,
              padding: compactMode ? "2px 4px" : t.compact ? "3px 4px" : "5px 6px",
              fontSize: compactMode ? "8px" : baseFS,
              verticalAlign: "middle",
              color: t.labelStyle === "uppercase-light" ? "#94a3b8" : "#000",
              textTransform: t.labelStyle === "uppercase-light" ? "uppercase" : "none",
              letterSpacing: t.labelStyle === "uppercase-light" ? "0.5px" : "normal",
            }}>
              {label}
            </td>
            <td style={{
              width: compactMode ? "65%" : "48%",
              borderBottom: idx < rightLabels.length - 1 ? S.border : 0,
              padding: compactMode ? "2px 4px" : t.compact ? "3px 4px" : "5px 6px",
              fontSize: compactMode ? "8px" : baseFS,
              fontWeight: "bold",
              verticalAlign: "middle",
            }}>
              {rightValues[idx] || "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderTop = () => {
    switch (t.layout) {
      case L.split:
        return (
          <>
            <tr>
              <td style={{ width: "50%", borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 6px 4px 8px" : "8px 10px 6px 12px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Seller</div>
                {sellerBlock}
              </td>
              <td style={{ width: "50%", borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 6px 4px 8px" : "8px 10px 6px 12px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Buyer</div>
                {buyerBlock}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
                {metadataBlock(true)}
              </td>
            </tr>
          </>
        );
      case L.stacked:
        return (
          <>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 6px 4px 8px" : "8px 10px 6px 12px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Seller</div>
                {sellerBlock}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 6px 4px 8px" : "8px 10px 6px 12px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Buyer</div>
                {buyerBlock}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
                {metadataBlock(true)}
              </td>
            </tr>
          </>
        );
      case L.cards:
        return (
          <tr>
            <td style={{ width: "57%", borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: "4px", verticalAlign: "top" }}>
              <div style={{ background: t.headerBg || "#f9f9f9", borderRadius: "3px", padding: "8px 10px", marginBottom: "4px" }}>
                {sellerBlock}
              </div>
              <div style={{ background: t.headerBg || "#f9f9f9", borderRadius: "3px", padding: "8px 10px" }}>
                {buyerBlock}
              </div>
            </td>
            <td style={{ width: "43%", borderRight: S.border, borderBottom: S.border, padding: "4px", verticalAlign: "top" }}>
              <div style={{ background: t.headerBg || "#f9f9f9", borderRadius: "3px", padding: "4px 6px" }}>
                {metadataBlock(false)}
              </div>
            </td>
          </tr>
        );
      case L.compact:
        return (
          <>
            <tr>
              <td style={{ width: "50%", borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: "6px 8px", verticalAlign: "top" }}>
                <div style={{ fontSize: "9px", fontWeight: "bold", color: t.primary, marginBottom: "2px", textTransform: "uppercase" }}>Seller</div>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: t.accentBg !== "#ffffff" ? t.accentBg : "#000" }}>{business?.businessName || "Business Name"}</div>
                <div style={{ fontSize: "9px", lineHeight: "1.4" }}>
                  {business?.addressLine1 || ""}{business?.addressLine2 ? ", " + business.addressLine2 : ""}, {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: "9px", lineHeight: "1.4" }}>
                  {business?.gstIn ? `GST: ${business.gstIn}` : ""}{business?.phone ? ` | Ph: ${business.phone}` : ""}
                </div>
              </td>
              <td style={{ width: "50%", borderRight: S.border, borderBottom: S.border, padding: "6px 8px", verticalAlign: "top" }}>
                <div style={{ fontSize: "9px", fontWeight: "bold", color: t.primary, marginBottom: "2px", textTransform: "uppercase" }}>Buyer</div>
                <div style={{ fontSize: "13px", fontWeight: "bold" }}>{customer?.name || "Customer Name"}</div>
                <div style={{ fontSize: "9px", lineHeight: "1.4" }}>
                  {customer?.billingAddress || ""}{customer?.phone ? ` | Ph: ${customer.phone}` : ""}
                  {customer?.gstIn ? ` | GST: ${customer.gstIn}` : ""}
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
                <table style={tStyle}>
                  <tbody>
                    <tr>
                      {[
                        [pl("Invoice No."), displayInvNo],
                        ["Date", form?.invoiceDate || "-"],
                        [pl("Due Date"), form?.dueDate || "-"],
                        ["PO No.", form?.buyerOrderNumber || "-"],
                        ["Terms", form?.paymentTerms || "-"],
                      ].map(([l, v], i) => (
                        <td key={i} style={{
                          borderRight: i < 4 ? S.border : 0, borderBottom: 0,
                          padding: "3px 6px", fontSize: "8px", verticalAlign: "middle",
                        }}>
                          <span style={{ color: "#94a3b8" }}>{l}: </span>
                          <span style={{ fontWeight: "bold" }}>{v}</span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </>
        );
      case L.modern:
        return (
          <>
            <tr>
              <td style={{ width: "57%", borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 6px 4px 8px" : "10px 8px 6px 12px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Seller</div>
                {sellerBlock}
              </td>
              <td style={{ width: "43%", borderRight: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top" }}>
                {metadataBlock(false)}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 6px 4px 8px" : "8px 10px 6px 12px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Buyer</div>
                {buyerBlock}
              </td>
            </tr>
          </>
        );
      case L.centered:
        return (
          <>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 6px 4px 8px" : "12px 12px 8px", verticalAlign: "top", textAlign: "center" }}>
                <div style={{ fontSize: t.compact ? "14px" : "18px", fontWeight: "bold", color: t.accentBg !== "#ffffff" ? t.accentBg : "#000" }}>
                  {business?.businessName || "Business Name"}
                </div>
                <div style={{ fontSize: baseFS, lineHeight: "1.45" }}>
                  {business?.addressLine1 || ""}{business?.addressLine2 ? ", " + business.addressLine2 : ""}, {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                </div>
                {business?.phone ? <div style={{ fontSize: baseFS }}>Ph: {business.phone} | GST: {business?.gstIn || ""}</div> : null}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 6px 4px 8px" : "10px 12px 8px", verticalAlign: "top", textAlign: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "2px", textTransform: "uppercase", letterSpacing: "1px" }}>Bill To</div>
                <div style={{ fontSize: t.compact ? "13px" : "16px", fontWeight: "bold" }}>{customer?.name || "Customer Name"}</div>
                {customer?.billingAddress ? <div style={{ fontSize: baseFS }}>{customer.billingAddress}</div> : null}
                {customer?.gstIn ? <div style={{ fontSize: baseFS }}>GSTIN: {customer.gstIn}</div> : null}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
                {metadataBlock(false)}
              </td>
            </tr>
          </>
        );
      case L.executive:
        return (
          <>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0, background: t.primary }}>
                <div style={{ padding: t.compact ? "8px 12px" : "12px 16px" }}>
                  <div style={{ fontSize: t.compact ? "16px" : "22px", fontWeight: "bold", color: "#ffffff" }}>
                    {business?.businessName || "Business Name"}
                  </div>
                  <div style={{ fontSize: baseFS, color: "rgba(255,255,255,0.8)", marginTop: "2px" }}>
                    {[business?.addressLine1, business?.addressLine2, business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                  </div>
                  <div style={{ fontSize: baseFS, color: "rgba(255,255,255,0.8)" }}>
                    {business?.phone ? `Ph: ${business.phone}` : ""}{business?.email ? ` | ${business.email}` : ""}{business?.gstIn ? ` | GST: ${business.gstIn}` : ""}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ width: "60%", borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 8px" : "10px 12px", verticalAlign: "top" }}>
                {buyerBlock}
              </td>
              <td style={{ width: "40%", borderRight: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top" }}>
                <table style={tStyle}>
                  <tbody>
                    {[
                      [pl("Invoice#"), displayInvNo],
                      ["Date", form?.invoiceDate || "-"],
                      [pl("Due Date"), form?.dueDate || "-"],
                      ["PO No.", form?.buyerOrderNumber || "-"],
                      ["Terms", form?.paymentTerms || "-"],
                      ["Ref.", form?.referenceNumber || "-"],
                    ].map(([l, v], i) => (
                      <tr key={i}>
                        <td style={{
                          width: "40%", borderBottom: S.border, borderRight: S.border,
                          padding: "4px 6px", fontSize: baseFS, color: t.primary, fontWeight: "bold",
                        }}>{l}</td>
                        <td style={{
                          width: "60%", borderBottom: S.border,
                          padding: "4px 6px", fontSize: baseFS, fontWeight: "bold",
                        }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </>
        );
      case L.divided:
        return (
          <tr>
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top" }}>
              <table style={tStyle}>
                <tbody>
                  <tr>
                    <td style={{ width: "33%", borderRight: S.border, padding: t.compact ? "6px 8px" : "8px 10px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "3px", textTransform: "uppercase" }}>Seller</div>
                      {sellerBlock}
                    </td>
                    <td style={{ width: "34%", borderRight: S.border, padding: t.compact ? "6px 8px" : "8px 10px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "3px", textTransform: "uppercase" }}>Buyer</div>
                      {buyerBlock}
                    </td>
                    <td style={{ width: "33%", padding: t.compact ? "6px 8px" : "8px 10px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "4px", textTransform: "uppercase" }}>Details</div>
                      {[
                        [pl("Invoice#"), displayInvNo],
                        ["Date", form?.invoiceDate || "-"],
                        [pl("Due Date"), form?.dueDate || "-"],
                        ["PO No.", form?.buyerOrderNumber || "-"],
                        ["Terms", form?.paymentTerms || "-"],
                      ].map(([l, v], i) => (
                        <div key={i} style={{ fontSize: baseFS, lineHeight: "1.6" }}>
                          <span style={{ color: "#94a3b8" }}>{l}: </span>
                          <span style={{ fontWeight: "bold" }}>{v}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        );
      case L["minimal-bar"]:
        return (
          <>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: "6px 12px", background: t.primary }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#ffffff" }}>
                    {business?.businessName || "Business Name"}
                  </span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.8)" }}>
                    {type === "PROFORMA_INVOICE" ? "PROFORMA INVOICE" : "TAX INVOICE"} | {displayInvNo}
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ width: "50%", borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: "5px 8px", verticalAlign: "top" }}>
                <div style={{ fontSize: "9px", fontWeight: "bold", color: t.primary, textTransform: "uppercase" }}>Bill To</div>
                <div style={{ fontSize: "12px", fontWeight: "bold" }}>{customer?.name || "Customer Name"}</div>
                {customer?.billingAddress ? <div style={{ fontSize: "9px", lineHeight: "1.3" }}>{customer.billingAddress}</div> : null}
                {customer?.phone ? <div style={{ fontSize: "9px" }}>Ph: {customer.phone}</div> : null}
                {customer?.gstIn ? <div style={{ fontSize: "9px" }}>GST: {customer.gstIn}</div> : null}
              </td>
              <td style={{ width: "50%", borderRight: S.border, borderBottom: S.border, padding: "5px 8px", verticalAlign: "top" }}>
                <div style={{ fontSize: "9px", fontWeight: "bold", color: t.primary, textTransform: "uppercase" }}>Ship To</div>
                <div style={{ fontSize: "9px", lineHeight: "1.3" }}>
                  {customer?.billingAddress || "-"}
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
                <table style={tStyle}>
                  <tbody>
                    <tr>
                      {[
                        ["Date", form?.invoiceDate || "-"],
                        [pl("Due"), form?.dueDate || "-"],
                        ["PO", form?.buyerOrderNumber || "-"],
                        ["Terms", form?.paymentTerms || "-"],
                        ["Ref", form?.referenceNumber || "-"],
                        ["Delivery", form?.deliveryNote || "-"],
                      ].map(([l, v], i) => (
                        <td key={i} style={{
                          borderRight: i < 5 ? S.border : 0,
                          padding: "3px 6px", fontSize: "8px", verticalAlign: "middle",
                        }}>
                          <span style={{ color: "#94a3b8" }}>{l}: </span>
                          <span style={{ fontWeight: "bold" }}>{v}</span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </>
        );
      case L.letterhead:
        return (
          <>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "8px 12px 6px" : "14px 16px 10px", verticalAlign: "top", textAlign: "center" }}>
                <div style={{ fontSize: t.compact ? "16px" : "22px", fontWeight: "bold", color: t.accentBg !== "#ffffff" ? t.accentBg : "#000", letterSpacing: "1px" }}>
                  {business?.businessName || "Business Name"}
                </div>
                <div style={{ fontSize: baseFS, color: "#666", marginTop: "2px", fontStyle: "italic" }}>
                  {[business?.addressLine1, business?.addressLine2].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: baseFS, color: "#666" }}>
                  {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: baseFS, color: "#666" }}>
                  {business?.phone ? `Ph: ${business.phone}` : ""}{business?.email ? ` | Email: ${business.email}` : ""}
                </div>
                <div style={{ borderTop: `2px solid ${t.primary}`, marginTop: t.compact ? "6px" : "10px", width: "60%", marginLeft: "auto", marginRight: "auto" }} />
              </td>
            </tr>
            <tr>
              <td style={{ width: "55%", borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 8px" : "8px 12px", verticalAlign: "top" }}>
                {buyerBlock}
              </td>
              <td style={{ width: "45%", borderRight: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top" }}>
                <table style={tStyle}>
                  <tbody>
                    {[
                      [pl("Invoice No."), displayInvNo],
                      ["Date", form?.invoiceDate || "-"],
                      [pl("Due Date"), form?.dueDate || "-"],
                      ["PO No.", form?.buyerOrderNumber || "-"],
                      ["Payment Terms", form?.paymentTerms || "-"],
                      ["Place of Supply", form?.placeOfSupply || "-"],
                    ].map(([l, v], i) => (
                      <tr key={i}>
                        <td style={{
                          width: "45%", borderBottom: S.border, borderRight: S.border,
                          padding: "4px 6px", fontSize: baseFS, color: t.primary, fontWeight: "bold",
                        }}>{l}</td>
                        <td style={{
                          width: "55%", borderBottom: S.border,
                          padding: "4px 6px", fontSize: baseFS, fontWeight: "bold",
                        }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </>
        );
      case L.panel:
        return (
          <>
            <tr>
              <td style={{ width: "28%", borderLeft: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top", background: t.primary }}>
                <div style={{ padding: t.compact ? "8px 10px" : "12px 14px" }}>
                  <div style={{ fontSize: t.compact ? "13px" : "16px", fontWeight: "bold", color: "#ffffff", marginBottom: "4px" }}>
                    {business?.businessName || "Business Name"}
                  </div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.75)", lineHeight: "1.5" }}>
                    {business?.addressLine1 || ""}{business?.addressLine2 ? ", " + business.addressLine2 : ""}
                  </div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.75)", lineHeight: "1.5" }}>
                    {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                  </div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.75)", lineHeight: "1.5", marginTop: "4px" }}>
                    {business?.phone ? `Ph: ${business.phone}` : ""}
                  </div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.75)", lineHeight: "1.5" }}>
                    {business?.email || ""}
                  </div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.75)", lineHeight: "1.5" }}>
                    {business?.gstIn ? `GST: ${business.gstIn}` : ""}
                  </div>
                </div>
              </td>
              <td style={{ width: "72%", borderRight: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top" }}>
                <table style={tStyle}>
                  <tbody>
                    <tr>
                      <td style={{ padding: t.compact ? "6px 8px" : "8px 12px", borderBottom: S.border, verticalAlign: "top" }}>
                        <div style={{ fontSize: "10px", fontWeight: "bold", color: t.primary, marginBottom: "2px", textTransform: "uppercase" }}>Bill To</div>
                        <div style={{ fontSize: t.compact ? "13px" : "15px", fontWeight: "bold" }}>{customer?.name || "Customer Name"}</div>
                        {customer?.billingAddress ? <div style={{ fontSize: baseFS }}>{customer.billingAddress}</div> : null}
                        {customer?.phone ? <div style={{ fontSize: baseFS }}>Ph: {customer.phone}</div> : null}
                        {customer?.gstIn ? <div style={{ fontSize: baseFS }}>GST: {customer.gstIn}</div> : null}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: t.compact ? "4px 8px" : "6px 12px", verticalAlign: "top" }}>
                        {[
                          [pl("Invoice#"), displayInvNo],
                          ["Date", form?.invoiceDate || "-"],
                          [pl("Due Date"), form?.dueDate || "-"],
                          ["PO No.", form?.buyerOrderNumber || "-"],
                          ["Terms", form?.paymentTerms || "-"],
                        ].map(([l, v], i) => (
                          <div key={i} style={{ fontSize: baseFS, lineHeight: "1.6", display: "inline-block", width: "48%" }}>
                            <span style={{ color: t.primary, fontWeight: "bold" }}>{l}: </span>
                            <span>{v}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </>
        );
      case L["clean-white"]:
        return (
          <>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: "8px 14px", background: "#f5f5f5" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "15px", fontWeight: "bold", color: "#333", letterSpacing: "0.5px" }}>
                    {type === "PROFORMA_INVOICE" ? "PROFORMA INVOICE" : "TAX INVOICE"}
                  </span>
                  <span style={{ fontSize: "10px", color: "#888" }}>{displayInvNo}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ width: "55%", borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "8px 8px 6px 10px" : "12px 10px 8px 14px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: "#999", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>From</div>
                <div style={{ fontSize: t.compact ? "15px" : "20px", fontWeight: "bold", color: "#222", marginBottom: "3px" }}>
                  {business?.businessName || "Business Name"}
                </div>
                <div style={{ fontSize: baseFS, color: "#666", lineHeight: "1.5" }}>
                  {[business?.addressLine1, business?.addressLine2].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: baseFS, color: "#666", lineHeight: "1.5" }}>
                  {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: "9px", color: "#999", marginTop: "4px" }}>
                  {business?.phone ? `Ph: ${business.phone}` : ""}{business?.email ? ` | ${business.email}` : ""}{business?.gstIn ? ` | GST: ${business.gstIn}` : ""}
                </div>
              </td>
              <td style={{ width: "45%", borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 8px" : "10px 12px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: "#999", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>Bill To</div>
                <div style={{ fontSize: t.compact ? "13px" : "16px", fontWeight: "bold", color: "#222" }}>
                  {customer?.name || "Customer Name"}
                </div>
                {customer?.billingAddress ? <div style={{ fontSize: baseFS, color: "#666", lineHeight: "1.5" }}>{customer.billingAddress}</div> : null}
                {customer?.phone ? <div style={{ fontSize: baseFS, color: "#666" }}>Ph: {customer.phone}</div> : null}
                {customer?.gstIn ? <div style={{ fontSize: baseFS, color: "#666" }}>GST: {customer.gstIn}</div> : null}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: "5px 10px 10px", background: "#fafafa" }}>
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                  {[
                    ["Date", form?.invoiceDate || "-"],
                    [pl("Due"), form?.dueDate || "-"],
                    ["PO", form?.buyerOrderNumber || "-"],
                    ["Terms", form?.paymentTerms || "-"],
                    ["Ref", form?.referenceNumber || "-"],
                    ["Delivery", form?.deliveryNote || "-"],
                  ].map(([l, v]) => (
                    <span key={l} style={{ fontSize: "9px" }}>
                      <span style={{ color: "#999" }}>{l}: </span>
                      <span style={{ color: "#333", fontWeight: "bold" }}>{v}</span>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          </>
        );
      case L["bold-corporate"]:
        return (
          <>
            <tr>
              <td colSpan={2} style={{ borderBottom: `3px solid #000`, padding: "6px 12px", background: "#000" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "16px", fontWeight: "bold", color: "#fff", letterSpacing: "1px" }}>
                    {business?.businessName || "Business Name"}
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "#fff" }}>
                    {type === "PROFORMA_INVOICE" ? "PROFORMA INVOICE" : "TAX INVOICE"} | {displayInvNo}
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ width: "50%", borderLeft: `2px solid #000`, borderRight: `1px solid #000`, borderBottom: `2px solid #000`, padding: "8px 12px", verticalAlign: "top" }}>
                <div style={{ fontSize: "9px", fontWeight: "bold", color: "#666", marginBottom: "2px", textTransform: "uppercase" }}>SELLER</div>
                <div style={{ fontSize: "14px", fontWeight: "bold" }}>{business?.businessName || "Business Name"}</div>
                <div style={{ fontSize: "9px", lineHeight: "1.5", color: "#444" }}>
                  {[business?.addressLine1, business?.addressLine2, business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: "9px", color: "#444" }}>
                  {business?.gstIn ? `GST: ${business.gstIn}` : ""}{business?.phone ? ` | Ph: ${business.phone}` : ""}
                </div>
              </td>
              <td style={{ width: "50%", borderRight: `2px solid #000`, borderBottom: `2px solid #000`, padding: "8px 12px", verticalAlign: "top" }}>
                <div style={{ fontSize: "9px", fontWeight: "bold", color: "#666", marginBottom: "2px", textTransform: "uppercase" }}>BUYER</div>
                <div style={{ fontSize: "14px", fontWeight: "bold" }}>{customer?.name || "Customer Name"}</div>
                {customer?.billingAddress ? <div style={{ fontSize: "9px", lineHeight: "1.5", color: "#444" }}>{customer.billingAddress}</div> : null}
                {customer?.gstIn ? <div style={{ fontSize: "9px", color: "#444" }}>GST: {customer.gstIn}</div> : null}
                {customer?.phone ? <div style={{ fontSize: "9px", color: "#444" }}>Ph: {customer.phone}</div> : null}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: `2px solid #000`, borderRight: `2px solid #000`, borderBottom: `2px solid #000`, padding: 0 }}>
                <table style={tStyle}>
                  <tbody>
                    <tr>
                      {[
                        [pl("Invoice#"), displayInvNo],
                        ["Date", form?.invoiceDate || "-"],
                        [pl("Due"), form?.dueDate || "-"],
                        ["PO#", form?.buyerOrderNumber || "-"],
                        ["Terms", form?.paymentTerms || "-"],
                      ].map(([l, v], i) => (
                        <td key={i} style={{
                          borderRight: i < 4 ? `1px solid #000` : 0,
                          padding: "4px 8px", fontSize: "9px", verticalAlign: "middle",
                        }}>
                          <span style={{ color: "#666", fontWeight: "bold" }}>{l}: </span>
                          <span style={{ fontWeight: "bold" }}>{v}</span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </>
        );
      case L["classic-formal"]:
        return (
          <>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: `3px double #666`, padding: t.compact ? "6px 10px" : "10px 14px", verticalAlign: "top" }}>
                <div style={{ fontSize: t.compact ? "16px" : "20px", fontWeight: "bold", color: "#222", letterSpacing: "0.5px" }}>
                  {business?.businessName || "Business Name"}
                </div>
                <div style={{ fontSize: baseFS, color: "#666", lineHeight: "1.5", marginTop: "2px" }}>
                  {[business?.addressLine1, business?.addressLine2, business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: baseFS, color: "#666" }}>
                  {business?.phone ? `Ph: ${business.phone} | Email: ${business.email || ""}` : ""}{business?.gstIn ? ` | GST: ${business.gstIn}` : ""}
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: t.compact ? "6px 10px" : "8px 14px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", marginBottom: "2px", fontStyle: "italic" }}>Bill To:</div>
                <div style={{ fontSize: t.compact ? "14px" : "18px", fontWeight: "bold", color: "#222" }}>
                  {customer?.name || "Customer Name"}
                </div>
                {customer?.billingAddress ? <div style={{ fontSize: baseFS, color: "#444", lineHeight: "1.5" }}>{customer.billingAddress}</div> : null}
                {customer?.phone ? <div style={{ fontSize: baseFS, color: "#444" }}>Ph: {customer.phone}</div> : null}
                {customer?.gstIn ? <div style={{ fontSize: baseFS, color: "#444" }}>GST: {customer.gstIn}</div> : null}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: "6px 10px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      {[
                        [pl("Invoice No."), displayInvNo],
                        ["Date", form?.invoiceDate || "-"],
                        [pl("Due Date"), form?.dueDate || "-"],
                      ].map(([l, v], i) => (
                        <td key={i} style={{
                          width: "33%", borderRight: i < 2 ? S.border : 0,
                          padding: "4px 8px", fontSize: "10px",
                        }}>
                          <span style={{ color: "#888", fontStyle: "italic" }}>{l}: </span>
                          <span style={{ fontWeight: "bold" }}>{v}</span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      {[
                        ["PO No.", form?.buyerOrderNumber || "-"],
                        ["Terms", form?.paymentTerms || "-"],
                        ["Ref.", form?.referenceNumber || "-"],
                      ].map(([l, v], i) => (
                        <td key={i} style={{
                          width: "33%", borderRight: i < 2 ? S.border : 0,
                          padding: "4px 8px", fontSize: "10px",
                        }}>
                          <span style={{ color: "#888", fontStyle: "italic" }}>{l}: </span>
                          <span style={{ fontWeight: "bold" }}>{v}</span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </>
        );
      case L["dark-modern"]:
        return (
          <>
            <tr>
              <td style={{ width: "25%", borderLeft: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top", background: "#2d2d2d" }}>
                <div style={{ padding: t.compact ? "8px 8px" : "12px 10px" }}>
                  <div style={{ fontSize: t.compact ? "12px" : "15px", fontWeight: "bold", color: "#ffffff", marginBottom: "2px" }}>
                    {business?.businessName || "Business Name"}
                  </div>
                  <div style={{ fontSize: "8px", color: "#bbb", lineHeight: "1.4" }}>
                    {business?.addressLine1 || ""}{business?.addressLine2 ? ", " + business.addressLine2 : ""}
                  </div>
                  <div style={{ fontSize: "8px", color: "#bbb", lineHeight: "1.4" }}>
                    {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                  </div>
                  <div style={{ fontSize: "8px", color: "#bbb", lineHeight: "1.4", marginTop: "3px" }}>
                    {business?.phone || ""}{business?.gstIn ? ` | GST: ${business.gstIn}` : ""}
                  </div>
                </div>
              </td>
              <td style={{ width: "75%", borderRight: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top" }}>
                <table style={tStyle}>
                  <tbody>
                    <tr>
                      <td style={{ borderBottom: S.border, padding: t.compact ? "6px 8px" : "8px 12px", verticalAlign: "top" }}>
                        <div style={{ fontSize: "9px", fontWeight: "bold", color: "#999", marginBottom: "2px", textTransform: "uppercase" }}>Bill To</div>
                        <div style={{ fontSize: t.compact ? "13px" : "16px", fontWeight: "bold", color: "#222" }}>
                          {customer?.name || "Customer Name"}
                        </div>
                        {customer?.billingAddress ? <div style={{ fontSize: "9px", color: "#666" }}>{customer.billingAddress}</div> : null}
                        {customer?.gstIn ? <div style={{ fontSize: "9px", color: "#666" }}>GST: {customer.gstIn}</div> : null}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: t.compact ? "4px 8px" : "6px 12px", verticalAlign: "top" }}>
                        <div style={{ fontSize: "9px", fontWeight: "bold", color: "#999", marginBottom: "3px", textTransform: "uppercase" }}>Invoice Details</div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            {[
                              [pl("Invoice No."), displayInvNo, "Date", form?.invoiceDate || "-"],
                              [pl("Due Date"), form?.dueDate || "-", "PO No.", form?.buyerOrderNumber || "-"],
                              ["Terms", form?.paymentTerms || "-", "Ref.", form?.referenceNumber || "-"],
                            ].map((row, ri) => (
                              <tr key={ri}>
                                {[0, 2].map((ci) => (
                                  <td key={ci} style={{
                                    width: "25%", padding: "2px 4px", fontSize: "9px", color: "#666",
                                    borderRight: ci === 0 ? S.border : 0,
                                  }}>{row[ci]}</td>
                                ))}
                                {[1, 3].map((ci) => (
                                  <td key={ci} style={{
                                    width: "25%", padding: "2px 4px", fontSize: "9px", fontWeight: "bold",
                                    borderRight: ci === 1 ? S.border : 0,
                                  }}>{row[ci]}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </>
        );
      default:
        return (
          <>
            <tr>
              <td style={{ width: "57%", borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top" }}>
                <table style={tStyle}>
                  <tbody>
                    <tr>
                      <td style={{ padding: t.compact ? "6px 6px 4px 8px" : "10px 8px 6px 12px", border: 0, verticalAlign: "top" }}>
                        {sellerBlock}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ borderTop: S.border, padding: "8px 12px", verticalAlign: "top" }}>
                        {buyerBlock}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style={{ width: "43%", borderRight: S.border, borderBottom: S.border, padding: 0, verticalAlign: "top" }}>
                {metadataBlock(false)}
              </td>
            </tr>
          </>
        );
    }
  };

  return (
    <div ref={ref} style={{
      width: `${TABLE_W + 2}px`,
      margin: "0 auto",
      background: t.bodyBg,
      fontFamily: t.font,
      color: "#000",
      fontSize: baseFS,
      lineHeight: "1.35",
      boxSizing: "border-box",
    }}>
      <table style={tStyle}>
        <tbody>
          {titleRow()}
          {renderTop()}

          {/* ITEM TABLE */}
          <tr>
            <td colSpan={2} style={{ padding: "0", borderTop: S.border, borderLeft: S.border, borderRight: S.border }}>
              <table style={tStyleSep}>
                <thead>
                  <tr style={{ height: t.compact ? "28px" : "32px" }}>
                    {ITEM_COLS.map((col, idx) => (
                      <th key={idx} style={{
                        ...cell(col.w),
                        borderRight: idx < ITEM_COLS.length - 1 ? S.border : "none",
                        borderBottom: S.border,
                        textAlign: "center",
                        fontSize: baseFS,
                        fontWeight: "bold",
                        padding: basePadH,
                        verticalAlign: "middle",
                        background: t.tableHeaderBg,
                        color: t.tableHeaderText,
                        lineHeight: "1.5",
                        whiteSpace: "normal",
                      }}>
                        {idx === 5 ? "Rate (Incl. of Tax)" : col.key === "sl" ? "Sl No" : col.key === "desc" ? "Description of Goods" : col.key === "hsn" ? "HSN/SAC" : col.key === "gst" ? "GST Rate" : col.key === "qty" ? "Quantity" : col.key === "per" ? "per" : "Amount"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validItems.length > 0 ? validItems.map((item, idx) => {
                    const itemTaxable = (parseFloat(item.taxableValue) || 0) * discRatio;
                    const itemGst = parseFloat(item.gstPercentage) || 0;
                    const itemTax = (itemTaxable * itemGst) / 100;
                    const itemTotal = itemTaxable + itemTax;
                    return (
                    <tr id={`section-item-row-${idx}`} key={idx} style={{ height: t.tableRowHeight }}>
                      {[
                        { a: "center", v: idx + 1, w: 52 },
                        { a: "left", v: item.itemName, w: 262 },
                        { a: "center", v: item.hsn || "-", w: 76 },
                        { a: "center", v: (parseFloat(item.gstPercentage) || 0).toFixed(1) + "%", w: 62 },
                        { a: "center", v: parseFloat(item.qty).toFixed(2), w: 72 },
                        { a: "center", v: formatINR(item.rate), w: 76 },
                        { a: "center", v: "Piece", w: 42 },
                        { a: "right", v: formatINR(itemTotal), w: 72 },
                      ].map((c, ci) => (
                        <td key={ci} style={{
                          ...cell(c.w),
                          borderRight: ci < ITEM_COLS.length - 1 ? S.border : "none",
                          borderBottom: S.border,
                          textAlign: c.a,
                          fontSize: baseFS,
                          padding: basePad,
                          verticalAlign: "middle",
                          background: t.labelStyle === "uppercase-light" && idx % 2 === 1 ? "#f8fafc" : "transparent",
                        }}>
                          {c.v}
                        </td>
                      ))}
                    </tr>
                    ); }) : (
                    <tr>
                      <td colSpan={8} style={{ borderTop: S.border, borderLeft: S.border, borderBottom: S.border, textAlign: "center", padding: "8px", fontSize: baseFS }}>No items</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </td>
          </tr>

          {isProforma ? (
            <>
          {/* PROFORMA ESTIMATED TOTALS */}
          <tr id="section-subtotals">
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", padding: "4px 10px", border: 0 }}>
                      {totals.taxAmount > 0 ? (
                        <>
                          <div style={{ fontSize: baseFS, marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px", color: t.primary, fontWeight: "bold" }}>CGST (Estimated)</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(cgstTotal)}</span>
                          </div>
                          <div style={{ fontSize: baseFS, marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px", color: t.primary, fontWeight: "bold" }}>SGST (Estimated)</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(sgstTotal)}</span>
                          </div>
                        </>
                      ) : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* PROFORMA AMOUNT IN WORDS + TOTAL */}
          <tr id="section-amount-words">
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "72%", borderRight: S.border, padding: basePadH, verticalAlign: "top" }}>
                      <div style={{ fontSize: baseFS, fontWeight: "bold", marginBottom: "3px", color: t.primary }}>
                        Estimated Amount (in words)
                      </div>
                      <div style={{ fontSize: t.compact ? "10px" : "11px", fontWeight: "bold" }}>
                        {(totals.grandTotal - discAmt) > 0 ? numberToWords(totals.grandTotal - discAmt) : "Zero Rupees Only"}
                      </div>
                    </td>
                    <td style={{ width: "28%", padding: basePadH, verticalAlign: "top" }}>
                      {discAmt > 0 && (
                        <div style={{ fontSize: "9px", fontWeight: "bold", textAlign: "left", color: "#16a34a", marginBottom: "2px" }}>
                          Discount ({discPct}%): -Rs. {formatINR(discAmt)}
                        </div>
                      )}
                      <div style={{ fontSize: baseFS, fontWeight: "bold", marginBottom: "2px", textAlign: "left", color: t.primary }}>
                        Estimated Total
                      </div>
                      <div style={{ fontSize: t.compact ? "15px" : "18px", fontWeight: "bold", margin: "2px 0", textAlign: "left", color: t.accentBg !== "#ffffff" ? t.accentBg : "#000" }}>
                        Rs: {formatINR(totals.grandTotal - discAmt)}
                      </div>
                      <div style={{ fontSize: baseFS, fontStyle: "italic", textAlign: "right" }}>
                        E. & O.E
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
            </>
          ) : (
            <>
          {/* GST SUMMARY */}
          <tr id="section-subtotals">
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", padding: "4px 10px", border: 0 }}>
                      {totals.taxAmount > 0 ? (
                        <>
                          <div style={{ fontSize: baseFS, marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px", color: t.primary, fontWeight: "bold" }}>CGST</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(cgstTotal)}</span>
                          </div>
                          <div style={{ fontSize: baseFS, marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px", color: t.primary, fontWeight: "bold" }}>SGST</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(sgstTotal)}</span>
                          </div>
                        </>
                      ) : null}
                      <div style={{ fontSize: baseFS }}>
                        <span style={{ marginRight: "16px" }}>Round Off</span>
                        <span style={{ fontWeight: "bold" }}>0.00</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* AMOUNT IN WORDS + TOTAL */}
          <tr id="section-amount-words">
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "72%", borderRight: S.border, padding: basePadH, verticalAlign: "top" }}>
                      <div style={{ fontSize: baseFS, fontWeight: "bold", marginBottom: "3px", color: t.primary }}>
                        Amount Chargeable (in words)
                      </div>
                      <div style={{ fontSize: t.compact ? "10px" : "11px", fontWeight: "bold" }}>
                        {(totals.grandTotal - discAmt) > 0 ? numberToWords(totals.grandTotal - discAmt) : "Zero Rupees Only"}
                      </div>
                    </td>
                    <td style={{ width: "28%", padding: basePadH, verticalAlign: "top" }}>
                      {discAmt > 0 && (
                        <div style={{ fontSize: "9px", fontWeight: "bold", textAlign: "left", color: "#16a34a", marginBottom: "2px" }}>
                          Discount ({discPct}%): -Rs. {formatINR(discAmt)}
                        </div>
                      )}
                      <div style={{ fontSize: baseFS, fontWeight: "bold", marginBottom: "2px", textAlign: "left", color: t.primary }}>
                        Total
                      </div>
                      <div style={{ fontSize: t.compact ? "15px" : "18px", fontWeight: "bold", margin: "2px 0", textAlign: "left", color: t.accentBg !== "#ffffff" ? t.accentBg : "#000" }}>
                        Rs: {formatINR(totals.grandTotal - discAmt)}
                      </div>
                      <div style={{ fontSize: baseFS, fontStyle: "italic", textAlign: "right" }}>
                        E. & O.E
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* TAX BREAKUP TABLE */}
          <tr>
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
              <table style={tStyleSep}>
                <thead id="section-hsn-header">
                  <tr style={{ height: t.compact ? "24px" : "28px" }}>
                    <th rowSpan={2} style={{ width: "16%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePadH, verticalAlign: "middle", background: t.tableHeaderBg, color: t.tableHeaderText, lineHeight: "1.5" }}>HSN/SAC</th>
                    <th rowSpan={2} style={{ width: "18%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePadH, verticalAlign: "middle", background: t.tableHeaderBg, color: t.tableHeaderText, lineHeight: "1.5" }}>Taxable Value</th>
                    <th colSpan={2} style={{ width: "24%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePadH, verticalAlign: "middle", background: t.tableHeaderBg, color: t.tableHeaderText, lineHeight: "1.5" }}>CGST</th>
                    <th colSpan={2} style={{ width: "28%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePadH, verticalAlign: "middle", background: t.tableHeaderBg, color: t.tableHeaderText, lineHeight: "1.5" }}>SGST/UTGST</th>
                    <th rowSpan={2} style={{ width: "14%", borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePadH, verticalAlign: "middle", background: t.tableHeaderBg, color: t.tableHeaderText, lineHeight: "1.5" }}>Total Tax Amount</th>
                  </tr>
                  <tr style={{ height: t.compact ? "24px" : "28px" }}>
                    <td style={{ width: "12%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, background: t.tableHeaderBg, color: t.tableHeaderText, lineHeight: "1.5" }}>Rate</td>
                    <td style={{ width: "12%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, background: t.tableHeaderBg, color: t.tableHeaderText, lineHeight: "1.5" }}>Amount</td>
                    <td style={{ width: "14%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, background: t.tableHeaderBg, color: t.tableHeaderText, lineHeight: "1.5" }}>Rate</td>
                    <td style={{ width: "14%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, background: t.tableHeaderBg, color: t.tableHeaderText, lineHeight: "1.5" }}>Amount</td>
                  </tr>
                </thead>
                <tbody>
                  {validItems.map((item, idx) => {
                    const gst = parseFloat(item.gstPercentage) || 0;
                    const halfGst = gst / 2;
                    const taxable = (parseFloat(item.taxableValue) || 0) * discRatio;
                    const taxAmt = (taxable * gst) / 100;
                    return (
                      <tr id={`section-hsn-row-${idx}`} key={idx} style={{ height: t.compact ? "22px" : "26px" }}>
                        <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, lineHeight: "1.5" }}>{item.hsn || "-"}</td>
                        <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: baseFS, padding: basePad, lineHeight: "1.5" }}>{formatINR(taxable)}</td>
                        <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, lineHeight: "1.5" }}>{halfGst.toFixed(1)}%</td>
                        <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: baseFS, padding: basePad, lineHeight: "1.5" }}>{formatINR(taxAmt / 2)}</td>
                        <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, lineHeight: "1.5" }}>{halfGst.toFixed(1)}%</td>
                        <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: baseFS, padding: basePad, lineHeight: "1.5" }}>{formatINR(taxAmt / 2)}</td>
                        <td style={{ borderBottom: S.border, textAlign: "right", fontSize: baseFS, padding: basePad, lineHeight: "1.5", fontWeight: "bold" }}>{formatINR(taxAmt)}</td>
                      </tr>
                    );
                  })}
                  <tr id="section-hsn-total" style={{ height: t.compact ? "22px" : "26px" }}>
                    <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, lineHeight: "1.5", fontWeight: "bold", background: t.tableHeaderBg, color: t.tableHeaderText }}>Total</td>
                    <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: baseFS, padding: basePad, lineHeight: "1.5", fontWeight: "bold", background: t.tableHeaderBg, color: t.tableHeaderText }}>{formatINR(totals.subtotal)}</td>
                    <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, lineHeight: "1.5", background: t.tableHeaderBg, color: t.tableHeaderText }}></td>
                    <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: baseFS, padding: basePad, lineHeight: "1.5", fontWeight: "bold", background: t.tableHeaderBg, color: t.tableHeaderText }}>{formatINR(totals.taxAmount / 2)}</td>
                    <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: baseFS, padding: basePad, lineHeight: "1.5", background: t.tableHeaderBg, color: t.tableHeaderText }}></td>
                    <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: baseFS, padding: basePad, lineHeight: "1.5", fontWeight: "bold", background: t.tableHeaderBg, color: t.tableHeaderText }}>{formatINR(totals.taxAmount / 2)}</td>
                    <td style={{ borderBottom: S.border, textAlign: "right", fontSize: baseFS, padding: basePad, lineHeight: "1.5", fontWeight: "bold", background: t.tableHeaderBg, color: t.tableHeaderText }}>{formatINR(totals.taxAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* TAX AMOUNT WORDS */}
          <tr id="section-hsn-words">
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: "5px 10px" }}>
              <span style={{ fontSize: baseFS, fontWeight: "bold", color: t.primary }}>Tax Amount (in words): </span>
              <span style={{ fontSize: baseFS, fontWeight: "bold" }}>
                {totals.taxAmount > 0 ? numberToWords(totals.taxAmount) : "Nil"}
              </span>
            </td>
          </tr>

          </>
          )}

          {/* BOTTOM SECTION */}
          <tr id="section-footer">
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr style={{ height: t.compact ? "120px" : "140px" }}>
                    <td style={{ width: "37%", borderRight: S.border, padding: t.compact ? "6px 6px 16px 6px" : "8px 8px 24px 8px", verticalAlign: "top" }}>
                      <div style={{
                        fontSize: "11px", fontWeight: "bold",
                        borderBottom: t.borderStyle === "double" ? `3px double ${t.borderColor}` : S.border,
                        paddingBottom: t.compact ? "6px" : "8px",
                        marginBottom: "6px",
                        color: t.primary,
                      }}>
                        Company's Bank Details
                      </div>
                      <div style={{ fontSize: baseFS, lineHeight: "1.5" }}>Bank Name: {business?.bankName || "-"}</div>
                      <div style={{ fontSize: baseFS, lineHeight: "1.5" }}>A/c No: {business?.accountNo || "-"}</div>
                      <div style={{ fontSize: baseFS, lineHeight: "1.5" }}>Branch: {business?.branch || "-"}</div>
                      <div style={{ fontSize: baseFS, lineHeight: "1.5" }}>IFSC: {business?.ifsc || "-"}</div>
                      <div style={{ fontSize: baseFS, lineHeight: "1.5" }}>Address: {business?.bankAddress || "-"}</div>
                    </td>
                    <td style={{ width: "33%", borderRight: S.border, padding: t.compact ? "6px 6px 16px 6px" : "8px 8px 24px 8px", verticalAlign: "top" }}>
                      <div style={{
                        fontSize: "11px", fontWeight: "bold",
                        borderBottom: t.borderStyle === "double" ? `3px double ${t.borderColor}` : S.border,
                        paddingBottom: t.compact ? "6px" : "8px",
                        marginBottom: "6px",
                        color: t.primary,
                      }}>
                        Declaration
                      </div>
                      <div style={{ fontSize: baseFS, lineHeight: "1.4" }}>
                        {isProforma
                          ? "We declare that this Proforma Invoice is issued for quotation purposes only. It is not a demand for payment and not valid for GST input tax credit claims."
                          : "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."}
                      </div>
                      {isProforma && (
                        <div style={{ fontSize: "9px", marginTop: "8px", fontStyle: "italic", color: "#666" }}>
                          This is a Proforma Invoice — not a demand for payment and not valid for GST input tax credit claims.
                        </div>
                      )}
                    </td>
                    <td style={{ width: "30%", padding: t.compact ? "6px 6px 16px 6px" : "8px 8px 24px 8px", verticalAlign: "top" }}>
                      <div style={{
                        fontSize: "11px", fontWeight: "bold",
                        borderBottom: t.borderStyle === "double" ? `3px double ${t.borderColor}` : S.border,
                        paddingBottom: t.compact ? "6px" : "8px",
                        marginBottom: "6px",
                        color: t.primary,
                      }}>
                        {business?.businessName || "Company Name"}
                      </div>
                      <div style={{ marginTop: "10px", textAlign: "center" }}>
                        {sigSrc ? <img src={sigSrc} alt="signature" style={{ height: "50px", objectFit: "contain", display: "block", margin: "0 auto" }} /> : null}
                        <div style={{ fontSize: baseFS, marginTop: "4px" }}>Authorised Signatory</div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* FOOTER */}
          <tr id="section-bottom-note">
            <td colSpan={2} style={{ padding: "6px 10px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "center", padding: 0 }}>
                      <div style={{ fontSize: baseFS, fontWeight: "bold" }}>SUBJECT TO BENGALURU JURISDICTION</div>
                      <div style={{ fontSize: baseFS, marginTop: "1px" }}>{isProforma ? "This is a Computer Generated Proforma Invoice" : "This is a Computer Generated Invoice"}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: "right", padding: 0, paddingTop: "10px" }}>
                      {sealVisible && sealType === "round" && (
                        <div style={{ display: "inline-block" }}>
                          <CompanySeal
                            companyName={business?.businessName || "COMPANY NAME"}
                            year={new Date().getFullYear()}
                            size={80}
                            color="#0A4BFF"
                          />
                        </div>
                      )}
                      {sealVisible && sealType === "stamp" && (
                        <div style={{ display: "inline-block" }}>
                          <CompanyStamp
                            companyName={business?.businessName || "COMPANY NAME"}
                            addressLine1={stampAddress1}
                            addressLine2={stampAddress2}
                            phone={stampPhone}
                            email={stampEmail}
                            width={240}
                            color="#0000cc"
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}));

InvoiceTemplateVariants.displayName = "InvoiceTemplateVariants";
export { TEMPLATE_THEMES };
export default InvoiceTemplateVariants;
