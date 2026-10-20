/**
 * Tax-mode (CGST_SGST vs IGST) contract tests — written BEFORE the feature
 * lands (Phase 3 of PLAN -> TESTS -> IMPLEMENT -> VERIFY). Plain node:assert,
 * same convention as the other scripts/*.test.mjs suites:  npm run test:unit
 *
 * Spec scenarios:
 *   A) taxable 100 @ 18% CGST_SGST -> 9 + 9, tax 18, grand 118
 *   B) taxable 100 @ 18% IGST     -> 18 IGST, no CGST/SGST, grand 118
 *   plus the ₹9 @ 18% baseline (0.81 + 0.81 vs 1.62), multi-item, mixed
 *   rates, zero-rated, discount, rounding/residual paisa, legacy default arg,
 *   the Enterprise HSN summary grouping and the mode validation helpers.
 */
import assert from "node:assert/strict";
import { computeInvoiceTotals } from "../src/utils/invoiceTotals.js";
import { groupTaxSummaryRows } from "../src/utils/enterprisePage.js";
import {
  determineTaxMode,
  resolveTaxMode,
  isTaxModeConsistent,
  validateTaxMode,
} from "../src/utils/taxMode.js";

const item = (rate, gst = 18, qty = 1) => ({
  itemName: `Item ${rate} @${gst}`,
  hsn: "9983",
  qty,
  rate,
  gstPercentage: gst,
});

/** Fields that must be byte-identical across the two tax modes. */
const assertModeIndependent = (split, igst) => {
  for (const k of ["subtotal", "discountPercent", "discountAmount", "taxableAmount", "ratio", "taxAmount", "grandTotal"]) {
    assert.deepEqual(split[k], igst[k], `${k} must not change with the tax mode`);
  }
  assert.equal(split.perItem.length, igst.perItem.length);
  split.perItem.forEach((p, i) => {
    assert.equal(p.taxable, igst.perItem[i].taxable, "per-item taxable must not change");
    assert.equal(p.tax, igst.perItem[i].tax, "per-item tax must not change");
    assert.equal(p.total, igst.perItem[i].total, "per-item total must not change");
  });
};

// ------------------------------------------------- Scenario A: ₹100 @ 18%
{
  const t = computeInvoiceTotals([item(100)], 0, "CGST_SGST");
  assert.equal(t.subtotal, 100);
  assert.equal(t.taxAmount, 18);
  assert.equal(t.cgst, 9);
  assert.equal(t.sgst, 9);
  assert.equal(t.igst, 0, "no IGST component in split mode");
  assert.equal(t.grandTotal, 118);
  assert.equal(t.perItem[0].cgst, 9);
  assert.equal(t.perItem[0].sgst, 9);
  assert.equal(t.perItem[0].igst, 0);
  assert.equal(t.perItem[0].tax, 18);
  assert.equal(t.perItem[0].total, 118);
}

// ------------------------------------------------- Scenario B: ₹100 @ 18%
{
  const g = computeInvoiceTotals([item(100)], 0, "IGST");
  assert.equal(g.subtotal, 100);
  assert.equal(g.taxAmount, 18);
  assert.equal(g.igst, 18);
  assert.equal(g.cgst, 0, "no CGST component in IGST mode");
  assert.equal(g.sgst, 0, "no SGST component in IGST mode");
  assert.equal(g.grandTotal, 118);
  assert.equal(g.perItem[0].igst, 18);
  assert.equal(g.perItem[0].cgst, 0);
  assert.equal(g.perItem[0].sgst, 0);
  assert.equal(g.perItem[0].tax, 18);

  // Both modes, one set of totals (tax counted exactly once either way).
  assertModeIndependent(computeInvoiceTotals([item(100)], 0, "CGST_SGST"), g);
  // Components always foot to the invoice tax in BOTH modes.
  const split = computeInvoiceTotals([item(100)], 0, "CGST_SGST");
  assert.equal(split.cgst + split.sgst, split.taxAmount);
  assert.equal(g.igst, g.taxAmount);
}

// ------------------------------------------- baseline ₹9 @ 18% (both modes)
{
  const s = computeInvoiceTotals([item(9)], 0, "CGST_SGST");
  assert.equal(s.taxAmount, 1.62);
  assert.equal(s.cgst, 0.81);
  assert.equal(s.sgst, 0.81);
  assert.equal(s.grandTotal, 10.62);

  const g = computeInvoiceTotals([item(9)], 0, "IGST");
  assert.equal(g.taxAmount, 1.62);
  assert.equal(g.igst, 1.62);
  assert.equal(g.cgst, 0);
  assert.equal(g.sgst, 0);
  assert.equal(g.grandTotal, 10.62);
}

// --------------------------- multi-item + mixed rates + 10% discount (parity)
{
  const items = [item(1000, 18, 2), item(250, 12, 4), item(60, 5, 1)];
  const split = computeInvoiceTotals(items, 10, "CGST_SGST");
  const igst = computeInvoiceTotals(items, 10, "IGST");
  assertModeIndependent(split, igst);
  assert.equal(split.subtotal, 2000 * 1 + 1000 + 60); // 2000 + 1000 + 60
  assert.equal(split.discountAmount, 306);
  assert.equal(split.taxableAmount, 2754);
  // components foot to taxAmount in both modes, per item and invoice level
  assert.equal(split.cgst + split.sgst, split.taxAmount);
  assert.equal(igst.igst, igst.taxAmount);
  split.perItem.forEach((p, i) => assert.equal(p.cgst + p.sgst, p.tax, `item ${i} split legs`));
  igst.perItem.forEach((p, i) => assert.equal(p.igst, p.tax, `item ${i} igst`));
}

// -------------------------------------------------------- zero-rated items
{
  for (const mode of ["CGST_SGST", "IGST"]) {
    const t = computeInvoiceTotals([item(100, 0)], 0, mode);
    assert.equal(t.taxAmount, 0);
    assert.equal(t.grandTotal, 100);
    assert.equal(t.perItem[0].tax, 0);
    if (mode === "IGST") assert.equal(t.igst, 0);
    else { assert.equal(t.cgst, 0); assert.equal(t.sgst, 0); }
  }
}

// -------------------------------------------- rounding & residual paisa edge
{
  // 3 × 33.33 = 99.99 @ 5% -> 4.9995 rounds HALF_UP to 5.00
  const s = computeInvoiceTotals([item(33.33, 5, 3)], 0, "CGST_SGST");
  assert.equal(s.taxableAmount, 99.99);
  assert.equal(s.taxAmount, 5);
  assert.equal(s.cgst, 2.5);
  assert.equal(s.sgst, 2.5);
  assert.equal(s.grandTotal, 104.99);
  const g = computeInvoiceTotals([item(33.33, 5, 3)], 0, "IGST");
  assert.equal(g.igst, 5);
  assert.equal(g.grandTotal, 104.99);

  // Odd paisa: tax 0.05 splits 0.03 / 0.02 (residual to SGST), IGST keeps 0.05
  const odd = computeInvoiceTotals([item(10, 0.5)], 0, "CGST_SGST");
  assert.equal(odd.taxAmount, 0.05);
  assert.equal(odd.cgst, 0.03);
  assert.equal(odd.sgst, 0.02);
  assert.equal(odd.cgst + odd.sgst, 0.05);
  const oddG = computeInvoiceTotals([item(10, 0.5)], 0, "IGST");
  assert.equal(oddG.igst, 0.05);
  assert.equal(oddG.cgst, 0);
}

// --------------------------------- legacy default arg = split mode, exact
{
  const implicit = computeInvoiceTotals([item(100)], 0);
  const explicit = computeInvoiceTotals([item(100)], 0, "CGST_SGST");
  assert.deepEqual(implicit, explicit, "no third arg must behave exactly like CGST_SGST");
  assert.deepEqual(computeInvoiceTotals([item(100)], 0, undefined), explicit);
  assert.deepEqual(computeInvoiceTotals([item(100)], 0, "BROKEN-VALUE"), explicit, "unknown mode falls back to split");
  // legacy fields intact for old consumers
  assert.deepEqual(
    { subtotal: implicit.subtotal, cgst: implicit.cgst, sgst: implicit.sgst, taxAmount: implicit.taxAmount, grandTotal: implicit.grandTotal },
    { subtotal: 100, cgst: 9, sgst: 9, taxAmount: 18, grandTotal: 118 },
  );
}

// ------------------------------------- Enterprise HSN summary column shape
{
  const rows = [
    { hsn: "9983", itemName: "Consulting", gstPercentage: 18, taxableValue: 100 },
    { hsn: "9983", itemName: "Consulting more", gstPercentage: 18, taxableValue: 50 },
    { hsn: "8471", itemName: "Laptop", gstPercentage: 28, taxableValue: 1000 },
  ];

  // Default (CGST_SGST): unchanged legacy shape — half-rate label, cgst/sgst
  const split = groupTaxSummaryRows(rows, {});
  assert.equal(split.length, 2, "grouping by hsn|rate preserved");
  const r0 = split.find((r) => r.key === "9983");
  assert.equal(r0.rateLabel, "9.00%");
  assert.equal(r0.taxable, 150);
  assert.equal(r0.cgst, 13.5);
  assert.equal(r0.sgst, 13.5);
  assert.equal(r0.tax, 27);
  assert.equal("igst" in r0, false, "no igst key in split mode");

  // IGST: full-rate label, single igst column, NO cgst/sgst keys at all
  const igst = groupTaxSummaryRows(rows, { taxMode: "IGST" });
  assert.equal(igst.length, 2, "grouping identical in IGST mode");
  const g0 = igst.find((r) => r.key === "9983");
  assert.equal(g0.rateLabel, "18.00%", "full rate on the IGST row");
  assert.equal(g0.taxable, 150);
  assert.equal(g0.igst, 27);
  assert.equal(g0.tax, 27);
  assert.equal("cgst" in g0, false, "no CGST column in IGST mode");
  assert.equal("sgst" in g0, false, "no SGST column in IGST mode");
  const g1 = igst.find((r) => r.key === "8471");
  assert.equal(g1.rateLabel, "28.00%");
  assert.equal(g1.igst, 280);
  // showHnSac:false groups by ITEM NAME instead of HSN — the three fixture
  // rows have distinct names, so they stay 3 rows (grouping rule unchanged)
  assert.equal(groupTaxSummaryRows(rows, { showHnSac: false }).length, 3);
}

// ------------------------------------------------------------ mode helpers
{
  // legal default from supplier state vs place of supply
  assert.equal(determineTaxMode("Karnataka", "Karnataka"), "CGST_SGST");
  assert.equal(determineTaxMode("karnataka ", "KARNATAKA"), "CGST_SGST");
  assert.equal(determineTaxMode("Delhi", "Delhi"), "CGST_SGST", "UT intra-state stays split (UTGST leg)");
  assert.equal(determineTaxMode("Karnataka", "Maharashtra"), "IGST");
  assert.equal(determineTaxMode(null, "Karnataka"), null, "missing supplier state = indeterminate");
  assert.equal(determineTaxMode("Karnataka", "  "), null, "missing PoS = indeterminate");
  assert.equal(determineTaxMode(null, null), null);

  // stored selection always wins for display; heuristic only fills gaps
  assert.equal(resolveTaxMode("IGST", "Karnataka", "Karnataka"), "IGST", "never silently changed");
  assert.equal(resolveTaxMode("CGST_SGST", "Karnataka", "Maharashtra"), "CGST_SGST");
  assert.equal(resolveTaxMode(null, "Karnataka", "Maharashtra"), "IGST");
  assert.equal(resolveTaxMode(null, "Karnataka", "Karnataka"), "CGST_SGST");
  assert.equal(resolveTaxMode(null, null, null), "CGST_SGST", "unknown info keeps today's split display");
  assert.equal(resolveTaxMode("bogus", "Karnataka", "Maharashtra"), "IGST", "invalid stored value treated as absent");

  // consistency: conflict is a problem, indeterminate is not
  assert.equal(isTaxModeConsistent("CGST_SGST", "Karnataka", "Karnataka"), true);
  assert.equal(isTaxModeConsistent("IGST", "Karnataka", "Maharashtra"), true);
  assert.equal(isTaxModeConsistent("IGST", "Karnataka", "Karnataka"), false);
  assert.equal(isTaxModeConsistent("CGST_SGST", "Karnataka", "Maharashtra"), false);
  assert.equal(isTaxModeConsistent("IGST", null, null), true, "cannot establish -> allow");

  // validation messages for the Create/View screens
  const ok = validateTaxMode("CGST_SGST", "Karnataka", "Karnataka");
  assert.equal(ok.ok, true);
  assert.equal(ok.level, "ok");
  assert.equal(ok.message, null);
  assert.equal(ok.cannotDetermine, false);

  const badIgst = validateTaxMode("IGST", "Karnataka", "Karnataka");
  assert.equal(badIgst.ok, false);
  assert.equal(badIgst.level, "warning");
  assert.match(badIgst.message, /inter-state/);
  assert.match(badIgst.message, /CGST \+ SGST\/UTGST/);

  const badSplit = validateTaxMode("CGST_SGST", "Karnataka", "Maharashtra");
  assert.equal(badSplit.ok, false);
  assert.match(badSplit.message, /intra-state/);
  assert.match(badSplit.message, /IGST/);

  const unknown = validateTaxMode("IGST", null, null);
  assert.equal(unknown.ok, true, "missing info follows the established flow: allow + explain");
  assert.equal(unknown.cannotDetermine, true);
  assert.equal(unknown.level, "info");
  assert.match(unknown.message, /place of supply|state/i);
}

console.log("taxMode.test.mjs: all assertions passed");
