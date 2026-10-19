import React, { useMemo, useState } from "react";
import CompanySeal from "./CompanySeal";
import CompanyStamp from "./CompanyStamp";
import { resolveSeal } from "../utils/seal";
import { numberToWords, formatINR } from "../utils/invoiceFormat";
import { computeInvoiceTotals } from "../utils/invoiceTotals";
import { jurisdictionLine } from "../utils/jurisdiction";
import { getSpecialistInLine, SPECIALIST_IN_EXTRA_H } from "../utils/specialistIn";
import {
  ENT_PAGE_METRICS as M,
  entCols,
  distributeBreakupRows,
  ENT_DESC_FONT_SIZE,
  ENT_FONT_STACK,
  groupTaxSummaryRows,
  packEntPages,
  resolveEntRow,
} from "../utils/enterprisePage";

/* ------------------------------------------------------------------ *
 * Enterprise — black & white corporate tax invoice (template-32).
 *
 * A fixed-A4-page template in the same family as the Retro shop-bill:
 * every page is an exact pixel budget, overflow items roll onto
 * continuation pages, and each page repeats a slim header so the item
 * table's lines CLOSE at every page edge (the PDF slicer cuts precisely
 * on the "ent-page-*" frame boundaries — nothing is ever sliced open).
 *
 * Page 1 carries a letterhead with the business logo in a fixed 75×75
 * square top-left box (upload from Settings → Business Logo; no upload
 * → the company block alone sits at the left margin). Page furniture:
 * seller | bill-to | invoice-details
 * strip, items grid, per-product tax breakup + totals + amount-in-words
 * and a bank/declaration/signature band on the FINAL page only,
 * jurisdiction /page-number footer on every page. Page frames are
 * content-height (budgeted to never exceed A4), so the document grows
 * with the items and the footer always sits directly under the band.
 * ------------------------------------------------------------------ */

const INK = "#111111";      // strong rules, headings
const GRID = "#c9c9c9";     // inner column rules
const LINE = "#e2e2e2";     // item row rules
const PANEL = "#f1f1f1";    // table header fill
const TOTAL_BG = "#f7f7f7"; // summary total-row fill
const MUTED = "#585858";    // small-print text
const FAINT = "#8a8a8a";    // caps labels
const STAMP_BLUE = "#0A4BFF"; // rubber-stamp ink (same blue as Retro/Original)

const FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

const TITLE_BY_TYPE = {
  TAX_INVOICE: "TAX INVOICE",
  PROFORMA_INVOICE: "PROFORMA INVOICE",
  QUOTATION: "QUOTATION",
  PURCHASE_ORDER: "PURCHASE ORDER",
};

const capsLabel = (text) => (
  <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "1.2px", color: FAINT, marginBottom: "3px" }}>
    {text}
  </div>
);

const nowrap = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

/* --------------------------------------------------------------- logo */

// Fixed SQUARE box: 75×75 — the only permitted logo box on this template, so a
// round/landscape/square upload always prints identically (object-fit contain
// letterboxes a non-square image inside the square frame). Sized to sit
// comfortably inside the 120px letterhead, and shared by EVERY invoice that
// uses this template (preview, PDF, e-mail, public share page).
const LOGO_BOX_W = 75;
const LOGO_BOX_H = 75;

/* html2canvas — the PDF engine — ignores `object-fit`, so a non-square upload
   stretched to its frame printed as a distorted rectangle in the PDF while
   looking fine on screen. Measuring the natural size and setting the
   CONTAIN-FIT dimensions explicitly makes screen and paper identical: a
   square logo stays square (and round stays round), centered in its box. */
const FitLogo = ({ src }) => {
  const [fit, setFit] = useState(null);
  const onLoad = (e) => {
    const nw = e.currentTarget.naturalWidth;
    const nh = e.currentTarget.naturalHeight;
    if (!nw || !nh || fit) return;
    const s = Math.min(LOGO_BOX_W / nw, LOGO_BOX_H / nh);
    setFit({ w: Math.round(nw * s), h: Math.round(nh * s) });
  };
  return (
    <div style={{
      width: `${LOGO_BOX_W}px`, height: `${LOGO_BOX_H}px`,
      /* NO frame/border: the upload prints exactly as the user supplied it */
      overflow: "hidden", background: "#ffffff", flexShrink: 0,
      marginRight: "18px",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <img
        src={src}
        alt="logo"
        onLoad={onLoad}
        style={fit
          ? { width: `${fit.w}px`, height: `${fit.h}px`, display: "block" }
          : { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
};

/* ----------------------------------------------------------- header */

const Letterhead = ({ business, title, subNote, headH }) => {
  const logoSrc = asDataUri(business?.logo);
  const addr1 = [business?.addressLine1, business?.addressLine2].filter(Boolean).join(", ");
  const addr2 = [business?.city, business?.state, business?.pincode ? "-" + business.pincode : ""]
    .filter(Boolean).join(", ");
  const contact = [
    business?.gstIn ? `GSTIN: ${business.gstIn}` : "",
    business?.phone ? `Ph: ${business.phone}` : "",
  ].filter(Boolean).join("  ·  ");
  const specialist = getSpecialistInLine(business);

  return (
    <div style={{
      height: headH, boxSizing: "border-box", borderBottom: `1px solid ${INK}`,
      padding: "0 22px", overflow: "hidden", background: "#ffffff",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "relative",
    }}>
      {/* left cluster: logo + company block. The company text occupies the
          REMAINING space up to the title — a fixed slot, not a flexible one —
          so a long name/address wraps inside the block instead of shoving
          sideways over/under the TAX INVOICE label. */}
      <div style={{ display: "flex", alignItems: "center", flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
        {logoSrc && (
          /* logo — fixed square box; FitLogo sets explicit contain-fit
             dimensions so the PDF engine (html2canvas, which ignores
             object-fit) can't stretch a landscape or round upload */
          <FitLogo src={logoSrc} />
        )}
        <div style={{ minWidth: 0, maxWidth: "100%" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "0.2px", lineHeight: "20px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {business?.businessName || "Business Name"}
          </div>
          {[addr1, addr2].filter(Boolean).map((line, i) => (
            <div key={i} style={{ fontSize: "9.5px", color: MUTED, lineHeight: "13px", marginTop: i === 0 ? "2px" : 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>{line}</div>
          ))}
          {contact && (
            <div style={{ fontSize: "9.5px", color: MUTED, lineHeight: "13px", overflowWrap: "anywhere", wordBreak: "break-word" }}>{contact}</div>
          )}
          {business?.email && (
            <div style={{ fontSize: "9.5px", color: MUTED, lineHeight: "13px", overflowWrap: "anywhere", wordBreak: "break-word" }}>{business.email}</div>
          )}
          {specialist && (
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.8px", lineHeight: "12px", marginTop: "2px", overflowWrap: "anywhere", wordBreak: "break-word" }}>
              SPECIALIST IN: {specialist}
            </div>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "18px" }}>
        <div style={{ fontSize: "19px", fontWeight: 700, letterSpacing: "3px", color: INK, lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ fontSize: "8.5px", fontStyle: "italic", color: MUTED, marginTop: "3px" }}>
          {subNote || "(ORIGINAL FOR RECIPIENT)"}
        </div>
      </div>
    </div>
  );
};

const ContHead = ({ business, title, pageNo, totalPages }) => (
  <div style={{
    height: M.contHead, boxSizing: "border-box", borderBottom: `1px solid ${INK}`,
    background: "#f7f7f7", padding: "8px 14px", display: "flex",
    justifyContent: "space-between", alignItems: "center", overflow: "hidden",
  }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: "11px", fontWeight: 700, ...nowrap }}>
        {business?.businessName || "Business Name"}
      </div>
      <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "1.2px", color: FAINT, marginTop: "1px" }}>
        {title} — CONTINUED
      </div>
    </div>
    <div style={{ textAlign: "right", fontSize: "10px", fontWeight: 700, color: INK }}>
      Page {pageNo} of {totalPages}
    </div>
  </div>
);

/* -------------------------------------------------------- party block */

const PartyCell = ({ label, children }) => (
  <div style={{
    padding: "8px 12px", overflow: "hidden",
    borderRight: "1px solid " + GRID, minHeight: 0,
    flex: "1 1 0", minWidth: 0, /* equal third — never squeeze on long content */
  }}>
    {capsLabel(label)}
    {children}
  </div>
);

const InfoLine = ({ children }) => (
  <div style={{ fontSize: "9.5px", color: MUTED, lineHeight: "13px", wordBreak: "break-word" }}>{children}</div>
);

const PartyRow = ({
  business, customer, form, displayInvNo, isProforma,
}) => {
  const detailRows = [
    [isProforma ? "Proforma Ref." : "Invoice No.", displayInvNo || "-", true],
    ["Invoice Date", form?.invoiceDate || "-", false],
    [isProforma ? "Valid Until" : "Due Date", form?.dueDate || "-", false],
    ["Payment Terms", form?.paymentTerms || "-", false],
    ["Place of Supply", form?.placeOfSupply || "-", false],
  ];

  return (
    <div style={{
      height: M.partyRow, boxSizing: "border-box", display: "flex",
      borderBottom: `1px solid ${INK}`, overflow: "hidden",
    }}>
      {/* Seller */}
      <PartyCell label="SELLER">
        <div style={{ fontSize: "13px", fontWeight: 700, wordBreak: "break-word", marginBottom: "2px" }}>
          {business?.businessName || "Business Name"}
        </div>
        <InfoLine>{[business?.addressLine1, business?.addressLine2].filter(Boolean).join(", ") || "-"}</InfoLine>
        <InfoLine>{[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}</InfoLine>
        <InfoLine>GSTIN: {business?.gstIn || "-"}</InfoLine>
        <InfoLine>State: {business?.state || "-"} · Code: {business?.gstIn?.substring(0, 2) || "-"}</InfoLine>
      </PartyCell>

      {/* Bill to */}
      <PartyCell label="BILL TO">
        <div style={{ fontSize: "13px", fontWeight: 700, wordBreak: "break-word", marginBottom: "2px" }}>
          {customer?.name || "Customer Name"}
        </div>
        <InfoLine>{[customer?.billingAddress].filter(Boolean).join(", ") || "-"}</InfoLine>
        <InfoLine>Ph: {customer?.phone || "-"}{customer?.email ? ` · ${customer.email}` : ""}</InfoLine>
        <InfoLine>GSTIN: {customer?.gstIn || "-"}</InfoLine>
        <InfoLine>State: {customer?.state || "-"}</InfoLine>
      </PartyCell>

      {/* Invoice details */}
      <div style={{ padding: "8px 12px", overflow: "hidden", flex: 1, minWidth: 0 }}>
        {capsLabel("INVOICE DETAILS")}
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <tbody>
            {detailRows.map(([label, value, strong], i) => (
              <tr key={i} style={{ height: "20px" }}>
                <td style={{
                  fontSize: "9px", color: FAINT, padding: "0", width: "42%",
                  verticalAlign: "middle",
                }}>{label}</td>
                <td style={{
                  fontSize: strong ? "10.5px" : "10px", fontWeight: strong ? 700 : 600,
                  padding: "0 0 0 6px", verticalAlign: "middle",
                  overflow: "hidden", whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* -------------------------------------------------------- items table */

const HEAD_LABELS = {
  sl: "Sl No", hsn: "HSN/SAC", gst: "GST", qty: "Quantity", rate: "Rate", amount: "Amount",
};

/* Items-table column descriptors in print order: width from the metric map,
   HSN folded when hidden (its 76px already moves into DESCRIPTION there). */
const COL_ALIGNS = {
  sl: "center", desc: "left", hsn: "center", gst: "center",
  qty: "center", rate: "right", amount: "right",
};
const entColumnList = (showHnSac) =>
  Object.entries(entCols(showHnSac))
    .map(([key, w]) => ({ key, w, align: COL_ALIGNS[key] }));

// business.logo / business.signature are stored as raw Base64; the sample
// businesses used in previews carry ready-made data URIs — pass those through
// untouched instead of double-prefixing them (which makes an invalid URL).
const asDataUri = (value) => {
  const v = String(value || "");
  if (!v) return null;
  return v.startsWith("data:") ? v : `data:image/png;base64,${v}`;
};

const ItemsTable = ({ cols, rowMeta, items, startIndex, descLabel, closesGrid = true }) => {
  return (
    <div style={{
      // No left/right borders here: the page frame already draws the outer
      // verticals — an extra pair flush against them reads as doubled lines.
      height: M.thead + rowMeta.reduce((s, m) => s + m.height, 0),
      boxSizing: "border-box",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          {cols.map((c, i) => (
            <col key={i} style={{ width: `${c.w}px` }} />
          ))}
        </colgroup>
        <thead style={{ display: "table-header-group" }}>
          <tr style={{ height: `${M.thead}px` }}>
            {cols.map((c, i) => (
              <th key={i} style={{
                background: PANEL,
                // No top rule here: the PartyRow strip's bottom border already
                // draws the single line above the header (an extra one here
                // printed as a doubled rule over Sl No / Description).
                borderBottom: `1px solid ${INK}`,
                borderRight: i < cols.length - 1 ? `1px solid ${GRID}` : "none",
                fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.4px", color: INK,
                textAlign: c.align, verticalAlign: "middle", padding: "0 8px",
                lineHeight: 1.2,
              }}>
                {c.key === "desc" ? descLabel : HEAD_LABELS[c.key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowMeta.map((meta, i) => {
            const item = items[i];
            const globalIdx = startIndex + i;
            // The measured (and possibly shrunk/clipped) description — the
            // packer reserved exactly this much room for it.
            const desc = meta.text;
            const qty = parseFloat(item.qty);
            const qtyText = `${Number.isFinite(qty) ? String(qty) : ""}${item.unit ? " " + item.unit : ""}`;
            const cells = {
              sl: globalIdx + 1,
              desc,
              hsn: item.hsn || "-",
              gst: `${parseFloat(item.gstPercentage) || 0}%`,
              qty: qtyText,
              rate: formatINR(item.rate),
              amount: <span style={{ fontWeight: 600 }}>{formatINR(item.__taxable)}</span>,
            };
            return (
              <tr key={i} id={`ent-item-${globalIdx}`} style={{ height: `${meta.height}px` }}>
                {cols.map((c, ci) => (
                  <td key={ci} style={{
                    // Last row closes the grid with an INK rule — unless the
                    // tax breakup follows directly on this page, where the
                    // breakup header owns the junction rule instead (a border
                    // here would print in html2canvas but hide under the
                    // header's background on screen: two renderers, two truths).
                    borderBottom: i === rowMeta.length - 1
                      ? (closesGrid ? `1px solid ${INK}` : "none")
                      : `1px solid ${LINE}`,
                    borderRight: ci < cols.length - 1 ? `1px solid ${GRID}` : "none",
                    fontSize: c.key === "desc" ? `${meta.fontSize}px` : "10px",
                    padding: "0 8px", verticalAlign: "middle",
                    textAlign: c.align, overflow: "hidden",
                    whiteSpace: c.key === "desc" ? "normal" : "nowrap",
                    ...(c.key === "desc"
                      ? { wordBreak: "break-word", lineHeight: `${Math.round(meta.fontSize * 1.3)}px` }
                      : {}),
                  }}>
                    {cells[c.key] || "-"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* -------------------------------------------------- summary + totals */

/* Tax breakup — one row PER PRODUCT (HSN/SAC, taxable value, CGST rate +
   amount, SGST rate + amount, total tax): the printed HSN-wise breakup a
   GST invoice carries. One chunk at a time: when the rows outlive the page
   the packer splits them across pages and each continuation repeats this
   header, with the Total foot row only on the final chunk. Hidden entirely
   for proforma (showTax off). When the items table sits directly above, THIS
   header draws the single junction rule itself (topRule): the item row's
   collapsed outer border is painted over by this header's background on
   screen yet still shows in html2canvas — owning the line here keeps screen
   and PDF identical, one rule either way. Continuation pages skip it:
   ContHead's bottom rule already closes the grid. */
const GST_SUMMARY_COLS = [
  { w: "13%", label: "HSN/SAC", align: "center" },
  { w: "23%", label: "Taxable Value", align: "right" },
  { w: "8%", label: "Rate", align: "center" },
  { w: "13%", label: "Amount", align: "right" },
  { w: "8%", label: "Rate", align: "center" },
  { w: "13%", label: "Amount", align: "right" },
  { w: "22%", label: "Total Tax Amount", align: "right" },
];

const gstSummaryHeight = (rowCount) =>
  M.summaryHead + M.summarySubHead + M.summaryFoot + rowCount * M.summaryRow;

const GstSummary = ({ rows, firstLabel, showTax, totals, withTotal = true, endsAtFooter = false, topRule = false }) => {
  // Proforma carries no tax breakup at all.
  if (!showTax) return null;

  const thBase = {
    background: PANEL, fontSize: "8.5px", fontWeight: 700, letterSpacing: "0.4px",
    textAlign: "center", verticalAlign: "middle", padding: "0 8px", color: INK,
  };
  const tdBase = { fontSize: "9.5px", padding: "0 8px", verticalAlign: "middle" };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>{GST_SUMMARY_COLS.map((c, i) => <col key={i} style={{ width: c.w }} />)}</colgroup>
      <thead>
        {/* Row 1: HSN/SAC + Taxable Value span both header rows; CGST and
            SGST/UTGST span two columns (Rate | Amount) below. */}
        <tr style={{ height: `${M.summaryHead}px` }}>
          <th rowSpan={2} style={{
            ...thBase, textAlign: GST_SUMMARY_COLS[0].align,
            // Junction rule (topRule): see note above — drawn here so the
            // screen and the PDF agree on a single line.
            borderTop: topRule ? `1px solid ${INK}` : "none",
            borderBottom: `1px solid ${INK}`,
            borderRight: `1px solid ${GRID}`,
          }}>{firstLabel}</th>
          <th rowSpan={2} style={{
            ...thBase, textAlign: GST_SUMMARY_COLS[1].align,
            borderTop: topRule ? `1px solid ${INK}` : "none",
            borderBottom: `1px solid ${INK}`,
            borderRight: `1px solid ${GRID}`,
          }}>{GST_SUMMARY_COLS[1].label}</th>
          <th colSpan={2} style={{
            ...thBase,
            borderTop: topRule ? `1px solid ${INK}` : "none",
            borderBottom: `1px solid ${INK}`,
            borderRight: `1px solid ${GRID}`,
          }}>CGST</th>
          <th colSpan={2} style={{
            ...thBase,
            borderTop: topRule ? `1px solid ${INK}` : "none",
            borderBottom: `1px solid ${INK}`,
            borderRight: `1px solid ${GRID}`,
          }}>SGST/UTGST</th>
          <th rowSpan={2} style={{
            ...thBase, textAlign: GST_SUMMARY_COLS[6].align,
            borderTop: topRule ? `1px solid ${INK}` : "none",
            borderBottom: `1px solid ${INK}`,
          }}>{GST_SUMMARY_COLS[6].label}</th>
        </tr>
        {/* Row 2: the four rate/amount sub-headers. */}
        <tr style={{ height: `${M.summarySubHead}px` }}>
          {["Rate", "Amount", "Rate", "Amount"].map((lbl, i) => (
            <th key={i} style={{
              ...thBase, borderBottom: `1px solid ${INK}`,
              borderRight: `1px solid ${GRID}`,
              textAlign: GST_SUMMARY_COLS[i + 2].align,
            }}>{lbl}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          // A chunk that ends flush against the page footer lets the footer's
          // own top rule close the grid — two touching 1px rules read double.
          const bb = endsAtFooter && i === rows.length - 1
            ? "none" : `1px solid ${LINE}`;
          return (
            <tr key={i} style={{ height: `${M.summaryRow}px` }}>
              <td style={{
                ...tdBase, textAlign: "center", borderRight: `1px solid ${GRID}`,
                borderBottom: bb, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis",
              }}>{r.key}</td>
              <td style={{
                ...tdBase, textAlign: "right", borderRight: `1px solid ${GRID}`,
                borderBottom: bb,
              }}>{formatINR(r.taxable)}</td>
              <td style={{
                ...tdBase, textAlign: "center", borderRight: `1px solid ${GRID}`,
                borderBottom: bb,
              }}>{r.rateLabel}</td>
              <td style={{
                ...tdBase, textAlign: "right", borderRight: `1px solid ${GRID}`,
                borderBottom: bb,
              }}>{formatINR(r.cgst)}</td>
              <td style={{
                ...tdBase, textAlign: "center", borderRight: `1px solid ${GRID}`,
                borderBottom: bb,
              }}>{r.rateLabel}</td>
              <td style={{
                ...tdBase, textAlign: "right", borderRight: `1px solid ${GRID}`,
                borderBottom: bb,
              }}>{formatINR(r.sgst)}</td>
              <td style={{
                ...tdBase, fontWeight: 600, textAlign: "right",
                borderBottom: bb,
              }}>{formatINR(r.tax)}</td>
            </tr>
          );
        })}
        {withTotal && (
          <tr style={{ height: `${M.summaryFoot}px` }}>
            {[
              "Total",
              formatINR(totals.taxableAmount),
              "",
              formatINR(totals.cgst),
              "",
              formatINR(totals.sgst),
              formatINR(totals.taxAmount),
            ].map((v, i) => (
              <td key={i} style={{
                background: TOTAL_BG, fontWeight: 700, fontSize: "9.5px",
                borderBottom: `1px solid ${INK}`,
                borderRight: i < GST_SUMMARY_COLS.length - 1 ? `1px solid ${GRID}` : "none",
                textAlign: i === 0 ? "center" : "right", verticalAlign: "middle", padding: "0 8px",
              }}>{v}</td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
};

const TotalsTable = ({ rows }) => (
  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
    <colgroup>
      <col style={{ width: "46%" }} />
      <col style={{ width: "27%" }} />
      <col style={{ width: "27%" }} />
    </colgroup>
    <tbody>
      {rows.map((row) => {
        const h = row.strong ? M.totalsGrand : M.totalsRow;
        if (row.strong) {
          return (
            <tr key={row.label} style={{ height: `${h}px` }}>
              <td style={{ borderTop: `2px solid ${INK}`, background: INK, padding: 0 }} />
              <td style={{
                borderTop: `2px solid ${INK}`, background: INK, color: "#ffffff",
                fontSize: "11px", fontWeight: 700, textAlign: "right", padding: "0 14px",
                verticalAlign: "middle",
              }}>{row.label}</td>
              <td style={{
                borderTop: `2px solid ${INK}`, background: INK, color: "#ffffff",
                fontSize: "11.5px", fontWeight: 700, textAlign: "right",
                padding: "0 8px", verticalAlign: "middle",
              }}>{row.value}</td>
            </tr>
          );
        }
        return (
          <tr key={row.label} style={{ height: `${h}px` }}>
            <td style={{ borderBottom: `1px solid ${LINE}`, padding: 0 }} />
            <td style={{
              fontSize: "10px", fontWeight: 600, color: INK, textAlign: "right",
              padding: "0 14px", verticalAlign: "middle", borderBottom: `1px solid ${LINE}`,
            }}>{row.label}</td>
            <td style={{
              fontSize: "10px", fontWeight: 600, textAlign: "right", padding: "0 8px",
              verticalAlign: "middle", borderBottom: `1px solid ${LINE}`,
            }}>{row.value}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const WordsStrip = ({ isProforma, words, showTax, taxAmount }) => {
  // Tax-amount-in-words lives INSIDE this strip as a properly sized second
  // line — a hairline fixed row squeezed next to the band clipped it invisible.
  const withTax = showTax && taxAmount > 0;
  return (
    <div style={{
      height: M.words + (withTax ? 22 : 0), boxSizing: "border-box", display: "flex", gap: "12px",
      padding: "7px 12px 6px", borderBottom: `1px solid ${INK}`, overflow: "hidden",
    }}>
      <div style={{ flex: 1.2, minWidth: 0 }}>
        <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "1.2px", color: FAINT, marginBottom: "2px" }}>
          {isProforma ? "ESTIMATED AMOUNT (IN WORDS)" : "AMOUNT CHARGEABLE (IN WORDS)"}
        </div>
        <div style={{ fontSize: "11px", fontWeight: 700, lineHeight: "14px", maxHeight: "28px", overflow: "hidden" }}>
          {words}
        </div>
        {withTax && (
          <div style={{ fontSize: "9px", lineHeight: "12px", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "1px", color: FAINT }}>
              TAX AMOUNT (IN WORDS):{" "}
            </span>
            <span style={{ fontWeight: 600 }}>
              {isProforma ? "Nil" : numberToWords(taxAmount)}
            </span>
          </div>
        )}
      </div>
      <div style={{ alignSelf: "flex-end", fontSize: "8.5px", fontStyle: "italic", color: MUTED, whiteSpace: "nowrap" }}>
        E. &amp; O.E.
      </div>
    </div>
  );
};


/* --------------------------------------------------------------- band */

const BankBand = ({ business, sigSrc, sealVisible, sealType, isProforma }) => (
  <div style={{
    height: M.band, boxSizing: "border-box", display: "flex",
    // The band sits directly under the words strip (whose bottom rule is its
    // top edge) and directly above the footer (whose top rule closes the band
    // on the last page). It must not draw a border of its own or the two
    // stacked 1px rules read as a double line above the jurisdiction row.
    overflow: "hidden", background: "#ffffff",
  }}>
    {/* bank details */}
    <div style={{ width: "34%", padding: "8px 12px", borderRight: `1px solid ${GRID}`, overflow: "hidden" }}>
      {capsLabel("COMPANY'S BANK DETAILS")}
      <div style={{ fontSize: "9.5px", color: MUTED, lineHeight: "14px" }}>
        <div style={nowrap}>Bank Name: {business?.bankName || "-"}</div>
        <div style={nowrap}>A/c No: {business?.accountNo || "-"}</div>
        <div style={nowrap}>IFSC: {business?.ifsc || "-"}</div>
        <div style={nowrap}>UPI: {business?.upiId || "-"}</div>
      </div>
    </div>
    {/* declaration */}
    <div style={{ width: "33%", padding: "8px 12px", borderRight: `1px solid ${GRID}`, overflow: "hidden" }}>
      {capsLabel("DECLARATION")}
      <div style={{ fontSize: "8.5px", color: MUTED, lineHeight: "13px", maxHeight: "58px", overflow: "hidden" }}>
        {isProforma
          ? "We declare that this Proforma Invoice is issued for quotation purposes only. It is not a demand for payment and not valid for GST input tax credit claims."
          : "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."}
      </div>
    </div>
    {/* signature + seal */}
    <div style={{
      flex: 1, padding: "8px 12px", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {capsLabel("FOR " + (business?.businessName || "").toUpperCase())}
      {/* signature sits CENTERED directly above the signatory label — the
          original template's convention — at a readable size; the seal inks
          over its right edge like a rubber stamp landing on a signed copy */}
      <div style={{
        flex: 1, minHeight: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {sigSrc && (
          <img
            src={sigSrc}
            alt="signature"
            style={{
              height: "56px", maxWidth: "78%", objectFit: "contain",
              display: "block",
            }}
          />
        )}
      </div>
      <div style={{
        textAlign: "center", fontSize: "9px", color: MUTED, paddingBottom: "4px",
      }}>
        Authorised Signatory
      </div>
      {/* the stamp/seal is inked OVER the uploaded signature (z-index keeps it
          on top), the way a rubber stamp lands on a signed copy — blue like
          every other template's stamp */}
      {sealVisible && sealType === "stamp" && (
        <div style={{ position: "absolute", right: "6px", top: "26px", zIndex: 2 }}>
          <CompanyStamp
            companyName={business?.businessName || "COMPANY NAME"}
            addressLine1={business?.addressLine1 || ""}
            addressLine2={[business?.addressLine2, business?.city, business?.state].filter(Boolean).join(", ")}
            phone={business?.phone ? `Ph: ${business.phone}` : ""}
            email={business?.email || ""}
            width={160}
            color={STAMP_BLUE}
          />
        </div>
      )}
      {sealVisible && sealType !== "stamp" && (
        <div style={{ position: "absolute", right: "12px", top: "16px", zIndex: 2 }}>
          <CompanySeal
            companyName={business?.businessName || "COMPANY NAME"}
            year={new Date().getFullYear()}
            size={80}
            color={STAMP_BLUE}
          />
        </div>
      )}
    </div>
  </div>
);

/* ------------------------------------------------------------- footer */

const PageFooter = ({ jurLine, isLast, isProforma, pageNo, totalPages }) => (
  <div style={{
    height: M.footer, boxSizing: "border-box", borderTop: `1px solid ${INK}`,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 12px", overflow: "hidden",
  }}>
    <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.6px", color: MUTED, flex: 1, ...nowrap }}>
      {jurLine || ""}
    </div>
    <div style={{ fontSize: "8.5px", color: isLast ? MUTED : INK, fontWeight: isLast ? 400 : 700, whiteSpace: "nowrap" }}>
      {isLast
        ? (isProforma ? "This is a Computer Generated Proforma Invoice" : "This is a Computer Generated Invoice")
        : "Continued on next page \u2192"}
    </div>
    <div style={{ fontSize: "9px", fontWeight: 700, textAlign: "right", flex: 1, whiteSpace: "nowrap" }}>
      Page {pageNo} of {totalPages}
    </div>
  </div>
);

/* --------------------------------------------------------------- page */

const EntPage = ({ pageId, showItems, sumRows, sumWithTotal, closing, chunkItems, chunkMeta, startIndex, shared, pageKind }) => {
  // pageKind: { isFirst, isLast, pageNo, totalPages }
  const { isLast } = pageKind;
  const { business, customer, form, jurLine, cols, descLabel } = shared;

  return (
    <div
      id={pageId}
      style={{
        width: `${M.width}px`, boxSizing: "border-box",
        // Content-driven height: the frame grows as items are added and ends
        // right after the footer instead of pinning it to a fixed A4 height.
        // The packer budgets each page so no frame ever exceeds M.pageH, and
        // the PDF slicer cuts on the ent-page boundaries either way.
        border: `1px solid ${INK}`, background: "#ffffff", color: INK,
        fontFamily: FONT, position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      {pageKind.isFirst ? (
        <>
          <Letterhead business={business} title={shared.title} subNote={shared.subNote} headH={shared.headH} />
          <PartyRow business={business} customer={customer} form={form} displayInvNo={shared.displayInvNo} isProforma={shared.isProforma} />
        </>
      ) : (
        <ContHead
          business={business}
          title={shared.title}
          pageNo={pageKind.pageNo}
          totalPages={pageKind.totalPages}
        />
      )}

      {/* items table — every page repeats the header row; the last rendered row
          closes the grid so lines never run open across a page break. The line
          above the header comes from the PartyRow strip's bottom border. */}
      {showItems && (
        <ItemsTable
          cols={cols}
          rowMeta={chunkMeta}
          items={chunkItems}
          startIndex={startIndex}
          descLabel={descLabel}
          closesGrid={!(shared.showTax && sumRows.length > 0)}
        />
      )}

      {/* per-product tax breakup — the chunk this page carries (the full list
          may span pages; continuations repeat the table header and the Total
          row travels only with the final chunk). topRule: the header owns the
          junction line whenever the items table sits directly above it. */}
      {sumRows.length > 0 && (
        <GstSummary
          rows={sumRows}
          firstLabel={shared.summaryFirstLabel}
          showTax={shared.showTax}
          totals={shared.calc}
          withTotal={sumWithTotal}
          endsAtFooter={!closing}
          topRule={showItems}
        />
      )}

      {closing && (
        <>
          <TotalsTable rows={shared.totalsRows} />
          <WordsStrip
            isProforma={shared.isProforma}
            words={shared.words}
            showTax={shared.showTax}
            taxAmount={shared.calc.taxAmount}
          />
          {/* bank / declaration / signature band hugs the words strip — the
              strip's bottom rule doubles as its top edge, so no gap opens up
              between "Amount Chargeable" and the bank details */}
          <BankBand
            business={business}
            sigSrc={shared.sigSrc}
            sealVisible={shared.sealVisible}
            sealType={shared.sealType}
            isProforma={shared.isProforma}
          />
        </>
      )}

      {/* Footer sits directly under the bank band (or under the items table on
          overflow pages): the frame is content-height, so nothing pushes it
          down and no dead whitespace opens above the jurisdiction row. */}
      <PageFooter
        jurLine={jurLine}
        isLast={isLast}
        isProforma={shared.isProforma}
        pageNo={pageKind.pageNo}
        totalPages={pageKind.totalPages}
      />
    </div>
  );
};

/* ----------------------------------------------------------- component */

const InvoiceTemplateEnterprise = React.forwardRef(
  ({ business, customer, form, items, discountPercent, type, invoiceNumber }, ref) => {
    const validItems = useMemo(
      () => (items || []).filter((i) => i?.itemName?.trim() && parseFloat(i?.qty) > 0),
      [items],
    );
    const showHnSac = !business || business.showHnSac !== false;
    const cols = entColumnList(showHnSac);
    const isProforma = type === "PROFORMA_INVOICE";
    const showTax = !isProforma;
    const displayInvNo = invoiceNumber || "DRAFT";
    const calc = computeInvoiceTotals(items, discountPercent);
    const jurLine = jurisdictionLine(business);
    const specialist = getSpecialistInLine(business);
    const headH = M.head + (specialist ? SPECIALIST_IN_EXTRA_H : 0);
    const descLabel = "Description of Goods";

    const sigSrc = asDataUri(business?.signature);
    const words = calc.grandTotal > 0
      ? numberToWords(calc.grandTotal)
      : "Zero Rupees Only";

    /* Tax breakup rows — one PER PRODUCT, in item order (HSN/SAC or product
       name, taxable, CGST + SGST halves, total tax). The full list — however
       many products — paginates with the table below; nothing is merged. */
    // GST breakup: ONE row per (HSN/product, rate) group — 53 line items
    // across 5 rates are 5 summary rows, not 53 identical ones.
    const summaryRows = groupTaxSummaryRows(validItems, { showHnSac, ratio: calc.ratio });
    const summaryFirstLabel = showHnSac ? "HSN/SAC" : "Product";

    /* Totals stack (Sub / Discount / CGST / SGST / Grand). Heights mirror
       M.totalsRow / M.totalsGrand exactly — the chunker reads the sum. */
    const totalsRows = [
      { label: "Sub Total", value: formatINR(calc.subtotal), strong: false },
      ...(calc.discountAmount > 0
        ? [{ label: `Discount (${calc.discountPercent}%)`, value: "- " + formatINR(calc.discountAmount), strong: false }]
        : []),
      ...(showTax ? [
        { label: "CGST", value: formatINR(calc.cgst), strong: false },
        { label: "SGST", value: formatINR(calc.sgst), strong: false },
      ] : []),
      {
        label: isProforma ? "Estimated Total" : "Grand Total",
        value: "Rs. " + formatINR(calc.grandTotal),
        strong: true,
      },
    ];
    const totalsRowsHeight = totalsRows.reduce((s, r) => s + (r.strong ? M.totalsGrand : M.totalsRow), 0);

    const withTaxWords = showTax && calc.taxAmount > 0;
    const wordsH = M.words + (withTaxWords ? 22 : 0);
    // Closing block: totals + amount-in-words + bank/signature band. The
    // footer is budgeted separately — every page carries exactly one.
    const closingNoFooter = totalsRowsHeight + wordsH + M.band;

    /* Item rows pack against OPEN budgets (footer only): the closing block is
       placed after packing because the uncapped per-product breakup can be
       taller than a whole page and must flow onto continuation pages rather
       than blow the budget. lastSingle/lastCont mirror the open budgets so
       packEntPages' roll-forward pass is a no-op under this scheme. */
    const fixedTopOf = (isFirst) =>
      isFirst ? headH + M.partyRow + M.thead + M.fudge : M.contHead + M.thead + M.fudge;
    const openBudget = (isFirst) => M.pageH - fixedTopOf(isFirst) - M.footer;
    /* Row heights come from the REAL rendered text width (canvas measureText
       with the template's own font), so a long description reserves exactly
       the space it needs. The old character-count guess was ~15% pessimistic
       and got worse with every wrapped line: pages ran out of room early and
       the leftover showed up as empty space. The same numbers drive the
       packer and the renderer, so the grid can never disagree with itself.
       A single row taller than the page is shrunk, then clipped, so it can
       never blow the frame open. */
    const measureDesc = useMemo(() => {
      if (typeof document === "undefined") return null;
      const ctx = document.createElement("canvas").getContext("2d");
      return (text) => {
        ctx.font = `${ENT_DESC_FONT_SIZE}px ${ENT_FONT_STACK}`;
        return ctx.measureText(String(text ?? "")).width;
      };
    }, []);
    const maxRowH = openBudget(false);
    const rowMeta = useMemo(
      () => validItems.map((it) =>
        resolveEntRow(it, { showHnSac, maxH: maxRowH, measure: measureDesc })),
      [validItems, showHnSac, maxRowH, measureDesc],
    );
    const heights = rowMeta.map((m) => m.height);
    const packed = packEntPages(heights, {
      page1: openBudget(true),
      cont: openBudget(false),
      lastSingle: openBudget(true),
      lastCont: openBudget(false),
    });

    /* Closing-block placement relative to the LAST items page:
       - whole breakup + closing fit there → single-flow layout (small bills);
       - otherwise the breakup FLOWS: it may start right on the items page
         when the header + at least one row fits — always leaving ≥1 row so
         the Total row travels with the final chunk — then continues on
         dedicated pages with the header repeated;
       - proforma carries no breakup: only the closing block may need a page. */
    const nSum = showTax ? summaryRows.length : 0;
    const lastUsed = packed[packed.length - 1].reduce((s, i) => s + heights[i], 0);
    const avail = M.pageH - fixedTopOf(packed.length === 1) - lastUsed - M.footer;
    const sumHeadH = M.summaryHead + M.summarySubHead;

    const plan = { onItemsPage: 0, pages: [], closingOnItemsPage: false, closingOwnPage: false };
    if (nSum === 0) {
      if (closingNoFooter <= avail) plan.closingOnItemsPage = true;
      else plan.closingOwnPage = true;
    } else if (gstSummaryHeight(nSum) + closingNoFooter <= avail) {
      plan.onItemsPage = nSum;
      plan.closingOnItemsPage = true;
    } else {
      const contCap = Math.max(1, Math.floor((M.pageH - M.contHead - sumHeadH - M.footer) / M.summaryRow));
      // A tax table that fits on ONE page is never split across two: a 5-row
      // table broken 4 + 1 leaves the last page looking half-empty and reads
      // like the document skipped a page. It travels whole to the final page
      // (which also carries the closing block).
      if (nSum <= contCap) {
        plan.onItemsPage = 0;
        plan.pages.push({ rows: nSum, isFinal: true });
      } else {
        if (avail >= sumHeadH + M.summaryRow) {
          plan.onItemsPage = Math.min(Math.floor((avail - sumHeadH) / M.summaryRow), nSum - 1);
        }
        let remaining = nSum - plan.onItemsPage;
        // Capacity per breakup page: a continuation page carries the table
        // header only; the FINAL page also carries the closing block (totals,
        // amount-in-words, bank/signature band), so it holds fewer rows.
        const finalCap = Math.max(1, Math.floor((M.pageH - M.contHead - sumHeadH - M.summaryFoot - closingNoFooter - M.footer) / M.summaryRow));
        // Rows are spread EVENLY over the breakup pages: the old rule filled
        // continuation pages to the brim and left the final page with a single
        // row + the closing block — that page rendered ~30% full and read like
        // the document had skipped a page. Same page count, no near-empty page.
        const breakupCounts = distributeBreakupRows(remaining, { contCap, finalCap });
        breakupCounts.forEach((rows, i) => {
          plan.pages.push({ rows, isFinal: i === breakupCounts.length - 1 });
        });
      }
    }

    const chunks = packed;
    const startIndexFor = chunks.map((_, i) =>
      chunks.slice(0, i).reduce((s, c) => s + c.length, 0)
    );

    const title = TITLE_BY_TYPE[type] || "TAX INVOICE";
    const subNote = isProforma ? "— NOT A TAX INVOICE —" : null;

    const { sealVisible, sealType } = resolveSeal(business);

    /* Render list: items pages, then any breakup-continuation pages (each
       repeating the table header), then a closing-only page when the block
       could not sit after the items (proforma overflow). */
    const pages = chunks.map((chunk, i) => {
      const onLastItems = i === chunks.length - 1;
      return {
        showItems: true,
        chunk,
        startIndex: startIndexFor[i],
        sumRows: onLastItems ? summaryRows.slice(0, plan.onItemsPage) : [],
        sumWithTotal: onLastItems && plan.closingOnItemsPage && nSum > 0,
        closing: onLastItems && plan.closingOnItemsPage,
      };
    });
    let sumOffset = plan.onItemsPage;
    plan.pages.forEach((sp) => {
      const sumRows = summaryRows.slice(sumOffset, sumOffset + sp.rows);
      sumOffset += sp.rows;
      pages.push({
        showItems: false,
        chunk: [],
        startIndex: 0,
        sumRows,
        sumWithTotal: sp.isFinal,
        closing: sp.isFinal,
      });
    });
    if (plan.closingOwnPage) {
      pages.push({ showItems: false, chunk: [], startIndex: 0, sumRows: [], sumWithTotal: false, closing: true });
    }

    return (
      <div ref={ref} style={{ width: `${M.width}px`, margin: "0 auto", background: "#ffffff" }}>
        {pages.map((p, i) => {
          const isFirst = i === 0;
          const isLast = i === pages.length - 1;
          const chunkItems = p.chunk.map((idx) => {
            const item = validItems[idx];
            return { ...item, __taxable: (parseFloat(item.taxableValue) || 0) * calc.ratio };
          });
          // Compact natural rows — exactly the estimated heights, no page-fill
          // inflation. The frame is content-height, so the table closes at the
          // last row and the footer follows the bank band with no dead space.
          const chunkMeta = p.chunk.map((idx) => rowMeta[idx]);
          return (
            <EntPage
              key={i}
              pageId={`ent-page-${i}`}
              showItems={p.showItems}
              sumRows={p.sumRows}
              sumWithTotal={p.sumWithTotal}
              closing={p.closing}
              chunkItems={chunkItems}
              chunkMeta={chunkMeta}
              startIndex={p.startIndex}
              pageKind={{ isFirst, isLast, pageNo: i + 1, totalPages: pages.length }}
              shared={{
                business, customer, form,
                calc, title, subNote, displayInvNo, isProforma,
                showTax, summaryFirstLabel, totalsRows, words,
                jurLine, cols, descLabel,
                headH, sigSrc, sealVisible, sealType,
              }}
            />
          );
        })}
      </div>
    );
  }
);

InvoiceTemplateEnterprise.displayName = "InvoiceTemplateEnterprise";
export default InvoiceTemplateEnterprise;
