// GST calculation audit for Inside Invoice.
// Verifies the frontend computeInvoiceTotals() against:
//   1. An EXACT BigDecimal (BigInt-scaled) replica of the backend InvoiceMapper.
//   2. Hand-computed Indian GST ground truth.
//   3. Internal consistency invariants (columns foot, CGST+SGST==tax, etc).
import { computeInvoiceTotals, round2 } from "../src/utils/invoiceTotals.js";

// ---------- exact decimal helpers (replicate Java BigDecimal) ----------
const SCALE = 20n;
const P = 10n ** SCALE;

function toDec(x) {
  const s = String(x);
  const neg = s.startsWith("-");
  const t = neg ? s.slice(1) : s;
  const [i, f = ""] = t.split(".");
  const frac = (f + "0".repeat(Number(SCALE))).slice(0, Number(SCALE));
  const v = BigInt(i || "0") * P + BigInt(frac || "0");
  return neg ? -v : v;
}
function mul(a, b) { return (a * b) / P; }
function divRound(a, b, scale) {
  const shift = SCALE - BigInt(scale);
  const divisor = 10n ** shift;
  const scaled = (a * P) / b; // a/b at SCALE
  let q = scaled / divisor;
  const r = scaled % divisor;
  if (r >= divisor / 2n) q += 1n; // HALF_UP (positive values only)
  return q * divisor;
}
function roundScale(a, scale) {
  const shift = SCALE - BigInt(scale);
  const divisor = 10n ** shift;
  let q = a / divisor;
  const r = a % divisor;
  if (r >= divisor / 2n) q += 1n;
  return q * divisor;
}
const toNum = (a) => Number(a) / Number(P);

// Backend InvoiceMapper.calculateInvoiceTotals — exact replica.
function backendTotals(items, discountPercent) {
  const bases = items
    .filter((i) => i.itemName?.trim() && parseFloat(i.qty) > 0)
    .map((i) => roundScale(mul(toDec(i.qty), toDec(i.rate)), 2));
  let subtotal = roundScale(
    bases.reduce((s, b) => s + b, 0n),
    2
  );
  let pct = toDec(discountPercent || 0);
  if (pct < 0n) pct = 0n;
  if (pct > toDec(100)) pct = toDec(100);
  // discountAmount = round2(subtotal * pct / 100)
  const discountAmount = roundScale((subtotal * pct) / toDec(100), 2);
  const taxableAmount = roundScale(subtotal - discountAmount, 2);
  const ratio = subtotal > 0n ? divRound(taxableAmount, subtotal, 10) : P;
  let taxAmount = 0n;
  const gstList = items
    .filter((i) => i.itemName?.trim() && parseFloat(i.qty) > 0)
    .map((i) => toDec(i.gstPercentage || 0));
  bases.forEach((b, idx) => {
    const t = divRound(mul(mul(b, ratio), gstList[idx]), toDec(100), 2);
    taxAmount += t;
  });
  taxAmount = roundScale(taxAmount, 2);
  const grandTotal = roundScale(taxableAmount + taxAmount, 2);
  return {
    subtotal: toNum(subtotal),
    discountAmount: toNum(discountAmount),
    taxableAmount: toNum(taxableAmount),
    taxAmount: toNum(taxAmount),
    grandTotal: toNum(grandTotal),
  };
}

// ---------- test harness ----------
let pass = 0;
let fail = 0;
function eq(a, b, tol = 0.005) {
  return Math.abs(a - b) < tol;
}
function check(name, cond, detail = "") {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL: ${name} ${detail}`); }
}
function assertClose(name, actual, expected) {
  if (eq(actual, expected)) pass++;
  else { fail++; console.log(`  FAIL: ${name}: got ${actual}, expected ${expected}`); }
}

function runCase(label, items, discountPct, expected = null) {
  console.log(`\n=== ${label} (discount ${discountPct}%) ===`);
  const f = computeInvoiceTotals(items, discountPct);
  const b = backendTotals(items, discountPct);

  // 1. Frontend must match the EXACT backend BigDecimal replica to the paisa.
  assertClose("subtotal", f.subtotal, b.subtotal);
  assertClose("discountAmount", f.discountAmount, b.discountAmount);
  assertClose("taxableAmount", f.taxableAmount, b.taxableAmount);
  assertClose("taxAmount", f.taxAmount, b.taxAmount);
  assertClose("grandTotal", f.grandTotal, b.grandTotal);

  // 2. Internal consistency (a GST invoice must foot line-by-line).
  const sumTaxable = f.perItem.reduce((s, p) => s + p.taxable, 0);
  const sumTax = f.perItem.reduce((s, p) => s + p.tax, 0);
  const sumTotal = f.perItem.reduce((s, p) => s + p.total, 0);
  assertClose("Σ perItem.taxable == taxableAmount", sumTaxable, f.taxableAmount);
  assertClose("Σ perItem.tax == taxAmount", sumTax, f.taxAmount);
  assertClose("Σ perItem.total == grandTotal", sumTotal, f.grandTotal);
  assertClose("cgst + sgst == taxAmount", f.cgst + f.sgst, f.taxAmount);
  assertClose("grandTotal == taxableAmount + taxAmount", f.grandTotal, f.taxableAmount + f.taxAmount);
  check("taxableAmount == subtotal - discountAmount", eq(f.taxableAmount, f.subtotal - f.discountAmount));

  // 3. GST must be on the DISCOUNTED value (never on gross) when discount>0.
  if (parseFloat(discountPct) > 0) {
    const grossTax = items
      .filter((i) => i.itemName?.trim() && parseFloat(i.qty) > 0)
      .reduce((s, i) => s + round2((round2(parseFloat(i.qty) * parseFloat(i.rate)) * (parseFloat(i.gstPercentage) || 0)) / 100), 0);
    if (grossTax > 0) {
      check("taxAmount < tax-on-gross", f.taxAmount < grossTax - 0.001, `(got ${f.taxAmount}, gross ${grossTax})`);
    }
  }

  // 4. Optional hand-computed ground truth.
  if (expected) {
    for (const k of Object.keys(expected)) assertClose(`expected.${k}`, f[k], expected[k]);
  }

  console.log(
    `  subtotal=${f.subtotal.toFixed(2)} disc=${f.discountAmount.toFixed(2)} ` +
    `taxable=${f.taxableAmount.toFixed(2)} tax=${f.taxAmount.toFixed(2)} ` +
    `cgst=${f.cgst.toFixed(2)} sgst=${f.sgst.toFixed(2)} grand=${f.grandTotal.toFixed(2)}`
  );
}

// ---------- cases ----------
runCase("Single item, 0% GST, no discount", [
  { itemName: "A", qty: "1", rate: "100", gstPercentage: "0" },
], "0", { subtotal: 100, taxAmount: 0, grandTotal: 100 });

runCase("Single item, 18% GST, no discount", [
  { itemName: "A", qty: "1", rate: "1000", gstPercentage: "18" },
], "0", { subtotal: 1000, taxAmount: 180, grandTotal: 1180 });

runCase("Multi-item mixed GST, no discount", [
  { itemName: "A", qty: "2", rate: "500", gstPercentage: "5" },
  { itemName: "B", qty: "1", rate: "1200", gstPercentage: "12" },
  { itemName: "C", qty: "3", rate: "800", gstPercentage: "18" },
  { itemName: "D", qty: "1", rate: "10000", gstPercentage: "28" },
], "0", { subtotal: 14600, taxAmount: 3426, grandTotal: 18026 });

runCase("10% discount, mixed GST", [
  { itemName: "A", qty: "2", rate: "500", gstPercentage: "5" },
  { itemName: "B", qty: "1", rate: "1200", gstPercentage: "12" },
  { itemName: "C", qty: "3", rate: "800", gstPercentage: "18" },
], "10", { subtotal: 4600, discountAmount: 460, taxableAmount: 4140, taxAmount: 563.4, grandTotal: 4703.4 });

runCase("50% discount, single 18% item", [
  { itemName: "A", qty: "1", rate: "1000", gstPercentage: "18" },
], "50", { subtotal: 1000, discountAmount: 500, taxableAmount: 500, taxAmount: 90, grandTotal: 590 });

runCase("100% discount (free sample)", [
  { itemName: "A", qty: "1", rate: "1000", gstPercentage: "18" },
], "100", { subtotal: 1000, discountAmount: 1000, taxableAmount: 0, taxAmount: 0, grandTotal: 0 });

// Rounding-stress: 1.5 * 33.33 = 49.995 -> taxable 50.00 (HALF_UP), 18% GST.
runCase("HALF_UP rounding stress (1.5 × 33.33 @18%)", [
  { itemName: "A", qty: "1.5", rate: "33.33", gstPercentage: "18" },
], "0", { subtotal: 50, taxAmount: 9, grandTotal: 59 });

runCase("Rounding stress with 7.5% discount", [
  { itemName: "A", qty: "3", rate: "33.33", gstPercentage: "18" },
  { itemName: "B", qty: "1", rate: "10.05", gstPercentage: "12" },
], "7.5");

runCase("Empty / invalid items", [], "10", { subtotal: 0, taxAmount: 0, grandTotal: 0 });

runCase("Items with qty 0 are skipped", [
  { itemName: "A", qty: "0", rate: "100", gstPercentage: "18" },
  { itemName: "B", qty: "2", rate: "100", gstPercentage: "18" },
], "0", { subtotal: 200, taxAmount: 36, grandTotal: 236 });

// round2 unit checks against Java BigDecimal HALF_UP.
console.log("\n=== round2 HALF_UP unit checks ===");
assertClose("round2(49.995)", round2(49.995), 50.0);
assertClose("round2(0.005)", round2(0.005), 0.01);
assertClose("round2(1.005)", round2(1.005), 1.01);
assertClose("round2(2.675)", round2(2.675), 2.68);
assertClose("round2(49.994)", round2(49.994), 49.99);
assertClose("round2(0)", round2(0), 0);

console.log(`\n========== RESULT: ${pass} passed, ${fail} failed ==========`);
process.exit(fail === 0 ? 0 : 1);
