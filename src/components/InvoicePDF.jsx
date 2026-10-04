import React from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { QRCodeSVG } from "qrcode.react";
import CompanySeal from "./CompanySeal";
import CompanyStamp from "./CompanyStamp";

const S = {
  border: "1px solid #000",
};

const numberToWords = (num) => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
  };
  const whole = Math.floor(num);
  const decimal = Math.round((num - whole) * 100);
  let result = convert(whole) + " Rupees";
  if (decimal > 0) result += " and " + convert(decimal) + " Paise";
  return result + " Only";
};

const formatINR = (val) => {
  const n = parseFloat(val) || 0;
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

const InvoicePDF = React.memo(React.forwardRef(({ business, customer, form, items, totals, discountPercent, type, invoiceNumber }, ref) => {
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
    : ["Invoice No.", "Delivery Note", "Reference No. & Date.", "Buyer's Order No.",
       "Dispatch Doc No.", "Dispatched through", "Terms of Delivery", "Payment Date",
       "Mode/Terms of Payment", "Other References", "Dated", "Delivery Note Date", "Destination"];
  const rightValues = [
    isProforma ? `PF-${displayInvNo}` : displayInvNo, form?.deliveryNote,
    form?.referenceNumber ? `${form.referenceNumber} / ${form.invoiceDate || ""}` : form?.invoiceDate,
    form?.buyerOrderNumber, form?.dispatchDocNumber, form?.dispatchedThrough,
    form?.termsOfDelivery, form?.dueDate, form?.paymentTerms, form?.otherReferences,
    form?.invoiceDate, form?.deliveryNoteDate, form?.destination,
  ];
  const totalQty = validItems.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);

  const sealVisible = typeof window !== "undefined" && localStorage.getItem("show_seal") === "true";
  const sealType = typeof window !== "undefined" ? localStorage.getItem("seal_type") || "round" : "round";
  const stampAddress1 = business?.addressLine1 || "";
  const stampAddress2 = [business?.addressLine2, business?.city, business?.state, business?.pincode ? "-" + business.pincode : ""].filter(Boolean).join(", ");
  const stampPhone = business?.phone ? `Ph: ${business.phone}` : "";
  const stampEmail = business?.email ? `E-Mail: ${business.email}` : "";

  return (
    <div ref={ref} style={{
      width: `${TABLE_W + 2}px`,
      margin: "0 auto",
      background: "#fff",
      fontFamily: "Arial, Helvetica, sans-serif",
      color: "#000",
      fontSize: "10px",
      lineHeight: "1.35",
      boxSizing: "border-box",
    }}>
      <table style={tStyle}>
        <tbody>
          {/* TITLE ROW */}
          <tr>
            <td colSpan={2} style={{ borderBottom: S.border, padding: 0 }}>
              <div style={{ position: "relative", textAlign: "center", fontSize: "14px", fontWeight: "bold", padding: "6px 10px" }}>
                {isProforma ? "PROFORMA INVOICE" : "Tax Invoice"}
                {isProforma ? (
                  <div style={{ fontSize: "9px", fontWeight: "normal", fontStyle: "italic" }}>
                    — NOT A TAX INVOICE —
                  </div>
                ) : (
                  <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", fontStyle: "italic", fontWeight: "normal" }}>
                    (ORIGINAL FOR RECIPIENT)
                  </span>
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
                      <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>
                        {business?.businessName || "Business Name"}
                      </div>
                      <div style={{ fontSize: "10px", lineHeight: "1.45" }}>
                        {business?.addressLine1 || ""}{business?.addressLine2 ? ", " + business.addressLine2 : ""}
                      </div>
                      <div style={{ fontSize: "10px", lineHeight: "1.45" }}>
                        {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                      </div>
                      {business?.phone ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>Ph: {business.phone}</div> : null}
                      {business?.email ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>{business.email}</div> : null}
                      {business?.gstIn ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>GSTIN/UIN: {business.gstIn}</div> : null}
                      {business?.state ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>State: {business.state} Code: {business.gstIn?.substring(0, 2) || ""}</div> : null}
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
                      {customer?.state ? <div style={{ fontSize: "10px", lineHeight: "1.45" }}>State: {customer.state}</div> : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td style={{ width: "43%", borderRight: S.border, padding: 0, verticalAlign: "top" }}>
              <table style={tStyle}>
                <tbody>
                  {rightLabels.map((label, idx) => (
                    <tr key={idx} style={{ height: "25px" }}>
                      <td style={{
                        width: "52%",
                        borderBottom: idx < rightLabels.length - 1 ? S.border : 0,
                        borderRight: S.border,
                        padding: "5px 6px",
                        fontSize: "10px",
                        verticalAlign: "middle",
                      }}>
                        {label}
                      </td>
                      <td style={{
                        width: "48%",
                        borderBottom: idx < rightLabels.length - 1 ? S.border : 0,
                        padding: "5px 6px",
                        fontSize: "10px",
                        fontWeight: "bold",
                        verticalAlign: "middle",
                      }}>
                        {rightValues[idx] || "-"}
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
                     {ITEM_COLS.map((col, idx) => (
                        <th key={idx} style={{
                          ...cell(col.w),
                          borderRight: idx < ITEM_COLS.length - 1 ? S.border : "none",
                          borderBottom: S.border,
                          textAlign: "center",
                          fontSize: "10px",
                          padding: "6px 6px 7px 6px",
                          verticalAlign: "middle",
                          background: "#f0f0f0",
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
                    const iTaxable = (parseFloat(item.taxableValue) || 0) * discRatio;
                    const iGst = parseFloat(item.gstPercentage) || 0;
                    const iTax = (iTaxable * iGst) / 100;
                    const iTotal = iTaxable + iTax;
                    return (
                    <tr id={`section-item-row-${idx}`} key={idx} style={{ height: "28px" }}>
                       {[
                         { a: "center", v: idx + 1, w: 52 },
                         { a: "left", v: item.itemName, w: 262 },
                         { a: "center", v: item.hsn || "-", w: 76 },
                         { a: "center", v: (parseFloat(item.gstPercentage) || 0).toFixed(1) + "%", w: 62 },
                         { a: "center", v: parseFloat(item.qty).toFixed(2), w: 72 },
                         { a: "center", v: formatINR(item.rate), w: 76 },
                         { a: "center", v: "Piece", w: 42 },
                         { a: "right", v: formatINR(iTotal), w: 72 },
                       ].map((c, ci) => (
                          <td key={ci} style={{
                            ...cell(c.w),
                            borderRight: ci < ITEM_COLS.length - 1 ? S.border : "none",
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
                        <td colSpan={8} style={{ borderTop: S.border, borderLeft: S.border, borderBottom: S.border, textAlign: "center", padding: "8px", fontSize: "10px" }}>No items</td>
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
                          <div style={{ fontSize: "10px", marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px" }}>CGST (Estimated)</span>
                            <span style={{ fontWeight: "bold" }}>{formatINR(cgstTotal)}</span>
                          </div>
                          <div style={{ fontSize: "10px", marginBottom: "1px" }}>
                            <span style={{ marginRight: "16px" }}>SGST (Estimated)</span>
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
                    <td style={{ width: "72%", borderRight: S.border, padding: "6px 10px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>Estimated Amount (in words)</div>
                      <div style={{ fontSize: "11px", fontWeight: "bold" }}>
                        {(totals.grandTotal - discAmt) > 0 ? numberToWords(totals.grandTotal - discAmt) : "Zero Rupees Only"}
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
                        Rs: {formatINR(totals.grandTotal - discAmt)}
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
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", padding: "4px 10px", border: 0 }}>
                      {totals.taxAmount > 0 ? (
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
                      ) : null}
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
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "72%", borderRight: S.border, padding: "6px 10px", verticalAlign: "top" }}>
                      <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>Amount Chargeable (in words)</div>
                      <div style={{ fontSize: "11px", fontWeight: "bold" }}>
                        {(totals.grandTotal - discAmt) > 0 ? numberToWords(totals.grandTotal - discAmt) : "Zero Rupees Only"}
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
                        Rs: {formatINR(totals.grandTotal - discAmt)}
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
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
              <table style={tStyleSep}>
                <thead id="section-hsn-header">
                  <tr style={{ height: "28px" }}>
                    <th rowSpan={2} style={{ width: "16%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>HSN/SAC</th>
                    <th rowSpan={2} style={{ width: "18%", borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "6px 6px 7px 6px", verticalAlign: "middle", lineHeight: "1.5" }}>Taxable Value</th>
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
                  </thead>
                  <tbody>
                     {validItems.map((item, idx) => {
                       const gst = parseFloat(item.gstPercentage) || 0;
                       const halfGst = gst / 2;
                       const taxable = (parseFloat(item.taxableValue) || 0) * discRatio;
                       const taxAmt = (taxable * gst) / 100;
                       return (
                          <tr id={`section-hsn-row-${idx}`} key={idx} style={{ height: "26px" }}>
                            <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{item.hsn || "-"}</td>
                            <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{formatINR(taxable)}</td>
                            <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{halfGst.toFixed(1)}%</td>
                            <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{formatINR(taxAmt / 2)}</td>
                            <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{halfGst.toFixed(1)}%</td>
                            <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5" }}>{formatINR(taxAmt / 2)}</td>
                            <td style={{ borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold" }}>{formatINR(taxAmt)}</td>
                         </tr>
                       );
                     })}
                     <tr id="section-hsn-total" style={{ height: "26px" }}>
                       <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "linear-gradient(to right, transparent 1px, #f0f0f0 1px)" }}>Total</td>
                       <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "#f0f0f0" }}>{formatINR(totals.subtotal)}</td>
                       <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", background: "#f0f0f0" }}></td>
                       <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "#f0f0f0" }}>{formatINR(totals.taxAmount / 2)}</td>
                       <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "center", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", background: "#f0f0f0" }}></td>
                       <td style={{ borderRight: S.border, borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "#f0f0f0" }}>{formatINR(totals.taxAmount / 2)}</td>
                       <td style={{ borderBottom: S.border, textAlign: "right", fontSize: "10px", padding: "5px 6px", lineHeight: "1.5", fontWeight: "bold", background: "linear-gradient(to left, transparent 1px, #f0f0f0 1px)" }}>{formatINR(totals.taxAmount)}</td>
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
                {totals.taxAmount > 0 ? numberToWords(totals.taxAmount) : "Nil"}
              </span>
            </td>
          </tr>

          </>
          )}

          {/* BOTTOM SECTION: Bank + UPI QR | Declaration | Signature */}
          <tr id="section-footer">
            <td colSpan={2} style={{ borderLeft: S.border, borderRight: S.border, borderBottom: S.border, padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                            <QRCodeSVG value={`upi://pay?pa=${business.upiId}&pn=${encodeURIComponent(business.businessName || "")}&am=${(totals.grandTotal - discAmt).toFixed(2)}&tr=${encodeURIComponent(displayInvNo)}&tn=${encodeURIComponent(displayInvNo)}&cu=INR`} size={74} style={{ width: "100%", height: "auto", maxWidth: "74px" }} />
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
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "center", padding: 0 }}>
                      <div style={{ fontSize: "10px", fontWeight: "bold" }}>SUBJECT TO BENGALURU JURISDICTION</div>
                      <div style={{ fontSize: "10px", marginTop: "1px" }}>{isProforma ? "This is a Computer Generated Proforma Invoice" : "This is a Computer Generated Invoice"}</div>
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

InvoicePDF.displayName = "InvoicePDF";

export async function downloadInvoicePDF(element, filename, paperSizeId) {
  if (!element) return;
  try {
    const { getPaperDimensions } = await import("../constants/paperSizes");
    const dim = getPaperDimensions(paperSizeId);
    const SCALE = 2;
    const CONTENT_W = dim.contentW;
    const LEFT = dim.left;
    const PAGE_H = dim.usableH;

    const rowSelectors = [
      '[id^="section-item-row-"]',
      '[id^="section-hsn-row-"]',
      "#section-subtotals",
      "#section-amount-words",
      "#section-hsn-header",
      "#section-hsn-total",
      "#section-hsn-words",
      "#section-footer",
      "#section-bottom-note",
    ];

    const allRowEls = element.querySelectorAll(rowSelectors.join(", "));
    const invoiceRect = element.getBoundingClientRect();

    const canvas = await html2canvas(element, {
      scale: SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF(dim.orientation, "mm", dim.format);
    const pxToMm = CONTENT_W / canvas.width;
    const onePagePx = PAGE_H / pxToMm;

    const safeCuts = new Set([0, canvas.height]);
    allRowEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const topInCanvas = Math.floor((rect.top - invoiceRect.top) * SCALE);
      const bottomInCanvas = Math.ceil((rect.bottom - invoiceRect.top) * SCALE);
      safeCuts.add(topInCanvas);
      safeCuts.add(bottomInCanvas);
    });

    const cutPoints = [...safeCuts].sort((a, b) => a - b);

    let pageStartPx = 0;
    let isFirstPage = true;

    while (pageStartPx < canvas.height) {
      const pageEndLimit = pageStartPx + onePagePx;

      let pageEndPx = null;
      for (const cut of cutPoints) {
        if (cut > pageStartPx && cut <= pageEndLimit) {
          pageEndPx = cut;
        }
      }

      if (!pageEndPx) {
        pageEndPx = cutPoints.find((cut) => cut > pageStartPx) || canvas.height;
      }

      const sliceHeightPx = pageEndPx - pageStartPx;
      const sliceHeightMM = sliceHeightPx * pxToMm;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;

      const ctx = sliceCanvas.getContext("2d");
      ctx.drawImage(
        canvas,
        0,
        pageStartPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );

      if (!isFirstPage) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, 2);
        pdf.addPage();
      }

      pdf.addImage(
        sliceCanvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        LEFT,
        10,
        CONTENT_W,
        sliceHeightMM
      );

      pageStartPx = pageEndPx;
      isFirstPage = false;
    }

    if (filename === null) {
      return pdf.output("bloburl");
    }
    pdf.save(filename);
  } catch (err) {
    console.error("PDF generation error:", err);
    throw err;
  }
}

export default InvoicePDF;
