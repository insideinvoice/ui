import React from "react";
import { parseTermsList } from "../utils/termsConditions";

/**
 * Terms & Conditions strip for the PRINTED invoice documents (View PDF modal,
 * Download PDF, email attachment): the same business-saved list that renders
 * on the view page card. Settings owns the data; this component renders it as
 * a full-width table row directly above the bank/declaration/signature band in
 * every template family. Returns null when the business has not saved any
 * terms, so layouts never print an empty box.
 */
const InvoiceTermsRow = ({ business, border, primary = "#111111", fontSize = "10px" }) => {
  const terms = parseTermsList(business?.termsConditions);
  if (terms.length === 0) return null;
  // Two balanced columns once there is enough content to be worth the split —
  // plain flex (no CSS columns) because the PDF rasteriser handles flexbox
  // reliably while multi-column text is flaky.
  const half = Math.ceil(terms.length / 2);
  const cols = terms.length > 3 ? [terms.slice(0, half), terms.slice(half)] : [terms];
  return (
    <tr id="section-terms">
      <td colSpan={2} style={{ borderLeft: border, borderRight: border, padding: "6px 10px", verticalAlign: "top" }}>
        <div style={{
          fontSize: "10px", fontWeight: "bold", letterSpacing: "0.4px",
          marginBottom: "3px", color: primary, textTransform: "uppercase",
        }}>
          Terms &amp; Conditions
        </div>
        <div style={{ display: "flex", gap: "18px" }}>
          {cols.map((col, c) => (
            <div key={c} style={{ flex: 1, minWidth: 0 }}>
              {col.map((t, i) => (
                <div key={i} style={{ fontSize, lineHeight: 1.45, color: "#333", marginBottom: "1px" }}>
                  <span style={{ fontWeight: "bold", color: primary }}>{(c === 0 ? i : half + i) + 1}. </span>
                  {t}
                </div>
              ))}
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
};

export default InvoiceTermsRow;
