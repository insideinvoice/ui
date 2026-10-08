import React from "react";

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

const ITEM_COLS_58 = [
  { w: 18, key: "sl" },
  { w: 122, key: "desc" },
  { w: 48, key: "qty" },
  { w: 60, key: "rate" },
  { w: 60, key: "amt" },
];
const TABLE_W_58 = ITEM_COLS_58.reduce((s, c) => s + c.w, 0);

const ITEM_COLS_80 = [
  { w: 20, key: "sl" },
  { w: 160, key: "desc" },
  { w: 20, key: "hsn" },
  { w: 56, key: "qty" },
  { w: 70, key: "rate" },
  { w: 70, key: "amt" },
];
const TABLE_W_80 = ITEM_COLS_80.reduce((s, c) => s + c.w, 0);

const cell = (w) => ({ width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, boxSizing: "border-box" });

const InvoiceThermal = React.forwardRef((props, ref) => {
  const { business, customer, form, items, totals, type, invoiceNumber, paperSize } = props;
  const is58 = paperSize === "THERMAL_58MM";
  const ITEM_COLS = is58 ? ITEM_COLS_58 : ITEM_COLS_80;
  const TABLE_W = is58 ? TABLE_W_58 : TABLE_W_80;
  const PAD = is58 ? 4 : 6;
  const FONT = is58 ? 9 : 10;
  const TITLE = is58 ? 11 : 13;
  const HEADER = is58 ? 8 : 9;
  const typeLabel = type === "PROFORMA_INVOICE" ? "PROFORMA INVOICE" : "TAX INVOICE";

  return (
    <div ref={ref} style={{
      width: `${is58 ? 290 : 430}px`,
      maxWidth: `${is58 ? 290 : 430}px`,
      overflow: "hidden",
      wordBreak: "break-all",
      fontFamily: "'Courier New', monospace",
      fontSize: `${FONT}px`,
      lineHeight: "1.25",
      color: "#000",
      background: "#fff",
      padding: `${PAD}px`,
      margin: 0,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        <div style={{ fontSize: `${TITLE}px`, fontWeight: "bold", textTransform: "uppercase" }}>
          {business?.businessName || "Business Name"}
        </div>
        {business?.addressLine1 && <div style={{ fontSize: `${FONT - 1}px` }}>{business.addressLine1}</div>}
        {business?.city && <div style={{ fontSize: `${FONT - 1}px` }}>{business.city}{business.state ? `, ${business.state}` : ""}{business.pincode ? ` - ${business.pincode}` : ""}</div>}
        {business?.phone && <div style={{ fontSize: `${FONT - 1}px` }}>Ph: {business.phone}</div>}
        {business?.email && <div style={{ fontSize: `${FONT - 1}px` }}>{business.email}</div>}
        {business?.gstIn && <div style={{ fontSize: `${FONT - 1}px` }}>GST: {business.gstIn}</div>}
      </div>

      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: `${HEADER}px`, borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "3px 0", marginBottom: "6px" }}>
        {typeLabel}
      </div>

      {/* Invoice meta */}
      <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", marginBottom: "6px" }}>
        <colgroup><col style={{ width: "40%" }} /><col style={{ width: "60%" }} /></colgroup>
        <tbody>
          <tr><td style={{ fontSize: `${FONT - 1}px`, width: "40%" }}>Invoice No:</td><td style={{ fontWeight: "bold", fontSize: `${FONT - 1}px` }}>{invoiceNumber}</td></tr>
          <tr><td style={{ fontSize: `${FONT - 1}px` }}>Date:</td><td style={{ fontWeight: "bold", fontSize: `${FONT - 1}px` }}>{form?.invoiceDate}</td></tr>
          {form?.dueDate && <tr><td style={{ fontSize: `${FONT - 1}px` }}>Due Date:</td><td style={{ fontWeight: "bold", fontSize: `${FONT - 1}px` }}>{form.dueDate}</td></tr>}
          {form?.placeOfSupply && <tr><td style={{ fontSize: `${FONT - 1}px` }}>Place of Supply:</td><td style={{ fontWeight: "bold", fontSize: `${FONT - 1}px` }}>{form.placeOfSupply}</td></tr>}
          {form?.paymentTerms && <tr><td style={{ fontSize: `${FONT - 1}px` }}>Payment Terms:</td><td style={{ fontWeight: "bold", fontSize: `${FONT - 1}px` }}>{form.paymentTerms}</td></tr>}
        </tbody>
      </table>

      {/* Customer */}
      <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "3px 0", marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold", fontSize: `${HEADER}px` }}>Bill To:</div>
        <div style={{ fontSize: `${FONT - 1}px` }}>{customer?.name || "Customer Name"}</div>
        {customer?.billingAddress && <div style={{ fontSize: `${FONT - 1}px` }}>{customer.billingAddress}</div>}
        {customer?.gstIn && <div style={{ fontSize: `${FONT - 1}px` }}>GST: {customer.gstIn}</div>}
        {customer?.phone && <div style={{ fontSize: `${FONT - 1}px` }}>Ph: {customer.phone}</div>}
      </div>

      {/* Items table */}
      <table style={{ width: `${TABLE_W}px`, maxWidth: `${TABLE_W}px`, tableLayout: "fixed", borderCollapse: "collapse", marginBottom: "4px" }}>
        <thead>
          <tr style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
            {ITEM_COLS.map((col) => (
              <th key={col.key} style={{ ...cell(col.w), fontSize: `${HEADER}px`, textAlign: col.key === "sl" || col.key === "qty" || col.key === "rate" || col.key === "amt" ? "right" : "left", padding: "1px 0" }}>
                {col.key === "sl" ? "#" : col.key === "desc" ? "Item" : col.key === "qty" ? "Qty" : col.key === "rate" ? "Rate" : col.key === "amt" ? "Amt" : col.key === "hsn" ? "HSN" : col.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(items || []).map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px dotted #ccc" }}>
              {ITEM_COLS.map((col) => (
                <td key={col.key} style={{ ...cell(col.w), fontSize: `${FONT - 1}px`, textAlign: col.key === "sl" || col.key === "qty" || col.key === "rate" || col.key === "amt" ? "right" : "left", padding: "1px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {col.key === "sl" ? idx + 1
                    : col.key === "desc" ? item.itemName
                    : col.key === "qty" ? item.qty
                    : col.key === "rate" ? formatINR(item.rate)
                    : col.key === "hsn" ? (item.hsn || "-")
                    : col.key === "amt" ? formatINR(item.total || item.amount)
                    : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ borderTop: "1px solid #000", paddingTop: "3px", marginTop: "4px" }}>
        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={{ fontSize: `${FONT - 1}px`, textAlign: "right", width: "60%" }}>Subtotal:</td><td style={{ fontSize: `${FONT}px`, fontWeight: "bold", textAlign: "right", width: "40%" }}>{formatINR(totals.subtotal)}</td></tr>
            <tr><td style={{ fontSize: `${FONT - 1}px`, textAlign: "right" }}>Tax:</td><td style={{ fontSize: `${FONT}px`, fontWeight: "bold", textAlign: "right" }}>{formatINR(totals.taxAmount)}</td></tr>
            <tr style={{ borderTop: "2px solid #000" }}>
              <td style={{ fontSize: `${FONT + 2}px`, fontWeight: "bold", textAlign: "right", paddingTop: "2px" }}>TOTAL:</td>
              <td style={{ fontSize: `${FONT + 2}px`, fontWeight: "bold", textAlign: "right", paddingTop: "2px" }}>{formatINR(totals.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: `${FONT - 2}px`, marginTop: "2px", textAlign: "center" }}>
          {numberToWords(parseFloat(totals.grandTotal) || 0)}
        </div>
      </div>

      {/* Notes */}
      {form?.notes && (
        <div style={{ fontSize: `${FONT - 1}px`, marginTop: "4px", borderTop: "1px dashed #000", paddingTop: "3px" }}>
          {form.notes}
        </div>
      )}

      {/* UPI QR */}
      {business?.upiId && (
        <div style={{ textAlign: "center", marginTop: "6px", paddingTop: "4px", borderTop: "1px dashed #000" }}>
          <div style={{ fontSize: `${FONT - 1}px`, marginBottom: "2px" }}>Pay via UPI: {business.upiId}</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: `${FONT - 2}px`, marginTop: "6px", borderTop: "1px dashed #000", paddingTop: "3px" }}>
        {business?.bankName && <div>{business.bankName}{business.ifsc ? ` / IFSC: ${business.ifsc}` : ""}</div>}
        {business?.accountNo && <div>A/c: {business.accountNo}</div>}
        <div>Computer Generated {typeLabel}</div>
      </div>
    </div>
  );
});

InvoiceThermal.displayName = "InvoiceThermal";
export default React.memo(InvoiceThermal);
