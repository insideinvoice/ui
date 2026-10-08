import React from "react";
import CompanySeal from "./CompanySeal";
import CompanyStamp from "./CompanyStamp";
import { numberToWords, formatINR } from "../utils/invoiceFormat";
import { getSpecialistInLine, SPECIALIST_IN_EXTRA_H } from "../utils/specialistIn";
import {
  RETRO_PAGE_METRICS,
  RETRO_CAPACITY_NOTE,
  COLS,
  RULE_X,
  ROW_H,
  splitAmount,
  fmtQty,
  fmtDate,
  chunkRetroItems,
} from "../utils/retroPage";

/* ------------------------------------------------------------------ *
 * Retro — fixed A4 shop-bill page.
 *
 * Reproduces the classic handwritten/tradesman bill: one outer frame,
 * a letterhead band, No./Date + M/s + Party's GSTIN rows, an OPEN item
 * box (vertical column rules only, no line after each product), a
 * Rupees-in-words + TOTAL/CGST/SGST/G.TOTAL block and a Terms +
 * signature band with the seal pinned to the same spot on every page.
 *
 * The whole page is a fixed pixel budget so page 1 and every overflow
 * page are identical, and the PDF slicer can cut exactly on
 * `retro-page-*` boundaries.
 * ------------------------------------------------------------------ */

const TITLE_BY_TYPE = {
  TAX_INVOICE: "TAX INVOICE",
  PROFORMA_INVOICE: "PROFORMA INVOICE",
  QUOTATION: "QUOTATION",
  PURCHASE_ORDER: "PURCHASE ORDER",
};

const B = "1px solid #000000";

const DOTS = ".".repeat(200);

/* Filler used only when a value is missing (matches the printed blank
   form). `width` pins it to the right edge, otherwise it fills the row. */
const Dots = ({ flex = 1, width }) => (
  <span
    style={{
      flex: width ? undefined : flex,
      width,
      whiteSpace: "nowrap",
      overflow: "hidden",
      fontSize: "13.5px",
      lineHeight: 1.35,
      alignSelf: "flex-end",
      minWidth: 0,
    }}
  >
    {DOTS}
  </span>
);

const Frame = ({ children, pageId }) => (
  <div
    id={pageId}
    style={{
      width: RETRO_PAGE_METRICS.width,
      boxSizing: "border-box",
      border: "2px solid #000000",
      background: "#ffffff",
      color: "#000000",
      fontFamily: "Arial, Helvetica, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);

/* --------------------------------------------------------------- header */

const Letterhead = ({ business, title }) => {
  const addr1 = [business?.addressLine1, business?.addressLine2].filter(Boolean).join(", ");
  const addr2 = [business?.city, business?.state, business?.pincode ? "-" + business.pincode : null]
    .filter(Boolean).join(" ");
  const addrLine = [addr2, business?.email ? `Email: ${business.email}` : null].filter(Boolean).join("   ");
  // The header only grows for invoices that print the optional Specialist In
  // line, so every other page keeps its exact height and PDF cut points.
  const specialist = getSpecialistInLine(business);
  const headerH = RETRO_PAGE_METRICS.header + (specialist ? SPECIALIST_IN_EXTRA_H : 0);

  return (
    <div style={{ height: headerH, boxSizing: "border-box", borderBottom: B, padding: "7px 10px 8px", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "12.5px", fontWeight: 700, lineHeight: 1.3 }}>
        <span>GSTIN: {business?.gstIn || "-"}</span>
        <span style={{ textAlign: "right" }}>{business?.phone || ""}</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: "7px", textAlign: "center", fontSize: "14.5px", fontWeight: 700, textDecoration: "underline", letterSpacing: "0.6px" }}>
        {title}
      </div>
      <div style={{ textAlign: "center", fontSize: "31px", fontWeight: 800, letterSpacing: "1.5px", marginTop: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1 }}>
        {(business?.businessName || "BUSINESS NAME").toUpperCase()}
      </div>
      {/* specialist sits directly under the company name, address follows */}
      {specialist && (
        <div style={{ fontSize: "12.5px", lineHeight: "17px", marginTop: "3px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          SPECIALIST IN : {specialist}
        </div>
      )}
      <div style={{ fontSize: "12.5px", lineHeight: "17px", marginTop: "3px", textAlign: "center" }}>
        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{addr1}</div>
        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{addrLine}</div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- details */

/* No rules between these rows — only the letterhead rule above and the
   table rule below (the last row keeps `last`). Rows are vertically
   centred; each group is its own block so label + value always share one
   line box (one straight baseline). */
const DetailRow = ({ children, last }) => (
  <div
    style={{
      height: RETRO_PAGE_METRICS.details / 3,
      boxSizing: "border-box",
      borderBottom: last ? B : "none",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "0 10px",
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);

const LABEL = { fontSize: "16px", fontWeight: 700, whiteSpace: "nowrap" };
const VALUE = { fontSize: "15px", whiteSpace: "nowrap" };

/* `grow` fills the row so a right-hand group (Date:) lands on the far
   right; overflow clips instead of wrapping so nothing ever stacks. */
const Group = ({ grow, children }) => (
  <span
    style={{
      display: "block",
      flex: grow ? "1 1 auto" : "0 0 auto",
      minWidth: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      lineHeight: 1.3,
    }}
  >
    {children}
  </span>
);

const Field = ({ label, value }) => (
  <>
    <span style={LABEL}>{label}</span>
    {value ? (
      <span style={{ ...VALUE, marginLeft: "5px" }}>{value}</span>
    ) : (
      <span style={VALUE}>{DOTS}</span>
    )}
  </>
);

const Details = ({ invoiceNumber, form, customer }) => {
  const no = String(invoiceNumber || "").trim();
  const date = fmtDate(form?.invoiceDate);
  const party = [customer?.name, customer?.billingAddress].filter(Boolean).join(", ").trim();
  const gstin = String(customer?.gstIn || "").trim();

  return (
    <div>
      <DetailRow>
        <Group grow><Field label="No.:" value={no} /></Group>
        <Group><Field label="Date:" value={date} /></Group>
      </DetailRow>
      <DetailRow>
        <Group grow><Field label="M/s:" value={party} /></Group>
      </DetailRow>
      <DetailRow last>
        <Group grow><Field label={"Party\u2019s GSTIN:"} value={gstin} /></Group>
      </DetailRow>
    </div>
  );
};

/* ----------------------------------------------------------- item box */

const ItemHead = () => {
  const th = {
    boxSizing: "border-box",
    borderBottom: B,
    background: "#d6d6d6",
    fontSize: "12.5px",
    fontWeight: 700,
    textAlign: "center",
    padding: "0 4px",
    lineHeight: 1.15,
    verticalAlign: "middle",
    letterSpacing: "0.3px",
  };
  // No./PARTICULARS/QTY./RATE span both header lines so the grey block is
  // continuous — only AMOUNT is split into Rs. / Ps.
  const span = { ...th, height: "39px" };
  const amount = { ...th, height: "24px", width: COLS.rs + COLS.ps, verticalAlign: "bottom" };
  const sub = { ...th, height: "15px", fontWeight: 400, fontSize: "11.5px", verticalAlign: "top" };
  return (
    // Rules come from the same absolute overlay as the item rows/totals —
    // collapsed-table borders are centred half a device-pixel off and the
    // header lines no longer touched the column rules below.
    <div style={{ position: "relative", height: "39px", boxSizing: "border-box" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      {/* Fixed layout splits a colSpan cell evenly, which put the Rs./Ps.
          divider at 634 while the body rules sit at RULE_X (662). The col
          widths pin every header rule to the same coordinates as the rows. */}
      <colgroup>
        <col style={{ width: COLS.no }} />
        <col style={{ width: COLS.particulars }} />
        <col style={{ width: COLS.hsn }} />
        <col style={{ width: COLS.qty }} />
        <col style={{ width: COLS.rate }} />
        <col style={{ width: COLS.rs }} />
        <col style={{ width: COLS.ps }} />
      </colgroup>
      <tbody>
        <tr>
          <td rowSpan={2} style={{ ...span, width: COLS.no }}>No.</td>
          <td rowSpan={2} style={{ ...span, width: COLS.particulars }}>PARTICULARS</td>
          <td rowSpan={2} style={{ ...span, width: COLS.hsn, lineHeight: "14px" }}>HSN<br />CODE</td>
          <td rowSpan={2} style={{ ...span, width: COLS.qty }}>QTY.</td>
          <td rowSpan={2} style={{ ...span, width: COLS.rate }}>RATE</td>
          <td style={amount} colSpan={2}>AMOUNT</td>
        </tr>
        <tr>
          <td style={{ ...sub, width: COLS.rs }}>Rs.</td>
          <td style={{ ...sub, width: COLS.ps }}>Ps.</td>
        </tr>
      </tbody>
    </table>
      {RULE_X.map((x) => (
        <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}px`, width: "1px", background: "#000000" }} />
      ))}
    </div>
  );
};

const ItemBox = ({ pageItems, startIndex }) => {
  const td = {
    padding: "4px 6px",
    fontSize: "12.5px",
    lineHeight: "16px",
    verticalAlign: "middle",
    height: `${ROW_H}px`,
    boxSizing: "border-box",
    overflow: "hidden",
  };
  return (
    <div style={{ height: RETRO_PAGE_METRICS.body, boxSizing: "border-box", borderBottom: B, position: "relative", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <tbody>
          {pageItems.map((item, i) => (
            <tr key={i} id={`retro-item-${startIndex + i}`}>
              <td style={{ ...td, width: COLS.no, textAlign: "center" }}>{startIndex + i + 1}</td>
              <td style={{ ...td, width: COLS.particulars, textAlign: "left", overflowWrap: "anywhere" }}>{item.itemName}</td>
              {/* 8-digit codes wrapped to a second line here, growing every
                  row by 14px past what the chunk estimator accounts for and
                  clipping the last row at the body's overflow:hidden — keep
                  them on one line at a size that fits the 62px column */}
              <td style={{ ...td, width: COLS.hsn, textAlign: "center", padding: "4px 3px", fontSize: "11px", whiteSpace: "nowrap" }}>{item.hsn || ""}</td>
              <td style={{ ...td, width: COLS.qty, textAlign: "center" }}>{fmtQty(item.qty)}</td>
              <td style={{ ...td, width: COLS.rate, textAlign: "right" }}>{formatINR(item.rate)}</td>
              <td style={{ ...td, width: COLS.rs, textAlign: "right" }}>{splitAmount(item.__amount).rs}</td>
              <td style={{ ...td, width: COLS.ps, textAlign: "right" }}>{splitAmount(item.__amount).ps}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* full-height column rules: rows carry no lines, the frame does */}
      {RULE_X.map((x) => (
        <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}px`, width: "1px", background: "#000000" }} />
      ))}
    </div>
  );
};

/* -------------------------------------------------------------- totals */

const Totals = ({ subtotal, cgst, sgst, grand, words, pctLabel }) => {
  const label = {
    height: `${ROW_H}px`,
    boxSizing: "border-box",
    borderBottom: B,
    fontSize: "13.5px",
    fontWeight: 700,
    padding: "0 10px",
    textAlign: "left",
    verticalAlign: "middle",
  };
  const money = {
    height: `${ROW_H}px`,
    boxSizing: "border-box",
    borderBottom: B,
    fontSize: "13px",
    fontWeight: 700,
    padding: "0 8px",
    textAlign: "right",
    verticalAlign: "middle",
  };
  const shade = { background: "#d6d6d6" };
  const rs = splitAmount;
  const rows = [
    { key: "total", text: "TOTAL", val: subtotal, shade: true },
    { key: "cgst", text: "CGST", pct: true, val: cgst, shade: false },
    { key: "sgst", text: "SGST", pct: true, val: sgst, shade: false },
    { key: "grand", text: "G. TOTAL", val: grand, shade: true },
  ];

  return (
    <div style={{ position: "relative" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      {/* same column pins as the item box so the Rs./Ps. rule runs straight
          from the AMOUNT header through every row and totals line */}
      <colgroup>
        <col style={{ width: COLS.no + COLS.particulars }} />
        <col style={{ width: COLS.hsn }} />
        <col style={{ width: COLS.qty + COLS.rate }} />
        <col style={{ width: COLS.rs }} />
        <col style={{ width: COLS.ps }} />
      </colgroup>
      <tbody>
        <tr>
          <td
            rowSpan={4}
            style={{
              width: COLS.no + COLS.particulars,
              borderBottom: B,
              boxSizing: "border-box",
              height: `${RETRO_PAGE_METRICS.totals}px`,
              padding: "7px 10px",
              verticalAlign: "top",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", fontSize: "12.5px" }}>
              <span style={{ whiteSpace: "nowrap" }}>Rupees in words :</span>
              {!words && <Dots />}
            </div>
            {words ? (
              <div style={{ fontSize: "12.5px", fontWeight: 700, marginTop: "4px", lineHeight: "16px", maxHeight: "52px", overflow: "hidden" }}>{words}</div>
            ) : (
              <>
                <div style={{ marginTop: "9px", fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden" }}>{DOTS}</div>
                <div style={{ marginTop: "9px", fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden" }}>{DOTS}</div>
              </>
            )}
          </td>
          {/* the HSN strip continues the item-box column rule; E.&O.E. lives in its corner */}
          <td
            rowSpan={4}
            style={{ width: COLS.hsn, borderBottom: B, boxSizing: "border-box", position: "relative" }}
          >
            <div style={{ position: "absolute", right: "5px", bottom: "4px", fontSize: "11.5px", fontWeight: 700 }}>E.&amp;O.E.</div>
          </td>
          <td style={{ ...label, ...rows[0].shade ? shade : {}, width: COLS.qty + COLS.rate }}>{rows[0].text}</td>
          <td style={{ ...money, ...rows[0].shade ? shade : {}, width: COLS.rs }}>{rs(rows[0].val).rs}</td>
          <td style={{ ...money, ...rows[0].shade ? shade : {}, width: COLS.ps }}>{rs(rows[0].val).ps}</td>
        </tr>
        {rows.slice(1).map((r) => (
          <tr key={r.key}>
            <td style={{ ...label, ...r.shade ? shade : {} }}>
              {r.text}
              {r.pct ? <span style={{ float: "right", paddingRight: "14px", fontWeight: 700 }}>{pctLabel}</span> : null}
            </td>
            <td style={{ ...money, ...r.shade ? shade : {} }}>{rs(r.val).rs}</td>
            <td style={{ ...money, ...r.shade ? shade : {} }}>{rs(r.val).ps}</td>
          </tr>
        ))}
      </tbody>
    </table>
      {/* only the rules that have a real column boundary in totals */}
      {[RULE_X[1], RULE_X[2], RULE_X[4], RULE_X[5]].map((x) => (
        <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}px`, width: "1px", background: "#000000" }} />
      ))}
    </div>
  );
};

/* -------------------------------------------------------------- footer */

const FooterBand = ({ business, terms, sealVisible, sealType, sigSrc }) => (
  <div style={{ height: RETRO_PAGE_METRICS.footer, display: "flex", boxSizing: "border-box", position: "relative" }}>
    <div style={{ width: COLS.no + COLS.particulars, boxSizing: "border-box", padding: "7px 10px", overflow: "hidden" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>Terms &amp; Conditions :</div>
      <div style={{ fontSize: "11.5px", lineHeight: "15px" }}>{terms}</div>
    </div>
    <div style={{ flex: 1, position: "relative", padding: "7px 10px", overflow: "hidden" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        For {(business?.businessName || "BUSINESS NAME").toUpperCase()}
      </div>
      <div style={{ position: "absolute", right: "26px", top: "22px" }}>
        {sealVisible && sealType === "stamp" && (
          <CompanyStamp
            companyName={business?.businessName || "COMPANY NAME"}
            addressLine1={business?.addressLine1 || ""}
            addressLine2={[business?.addressLine2, business?.city, business?.state].filter(Boolean).join(", ")}
            phone={business?.phone ? `Ph: ${business.phone}` : ""}
            email={business?.email || ""}
            width={150}
            color="#0A4BFF"
          />
        )}
        {sealVisible && sealType !== "stamp" && (
          <CompanySeal companyName={business?.businessName || "COMPANY NAME"} year={new Date().getFullYear()} size={74} color="#0A4BFF" />
        )}
        {!sealVisible && sigSrc && (
          <img src={sigSrc} alt="signature" style={{ height: "44px", objectFit: "contain", display: "block" }} />
        )}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "4px", textAlign: "center", fontSize: "12.5px" }}>Signature</div>
    </div>
    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${COLS.no + COLS.particulars}px`, width: "1px", background: "#000000" }} />
  </div>
);

/* --------------------------------------------------------------- page */

const RetroPage = ({ pageId, chunks, startIndex, shared }) => (
  <Frame pageId={pageId}>
    <Letterhead business={shared.business} title={shared.title} />
    <Details invoiceNumber={shared.displayInvNo} form={shared.form} customer={shared.customer} />
    <ItemHead />
    <ItemBox pageItems={chunks} startIndex={startIndex} />
    <Totals
      subtotal={shared.taxableTotal}
      cgst={shared.cgst}
      sgst={shared.sgst}
      grand={shared.grand}
      words={shared.words}
      pctLabel={shared.pctLabel}
    />
    <FooterBand
      business={shared.business}
      terms={shared.terms}
      sealVisible={shared.sealVisible}
      sealType={shared.sealType}
      sigSrc={shared.sigSrc}
    />
  </Frame>
);

/* ----------------------------------------------------------- component */

const InvoiceTemplateRetro = React.forwardRef(
  ({ business, customer, form, items, totals, discountPercent, type, invoiceNumber }, ref) => {
    const all = (items || []).filter((i) => i?.itemName?.trim() && parseFloat(i?.qty) > 0);
    const chunks = chunkRetroItems(all);

    const subtotal = parseFloat(totals?.subtotal) || 0;
    const discPct = parseFloat(discountPercent) || 0;
    const discAmt = (subtotal * Math.min(discPct, 100)) / 100;
    const taxableTotal = subtotal - discAmt;
    const ratio = subtotal > 0 ? taxableTotal / subtotal : 0;

    let cgst = 0;
    let sgst = 0;
    const rates = new Set();
    all.forEach((item) => {
      const gst = parseFloat(item.gstPercentage) || 0;
      rates.add(gst);
      const itemTaxable = (parseFloat(item.taxableValue) || (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)) * ratio;
      cgst += (itemTaxable * (gst / 2)) / 100;
      sgst += (itemTaxable * (gst / 2)) / 100;
    });

    const grand = parseFloat(totals?.grandTotal) || taxableTotal + cgst + sgst;
    const singleRate = rates.size === 1 ? [...rates][0] : null;
    const pctLabel = singleRate ? `${singleRate / 2} %` : "";

    const pageItems = (page) =>
      page.map((item) => ({
        ...item,
        __amount:
          parseFloat(item.taxableValue) ||
          (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0),
      }));

    const shared = {
      business,
      customer,
      form,
      title: TITLE_BY_TYPE[type] || (type === "PROFORMA_INVOICE" ? "PROFORMA INVOICE" : "TAX INVOICE"),
      displayInvNo: invoiceNumber || "",
      taxableTotal,
      cgst,
      sgst,
      grand,
      words: grand > 0 ? numberToWords(grand) : "",
      pctLabel,
      terms: (form?.notes && form.notes.trim()) || "Goods once sold cannot be taken back or exchanged.",
      sealVisible: typeof window !== "undefined" && window.localStorage?.getItem("show_seal") === "true",
      sealType: (typeof window !== "undefined" && window.localStorage?.getItem("seal_type")) || "round",
      sigSrc: business?.signature ? `data:image/png;base64,${business.signature}` : null,
    };

    const offsets = chunks.reduce((acc, chunk, i) => {
      acc.push(i === 0 ? 0 : acc[i - 1] + chunks[i - 1].length);
      return acc;
    }, []);
    return (
      <div ref={ref} style={{ width: RETRO_PAGE_METRICS.width, margin: "0 auto", background: "#ffffff" }}>
        {chunks.map((chunk, i) => {
          const startIndex = offsets[i];
          return (
            <div key={i} style={{ marginBottom: i < chunks.length - 1 ? RETRO_PAGE_METRICS.gap : 0 }}>
              <RetroPage
                pageId={`retro-page-${i}`}
                chunks={pageItems(chunk)}
                startIndex={startIndex}
                shared={shared}
              />
            </div>
          );
        })}
      </div>
    );
  }
);

InvoiceTemplateRetro.displayName = "InvoiceTemplateRetro";
export default InvoiceTemplateRetro;
