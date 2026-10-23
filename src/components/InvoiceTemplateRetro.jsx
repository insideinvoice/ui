import React from "react";
import SealOverlay from "./SealOverlay";
import { resolveSeal } from "../utils/seal";
import { resolveSealConfig, sealSpecAttribute } from "../utils/sealConfig";
import { asImageSrc } from "../utils/imageSrc";
import { numberToWords, formatINR } from "../utils/invoiceFormat";
import { computeInvoiceTotals } from "../utils/invoiceTotals";
import { getSpecialistInLine, SPECIALIST_IN_EXTRA_H } from "../utils/specialistIn";
import {
  RETRO_PAGE_METRICS,
  RETRO_CAPACITY_NOTE,
  retroCols,
  retroRuleX,
  retroCharsPerLine,
  ROW_H,
  splitAmount,
  fmtQtyUnit,
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

/* white space below the terms/signature band; the band's column rule runs
   through it too so the particulars-right line meets the frame's bottom edge */
const BOTTOM_SPACER = 28;

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

/* Auto-fit a single line: the text starts at `base` px and the font shrinks
   (never wraps, never clips, no ellipsis) until the rendered width fits the
   padded box. Measured in a layout effect against the real DOM, so both the
   on-screen share page and the html2canvas PDF capture always see the final
   size — the letterhead's fixed pixel budget is untouched (height stays
   pinned by the wrapper, only the glyphs shrink). */
const FitLine = ({ base, min = 10, text, style }) => {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    const cs = getComputedStyle(parent);
    const avail =
      parent.clientWidth -
      (parseFloat(cs.paddingLeft) || 0) -
      (parseFloat(cs.paddingRight) || 0);
    if (!(avail > 0)) return;
    let size = base;
    el.style.fontSize = `${size}px`;
    // A couple of passes: letter-spacing is constant px, so the first
    // proportional guess slightly overshoots — re-measure and settle.
    for (let i = 0; i < 4; i++) {
      const w = el.offsetWidth;
      if (w <= avail || size <= min) break;
      size = Math.max(min, Math.floor(((size * avail) / w) * 10) / 10);
      el.style.fontSize = `${size}px`;
    }
  }, [text, base, min]);
  return (
    <span ref={ref} data-fitline="" style={{ display: "inline-block", whiteSpace: "nowrap", ...style }}>
      {text}
    </span>
  );
};

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
    }}
  >
    {children}
  </div>
);

/* --------------------------------------------------------------- header */

const Letterhead = ({ business, title, subNote }) => {
  const addr1 = [business?.addressLine1, business?.addressLine2].filter(Boolean).join(", ");
  const addr2 = [business?.city, business?.state, business?.pincode ? "-" + business.pincode : null]
    .filter(Boolean).join(" ");
  const addrLine = [addr2, business?.email ? `Email: ${business.email}` : null].filter(Boolean).join("   ");
  // The header only grows for invoices that print the optional Specialist In
  // line, so every other page keeps its exact height and PDF cut points.
  const specialist = getSpecialistInLine(business);
  const headerH = RETRO_PAGE_METRICS.header + (specialist ? SPECIALIST_IN_EXTRA_H : 0);
  // Proforma adds a second heading line; the header is a fixed, clipped box
  // (PDF cut points), so the company name tightens (27px / lineHeight 1) to
  // keep the untouched 112px (+18px specialist) budget.
  const twoLine = Boolean(subNote);

  return (
    <div style={{ height: headerH, boxSizing: "border-box", borderBottom: B, padding: "7px 10px 8px", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "12.5px", fontWeight: 700, lineHeight: 1.3 }}>
        <span>GSTIN: {business?.gstIn || "-"}</span>
        <span style={{ textAlign: "right" }}>{business?.phone || ""}</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: twoLine ? "3px" : "7px", textAlign: "center", fontSize: "14.5px", fontWeight: 700, letterSpacing: "0.6px", lineHeight: 1.3 }}>
        <span style={{ textDecoration: "underline" }}>{title}</span>
        {subNote && (
          <div style={{ fontSize: "9.5px", letterSpacing: "1px", lineHeight: 1.2, fontWeight: 700 }}>
            {subNote}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: twoLine ? "27px" : "34.1px", marginTop: twoLine ? "12px" : "6px", whiteSpace: "nowrap", overflow: "hidden", paddingLeft: 62, paddingRight: 62 }}>
        <FitLine base={twoLine ? 27 : 31} min={10} text={(business?.businessName || "BUSINESS NAME").toUpperCase()} style={{ fontWeight: 800, letterSpacing: "1.5px", lineHeight: twoLine ? 1 : 1.1 }} />
      </div>
      {/* specialist sits directly under the company name, address follows */}
      {specialist && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "17px", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", paddingLeft: 62, paddingRight: 62 }}>
          <FitLine base={12.5} min={8} text={`SPECIALIST IN : ${specialist}`} style={{ lineHeight: "17px" }} />
        </div>
      )}
      <div style={{ fontSize: "12.5px", marginTop: "3px", textAlign: "center", paddingLeft: 62, paddingRight: 62 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "17px", whiteSpace: "nowrap", overflow: "hidden" }}>
          <FitLine base={12.5} min={8} text={addr1} style={{ lineHeight: "17px" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "17px", whiteSpace: "nowrap", overflow: "hidden" }}>
          <FitLine base={12.5} min={8} text={addrLine} style={{ lineHeight: "17px" }} />
        </div>
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

const ItemHead = ({ layout }) => {
  const { cols, ruleX, showHnSac } = layout;
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
  const amount = { ...th, height: "24px", width: cols.rs + cols.ps, verticalAlign: "bottom" };
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
        <col style={{ width: cols.no }} />
        <col style={{ width: cols.particulars }} />
        {showHnSac && <col style={{ width: cols.hsn }} />}
        <col style={{ width: cols.qty }} />
        <col style={{ width: cols.rate }} />
        <col style={{ width: cols.rs }} />
        <col style={{ width: cols.ps }} />
      </colgroup>
      <tbody>
        <tr>
          <td rowSpan={2} style={{ ...span, width: cols.no }}>No.</td>
          <td rowSpan={2} style={{ ...span, width: cols.particulars }}>PARTICULARS</td>
          {showHnSac && (
          <td rowSpan={2} style={{ ...span, width: cols.hsn, lineHeight: "14px" }}>HSN<br />CODE</td>
          )}
          <td rowSpan={2} style={{ ...span, width: cols.qty }}>QTY.</td>
          <td rowSpan={2} style={{ ...span, width: cols.rate }}>RATE</td>
          <td style={amount} colSpan={2}>AMOUNT</td>
        </tr>
        <tr>
          <td style={{ ...sub, width: cols.rs }}>Rs.</td>
          <td style={{ ...sub, width: cols.ps }}>Ps.</td>
        </tr>
      </tbody>
    </table>
      {/* vertical column rules, same overlay as the item rows/totals — but
          NOT the Rs./Ps. rule: on the printed form that rule starts at the
          item box, so the AMOUNT cell stays whole and its label reads centred */}
      {ruleX.slice(0, -1).map((x) => (
        <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}px`, width: "1px", background: "#000000" }} />
      ))}
    </div>
  );
};

const ItemBox = ({ pageItems, startIndex, height = RETRO_PAGE_METRICS.body, layout }) => {
  const { cols, ruleX, showHnSac } = layout;
  // Compact rows: natural height only (26px ≈ 5px below each line — no
  // stretching to fill the box). Rows stack from the top of the fixed box
  // and the leftover space stays as blank ruled area above the totals, like
  // a written shop bill. The box keeps its fixed height, so PDF page cut
  // points are unaffected; a wrapped name still grows its own row (td
  // height acts as a minimum) and chunkRetroItems' EST_ROW estimate already
  // budgets for that.
  const rowH = ROW_H;
  const td = {
    padding: "4px 6px",
    fontSize: "12.5px",
    lineHeight: "16px",
    verticalAlign: "middle",
    height: `${rowH}px`,
    boxSizing: "border-box",
    overflow: "hidden",
  };
  return (
    <div style={{ height, boxSizing: "border-box", borderBottom: B, position: "relative", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <tbody>
          {pageItems.map((item, i) => (
            <tr key={i} id={`retro-item-${startIndex + i}`}>
              <td style={{ ...td, width: cols.no, textAlign: "center" }}>{startIndex + i + 1}</td>
              <td style={{ ...td, width: cols.particulars, textAlign: "left", overflowWrap: "anywhere" }}>{item.itemName}</td>
              {/* 8-digit codes wrapped to a second line here, growing every
                  row by 14px past what the chunk estimator accounts for and
                  clipping the last row at the body's overflow:hidden — keep
                  them on one line at a size that fits the 62px column */}
              {showHnSac && (
              <td style={{ ...td, width: cols.hsn, textAlign: "center", padding: "4px 3px", fontSize: "11px", whiteSpace: "nowrap" }}>{item.hsn || ""}</td>
              )}
              <td style={{ ...td, width: cols.qty, textAlign: "center" }}>{fmtQtyUnit(item.qty, item.unit)}</td>
              <td style={{ ...td, width: cols.rate, textAlign: "right" }}>{formatINR(item.rate)}</td>
              <td style={{ ...td, width: cols.rs, textAlign: "right" }}>{splitAmount(item.__amount).rs}</td>
              <td style={{ ...td, width: cols.ps, textAlign: "right" }}>{splitAmount(item.__amount).ps}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* full-height column rules: rows carry no lines, the frame does */}
      {ruleX.map((x) => (
        <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}px`, width: "1px", background: "#000000" }} />
      ))}
    </div>
  );
};

/* -------------------------------------------------------------- totals */

const Totals = ({ gross, discAmt, discPct, cgst, sgst, igst, igstMode = false, grand, words, pctLabel, showTax = true, layout }) => {
  const { cols, ruleX, showHnSac } = layout;
  const shade = { background: "#d6d6d6" };
  const rs = splitAmount;
  const showDiscount = parseFloat(discAmt) > 0;
  const rows = [
    { key: "total", text: "TOTAL", val: gross, shade: true },
    ...(showDiscount
      ? [{ key: "discount", text: `Discount (${discPct}%)`, val: -Math.abs(parseFloat(discAmt) || 0), shade: false, discount: true }]
      : []),
    ...(showTax
      ? (igstMode
        // Inter-state: ONE IGST row at the full rate — never beside CGST/SGST.
        ? [{ key: "igst", text: "IGST", pct: true, val: igst, shade: false }]
        : [
          { key: "cgst", text: "CGST", pct: true, val: cgst, shade: false },
          { key: "sgst", text: "SGST", pct: true, val: sgst, shade: false },
        ])
      : []),
    { key: "grand", text: "G. TOTAL", val: grand, shade: true },
  ];
  // The block always owns the same fixed pixel budget (104px + one discount
  // line), spread across whichever rows exist — dropping the proforma's
  // CGST/SGST lines (or collapsing them to one IGST line) shrinks no frame
  // height, so the A4 cut never moves.
  const rowH = (RETRO_PAGE_METRICS.totals + (showDiscount ? ROW_H : 0)) / rows.length;
  const label = {
    height: `${rowH}px`,
    boxSizing: "border-box",
    borderBottom: B,
    fontSize: "13.5px",
    fontWeight: 700,
    padding: "0 10px",
    textAlign: "left",
    verticalAlign: "middle",
  };
  const money = {
    height: `${rowH}px`,
    boxSizing: "border-box",
    borderBottom: B,
    fontSize: "13px",
    fontWeight: 700,
    padding: "0 8px",
    textAlign: "right",
    verticalAlign: "middle",
  };
  // Left "Rupees in words" cell spans every totals row; its height must equal
  // the right-side rows so the block stays a fixed pixel budget on the page.
  const totalsH = rows.length * rowH;

  return (
    <div style={{ position: "relative" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      {/* same column pins as the item box so the Rs./Ps. rule runs straight
          from the AMOUNT header through every row and totals line */}
      <colgroup>
        <col style={{ width: cols.no + cols.particulars }} />
        {showHnSac && <col style={{ width: cols.hsn }} />}
        <col style={{ width: cols.qty + cols.rate }} />
        <col style={{ width: cols.rs }} />
        <col style={{ width: cols.ps }} />
      </colgroup>
      <tbody>
        <tr>
          <td
            rowSpan={rows.length}
            style={{
              width: cols.no + cols.particulars,
              borderBottom: B,
              boxSizing: "border-box",
              height: `${totalsH}px`,
              padding: "7px 10px",
              verticalAlign: "top",
              position: "relative",
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
            {/* Without the HSN strip there is no dedicated corner cell, so
                E.&O.E. keeps its bottom-right place inside this one. */}
            {!showHnSac && (
              <div style={{ position: "absolute", right: "8px", bottom: "4px", fontSize: "11.5px", fontWeight: 700 }}>E.&amp;O.E.</div>
            )}
          </td>
          {/* the HSN strip continues the item-box column rule; E.&O.E. lives in its corner */}
          {showHnSac && (
          <td
            rowSpan={rows.length}
            style={{ width: cols.hsn, borderBottom: B, boxSizing: "border-box", position: "relative" }}
          >
            <div style={{ position: "absolute", right: "5px", bottom: "4px", fontSize: "11.5px", fontWeight: 700 }}>E.&amp;O.E.</div>
          </td>
          )}
          <td style={{ ...label, ...rows[0].shade ? shade : {}, width: cols.qty + cols.rate }}>{rows[0].text}</td>
          <td style={{ ...money, ...rows[0].shade ? shade : {}, width: cols.rs }}>{rs(rows[0].val).rs}</td>
          <td style={{ ...money, ...rows[0].shade ? shade : {}, width: cols.ps }}>{rs(rows[0].val).ps}</td>
        </tr>
        {rows.slice(1).map((r) => (
          <tr key={r.key}>
            <td style={{ ...label, ...r.shade ? shade : {} }}>
              {r.text}
              {r.pct ? <span style={{ float: "right", paddingRight: "14px", fontWeight: 700 }}>{pctLabel}</span> : null}
            </td>
            <td style={{ ...money, ...(r.shade ? shade : {}), ...(r.discount ? { color: "#0a7d24" } : {}) }}>{rs(r.val).rs}</td>
            <td style={{ ...money, ...(r.shade ? shade : {}), ...(r.discount ? { color: "#0a7d24" } : {}) }}>{rs(r.val).ps}</td>
          </tr>
        ))}
      </tbody>
    </table>
      {/* only the rules that have a real column boundary in totals */}
      {(showHnSac
        ? [ruleX[1], ruleX[2], ruleX[4], ruleX[5]]
        : [ruleX[1], ruleX[2], ruleX[3], ruleX[4]]
      ).map((x) => (
        <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}px`, width: "1px", background: "#000000" }} />
      ))}
    </div>
  );
};

/* -------------------------------------------------------------- footer */

const FooterBand = ({ business, terms, sigSrc, layout }) => (
  <div style={{ height: RETRO_PAGE_METRICS.footer, display: "flex", boxSizing: "border-box", position: "relative" }}>
    <div style={{ width: layout.cols.no + layout.cols.particulars, boxSizing: "border-box", padding: "7px 10px", overflow: "hidden" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>Terms &amp; Conditions :</div>
      <div style={{ fontSize: "11.5px", lineHeight: "15px" }}>{terms}</div>
    </div>
    <div style={{ flex: 1, position: "relative", padding: "7px 10px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        For {(business?.businessName || "BUSINESS NAME").toUpperCase()}
      </div>
      {/* The signature stays dead-centre in the column (image over its label) and the
          seal is aligned with that signature row — painted after it, so the seal is
          never the thing that gets covered up. */}
      {sigSrc && (
        <img
          src={sigSrc}
          alt="signature"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "14px",
            margin: "0 auto",
            height: "68px",
            maxWidth: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "1px", textAlign: "center", fontSize: "12.5px" }}>Signature</div>
    </div>
    <div style={{ position: "absolute", top: 0, bottom: -BOTTOM_SPACER, left: `${layout.cols.no + layout.cols.particulars}px`, width: "1px", background: "#000000" }} />
  </div>
);

/* --------------------------------------------------------------- page */

const RetroPage = ({ pageId, chunks, startIndex, shared, pageIndex = 0 }) => (
  <Frame pageId={pageId}>
    <Letterhead business={shared.business} title={shared.title} subNote={shared.subNote} />
    <Details invoiceNumber={shared.displayInvNo} form={shared.form} customer={shared.customer} />
    <ItemHead layout={shared.layout} />
    <ItemBox pageItems={chunks} startIndex={startIndex} height={shared.bodyH} layout={shared.layout} />
    <Totals
      gross={shared.gross}
      discAmt={shared.discAmt}
      discPct={shared.discPct}
      cgst={shared.cgst}
      sgst={shared.sgst}
      igst={shared.igst}
      igstMode={shared.igstMode}
      grand={shared.grand}
      words={shared.words}
      pctLabel={shared.pctLabel}
      showTax={shared.showTax}
      layout={shared.layout}
    />
    <FooterBand
      business={shared.business}
      terms={shared.terms}
      sigSrc={shared.sigSrc}
      layout={shared.layout}
    />
    {/* breathing room between the terms/signature band and the frame edge */}
    <div style={{ height: `${BOTTOM_SPACER}px`, boxSizing: "border-box" }} />
    {shared.sealVisible && (shared.sealAllPages || pageIndex === 0) && (
      <SealOverlay business={shared.business} type={shared.sealType} />
    )}
  </Frame>
);

/* ----------------------------------------------------------- component */

const InvoiceTemplateRetro = React.forwardRef(
  ({ business, customer, form, items, discountPercent, type, invoiceNumber, taxMode }, ref) => {
    const all = (items || []).filter((i) => i?.itemName?.trim() && parseFloat(i?.qty) > 0);
    // Display-only HSN/SAC switch: hidden means the whole column disappears
    // and PARTICULARS absorbs its width — frame width and cut points unchanged.
    const showHnSac = !business || business.showHnSac !== false;
    const cols = retroCols(showHnSac);
    const ruleX = retroRuleX(cols);
    // The Specialist In line grows the letterhead; take the same height out of
    // the open item box so the outer frame always equals one A4 page — the PDF
    // slicer cuts on frame boundaries and anything taller spills onto page 2.
    const bodyH =
      RETRO_PAGE_METRICS.body -
      (getSpecialistInLine(business) ? SPECIALIST_IN_EXTRA_H : 0);
    const chunks = chunkRetroItems(all, bodyH, retroCharsPerLine(cols));

    const calc = computeInvoiceTotals(items, discountPercent, taxMode);
    const isProforma = type === "PROFORMA_INVOICE";
    const igstMode = taxMode === "IGST";
    // A Discount row takes one extra totals line (ROW_H). Shrink the open item
    // box by the same amount so the fixed A4 frame budget is unchanged and the
    // PDF slicer still cuts exactly on the page boundary.
    const hasDiscount = calc.discountAmount > 0;
    const discountRowH = hasDiscount ? ROW_H : 0;

    const rates = new Set();
    all.forEach((item) => {
      rates.add(parseFloat(item.gstPercentage) || 0);
    });

    const grand = isProforma ? calc.taxableAmount : calc.grandTotal;
    const singleRate = rates.size === 1 ? [...rates][0] : null;
    // Rate shown beside the tax rows: the FULL GST rate in IGST mode, the
    // halved split rate otherwise (as always).
    const pctLabel = singleRate ? (igstMode ? `${singleRate} %` : `${singleRate / 2} %`) : "";

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
      layout: { cols, ruleX, showHnSac },
      title: TITLE_BY_TYPE[type] || (type === "PROFORMA_INVOICE" ? "PROFORMA INVOICE" : "TAX INVOICE"),
      subNote: isProforma ? "— NOT A TAX INVOICE —" : null,
      showTax: !isProforma,
      displayInvNo: invoiceNumber || "",
      bodyH: bodyH - discountRowH,
      gross: calc.subtotal,
      discAmt: calc.discountAmount,
      discPct: calc.discountPercent,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      igstMode,
      grand,
      words: grand > 0 ? numberToWords(grand) : "",
      pctLabel,
      terms: (form?.notes && form.notes.trim()) || "Goods once sold cannot be taken back or exchanged.",
      ...resolveSeal(business),
      sealAllPages: resolveSealConfig(business).allPages !== false,
      sigSrc: asImageSrc(business?.signature),
    };

    const offsets = chunks.reduce((acc, chunk, i) => {
      acc.push(i === 0 ? 0 : acc[i - 1] + chunks[i - 1].length);
      return acc;
    }, []);
    return (
      <div ref={ref} data-ii-seal-spec={sealSpecAttribute(business)} style={{ width: RETRO_PAGE_METRICS.width, margin: "0 auto", background: "#ffffff", position: "relative" }}>
        {chunks.map((chunk, i) => {
          const startIndex = offsets[i];
          return (
            <div key={i} style={{ marginBottom: i < chunks.length - 1 ? RETRO_PAGE_METRICS.gap : 0 }}>
              <RetroPage
                pageId={`retro-page-${i}`}
                chunks={pageItems(chunk)}
                startIndex={startIndex}
                shared={shared}
                pageIndex={i}
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
