/**
 * Regression tests for the Enterprise (template-32) invoice pagination.
 * Runs with plain `node` (node:assert/strict):  npm run test:unit
 *
 * Two bugs are locked down here, both seen on a real 53-item invoice
 * (Gritx Technologies, HSN 8471 at 0/5/12/18/28%):
 *
 *   1. The tax breakup was rendered ONE ROW PER LINE ITEM — 53 rows, with 11
 *      identical rows for the same HSN+rate. It now lists one row per
 *      (HSN/product, rate) GROUP: 5 rows. The long table used to need extra
 *      pages and left the last one ~30% full ("the document skipped a page").
 *   2. A tax table that fits on ONE page is never split across two (5 rows
 *      broken 4 + 1 left a nearly empty final page). Long tables are spread
 *      evenly over their pages, so no page carries a lonely single row.
 */
import assert from "node:assert/strict";
import {
  ENT_PAGE_METRICS as M,
  distributeBreakupRows,
  entDescLines,
  estimateEntRow,
  groupTaxSummaryRows,
  packEntPages,
  resolveEntRow,
} from "../src/utils/enterprisePage.js";

/* --- the planner's geometry, mirrored from InvoiceTemplateEnterprise --- */
const fixedTopOf = (isFirst) =>
  isFirst
    ? M.head + M.partyRow + M.thead + M.fudge
    : M.contHead + M.thead + M.fudge;
const openBudget = (isFirst) => M.pageH - fixedTopOf(isFirst) - M.footer;
const sumHeadH = M.summaryHead + M.summarySubHead;
const contCap = Math.max(1, Math.floor((M.pageH - M.contHead - sumHeadH - M.footer) / M.summaryRow));
const finalCap = Math.max(1, Math.floor((M.pageH - M.contHead - sumHeadH - M.summaryFoot - 290 - M.footer) / M.summaryRow));
const closingNoFooter = 290; // totals + amount-in-words + bank/signature band

/* --- the reported invoice: 53 items, 2-line descriptions, 5 tax groups --- */
const GROUPS = [
  { hsn: "8471", rate: 0, count: 10 },
  { hsn: "8471", rate: 5, count: 11 },
  { hsn: "8471", rate: 12, count: 11 },
  { hsn: "8471", rate: 18, count: 11 },
  { hsn: "8471", rate: 28, count: 10 },
];
const items = [];
GROUPS.forEach((g) => {
  for (let i = 0; i < g.count; i++) {
    items.push({
      itemName: `Item ${items.length + 1} ${"x".repeat(52)}`, // ~61 chars → 2 lines
      hsn: g.hsn,
      gstPercentage: g.rate,
      taxableValue: 1000,
    });
  }
});
assert.equal(items.length, 53);

/* ── 1. the tax breakup groups by (HSN, rate) ────────────────────────── */
const summary = groupTaxSummaryRows(items, { showHnSac: true, ratio: 1 });
assert.equal(summary.length, 5, "53 items across 5 rates must produce 5 summary rows");
assert.deepEqual(
  summary.map((r) => r.rateLabel),
  ["0.00%", "2.50%", "6.00%", "9.00%", "14.00%"],
  "one row per rate, in order",
);
assert.equal(summary[0].key, "8471");
assert.equal(summary[0].taxable, 10 * 1000, "taxable value is summed per group");

/* ── 2. grouping must not change a single rupee ──────────────────────── */
const perItemTax = items.reduce((s, it) => s + (1000 * (it.gstPercentage / 100)), 0);
const groupedTax = summary.reduce((s, r) => s + r.tax, 0);
assert.ok(Math.abs(perItemTax - groupedTax) < 0.01, "grouping must conserve the tax total");
const perItemCgst = items.reduce((s, it) => s + (1000 * (it.gstPercentage / 200)), 0);
assert.ok(Math.abs(perItemCgst - summary.reduce((s, r) => s + r.cgst, 0)) < 0.01, "CGST must be conserved");

/* ── 3. pagination: pages, and no near-empty page ────────────────────── */
const heights = items.map((it) => estimateEntRow(it.itemName));
const packed = packEntPages(heights, {
  page1: openBudget(true),
  cont: openBudget(false),
  lastSingle: openBudget(true),
  lastCont: openBudget(false),
});
const nSum = summary.length;
const lastUsed = packed[packed.length - 1].reduce((s, i) => s + heights[i], 0);
const avail = M.pageH - fixedTopOf(packed.length === 1) - lastUsed - M.footer;
const plan = { onItemsPage: 0, pages: [] };
if (nSum === 0) {
  /* nothing to break up */
} else if (M.summaryHead + M.summarySubHead + M.summaryFoot + nSum * M.summaryRow + closingNoFooter <= avail) {
  plan.onItemsPage = nSum;
} else if (nSum <= contCap) {
  // whole table travels to the final page — never split
  plan.pages.push({ rows: nSum, isFinal: true });
} else {
  plan.onItemsPage = avail >= sumHeadH + M.summaryRow
    ? Math.min(Math.floor((avail - sumHeadH) / M.summaryRow), nSum - 1)
    : 0;
  const remaining = nSum - plan.onItemsPage;
  distributeBreakupRows(remaining, { contCap, finalCap }).forEach((rows, i, all) => {
    plan.pages.push({ rows, isFinal: i === all.length - 1 });
  });
}

const breakupRows = plan.pages.reduce((s, p) => s + p.rows, 0) + plan.onItemsPage;
assert.equal(breakupRows, nSum, "every tax row must be placed exactly once");
assert.equal(plan.pages.length, 1, "a 5-row tax table fits on one page — it must not be split");
assert.equal(plan.pages[0].rows, 5);

/* page fills: items pages + the final (closing) page */
const pageFills = [];
packed.forEach((chunk, i) => {
  const used = chunk.reduce((s, idx) => s + heights[idx], 0);
  const furniture = i === packed.length - 1 ? sumHeadH + nSum * M.summaryRow + M.summaryFoot + closingNoFooter : 0;
  pageFills.push((used + furniture) / openBudget(i === 0));
});
const finalPageFill = (M.contHead + sumHeadH + nSum * M.summaryRow + M.summaryFoot + closingNoFooter + M.footer) / M.pageH;
pageFills.push(finalPageFill);

const emptiest = Math.min(...pageFills);
assert.ok(
  emptiest >= 0.45,
  `emptiest page is only ${Math.round(emptiest * 100)}% full — pages must be filled`,
);

/* ── 4. long breakups are spread evenly (no lonely single-row page) ──── */
const long = distributeBreakupRows(120, { contCap, finalCap });
assert.equal(long.reduce((s, c) => s + c, 0), 120, "every row must be placed");
assert.ok(long[long.length - 1] >= 2, "the final page must not carry a single row");
assert.ok(
  Math.max(...long) - Math.min(...long) <= Math.ceil(120 / long.length) + 1,
  "long breakups must be spread evenly",
);
assert.ok(long[long.length - 1] <= finalCap, "the final page must respect its budget");
for (let i = 0; i < long.length - 1; i++) {
  assert.ok(long[i] <= contCap, "continuation pages must respect their budget");
}

/* ── 5. tiny / empty cases stay sane ─────────────────────────────────── */
assert.deepEqual(distributeBreakupRows(3, { contCap, finalCap }), [3]);
assert.deepEqual(distributeBreakupRows(0, { contCap, finalCap }), []);
assert.deepEqual(distributeBreakupRows(finalCap, { contCap, finalCap }), [finalCap]);
assert.deepEqual(distributeBreakupRows(finalCap + 1, { contCap, finalCap }), [14, 13]);
assert.deepEqual(distributeBreakupRows(finalCap + 2, { contCap, finalCap }), [14, 14]);
assert.deepEqual(distributeBreakupRows(contCap + finalCap, { contCap, finalCap }), [contCap, finalCap]);
assert.deepEqual(groupTaxSummaryRows([], { showHnSac: true }), []);

/* ── 6. HUGE items: real wrap measurement, and no row may blow the page ── */
const maxRowH = openBudget(false);

// A measurer that mimics 10px Segoe UI (≈5.2px per character).
const measure = (text) => String(text).length * 5.2;

// 61 chars → two real lines; the row reserves the measured height, and the
// OLD character-count guess (24 + 14 per extra line) wasted ~4px per row.
const row61 = resolveEntRow({ itemName: "x".repeat(61) }, { showHnSac: true, maxH: maxRowH, measure });
assert.equal(row61.lines, 2, "a 61-char description wraps to two lines in a 292px column");
assert.equal(row61.height, 2 * 13 + 8, "the row height follows the measured wrap");
assert.ok(row61.height < estimateEntRow("x".repeat(61)), "the measured height must be tighter than the old guess");
assert.equal(row61.truncated, false);

// A long description: measured height, still well inside the page.
const row400 = resolveEntRow({ itemName: "y".repeat(400) }, { showHnSac: true, maxH: maxRowH, measure });
assert.equal(row400.lines, Math.ceil(400 * 5.2 / 276));
assert.ok(row400.height <= maxRowH, "a normal long row must fit the page");

// A very long description (4,000 chars): the font shrinks to fit — the row
// still fits the page and nothing is clipped.
const row4000 = resolveEntRow({ itemName: "z".repeat(4000) }, { showHnSac: true, maxH: maxRowH, measure });
assert.ok(row4000.height <= maxRowH, "a single huge row may never blow the page frame open");
assert.ok(row4000.fontSize < 10, "the font shrinks before the text is clipped");
assert.equal(row4000.truncated, false, "4,000 chars still fit once the font shrinks");

// An absurd description (20,000 chars): the font is already at its floor, so
// the text is clipped with an ellipsis — the row still fits the page.
const row20000 = resolveEntRow({ itemName: "z".repeat(20000) }, { showHnSac: true, maxH: maxRowH, measure });
assert.ok(row20000.height <= maxRowH, "even an absurd row may never blow the page frame open");
assert.ok(row20000.truncated, "an absurd description is clipped with an ellipsis");
assert.ok(row20000.text.endsWith("\u2026"));

// The HSN-hidden column is wider → fewer lines for the same text.
assert.ok(
  entDescLines("x".repeat(120), { showHnSac: false }) <= entDescLines("x".repeat(120), { showHnSac: true }),
  "the wider (HSN hidden) column must not need more lines",
);

// Huge items end-to-end: no page may exceed its budget.
const hugeItems = Array.from({ length: 20 }, (_, i) => ({
  itemName: `Huge ${i} ${"q".repeat(400)}`,
  hsn: "8471",
  gstPercentage: 18,
  taxableValue: 1000,
}));
const hugeMeta = hugeItems.map((it) => resolveEntRow(it, { showHnSac: true, maxH: maxRowH, measure }));
const hugeHeights = hugeMeta.map((m) => m.height);
const hugePacked = packEntPages(hugeHeights, {
  page1: openBudget(true),
  cont: openBudget(false),
  lastSingle: openBudget(true),
  lastCont: openBudget(false),
});
hugePacked.forEach((chunk, i) => {
  const used = chunk.reduce((s, idx) => s + hugeHeights[idx], 0);
  assert.ok(
    used <= (i === 0 ? openBudget(true) : openBudget(false)),
    `huge-item page ${i + 1} overflows its budget`,
  );
});
assert.ok(hugePacked.length >= 2, "20 huge items must span several pages");
// Every page but the last is filled to at least 80% of its budget.
hugePacked.slice(0, -1).forEach((chunk, i) => {
  const used = chunk.reduce((s, idx) => s + hugeHeights[idx], 0);
  const budget = i === 0 ? openBudget(true) : openBudget(false);
  assert.ok(used / budget >= 0.8, `huge-item page ${i + 1} is only ${Math.round((used / budget) * 100)}% full`);
});

console.log(
  `✓ enterprisePaging: ${items.length} items → ${packed.length} item pages + ${plan.pages.length} tax page ` +
  `(tax rows ${summary.length}, emptiest page ${Math.round(emptiest * 100)}%) · huge items: ` +
  `${hugePacked.length} pages, no overflow`,
);
