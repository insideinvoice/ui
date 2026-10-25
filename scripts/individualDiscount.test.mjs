/**
 * INDIVIDUAL (per-line) discount contract tests — V45. Plain node:assert,
 * same convention as the other scripts/*.test.mjs suites:  npm run test:unit
 *
 * Every number here mirrors the backend InvoiceMapper.calculateInvoiceTotals
 * INDIVIDUAL branch (and its clampPercent): each line's GST applies to that
 * line's own NET value (CGST Act s.15(3)(b)) — no invoice-level pro-rating —
 * so the stored invoice and every screen agree to the paisa.
 */
import assert from "node:assert/strict";
import { computeInvoiceTotals } from "../src/utils/invoiceTotals.js";

const item = (rate, gst = 18, qty = 1, discountPercent = "") => ({
  itemName: `Item ${rate} @${gst}`,
  hsn: "9983",
  qty,
  rate,
  gstPercentage: gst,
  discountPercent,
});

// --------------------------------------------- two lines, 10% and 5%
{
  const t = computeInvoiceTotals(
    [item(1000, 18, 1, "10"), item(500, 18, 1, "5")],
    0, // invoice-level % is meaningless in INDIVIDUAL mode
    "CGST_SGST",
    0,
    "INDIVIDUAL"
  );
  assert.equal(t.discountType, "INDIVIDUAL");
  assert.equal(t.subtotal, 1500);
  // 1000×10% + 500×5% = 100 + 25
  assert.equal(t.discountAmount, 125);
  assert.equal(t.taxableAmount, 1375);
  // each line's GST on its own net: 900×18% + 475×18% = 162 + 85.5
  assert.equal(t.taxAmount, 247.5);
  assert.equal(t.grandTotal, 1622.5);
  assert.equal(t.cgst, 123.75);
  assert.equal(t.sgst, 123.75);
  // per-line results for the item grid
  assert.equal(t.perItem[0].taxable, 900);
  assert.equal(t.perItem[0].tax, 162);
  assert.equal(t.perItem[0].total, 1062);
  assert.equal(t.perItem[0].discountPercent, 10);
  assert.equal(t.perItem[0].discountAmount, 100);
  assert.equal(t.perItem[1].taxable, 475);
  assert.equal(t.perItem[1].tax, 85.5);
  assert.equal(t.perItem[1].discountAmount, 25);
  // the taxable column must foot exactly to the taxable amount
  const colSum = t.perItem.reduce((s, p) => s + p.taxable, 0);
  assert.equal(Math.round(colSum * 100) / 100, t.taxableAmount);
}

// --------------------------------------------- discount on ONE line only
// The whole point of the feature: line 4 of 10 gets a discount, the rest none.
{
  const t = computeInvoiceTotals(
    [item(100), item(100), item(100), item(100, 18, 1, "25")],
    0, "CGST_SGST", 0, "INDIVIDUAL"
  );
  assert.equal(t.subtotal, 400);
  assert.equal(t.discountAmount, 25);
  assert.equal(t.taxableAmount, 375);
  // 3 undiscounted lines at 18 each + 75×18% = 13.5 -> 67.5
  assert.equal(t.taxAmount, 67.5);
  assert.equal(t.perItem[0].tax, 18);
  assert.equal(t.perItem[3].taxable, 75);
  assert.equal(t.perItem[3].tax, 13.5);
  assert.equal(t.grandTotal, 442.5);
  // an empty per-line % is simply no discount — never NaN
  assert.equal(t.perItem[0].discountPercent, 0);
  assert.equal(t.perItem[0].discountAmount, 0);
}

// --------------------------------------------- clamp: >100 and negative
{
  const t = computeInvoiceTotals([item(200, 18, 1, "150")], 0, "IGST", 0, "INDIVIDUAL");
  assert.equal(t.discountAmount, 200); // clamped to 100%
  assert.equal(t.taxableAmount, 0);
  assert.equal(t.taxAmount, 0);
  assert.equal(t.grandTotal, 0);

  const n = computeInvoiceTotals([item(200, 18, 1, "-5")], 0, "IGST", 0, "INDIVIDUAL");
  assert.equal(n.discountAmount, 0); // clamped up to 0
  assert.equal(n.taxAmount, 36);
}

// --------------------------------------------- tax-mode independence
{
  const split = computeInvoiceTotals([item(1000, 18, 1, "10")], 0, "CGST_SGST", 0, "INDIVIDUAL");
  const igst = computeInvoiceTotals([item(1000, 18, 1, "10")], 0, "IGST", 0, "INDIVIDUAL");
  for (const k of ["subtotal", "discountAmount", "taxableAmount", "taxAmount", "grandTotal"]) {
    assert.equal(split[k], igst[k], `${k} must not change with the tax mode`);
  }
  assert.equal(split.cgst + split.sgst, split.taxAmount);
  assert.equal(igst.igst, split.taxAmount);
  assert.equal(igst.cgst, 0);
  assert.equal(igst.sgst, 0);
}

// --------------------------------------------- cess rides on the net base
{
  const t = computeInvoiceTotals([item(1000, 18, 1, "10")], 0, "CGST_SGST", 5, "INDIVIDUAL");
  assert.equal(t.cessAmount, 45); // 5% of the discounted 900
  // 900 taxable + 162 GST + 45 cess
  assert.equal(t.grandTotal, 1107);
}

// --------------------------------------------- rounding matches backend
// 33.33 × 33.33% must round HALF_UP to 11.11 (not 11.10), and the line tax
// 22.22 × 18% = 3.9996 -> 4.00 — identical to BigDecimal setScale(2, HALF_UP).
{
  const t = computeInvoiceTotals([item(33.33, 18, 1, "33.33")], 0, "CGST_SGST", 0, "INDIVIDUAL");
  assert.equal(t.perItem[0].discountAmount, 11.11);
  assert.equal(t.perItem[0].taxable, 22.22);
  assert.equal(t.perItem[0].tax, 4);
  assert.equal(t.discountAmount, 11.11);
  assert.equal(t.taxAmount, 4);
}

// --------------------------------------------- FULL default untouched
// Omitting discountType keeps the original invoice-level flow byte-for-byte.
{
  const t = computeInvoiceTotals([item(1000, 18, 1, "10")], 10, "CGST_SGST");
  assert.equal(t.discountType, "FULL");
  assert.equal(t.discountPercent, 10);
  assert.equal(t.discountAmount, 100);
  assert.equal(t.taxableAmount, 900);
  assert.equal(t.taxAmount, 162); // pro-rated: 1000 × 0.9 × 18%
  assert.equal(t.grandTotal, 1062);
  assert.equal(t.perItem[0].discountAmount, undefined);
}

// An INDIVIDUAL call never reports an invoice-level percent (backend forces 0).
{
  const t = computeInvoiceTotals([item(1000, 18, 1, "10")], 10, "CGST_SGST", 0, "INDIVIDUAL");
  assert.equal(t.discountPercent, 0);
  assert.equal(t.discountAmount, 100);
}

console.log("individualDiscount.test.mjs: all assertions passed");
