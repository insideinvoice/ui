import React, { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import SealOverlay from "./SealOverlay";
import InvoiceTermsRow from "./InvoiceTermsRow";
import { resolveSeal } from "../utils/seal";
import { sealSpecAttribute } from "../utils/sealConfig";
import { asImageSrc } from "../utils/imageSrc";
import { getSpecialistInLine } from "../utils/specialistIn";
import { computeInvoiceTotals } from "../utils/invoiceTotals";
import { mobileLine } from "../utils/phoneDisplay";
import { numberToWords, formatINR } from "../utils/invoiceFormat";
import { jurisdictionLine, formatJurisdiction, shouldShowJurisdiction } from "../utils/jurisdiction";
import { getIndustryConfig, getTemplateRightRows, fieldLabel } from "../constants/industryConfig";
import { stateWithCode } from "../constants/indianStates";
import { uqcFor } from "../constants/units";

const S = {
  border: "1px solid #000",
};

// Document titles (Rule 46: each document type is a DISTINCT title).
const TITLE_BY_TYPE = {
  TAX_INVOICE: "Tax Invoice",
  PROFORMA_INVOICE: "PROFORMA INVOICE",
  BILL_OF_SUPPLY: "BILL OF SUPPLY",
  CREDIT_NOTE: "CREDIT NOTE",
  DEBIT_NOTE: "DEBIT NOTE",
};

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
  borderCollapse: "separate",
  borderSpacing: 0,
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

const InvoicePDF = React.memo(React.forwardRef(({ business, customer, form, items, discountPercent, type, invoiceNumber, taxMode }, ref) => {
  const displayInvNo = invoiceNumber || "DRAFT";
  const isProforma = type === "PROFORMA_INVOICE";
  const validItems = (items || []).filter((i) => i.itemName?.trim() && parseFloat(i.qty) > 0);
  const sigSrc = asImageSrc(business?.signature);
  const calc = computeInvoiceTotals(items, discountPercent, taxMode, form?.cessPercent);
  // IGST (inter-state) replaces the CGST/SGST pair everywhere below — the two
  // structures never render together for the same taxable line.
  const igstMode = taxMode === "IGST";
  const discPct = calc.discountPercent;
  const discAmt = calc.discountAmount;
  const taxableAmount = calc.taxableAmount;
  const discRatio = calc.ratio;
  const cgstTotal = calc.cgst;
  const sgstTotal = calc.sgst;
  const calcTaxAmount = calc.taxAmount;
  const finalTotal = calc.grandTotal;

  const industryConfig = getIndustryConfig(business?.industry);
  // Display-only HSN/SAC switch. Undefined/null (legacy business, or a client
  // that hasn't refreshed) keeps the column on, so nothing changes visually
  // until a business explicitly opts out.
  const showHnSac = business?.showHnSac !== false;
  // When HSN is hidden the freed 76px is folded into the description column, so
  // the outer table width (TABLE_W) and every template's page fit are unchanged.
  const itemCols = useMemo(
    () => (showHnSac ? ITEM_COLS : ITEM_COLS.map((c) => (c.key === "hsn" ? null : c.key === "desc" ? { ...c, w: c.w + 76 } : c)).filter(Boolean)),
    [showHnSac],
  );
  const rightRowsRaw = getTemplateRightRows(industryConfig, form, displayInvNo, isProforma);
  // The right meta column is a fixed part of the classic GST layout (13 ruled
  // rows). Service industries (telecom, healthcare, education, professional
  // services) and construction hide the dispatch/delivery rows, so the column
  // rendered only 7 rows and simply ended after "Dated" — leaving the lower
  // half of the cell unruled and the frame looking cut off. Pad the column
  // with empty rows so every horizontal line and the label/value divider run
  // all the way down to the section separator.
  const RIGHT_ROW_LAYOUT_ROWS = 13;
  const rightRows = rightRowsRaw.length >= RIGHT_ROW_LAYOUT_ROWS
    ? rightRowsRaw
    : [
        ...rightRowsRaw,
        ...Array.from({ length: RIGHT_ROW_LAYOUT_ROWS - rightRowsRaw.length }, (_, i) => ({
          key: `filler-${i}`,
          label: "-",
          value: "-",
        })),
      ];
  const itemDescLabel = fieldLabel(industryConfig, "itemName", "Description of Goods");

  const { sealVisible, sealType } = resolveSeal(business);
  // Configurable jurisdiction line (V31): text comes from the business's
  // persisted configuration. A profile that never saved an explicit
  // jurisdiction city falls back to its own city, so a Bengaluru business
  // still prints "SUBJECT TO BENGALURU JURISDICTION" instead of nothing.
  // Never a hardcoded city — the Settings toggle still switches it off.
  const jurLine =
    jurisdictionLine(business) ||
    (shouldShowJurisdiction(business) ? formatJurisdiction(business?.city) : "");

  return (
    <div
      ref={ref}
      data-ii-seal-spec={sealSpecAttribute(business)}
      style={{
      width: `${TABLE_W + 2}px`,
      margin: "0 auto",
      background: "#fff",
      fontFamily: "Arial, Helvetica, sans-serif",
      color: "#000",
      fontSize: "10px",
      lineHeight: "1.35",
      boxSizing: "border-box",
      position: "relative",
    }}>
      <table style={tStyle}>
        <tbody>
          {/* TITLE ROW */}
          <tr>
            <td colSpan={2} style={{ borderBottom: S.border, padding: 0 }}>
              <div style={{ position: "relative", textAlign: "center", fontSize: "14px", fontWeight: "bold", padding: "6px 10px" }}>
                {TITLE_BY_TYPE[type] || "Tax Invoice"}
                {isProforma ? (
                  <div style={{ fontSize: "9px", fontWeight: "normal", fontStyle: "italic" }}>
                    — NOT A TAX INVOICE —
                  </div>
                ) : (
                  (type || "TAX_INVOICE") === "TAX_INVOICE" && (
                  <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", fontStyle: "italic", fontWeight: "normal" }}>
                    (ORIGINAL FOR RECIPIENT)
                  </span>
                  )
                )}
              </div>
            </td>
          </tr>

          {/* TOP SECTION */}
          <tr>
            <td style={{ width: "57%", borderLeft: S.border, borderRight: S.border, padding: 0, verticalAlign: "top" }}>
              <table style={tStyle}>
                <tbody>
                  <tr>
                    <td style={{ padding: "10px 8px 6px 12px", border: 0, verticalAlign: "top" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ minWidth: 0, flex: "1 1 0" }}>
                      <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>
                        {business?.businessName || "Business Name"}
                      </div>
                      <div style={{ fontSize: "10px", lineHeight: "1.45" }}>
                        {business?.addressLine1 || ""}{business?.addressLine2 ? ", " + business.addressLine2 : ""}
                      </div>
                      <div style={{ fontSize: "10px", lineHeight: "1.45" }}>
                        {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                      </div>
                      {getSpecialistInLine(business) ? (
                        <div style={{ fontSize: "10px", lineHeight: "1.45" }}>SPECIALIST IN : {getSpecialistInLine(business)}</div>
                      ) : null}
                      {mobileLine(business) ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>{mobileLine(business)}</div> : null}
                      {business?.email ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>{business.email}</div> : null}
                      {business?.gstIn ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>GSTIN/UIN: {business.gstIn}</div> : null}
                      {business?.state ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>State: {business.state} Code: {business.gstIn?.substring(0, 2) || ""}</div> : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ borderTop: S.border, padding: "8px 12px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>
                        Buyer (Bill to)
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "3px" }}>
                        {customer?.name || "Customer Name"}
                      </div>
                      {customer?.billingAddress ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>{customer.billingAddress}</div> : null}
                      {customer?.phone ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>Ph: {customer.phone}</div> : null}
                      {customer?.email ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>{customer.email}</div> : null}
                      {customer?.gstIn ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>GSTIN/UIN: {customer.gstIn}</div> : null}
                      {customer?.state ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>State: {stateWithCode(customer.state)}</div> : null}
                      {form?.placeOfSupply ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>Place of Supply: {stateWithCode(form.placeOfSupply)}</div> : null}
                      {form?.shippingAddress ? (
                        <div style={{ marginTop: "3px", fontSize: "10px", lineHeight: "1.45" }}>
                          <span style={{ fontWeight: "bold" }}>Ship To: </span>{form.shippingAddress}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td style={{ width: "43%", borderRight: S.border, padding: 0, verticalAlign: "top" }}>
              <table style={tStyle}>
                <tbody>
                  {rightRows.map((row, idx) => (
                    <tr key={row.key} style={{ height: "25px" }}>
                      <td style={{
                        width: "52%",
                        borderBottom: idx < rightRows.length - 1 ? S.border : 0,
                        borderRight: S.border,
                        padding: "5px 6px",
                        fontSize: "10px",
                        verticalAlign: "middle",
                      }}>
                        {row.label}
                      </td>
                      <td style={{
                        width: "48%",
                        borderBottom: idx < rightRows.length - 1 ? S.border : 0,
                        padding: "5px 6px",
                        fontSize: "10px",
                        fontWeight: "bold",
                        verticalAlign: "middle",
                      }}>
                        {row.value || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>

          {/* ITEM TABLE */}
          <tr>
            <td colSpan={2} style={{ padding: "0", borderTop: S.border, borderLeft: S.border, borderRight: S.border }}>
              <table style={tStyleSep}>
                <thead>
                   <tr style={{ height: "32px" }}>
                     {itemCols.map((col, idx) => (
                        <th key={col.key} style={{
                          ...cell(col.w),
                          borderRight: idx < itemCols.length - 1 ? S.border : "none",
                          borderBottom: S.border,
                          textAlign: "center",
                          fontSize: "10px",
                          padding: "6px 6px 7px 6px",
                          verticalAlign: "middle",
                          background: "#f0f0f0",
                          lineHeight: "1.5",
                          whiteSpace: "normal",
                        }}>
                          {col.key === "rate" ? "Rate (Incl. of Tax)" : col.key === "sl" ? "Sl No" : col.key === "desc" ? itemDescLabel : col.key === "hsn" ? "HSN/SAC" : col.key === "gst" ? "GST Rate" : col.key === "qty" ? "Quantity" : col.key === "per" ? "per" : "Amount"}
                       </th>
                     ))}
                   </tr>
                </thead>
                <tbody>
                  {validItems.length > 0 ? validItems.map((item, idx) => {
                    const iTaxable = (parseFloat(item.taxableValue) || 0) * discRatio;
                    const iGst = parseFloat(item.gstPercentage) || 0;
                    const iTax = (iTaxable * iGst) / 100;
                    const iTotal = iTaxable + iTax;
                    // Legacy items with no unit render "Piece" — exactly what every
                    // template has always printed in the per column.
                    const cells = [
                      { key: "sl", a: "center", v: idx + 1, w: 52 },
                      { key: "desc", a: "left", v: item.itemName, w: showHnSac ? 262 : 338 },
                      ...(showHnSac ? [{ key: "hsn", a: "center", v: item.hsn || "-", w: 76 }] : []),
                      { key: "gst", a: "center", v: (parseFloat(item.gstPercentage) || 0).toFixed(1) + "%", w: 62 },
                      { key: "qty", a: "center", v: parseFloat(item.qty) || "", w: 72 },
                      { key: "rate", a: "center", v: formatINR(item.rate), w: 76 },
                      { key: "per", a: "center", v: uqcFor(item.unit || "Piece"), w: 42 },
                      { key: "amt", a: "right", v: formatINR(iTotal), w: 72 },
                    ];
                    return (
                    <tr id={`section-item-row-${idx}`} key={idx} style={{ height: "28px" }}>
                       {cells.map((c, ci) => (
                          <td key={c.key} style={{
                            ...cell(c.w),
                            borderRight: ci < cells.length - 1 ? S.border : "none",
                            borderBottom: S.border,
                            textAlign: c.a,
                            fontSize: "10px",
                            padding: "5px 6px",
                            verticalAlign: "middle",
                          }}>
                            {c.v}
                          </td>
                        ))}
                      </tr>
                     ); }) : (
           <tr>
                        <td colSpan={itemCols.length} style={{ borderBottom: S.border, textAlign: "center", padding: "8px", fontSize: "10px" }}>No items</td>
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
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", padding: "4px 10px", border: 0 }}>
                      {calcTaxAmount > 0 ? (
                        igstMode ? (
                          <div style={{ fontSize: "10px", marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px" }}>IGST (Estimated)</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(calc.igst)}</span>
                          </div>
                        ) : (
                        <>
                          <div style={{ fontSize: "10px", marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px" }}>CGST (Estimated)</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(cgstTotal)}</span>
                          </div>
                          <div style={{ fontSize: "10px", marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px" }}>SGST (Estimated)</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(sgstTotal)}</span>
                          </div>
                        </>
                        )
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
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ width: "72%", borderRight: S.border, padding: "6px 10px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>Estimated Amount (in words)</div>
                      <div style={{ fontSize: "11px", fontWeight: "bold" }}>
                        {(finalTotal) > 0 ? numberToWords(finalTotal) : "Zero Rupees Only"}
                      </div>
                    </td>
                    <td style={{ width: "28%", padding: "6px 10px", verticalAlign: "top" }}>
                      {discAmt > 0 && (
                        <div style={{ fontSize: "9px", fontWeight: "bold", textAlign: "left", color: "#16a34a", marginBottom: "2px" }}>
                          Discount ({discPct}%): -Rs. {formatINR(discAmt)}
                        </div>
                      )}
                      <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "2px", textAlign: "left" }}>
                        Estimated Total
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: "bold", margin: "2px 0", textAlign: "left" }}>
                        Rs: {formatINR(finalTotal)}
                      </div>
                      <div style={{ fontSize: "10px", fontStyle: "italic", textAlign: "right" }}>
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
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", padding: "4px 10px", border: 0 }}>
                      {calcTaxAmount > 0 ? (
                        igstMode ? (
                          <div style={{ fontSize: "10px", marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px" }}>IGST</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(calc.igst)}</span>
                          </div>
                        ) : (
                        <>
                          <div style={{ fontSize: "10px", marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px" }}>CGST</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(cgstTotal)}</span>
                          </div>
                          <div style={{ fontSize: "10px", marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px" }}>SGST</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(sgstTotal)}</span>
                          </div>
                        </>
                        )
                      ) : null}
                      {calc.cessAmount > 0 && (
                        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
                          <span style={{ marginRight: "16px" }}>Cess ({calc.cessPercent}%)</span>
                          <span style={{ fontWeight: "bold" }}>{formatINR(calc.cessAmount)}</span>
                        </div>
                      )}
                      <div style={{ fontSize: "10px" }}>
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
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ width: "72%", borderRight: S.border, padding: "6px 10px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>Amount Chargeable (in words)</div>
                      <div style={{ fontSize: "11px", fontWeight: "bold" }}>
                        {(finalTotal) > 0 ? numberToWords(finalTotal) : "Zero Rupees Only"}
                      </div>
                    </td>
                    <td style={{ width: "28%", padding: "6px 10px", verticalAlign: "top" }}>
                      {discAmt > 0 && (
                        <div style={{ fontSize: "9px", fontWeight: "bold", textAlign: "left", color: "#16a34a", marginBottom: "2px" }}>
                          Discount ({discPct}%): -Rs. {formatINR(discAmt)}
                        </div>
                      )}
                      <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "2px", textAlign: "left" }}>
                        Total
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: "bold", margin: "2px 0", textAlign: "left" }}>
                        Rs: {formatINR(finalTotal)}
                      </div>
                      <div style={{ fontSize: "10px", fontStyle: "italic", textAlign: "right" }}>
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
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, padding: 0 }}>
              <table style={tStyleSep}>
                <thead id="section-hsn-header">
                  {igstMode ? (
                    // Inter-state: one IGST rate/amount pair — the freed width
                    // folds into those two columns so the table still spans
                    // the full invoice width (no empty CGST/SGST columns).
                    <tr style={{ height: "28px" }}>
                      {showHnSac && (
                      <th style={{ width: "16%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>HSN/SAC</th>
                      )}
                      <th style={{ width: showHnSac ? "18%" : "34%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>Taxable Value</th>
                      <th style={{ width: "26%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>IGST Rate</th>
                      <th style={{ width: "26%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>IGST Amount</th>
                      <th style={{ width: "14%", borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>Total Tax Amount</th>
                    </tr>
                  ) : (
                    <>
                   <tr style={{ height: "28px" }}>
                     {showHnSac && (
                     <th rowSpan={2} style={{ width: "16%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>HSN/SAC</th>
                     )}
                     <th rowSpan={2} style={{ width: showHnSac ? "18%" : "34%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>Taxable Value</th>
                    <th colSpan={2} style={{ width: "24%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>CGST</th>
                     <th colSpan={2} style={{ width: "28%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>SGST/UTGST</th>
                     <th rowSpan={2} style={{ width: "14%", borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>Total Tax Amount</th>
                    </tr>
                    <tr style={{ height: "28px" }}>
                      <td style={{ width: "12%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>Rate</td>
                      <td style={{ width: "12%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>Amount</td>
                      <td style={{ width: "14%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>Rate</td>
                      <td style={{ width: "14%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>Amount</td>
                    </tr>
                    </>
                  )}
                  </thead>
                  <tbody>
                     {validItems.map((item, idx) => {
                       const gst = parseFloat(item.gstPercentage) || 0;
                       const halfGst = gst / 2;
                       const taxable = (parseFloat(item.taxableValue) || 0) * discRatio;
                       const taxAmt = (taxable * gst) / 100;
                       return (
                           <tr id={`section-hsn-row-${idx}`} key={idx} style={{ height: "26px" }}>
                             {showHnSac && (
                             <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{item.hsn || "-"}</td>
                             )}
                             <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{formatINR(taxable)}</td>
                             {igstMode ? (
                               <>
                                 <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{gst.toFixed(1)}%</td>
                                 <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{formatINR(taxAmt)}</td>
                               </>
                             ) : (
                               <>
                                 <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{halfGst.toFixed(1)}%</td>
                                 <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{formatINR(taxAmt / 2)}</td>
                                 <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{halfGst.toFixed(1)}%</td>
                                 <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{formatINR(taxAmt / 2)}</td>
                               </>
                             )}
                             <td style={{ borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold" }}>{formatINR(taxAmt)}</td>
                          </tr>
                       );
                     })}
                     <tr id="section-hsn-total" style={{ height: "26px" }}>
                       {showHnSac && (
                       <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "linear-gradient(to right, transparent 1px, #f0f0f0 1px)" }}>Total</td>
                       )}
                       <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "#f0f0f0" }}>{formatINR(taxableAmount)}</td>
                       <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", background: "#f0f0f0" }}></td>
                       {igstMode ? (
                         <>
                           <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "#f0f0f0" }}>{formatINR(calc.igst)}</td>
                           <td style={{ borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "linear-gradient(to left, transparent 1px, #f0f0f0 1px)" }}>{formatINR(calcTaxAmount)}</td>
                         </>
                       ) : (
                         <>
                           <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "#f0f0f0" }}>{formatINR(cgstTotal)}</td>
                           <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", background: "#f0f0f0" }}></td>
                           <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "#f0f0f0" }}>{formatINR(sgstTotal)}</td>
                           <td style={{ borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "linear-gradient(to left, transparent 1px, #f0f0f0 1px)" }}>{formatINR(cgstTotal + sgstTotal)}</td>
                         </>
                       )}
                     </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* TAX AMOUNT WORDS */}
          <tr id="section-hsn-words">
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: "5px 10px" }}>
              <span style={{ fontSize: "10px", fontWeight: "bold" }}>Tax Amount (in words): </span>
              <span style={{ fontSize: "10px", fontWeight: "bold" }}>
                 {calcTaxAmount > 0 ? numberToWords(calcTaxAmount) : "Nil"}
              </span>
            </td>
          </tr>

          </>
          )}

          {/* Terms & Conditions — the business's saved defaults (Settings owns
              them), full width, sitting between the tax-amount-in-words row and
              the bank/declaration/signature band. InvoiceTermsRow draws its own
              bottom rule — that rule IS the divider between this strip and the
              band below; without it the two blocks share an open edge and read
              as one. Collapses away entirely when no terms are saved. */}
          <InvoiceTermsRow business={business} border={S.border} />

          {/* BOTTOM SECTION: Bank + UPI QR | Declaration | Signature */}
          <tr id="section-footer">
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <tbody>
                  <tr style={{ height: "140px" }}>
                    <td style={{ width: "37%", borderRight: S.border, padding: "8px 8px 24px 8px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "11px", fontWeight: "bold", borderBottom: S.border, paddingBottom: "8px", marginBottom: "6px" }}>
                        Company's Bank Details
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "10px", lineHeight: "1.5" }}>Bank Name: {business?.bankName || "-"}</div>
                          <div style={{ fontSize: "10px", lineHeight: "1.5" }}>A/c No: {business?.accountNo || "-"}</div>
                          <div style={{ fontSize: "10px", lineHeight: "1.5" }}>Branch: {business?.branch || "-"}</div>
                          <div style={{ fontSize: "10px", lineHeight: "1.5" }}>IFSC: {business?.ifsc || "-"}</div>
                          <div style={{ fontSize: "10px", lineHeight: "1.5" }}>Address: {business?.bankAddress || "-"}</div>
                        </div>
                        {business?.upiId && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, maxWidth: "90px" }}>
                            <QRCodeSVG value={`upi://pay?pa=${business.upiId}&pn=${encodeURIComponent(business.businessName || "")}&am=${finalTotal.toFixed(2)}&tr=${encodeURIComponent(displayInvNo)}&tn=${encodeURIComponent(`${displayInvNo} ${form?.invoiceDate || ""}`.trim())}&cu=INR`} size={74} style={{ width: "100%", height: "auto", maxWidth: "74px" }} />
                            <div style={{ fontSize: "9px", marginTop: "2px", color: "#555" }}>Scan to Pay</div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ width: "33%", borderRight: S.border, padding: "8px 8px 24px 8px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "11px", fontWeight: "bold", borderBottom: S.border, paddingBottom: "8px", marginBottom: "6px" }}>
                        Declaration
                      </div>
                      <div style={{ fontSize: "10px", lineHeight: "1.4" }}>
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
                      <td style={{ width: "30%", padding: "8px 8px 24px 8px", verticalAlign: "top" }}>
                        <div style={{ fontSize: "11px", fontWeight: "bold", borderBottom: S.border, paddingBottom: "8px", marginBottom: "6px" }}>
                          {business?.businessName || "Company Name"}
                        </div>
                        <div style={{ marginTop: "10px", textAlign: "center" }}>
                          {sigSrc ? <img src={sigSrc} alt="signature" style={{ height: "50px", objectFit: "contain", display: "block", margin: "0 auto" }} /> : null}
                          <div style={{ fontSize: "10px", marginTop: "4px" }}>Authorised Signatory</div>
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
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "center", padding: 0 }}>
                      {jurLine && (
                        <div style={{ fontSize: "10px", fontWeight: "bold" }}>{jurLine}</div>
                      )}
                      <div style={{ fontSize: "10px", marginTop: "1px" }}>{isProforma ? "This is a Computer Generated Proforma Invoice" : "This is a Computer Generated Invoice"}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      {sealVisible && <SealOverlay business={business} type={sealType} />}
    </div>
  );
}));

InvoicePDF.displayName = "InvoicePDF";

export default InvoicePDF;
