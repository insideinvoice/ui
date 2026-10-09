// Single source of truth for invoice totals on the frontend.
// Every screen (UI summary, item tables, PDF templates, public page) must use
// this so view / download / share-link always show the same numbers.
//
// Indian GST rules applied here (CGST Act s.15(3)(b)):
//   - Any discount declared on the invoice is deducted BEFORE tax, so GST is
//     charged on the net (discounted) taxable value, never on the gross.
//   - CGST = SGST = half of the total GST (intra-state supply).
//   - All money values are rounded to 2 decimals (HALF_UP), matching the
//     backend InvoiceMapper exactly, so the stored invoice and every screen
//     agree to the paisa.
//
// Formula (mirrors backend InvoiceMapper.calculateInvoiceTotals):
//   base_i         = item.taxableValue  (= qty × rate), rounded to 2dp
//   subtotal       = round2(Σ base_i)
//   discountAmount = round2(subtotal × clamp(discount%, 0..100) / 100)
//   taxableAmount  = subtotal − discountAmount
//   ratio          = taxableAmount / subtotal          (pro-rata allocation)
//   item.tax       = round2(base_i × ratio × gst% / 100)   ← GST on discounted value
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

export function computeInvoiceTotals(items, discountPercent) {
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

  const pct = Math.min(Math.max(parseFloat(discountPercent) || 0, 0), 100);
  const discountAmount = round2((subtotal * pct) / 100);
  const taxableAmount = round2(subtotal - discountAmount);
  const ratio = subtotal > 0 ? round10(taxableAmount / subtotal) : 1;

  // Per-item tax on the DISCOUNTED value, rounded like the backend so the
  // invoice-level taxAmount matches what the server stored to the paisa.
  const taxes = valid.map((item, idx) => {
    const gst = parseFloat(item.gstPercentage) || 0;
    return round2((bases[idx] * ratio * gst) / 100);
  });
  const taxAmount = round2(taxes.reduce((s, t) => s + t, 0));

  // CGST/SGST split of the total tax; residual paisa goes to SGST so the two
  // halves always add up to the taxAmount shown on the invoice.
  const cgst = round2(taxAmount / 2);
  const sgst = round2(taxAmount - cgst);

  // Discounted taxable value per line. The last line absorbs any rounding
  // residual so the Taxable column adds up EXACTLY to the Taxable Amount
  // total (a GST invoice must foot line-by-line).
  const taxableCol = bases.map((b) => round2(b * ratio));
  if (taxableCol.length > 0) {
    const sumOthers = taxableCol.slice(0, -1).reduce((s, v) => s + v, 0);
    taxableCol[taxableCol.length - 1] = round2(taxableAmount - sumOthers);
  }

  const perItem = valid.map((item, idx) => {
    const half = round2(taxes[idx] / 2);
    return {
      taxable: taxableCol[idx],
      cgst: half,
      sgst: round2(taxes[idx] - half),
      tax: taxes[idx],
      total: round2(taxableCol[idx] + taxes[idx]),
    };
  });

  return {
    subtotal,
    discountPercent: pct,
    discountAmount,
    taxableAmount,
    ratio,
    cgst,
    sgst,
    taxAmount,
    grandTotal: round2(taxableAmount + taxAmount),
    perItem,
  };
}
