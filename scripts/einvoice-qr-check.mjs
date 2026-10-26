// e-Invoice QR payload check — run with:
//
//   node scripts/einvoice-qr-check.mjs ["rows=40&igst=1" ...]
//
// Needs the Vite dev server on :5173 (npm run dev). Opens the dev-only
// /__einv-lab route, reads the exact string the template hands to QRCodeSVG
// (data-qr-payload on the QR's wrapper) and asserts it carries the invoice's
// own dynamic data:
//
//   · the shape the NIC spec defines (Version/TranDtls/DocDtls/SellerDtls/
//     BuyerDtls/ValDtls)
//   · Doc No / Doc Dt / Seller GSTIN / Buyer name actually printed on the page
//   · ValDtls.TotInvVal == the grand total printed in #section-subtotals
//   · the value breakdown adds up, and tax fields match the tax mode
//
// Any mismatch exits non-zero with the offending field named.

import puppeteer from "puppeteer";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:5173";
const OUT =
  process.env.OUT ||
  "/private/var/folders/00/0hss351j5gg438t18z9lyntw0000gn/T/opencode/einvoice-stress";
const PROFILE = path.join(OUT, ".profile");

const QUERIES = process.argv.slice(2);
const SCENARIOS = QUERIES.length
  ? QUERIES
  : ["rows=12", "rows=60&igst=1", "rows=20&cess=1", "rows=45&industry=HEALTHCARE"];

const money = (s) => Number(String(s).replace(/[^0-9.-]/g, ""));
const near = (a, b, tol = 0.02) => Math.abs(Number(a) - Number(b)) <= tol;

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox"],
  userDataDir: PROFILE,
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1400, deviceScaleFactor: 1 });

let failed = 0;
const report = (label, ok, detail) => {
  if (!ok) {
    failed += 1;
    console.log(`   ✗ ${label}${detail ? `: ${detail}` : ""}`);
  }
};

for (const query of SCENARIOS) {
  await page.goto(`${BASE}/__einv-lab?${query}`, {
    waitUntil: "networkidle2",
    timeout: 90000,
  });
  await page.waitForFunction(() => window.__iiStress?.getElement, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 300));

  const out = await page.evaluate(() => {
    const el = document.querySelector("[data-qr-payload]");
    const subtotals = document.querySelector("#section-subtotals");
    const totalCell = subtotals ? subtotals.cells[subtotals.cells.length - 1] : null;
    return {
      raw: el ? el.getAttribute("data-qr-payload") : null,
      printedTotal: totalCell ? totalCell.innerText : null,
      pageText: document.body.innerText,
      igstMode: /\bIGST\b/.test(document.querySelector("#einv-hsn")?.innerText || ""),
    };
  });

  console.log(`\n${query}`);
  if (!out.raw) {
    console.log("   ✗ no QR payload on the page");
    failed += 1;
    continue;
  }

  let qr;
  try {
    qr = JSON.parse(out.raw);
  } catch (e) {
    console.log(`   ✗ payload is not valid JSON: ${e.message}`);
    failed += 1;
    continue;
  }

  const text = out.pageText;
  report("Version", qr.Version === "1.1", `got ${qr.Version}`);
  report("TranDtls.TaxSch", qr.TranDtls?.TaxSch === "GST", JSON.stringify(qr.TranDtls));
  report("TranDtls.SupTyp", qr.TranDtls?.SupTyp === "B2B", JSON.stringify(qr.TranDtls));
  report("DocDtls.Typ", qr.DocDtls?.Typ === "INV", qr.DocDtls?.Typ);

  const no = qr.DocDtls?.No || "";
  report("DocDtls.No non-empty", no.length > 0);
  report("DocDtls.No printed on the invoice", text.includes(no), no);
  report("DocDtls.Dt non-empty", String(qr.DocDtls?.Dt || "").length > 0, String(qr.DocDtls?.Dt));
  report("DocDtls.Dt printed on the invoice", text.includes(String(qr.DocDtls?.Dt)));

  const seller = qr.SellerDtls || {};
  const buyer = qr.BuyerDtls || {};
  report("SellerDtls.Gstin non-empty", String(seller.Gstin || "").length >= 15, seller.Gstin);
  report("SellerDtls.Gstin printed", text.includes(String(seller.Gstin || "")), seller.Gstin);
  report("SellerDtls.LglNm printed", text.includes(String(seller.LglNm || "")), seller.LglNm);
  report("BuyerDtls.LglNm printed", text.includes(String(buyer.LglNm || "")), buyer.LglNm);
  report("BuyerDtls.Gstin printed when present",
    !buyer.Gstin || text.includes(String(buyer.Gstin)), buyer.Gstin);
  report("BuyerDtls.State filled", String(buyer.State || "").length > 0, buyer.State);

  const v = qr.ValDtls || {};
  const wanted = money(out.printedTotal);
  report("ValDtls.TotInvVal matches the printed grand total",
    near(v.TotInvVal, wanted), `qr=${v.TotInvVal} printed=${out.printedTotal}`);

  const sum = Number(v.AssVal || 0) + Number(v.CgstVal || 0) + Number(v.SgstVal || 0)
    + Number(v.IgstVal || 0) + Number(v.CessVal || 0);
  report("value breakdown adds up to TotInvVal", near(sum, v.TotInvVal),
    `${sum.toFixed(2)} vs ${v.TotInvVal}`);

  const cgst = Number(v.CgstVal || 0), sgst = Number(v.SgstVal || 0), igst = Number(v.IgstVal || 0);
  if (out.igstMode) {
    report("IGST mode: IgstVal used, CGST/SGST zero", igst > 0 && cgst === 0 && sgst === 0,
      `igst=${igst} cgst=${cgst} sgst=${sgst}`);
  } else {
    report("split mode: CGST/SGST used, IgstVal zero", igst === 0 && cgst > 0 && sgst > 0,
      `igst=${igst} cgst=${cgst} sgst=${sgst}`);
    report("CGST == SGST", near(cgst, sgst), `${cgst} vs ${sgst}`);
  }

  console.log(
    `   ${failed === 0 ? "" : ""}Doc No=${no} Dt=${qr.DocDtls?.Dt} ` +
      `AssVal=${v.AssVal} Tot=${v.TotInvVal} printed=${out.printedTotal} ` +
      `cgst=${cgst} sgst=${sgst} igst=${igst}`
  );
}

await browser.close();
console.log(failed === 0 ? "\nQR payload: all assertions passed" : `\nQR payload: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
