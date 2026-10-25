// Page-cut band audit — decides whether a reported "split row" is a real
// broken rule or just integer rounding at the slice boundary.
//
//   node scripts/einvoice-band-audit.mjs <scenario>-cut-before-p<N>.jpg ...
//
// Each band image is 90 device px above and below one page cut, so the cut is
// exactly at the band's midline. The script prints the luminance of the pixel
// rows around it: a rule that ends on one side with white on the other is a
// clean cut; darkness straddling the midline means the line really was split.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";

const OUT =
  "/private/var/folders/00/0hss351j5gg438t18z9lyntw0000gn/T/opencode/einvoice-stress";
const bands = process.argv.slice(2);

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox"],
  userDataDir: path.join(OUT, ".profile-band"),
});
const page = await browser.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });

for (const b of bands) {
  const data = fs.readFileSync(path.join(OUT, b)).toString("base64");
  const rows = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/jpeg;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const out = [];
    for (let y = 0; y < c.height; y++) {
      let s = 0;
      for (let x = 0; x < c.width; x += 4) s += d[(y * c.width + x) * 4];
      out.push(s / Math.ceil(c.width / 4));
    }
    return { w: c.width, h: c.height, mean: out };
  }, data);

  // the cut sits exactly at h/2 (90 device px above and below)
  const cut = rows.h / 2;
  const near = rows.mean
    .map((m, y) => ({ y, m: Math.round(m) }))
    .filter((r) => Math.abs(r.y - cut) <= 6);
  const dark = rows.mean.map((m, y) => ({ y, m })).filter((r) => r.m < 160);
  // contiguous dark runs near the cut = the horizontal rule(s)
  const runs = [];
  dark.forEach((r) => {
    const last = runs[runs.length - 1];
    if (last && r.y === last.y1 + 1) last.y1 = r.y;
    else runs.push({ y0: r.y, y1: r.y });
  });
  console.log(
    `\n${b}  ${rows.w}×${rows.h}  cut@${cut}`
  );
  console.log(
    "  rows±6: " + near.map((r) => `${r.y}:${r.m}`).join(" ")
  );
  console.log(
    "  dark runs (<160) touching cut: " +
      JSON.stringify(runs.filter((r) => r.y1 >= cut - 8 && r.y0 <= cut + 8))
  );
}
await browser.close();
