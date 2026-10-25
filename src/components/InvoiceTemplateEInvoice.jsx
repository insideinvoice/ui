import React from "react";
import { QRCodeSVG } from "qrcode.react";
import SealOverlay from "./SealOverlay";
import { resolveSeal } from "../utils/seal";
import { sealSpecAttribute } from "../utils/sealConfig";
import { asImageSrc } from "../utils/imageSrc";
import { numberToWords, formatINR } from "../utils/invoiceFormat";
import { computeInvoiceTotals, round2 } from "../utils/invoiceTotals";
import { GST_STATE_CODES } from "../constants/indianStates";
import { uqcFor } from "../constants/units";

/* ------------------------------------------------------------------ *
 * e-Invoice — GST e-Invoice style tax invoice (template-33).
 *
 * Reproduces the NIC/Tally e-Invoice print layout pin for pin:
 *
 *   ZONE A  (unframed)  "Tax Invoice" title + IRN / Ack No / Ack Date on
 *                       the left, "e-Invoice" + QR on the right.
 *   ZONE B  (one frame) header  =  party column (Seller / Consignee /
 *                                  Buyer, three stacked blocks with their
 *                                  OWN rules) | meta column (7 ruled rows
 *                                  × 2 cells, rules independent of the
 *                                  party column)
 *                       items   = 8 columns incl. Disc. %, with the CGST /
 *                                  SGST labels set right-aligned inside the
 *                                  Description cell and their amounts in the
 *                                  Amount cell
 *                       words   → HSN/SAC tax table (2-row header,
 *                                  Central Tax / State Tax) → tax words →
 *                                  Declaration | Authorised Signatory
 *   ZONE C  (unframed)  "This is a Computer Generated Invoice"
 *
 * Every section boundary above is exactly ONE rule: each block owns only the
 * side it needs (block bottom, or the frame's own edge) so no two adjacent
 * rows ever both draw a line and nothing doubles up to 2px.
 * ------------------------------------------------------------------ */

const ROOT_W = 716; // 714 content + 1px frame on each side
const CONTENT_W = 714;
const B = "1px solid #000000";

// Document titles (Rule 46: each document type is a DISTINCT title).
const TITLE_BY_TYPE = {
  TAX_INVOICE: "Tax Invoice",
  PROFORMA_INVOICE: "PROFORMA INVOICE",
  BILL_OF_SUPPLY: "BILL OF SUPPLY",
  CREDIT_NOTE: "CREDIT NOTE",
  DEBIT_NOTE: "DEBIT NOTE",
};

/* Item grid — sums to 714 so the table exactly fills the frame's inner box. */
const ITEM_COLS = [
  { w: 30, key: "sl" },
  { w: 302, key: "desc" },
  { w: 58, key: "hsn" },
  { w: 64, key: "qty" },
  { w: 70, key: "rate" },
  { w: 40, key: "per" },
  { w: 46, key: "disc" },
  { w: 104, key: "amt" },
];

/* HSN/SAC breakup columns are computed per tax mode inside the component so
   the grid always totals 714px whether or not the HSN column is shown. */

const tStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "fixed",
  boxSizing: "border-box",
};

const cell = (w) => ({
  width: `${w}px`,
  minWidth: `${w}px`,
  maxWidth: `${w}px`,
  boxSizing: "border-box",
});

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2020-12-21" -> "21-Dec-20" (the Tally/e-Invoice date stamp)
const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  if (!y || !m || !day) return String(d);
  const mi = parseInt(m, 10);
  if (!MON[mi - 1]) return String(d);
  return `${day}-${MON[mi - 1]}-${y.slice(2)}`;
};

// "... Four Thousand ... Rupees Only" -> "Indian Rupee Four Thousand ... Only"
const inWords = (n) => {
  if (!n || n <= 0) return "Indian Rupee Zero Only";
  return `Indian Rupee ${numberToWords(n).replace(" Rupees", "").replace(/ Only$/, "")}`;
};

const stateCode = (name) => (name && GST_STATE_CODES[name] ? GST_STATE_CODES[name] : "");

// Meta-column fields that hold a date and therefore get the 01-Oct-26 stamp.
const isMetaDate = (f) =>
  f === "invoiceDate" || f === "deliveryNoteDate" || f === "buyerOrderDate";

/* Hanging-indent key/value line so a wrapping IRN keeps its second line under
   the value, exactly like the printed form. */
const MetaLine = ({ label, value }) => (
  <div style={{ display: "flex", alignItems: "flex-start", fontSize: "10.5px", lineHeight: 1.5 }}>
    <span style={{ width: "74px", flexShrink: 0 }}>{label}</span>
    <span style={{ flexShrink: 0 }}>:</span>
    <span style={{ flex: 1, minWidth: 0, marginLeft: "6px", wordBreak: "break-all" }}>{value}</span>
  </div>
);

/* Right-hand meta grid: 7 rows × 2 cells. Rules live on the cells, never on
   the party column beside it, so the two halves never share a line. */
const META_ROWS = [
  { l: "Invoice No.", r: "Dated", lv: "invoiceNumber", rv: "invoiceDate", bold: true },
  { l: "Delivery Note", r: "Mode/Terms of Payment", lv: "deliveryNote", rv: "paymentTerms" },
  { l: "Reference No. & Date.", r: "Other References", lv: "referenceNumber", rv: "otherReferences" },
  { l: "Buyer's Order No.", r: "Dated", lv: "buyerOrderNumber", rv: "buyerOrderDate" },
  { l: "Dispatch Doc No.", r: "Delivery Note Date", lv: "dispatchDocNumber", rv: "deliveryNoteDate" },
  { l: "Dispatched through", r: "Destination", lv: "dispatchedThrough", rv: "destination" },
  { l: "Terms of Delivery", r: "", lv: "termsOfDelivery", rv: "" },
];

const InvoiceTemplateEInvoice = React.memo(React.forwardRef(
  ({ business, customer, form, items, discountPercent, type, invoiceNumber, taxMode }, ref) => {
    const displayInvNo = invoiceNumber || "DRAFT";
    const title = TITLE_BY_TYPE[type] || "Tax Invoice";

    const validItems = (items || []).filter((i) => i.itemName?.trim() && parseFloat(i.qty) > 0);
    const calc = computeInvoiceTotals(items, discountPercent, taxMode, form?.cessPercent);
    const igstMode = taxMode === "IGST";
    const finalTotal = calc.grandTotal;

    const showHnSac = !business || business.showHnSac !== false;
    const itemCols = showHnSac
      ? ITEM_COLS
      : ITEM_COLS
          .map((c) => (c.key === "hsn" ? null : c.key === "desc" ? { ...c, w: c.w + 58 } : c))
          .filter(Boolean);

    const sigSrc = asImageSrc(business?.signature);
    const { sealVisible, sealType } = resolveSeal(business);

    /* ---- e-Invoice QR -------------------------------------------------
       Built in the NIC QR shape (Version / TranDtls / DocDtls / SellerDtls /
       BuyerDtls / ValDtls) from the invoice we already hold, so the code is
       real and scannable rather than decorative. Swap in the portal-issued
       IRN payload once backend e-invoice integration exists. */
    const qrPayload = JSON.stringify({
      Version: "1.1",
      TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
      DocDtls: {
        Typ: type === "PROFORMA_INVOICE" ? "INV" : "INV",
        No: displayInvNo,
        Dt: fmtDate(form?.invoiceDate),
      },
      SellerDtls: {
        Gstin: business?.gstIn || "",
        LglNm: business?.businessName || "",
        Loc: business?.city || "",
        Pin: business?.pincode || "",
        State: business?.state || "",
      },
      BuyerDtls: {
        Gstin: customer?.gstIn || "",
        LglNm: customer?.name || "",
        Loc: business?.city || "",
        State: customer?.state || "",
      },
      ValDtls: {
        AssVal: calc.taxableAmount,
        CgstVal: calc.cgst,
        SgstVal: calc.sgst,
        IgstVal: calc.igst,
        CessVal: calc.cessAmount,
        TotInvVal: finalTotal,
      },
    });

    const party = {
      gstIn: business?.gstIn || "",
      state: business?.state || "",
      code: stateCode(business?.state),
    };
    const custGstin = customer?.gstIn || "";
    const custState = customer?.state || "";
    const custCode = stateCode(customer?.state);
    // Consignee defaults to the buyer; a separate Ship-To overrides only the
    // address line, which is what produces the identical pair on the sample.
    const shipAddr = form?.shippingAddress || customer?.billingAddress || "";

    /* ---- HSN/SAC grouping (rate-aware, like the statutory breakup) ---- */
    const hsnGroups = [];
    const hsnIndex = new Map();
    validItems.forEach((item, i) => {
      const p = calc.perItem[i];
      if (!p) return;
      const gst = parseFloat(item.gstPercentage) || 0;
      const key = `${item.hsn || "-"}|${gst}`;
      let g = hsnIndex.get(key);
      if (!g) {
        g = { hsn: item.hsn || "-", gst, taxable: 0, tax: 0 };
        hsnIndex.set(key, g);
        hsnGroups.push(g);
      }
      g.taxable = round2(g.taxable + p.taxable);
      g.tax = round2(g.tax + p.tax);
    });

    const totalQty = validItems.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
    const qtyUnit = uqcFor(validItems[0]?.unit || "Piece");

    // Column width lookup that survives the HSN/SAC column being folded away.
    const colW = (key) => (itemCols.find((c) => c.key === key) || { w: 0 }).w;

    /* HSN/SAC breakup widths — always sum to 714 in both tax modes and with
       the HSN column switched off (its 264px folds into Taxable Value). */
    const hsnW = 264;
    const taxableW = showHnSac ? 95 : 359;
    const SPLIT_TAIL = [55, 75, 55, 75, 95]; // rate|amount ×2 | total tax
    const IGST_TAIL = [110, 150, 95]; // rate | amount | total tax
    const hsnColCount = igstMode
      ? showHnSac ? 5 : 4
      : showHnSac ? 7 : 6;
    const thStyle = {
      borderBottom: B,
      textAlign: "center",
      fontSize: "10px",
      fontWeight: "normal",
      padding: "5px 6px",
      verticalAlign: "middle",
    };
    const tdStyle = { borderBottom: B, fontSize: "10.5px", padding: "4px 6px" };

    return (
      <div
        ref={ref}
        data-ii-seal-spec={sealSpecAttribute(business)}
        style={{
          width: `${ROOT_W}px`,
          margin: "0 auto",
          background: "#ffffff",
          color: "#000000",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "10.5px",
          lineHeight: 1.35,
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {/* ================= ZONE A — e-Invoice header (no frame) ========= */}
        <div
          style={{
            width: `${ROOT_W}px`,
            boxSizing: "border-box",
            padding: "0 1px",
            display: "flex",
            alignItems: "stretch",
            paddingBottom: "8px",
          }}
        >
          <div
            style={{
              width: "530px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxSizing: "border-box",
              paddingRight: "14px",
            }}
          >
            <div style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", paddingTop: "2px" }}>
              {title}
            </div>
            <div style={{ paddingBottom: "2px" }}>
              <MetaLine label="IRN" value={form?.irn || "—"} />
              <MetaLine label="Ack No." value={form?.ackNo || "—"} />
              <MetaLine label="Ack Date" value={form?.ackDate ? fmtDate(form.ackDate) : "—"} />
            </div>
          </div>
          <div style={{ width: "184px", textAlign: "center" }}>
            <div style={{ fontSize: "13px", fontWeight: "bold", paddingTop: "2px" }}>e-Invoice</div>
            <div style={{ display: "inline-block", marginTop: "8px" }}>
              <QRCodeSVG value={qrPayload} size={150} level="M" />
            </div>
          </div>
        </div>

        {/* ================= ZONE B — the framed document ================= */}
        <div style={{ width: `${ROOT_W}px`, boxSizing: "border-box", border: B }}>
          {/* ---------- header: party column | meta column ---------------- */}
          <table style={{ ...tStyle, borderBottom: B }}>
            <tbody>
              <tr>
                {/* party column — its own 3 blocks and its own 2 rules */}
                <td style={{ ...cell(346), borderRight: B, verticalAlign: "top" }}>
                  <table style={tStyle}>
                    <tbody>
                      <tr>
                        <td style={{ borderBottom: B, padding: "6px 9px 7px", verticalAlign: "top" }}>
                          <div style={{ fontSize: "15px", fontWeight: "bold", lineHeight: 1.3 }}>
                            {business?.businessName || "Business Name"}
                          </div>
                          <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>
                            {[business?.addressLine1, business?.addressLine2].filter(Boolean).join(", ")}
                          </div>
                          <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>
                            {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
                          </div>
                          {party.gstIn ? (
                            <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>GSTIN/UIN: {party.gstIn}</div>
                          ) : null}
                          {party.state ? (
                            <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>
                              State Name : {party.state}, Code : {party.code}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ borderBottom: B, padding: "5px 9px 7px", verticalAlign: "top" }}>
                          <div style={{ fontSize: "10px", lineHeight: 1.5 }}>Consignee (Ship to)</div>
                          <div style={{ fontSize: "13px", fontWeight: "bold", lineHeight: 1.35 }}>
                            {customer?.name || "Customer Name"}
                          </div>
                          {shipAddr ? <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>{shipAddr}</div> : null}
                          {custGstin ? (
                            <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>GSTIN/UIN : {custGstin}</div>
                          ) : null}
                          {custState ? (
                            <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>
                              State Name : {custState}, Code : {custCode}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "5px 9px 8px", verticalAlign: "top" }}>
                          <div style={{ fontSize: "10px", lineHeight: 1.5 }}>Buyer (Bill to)</div>
                          <div style={{ fontSize: "13px", fontWeight: "bold", lineHeight: 1.35 }}>
                            {customer?.name || "Customer Name"}
                          </div>
                          {customer?.billingAddress ? (
                            <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>{customer.billingAddress}</div>
                          ) : null}
                          {custGstin ? (
                            <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>GSTIN/UIN : {custGstin}</div>
                          ) : null}
                          {custState ? (
                            <div style={{ fontSize: "10.5px", lineHeight: 1.5 }}>
                              State Name : {custState}, Code : {custCode}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>

                {/* meta column — 7 independent ruled rows */}
                <td style={{ ...cell(368), verticalAlign: "top" }}>
                  <table style={tStyle}>
                    <tbody>
                      {META_ROWS.map((row, idx) => {
                        const last = idx === META_ROWS.length - 1;
                        const lv =
                          row.lv === "invoiceNumber"
                            ? displayInvNo
                            : isMetaDate(row.lv)
                              ? fmtDate(form?.[row.lv])
                              : form?.[row.lv] || "";
                        const rv = isMetaDate(row.rv) ? fmtDate(form?.[row.rv]) : form?.[row.rv] || "";
                        const showRight = row.r !== "";
                        return (
                          <tr key={row.l}>
                            <td
                              style={{
                                ...cell(showRight ? 184 : 368),
                                borderRight: showRight ? B : "none",
                                borderBottom: last ? "none" : B,
                                padding: "5px 7px",
                                fontSize: "10.5px",
                                verticalAlign: "top",
                                lineHeight: 1.45,
                              }}
                            >
                              <div>{row.l}</div>
                              {lv ? (
                                <div style={{ fontWeight: row.bold ? "bold" : "normal" }}>{lv}</div>
                              ) : null}
                            </td>
                            {showRight ? (
                              <td
                                style={{
                                  ...cell(184),
                                  borderBottom: last ? "none" : B,
                                  padding: "5px 7px",
                                  fontSize: "10.5px",
                                  verticalAlign: "top",
                                  lineHeight: 1.45,
                                }}
                              >
                                <div>{row.r}</div>
                                {rv ? (
                                  <div style={{ fontWeight: row.bold ? "bold" : "normal" }}>{rv}</div>
                                ) : null}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ---------- item table ----------------------------------------
              Every row draws its own bottom rule, so the table itself adds none —
              one line per boundary, never two. */}
          <table style={tStyle}>
            <thead>
              <tr>
                {itemCols.map((col, i) => (
                  <th
                    key={col.key}
                    style={{
                      ...cell(col.w),
                      borderRight: i < itemCols.length - 1 ? B : "none",
                      borderBottom: B,
                      textAlign: "center",
                      fontSize: "10px",
                      fontWeight: "normal",
                      padding: "5px 5px",
                      verticalAlign: "middle",
                      lineHeight: 1.4,
                    }}
                  >
                    {col.key === "sl"
                      ? "Sl No."
                      : col.key === "desc"
                        ? "Description of Goods"
                        : col.key === "hsn"
                          ? "HSN/SAC"
                          : col.key === "qty"
                            ? "Quantity"
                            : col.key === "rate"
                              ? "Rate"
                              : col.key === "per"
                                ? "per"
                                : col.key === "disc"
                                  ? "Disc. %"
                                  : "Amount"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {validItems.length > 0 ? (
                validItems.map((item, idx) => {
                  const p = calc.perItem[idx] || { total: 0 };
                  const cells = [
                    { key: "sl", a: "center", v: idx + 1, w: colW("sl") },
                    { key: "desc", a: "left", v: item.itemName, w: colW("desc"), bold: true },
                    ...(showHnSac ? [{ key: "hsn", a: "center", v: item.hsn || "-", w: colW("hsn") }] : []),
                    { key: "qty", a: "right", v: `${parseFloat(item.qty) || ""} ${qtyUnit}`, w: colW("qty"), bold: true },
                    { key: "rate", a: "right", v: formatINR(item.rate), w: colW("rate") },
                    { key: "per", a: "center", v: uqcFor(item.unit || "Piece"), w: colW("per") },
                    {
                      key: "disc",
                      a: "center",
                      v: calc.discountPercent > 0 ? `${calc.discountPercent}%` : "",
                      w: colW("disc"),
                    },
                    { key: "amt", a: "right", v: formatINR(p.total), w: colW("amt") },
                  ];
                  return (
                    <tr key={idx} id={`section-item-row-${idx}`}>
                      {cells.map((c, ci) => (
                        <td
                          key={c.key}
                          style={{
                            ...cell(c.w),
                            borderRight: ci < cells.length - 1 ? B : "none",
                            borderBottom: B,
                            textAlign: c.a,
                            fontSize: "10.5px",
                            fontWeight: c.bold ? "bold" : "normal",
                            padding: "5px 6px",
                            verticalAlign: "middle",
                          }}
                        >
                          {c.v}
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={itemCols.length}
                    style={{ borderBottom: B, textAlign: "center", padding: "8px", fontSize: "10.5px" }}
                  >
                    No items
                  </td>
                </tr>
              )}

              {/* tax legs — labels right-aligned in Description, amounts in Amount */}
              {(igstMode ? ["IGST"] : ["CGST", "SGST"]).map((leg) => {
                const amt = igstMode ? calc.igst : leg === "CGST" ? calc.cgst : calc.sgst;
                return (
                  <tr key={leg}>
                    <td style={{ ...cell(itemCols[0].w), borderRight: B, borderBottom: B, padding: "4px 6px" }} />
                    <td
                      style={{
                        ...cell(itemCols[1].w),
                        borderRight: B,
                        borderBottom: B,
                        textAlign: "right",
                        fontSize: "10.5px",
                        padding: "4px 6px",
                      }}
                    >
                      {leg}
                    </td>
                    {itemCols.slice(2, -1).map((c) => (
                      <td
                        key={c.key}
                        style={{
                          ...cell(c.w),
                          borderRight: B,
                          borderBottom: B,
                          padding: "4px 6px",
                        }}
                      />
                    ))}
                    <td
                      style={{
                        ...cell(itemCols[itemCols.length - 1].w),
                        borderBottom: B,
                        textAlign: "right",
                        fontSize: "10.5px",
                        padding: "4px 6px",
                      }}
                    >
                      {formatINR(amt)}
                    </td>
                  </tr>
                );
              })}

              {/* grand total */}
              <tr id="section-subtotals">
                <td style={{ ...cell(itemCols[0].w), borderRight: B, borderBottom: B, padding: "5px 6px" }} />
                <td
                  style={{
                    ...cell(itemCols[1].w),
                    borderRight: B,
                    borderBottom: B,
                    textAlign: "right",
                    fontSize: "11px",
                    fontWeight: "bold",
                    padding: "5px 6px",
                  }}
                >
                  Total
                </td>
                {itemCols.slice(2, -1).map((c) => (
                  <td
                    key={c.key}
                    style={{
                      ...cell(c.w),
                      borderRight: B,
                      borderBottom: B,
                      textAlign: c.key === "qty" ? "right" : "inherit",
                      fontSize: "11px",
                      fontWeight: c.key === "qty" ? "bold" : "normal",
                      padding: "5px 6px",
                    }}
                  >
                    {c.key === "qty" ? `${totalQty} ${qtyUnit}` : ""}
                  </td>
                ))}
                <td
                  style={{
                    ...cell(itemCols[itemCols.length - 1].w),
                    borderBottom: B,
                    textAlign: "right",
                    fontSize: "11px",
                    fontWeight: "bold",
                    padding: "5px 6px",
                  }}
                >
                  ₹ {formatINR(finalTotal)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ---------- amount chargeable -------------------------------- */}
          <table style={{ ...tStyle, borderBottom: B }}>
            <tbody>
              <tr id="section-amount-words">
                <td colSpan={itemCols.length} style={{ padding: "5px 8px 6px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: "10.5px",
                    }}
                  >
                    <span>Amount Chargeable (in words)</span>
                    <span style={{ fontStyle: "italic" }}>E. &amp; O.E</span>
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: "bold", marginTop: "2px" }}>
                    {inWords(finalTotal)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ---------- HSN/SAC statutory breakup ------------------------
              The closing Total row owns the block's bottom rule. */}
          <table style={tStyle}>
            <thead id="section-hsn-header">
              {igstMode ? (
                <tr>
                  {showHnSac && (
                    <th rowSpan={2} style={{ ...cell(hsnW), ...thStyle, borderRight: B, verticalAlign: "middle" }}>
                      HSN/SAC
                    </th>
                  )}
                  <th rowSpan={2} style={{ ...cell(taxableW), ...thStyle, borderRight: B, verticalAlign: "middle" }}>
                    Taxable Value
                  </th>
                  <th colSpan={2} style={{ ...cell(IGST_TAIL[0] + IGST_TAIL[1]), ...thStyle, borderRight: B, verticalAlign: "middle" }}>
                    IGST
                  </th>
                  <th rowSpan={2} style={{ ...cell(IGST_TAIL[2]), ...thStyle, lineHeight: 1.35 }}>
                    Total Tax Amount
                  </th>
                </tr>
              ) : (
                <tr>
                  {showHnSac && (
                    <th rowSpan={2} style={{ ...cell(hsnW), ...thStyle, borderRight: B, verticalAlign: "middle" }}>
                      HSN/SAC
                    </th>
                  )}
                  <th rowSpan={2} style={{ ...cell(taxableW), ...thStyle, borderRight: B, verticalAlign: "middle" }}>
                    Taxable Value
                  </th>
                  <th colSpan={2} style={{ ...cell(SPLIT_TAIL[0] + SPLIT_TAIL[1]), ...thStyle, borderRight: B, verticalAlign: "middle" }}>
                    Central Tax
                  </th>
                  <th colSpan={2} style={{ ...cell(SPLIT_TAIL[2] + SPLIT_TAIL[3]), ...thStyle, borderRight: B, verticalAlign: "middle" }}>
                    State Tax
                  </th>
                  <th rowSpan={2} style={{ ...cell(SPLIT_TAIL[4]), ...thStyle, lineHeight: 1.35 }}>
                    Total Tax Amount
                  </th>
                </tr>
              )}
              {igstMode ? (
                <tr>
                  <td style={{ ...cell(IGST_TAIL[0]), ...tdStyle, borderRight: B, textAlign: "center", fontSize: "10px" }}>Rate</td>
                  <td style={{ ...cell(IGST_TAIL[1]), ...tdStyle, textAlign: "center", fontSize: "10px" }}>Amount</td>
                </tr>
              ) : (
                <tr>
                  <td style={{ ...cell(SPLIT_TAIL[0]), ...tdStyle, borderRight: B, textAlign: "center", fontSize: "10px" }}>Rate</td>
                  <td style={{ ...cell(SPLIT_TAIL[1]), ...tdStyle, borderRight: B, textAlign: "center", fontSize: "10px" }}>Amount</td>
                  <td style={{ ...cell(SPLIT_TAIL[2]), ...tdStyle, borderRight: B, textAlign: "center", fontSize: "10px" }}>Rate</td>
                  <td style={{ ...cell(SPLIT_TAIL[3]), ...tdStyle, textAlign: "center", fontSize: "10px" }}>Amount</td>
                </tr>
              )}
            </thead>
            <tbody>
              {hsnGroups.length > 0 ? (
                hsnGroups.map((g, i) => (
                  <tr key={i} id={`section-hsn-row-${i}`} style={{ height: "24px" }}>
                    {showHnSac && (
                      <td style={{ ...cell(hsnW), ...tdStyle, borderRight: B, textAlign: "center" }}>
                        {g.hsn}
                      </td>
                    )}
                    <td style={{ ...cell(taxableW), ...tdStyle, borderRight: B, textAlign: "right" }}>
                      {formatINR(g.taxable)}
                    </td>
                    {igstMode ? (
                      <>
                        <td style={{ ...cell(IGST_TAIL[0]), ...tdStyle, borderRight: B, textAlign: "center" }}>
                          {g.gst.toFixed(1)}%
                        </td>
                        <td style={{ ...cell(IGST_TAIL[1]), ...tdStyle, textAlign: "right" }}>
                          {formatINR(g.tax)}
                        </td>
                        <td style={{ ...cell(IGST_TAIL[2]), ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
                          {formatINR(g.tax)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...cell(SPLIT_TAIL[0]), ...tdStyle, borderRight: B, textAlign: "center" }}>
                          {(g.gst / 2).toFixed(1)}%
                        </td>
                        <td style={{ ...cell(SPLIT_TAIL[1]), ...tdStyle, borderRight: B, textAlign: "right" }}>
                          {formatINR(g.tax / 2)}
                        </td>
                        <td style={{ ...cell(SPLIT_TAIL[2]), ...tdStyle, borderRight: B, textAlign: "center" }}>
                          {(g.gst / 2).toFixed(1)}%
                        </td>
                        <td style={{ ...cell(SPLIT_TAIL[3]), ...tdStyle, borderRight: B, textAlign: "right" }}>
                          {formatINR(g.tax / 2)}
                        </td>
                        <td style={{ ...cell(SPLIT_TAIL[4]), ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
                          {formatINR(g.tax)}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={hsnColCount} style={{ ...tdStyle, textAlign: "center", padding: "6px" }}>
                    —
                  </td>
                </tr>
              )}

              <tr id="section-hsn-total" style={{ height: "24px" }}>
                {showHnSac && (
                  <td style={{ ...cell(hsnW), ...tdStyle, borderRight: B, textAlign: "right", fontWeight: "bold" }}>
                    Total
                  </td>
                )}
                <td style={{ ...cell(taxableW), ...tdStyle, borderRight: B, textAlign: "right", fontWeight: "bold" }}>
                  {formatINR(calc.taxableAmount)}
                </td>
                {igstMode ? (
                  <>
                    <td style={{ ...cell(IGST_TAIL[0]), ...tdStyle, borderRight: B }} />
                    <td style={{ ...cell(IGST_TAIL[1]), ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
                      {formatINR(calc.igst)}
                    </td>
                    <td style={{ ...cell(IGST_TAIL[2]), ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
                      {formatINR(calc.taxAmount)}
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ ...cell(SPLIT_TAIL[0]), ...tdStyle, borderRight: B }} />
                    <td style={{ ...cell(SPLIT_TAIL[1]), ...tdStyle, borderRight: B, textAlign: "right", fontWeight: "bold" }}>
                      {formatINR(calc.cgst)}
                    </td>
                    <td style={{ ...cell(SPLIT_TAIL[2]), ...tdStyle, borderRight: B }} />
                    <td style={{ ...cell(SPLIT_TAIL[3]), ...tdStyle, borderRight: B, textAlign: "right", fontWeight: "bold" }}>
                      {formatINR(calc.sgst)}
                    </td>
                    <td style={{ ...cell(SPLIT_TAIL[4]), ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
                      {formatINR(calc.taxAmount)}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>

          {/* ---------- tax amount in words ------------------------------ */}
          <table style={{ ...tStyle, borderBottom: B }}>
            <tbody>
              <tr id="section-hsn-words">
                <td colSpan={itemCols.length} style={{ padding: "5px 8px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "bold" }}>Tax Amount (in words) : </span>
                  <span style={{ fontSize: "10.5px", fontWeight: "bold" }}>
                    {inWords(calc.taxAmount)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ---------- declaration | authorised signatory ---------------- */}
          <table style={tStyle}>
            <tbody>
              <tr id="section-footer">
                <td colSpan={itemCols.length} style={{ padding: 0, verticalAlign: "top" }}>
                  <table style={tStyle}>
                    <tbody>
                      <tr style={{ height: "76px" }}>
                        <td
                          style={{
                            width: "400px",
                            borderRight: B,
                            padding: "6px 9px 8px",
                            verticalAlign: "top",
                            boxSizing: "border-box",
                          }}
                        >
                          <div style={{ fontSize: "10.5px", fontWeight: "bold" }}>Declaration</div>
                          <div style={{ fontSize: "10.5px", lineHeight: 1.45, marginTop: "2px" }}>
                            We declare that this invoice shows the actual price of the goods described and that all
                            particulars are true and correct.
                          </div>
                        </td>
                        <td
                          style={{
                            width: "314px",
                            padding: "6px 9px 8px",
                            verticalAlign: "top",
                            textAlign: "right",
                            boxSizing: "border-box",
                          }}
                        >
                          <div style={{ fontSize: "10.5px", fontWeight: "bold" }}>
                            for {business?.businessName || "Company Name"}
                          </div>
                          <div style={{ height: "34px" }} />
                          {sigSrc ? (
                            <img
                              src={sigSrc}
                              alt="signature"
                              style={{ height: "34px", objectFit: "contain", display: "block", marginLeft: "auto" }}
                            />
                          ) : null}
                          <div style={{ fontSize: "10.5px", marginTop: "3px" }}>Authorised Signatory</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ================= ZONE C — footer note (no frame) ============= */}
        <div
          id="section-bottom-note"
          style={{ textAlign: "center", fontSize: "10.5px", padding: "6px 0 4px" }}
        >
          {type === "PROFORMA_INVOICE"
            ? "This is a Computer Generated Proforma Invoice"
            : "This is a Computer Generated Invoice"}
        </div>

        {sealVisible && <SealOverlay business={business} type={sealType} />}
      </div>
    );
  },
));

InvoiceTemplateEInvoice.displayName = "InvoiceTemplateEInvoice";

export default InvoiceTemplateEInvoice;
