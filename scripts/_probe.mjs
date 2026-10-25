import puppeteer from "puppeteer";

const q = process.argv[2] || "rows=40";
const out =
  process.argv[3] ||
  "/private/var/folders/00/0hss351j5gg438t18z9lyntw0000gn/T/opencode/hsn.png";
const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox"],
  userDataDir:
    "/private/var/folders/00/0hss351j5gg438t18z9lyntw0000gn/T/opencode/einvoice-stress/.profile",
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1400, deviceScaleFactor: 2 });
await page.goto(`http://localhost:5173/__einv-lab?${q}`, {
  waitUntil: "networkidle2",
  timeout: 90000,
});
await page.waitForFunction(() => window.__iiStress?.getElement, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 400));

const info = await page.evaluate(() => {
  const dump = (sel) => {
    const t = document.querySelector(sel);
    if (!t) return null;
    const rows = [];
    [...t.querySelectorAll("tr")].forEach((tr, ri) => {
      rows.push(
        `[${ri}] ` +
          [...tr.cells]
            .map(
              (td, ci) =>
                `${ci}:${td.tagName}${td.colSpan > 1 ? "x" + td.colSpan : ""}${
                  td.rowSpan > 1 ? "^" + td.rowSpan : ""
                } w=${Math.round(td.getBoundingClientRect().width)} bR=${getComputedStyle(td)
                  .borderRightWidth} bB=${getComputedStyle(td).borderBottomWidth}`
            )
            .join("  ")
      );
    });
    return rows;
  };
  return {
    igstMode: !document.querySelector("#einv-hsn thead tr th")?.innerText?.includes("Central"),
    items: dump("#einv-items"),
    hsn: dump("#einv-hsn"),
  };
});
console.log("HSN header/body cells:");
(info.hsn || []).forEach((r) => console.log("  " + r));
const el = await page.$("#einv-hsn");
await el.screenshot({ path: out });
console.log("shot:", out);
await browser.close();
