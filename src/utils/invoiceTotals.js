// Single source of truth for invoice totals on the frontend.
// Every screen (UI summary, item tables, PDF templates, public page) must use
// this so view / download / share-link always show the same numbers.
//
// Indian GST rules applied here (CGST Act s.15(3)(b)):
//   - Any discount declared on the invoice is deducted BEFORE tax, so GST is
//     charged on the net (discounted) taxable value, never on the gross.
//   - Tax mode (3rd argument, defaults to "CGST_SGST"):
//       CGST_SGST -> CGST = SGST = half of the total GST (intra-state supply)
//       IGST      -> one full-rate IGST leg, NO CGST/SGST components
//     The total tax is identical either way — only the structure changes.
//   - All money values are rounded to 2 decimals (HALF_UP), matching the
//     backend InvoiceMapper exactly, so the stored invoice and every screen
//     agree to the paisa.
//
// Formula (mirrors backend InvoiceMapper.calculateInvoiceTotals):
//   base_i         = item.taxableValue  (= qty × rate), rounded to 2dp
//   subtotal       = round2(Σ base_i)
//
//   FULL (default — invoice-level discount, GST pro-rated):
//   discountAmount = round2(subtotal × clamp(discount%, 0..100) / 100)
//   taxableAmount  = subtotal − discountAmount
//   ratio          = taxableAmount / subtotal          (pro-rata allocation)
//   item.tax       = round2(base_i × ratio × gst% / 100)   ← GST on discounted value
//
//   INDIVIDUAL (per-line discount, e-Invoice template only):
//   disc_i         = round2(base_i × clamp(item.discount%, 0..100) / 100)
//   net_i          = base_i − disc_i
//   discountAmount = round2(Σ disc_i)     taxableAmount = subtotal − discountAmount
//   item.tax       = round2(net_i × gst% / 100)  ← each line's GST on ITS OWN net
//
//   taxAmount      = round2(Σ item.tax)
//   grandTotal     = taxableAmount + taxAmount

// HALF_UP rounding to 2 decimals, matching the backend's BigDecimal
// setScale(2, RoundingMode.HALF_UP). Plain Math.round(n*100)/100 is NOT enough:
// e.g. 1.5 * 33.33 = 49.995 exactly, but in float n*100 lands on
// 4999.499999999999 and Math.round gives 4999 (49.99) while the backend gives
// 50.00. The threshold below recovers true .5 boundaries so the frontend and
// backend agree to the paisa.
export const round2 = (n) => {
  const v = n * 100;
  const floor = Math.floor(v);
  const diff = v - floor;
  const r = diff >= 0.4999999999 ? floor + 1 : Math.round(v);
  return r / 100;
};
// Backend divides by the subtotal with scale 10 (HALF_UP); mirror that so the
// per-item tax matches the stored invoice to the paisa in every edge case.
const round10 = (n) => Math.round((n + Number.EPSILON) * 1e10) / 1e10;

/**
 * @param {Array}  items         invoice lines
 * @param {number} discountPercent invoice-level discount %
 * @param {string} [taxMode]     "CGST_SGST" (default) | "IGST" — picks the
 *                               tax STRUCTURE only; totals never change.
 * @param {number} [cessPercent] invoice-level compensation cess %
 * @param {string} [discountType] "FULL" (default) | "INDIVIDUAL" — INDIVIDUAL
 *                               reads each line's own discountPercent and every
 *                               line's GST applies to its own NET value (no
 *                               invoice-level pro-rating). Mirrors the backend
 *                               InvoiceMapper.calculateInvoiceTotals INDIVIDUAL
 *                               branch so the stored invoice and every screen
 *                               agree to the paisa.
 */
export function computeInvoiceTotals(items, discountPercent, taxMode, cessPercent = 0, discountType = "FULL") {
  const igstMode = taxMode === "IGST";
  const individual = discountType === "INDIVIDUAL";
  const valid = (items || []).filter(
    (i) => i?.itemName?.trim() && parseFloat(i?.qty) > 0
  );

  const bases = valid.map((i) =>
    round2(
      parseFloat(i.taxableValue) ||
        (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0)
    )
  );

  const subtotal = round2(bases.reduce((s, b) => s + b, 0));

  let pct;
  let discountAmount;
  let taxableAmount;
  let taxes;
  let taxableCol;
  let lineMeta;

  if (individual) {
    // Per-line discounts (V45): each line's discount and GST are computed on
    // that line alone, exactly like the backend's INDIVIDUAL branch.
    pct = Math.min(Math.max(parseFloat(discountPercent) || 0, 0), 100);
    const linePcts = valid.map((i) =>
      Math.min(Math.max(parseFloat(i.discountPercent) || 0, 0), 100)
    );
    const lineDiscounts = bases.map((b, idx) => round2((b * linePcts[idx]) / 100));
    discountAmount = round2(lineDiscounts.reduce((s, d) => s + d, 0));
    taxableAmount = round2(subtotal - discountAmount);
    taxes = valid.map((item, idx) => {
      const gst = parseFloat(item.gstPercentage) || 0;
      return round2(((bases[idx] - lineDiscounts[idx]) * gst) / 100);
    });
    // The taxable column is the per-line NET value — every entry is already
    // 2dp, so the column foots to taxableAmount with no residual to absorb.
    taxableCol = bases.map((b, idx) => round2(b - lineDiscounts[idx]));
    if (taxableCol.length > 0) {
      const sumOthers = taxableCol.slice(0, -1).reduce((s, v) => s + v, 0);
      taxableCol[taxableCol.length - 1] = round2(taxableAmount - sumOthers);
    }
    // per-line % / amount for the item grid's Disc. column and every screen.
    lineMeta = valid.map((item, idx) => ({
      discountPercent: linePcts[idx],
      discountAmount: lineDiscounts[idx],
    }));
  } else {
    pct = Math.min(Math.max(parseFloat(discountPercent) || 0, 0), 100);
    discountAmount = round2((subtotal * pct) / 100);
    taxableAmount = round2(subtotal - discountAmount);
  }

  const ratio = subtotal > 0 ? round10(taxableAmount / subtotal) : 1;

  if (!individual) {
    // Per-item tax on the DISCOUNTED value, rounded like the backend so the
    // invoice-level taxAmount matches what the server stored to the paisa.
    taxes = valid.map((item, idx) => {
      const gst = parseFloat(item.gstPercentage) || 0;
      return round2((bases[idx] * ratio * gst) / 100);
    });
  }
  const taxAmount = round2(taxes.reduce((s, t) => s + t, 0));

  // Invoice-level tax structure. IGST (inter-state) is the single full-rate
  // leg and must never coexist with CGST/SGST; in split mode the residual
  // paisa goes to SGST so the two legs always add up to the taxAmount shown.
  const cgst = igstMode ? 0 : round2(taxAmount / 2);
  const sgst = igstMode ? 0 : round2(taxAmount - cgst);
  const igst = igstMode ? taxAmount : 0;

  // Compensation cess: invoice-level % on the discounted taxable value — the
  // same base GST uses (mirrors backend InvoiceMapper exactly).
  const cessPct = Math.min(Math.max(parseFloat(cessPercent) || 0, 0), 100);
  const cessAmount = round2((taxableAmount * cessPct) / 100);

  // Discounted taxable value per line. The last line absorbs any rounding
  // residual so the Taxable column adds up EXACTLY to the Taxable Amount
  // total (a GST invoice must foot line-by-line). (INDIVIDUAL already built
  // its own per-line NET column above.)
  if (!individual) {
    taxableCol = bases.map((b) => round2(b * ratio));
    if (taxableCol.length > 0) {
      const sumOthers = taxableCol.slice(0, -1).reduce((s, v) => s + v, 0);
      taxableCol[taxableCol.length - 1] = round2(taxableAmount - sumOthers);
    }
  }

  const perItem = valid.map((item, idx) => {
    const half = round2(taxes[idx] / 2);
    return {
      taxable: taxableCol[idx],
      cgst: igstMode ? 0 : half,
      sgst: igstMode ? 0 : round2(taxes[idx] - half),
      igst: igstMode ? taxes[idx] : 0,
      tax: taxes[idx],
      total: round2(taxableCol[idx] + taxes[idx]),
      ...(lineMeta ? lineMeta[idx] : {}),
    };
  });

  return {
    subtotal,
    discountPercent: individual ? 0 : pct,
    discountAmount,
    taxableAmount,
    ratio,
    cgst,
    sgst,
    igst,
    taxAmount,
    cessPercent: cessPct,
    cessAmount,
    grandTotal: round2(taxableAmount + taxAmount + cessAmount),
    perItem,
    discountType: individual ? "INDIVIDUAL" : "FULL",
  };
}
