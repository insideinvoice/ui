// e-Invoice (template-33) stress bench — run with:
//
//   node scripts/einvoice-stress.mjs [scenario ...]
//
// Needs the Vite dev server on :5173 (npm run dev). Renders the dev-only
// /__einv-lab route (registered in App.jsx under import.meta.env.DEV) with
// data pushed to the extremes, then runs the REAL buildInvoicePdf() that
// Print/Download use and inspects every page it sliced, so the checks are on
// the artefact the user actually gets — not on a re-implementation.
//
// Per scenario it reports: horizontal overflow, clipped cells, missing item
// rows, whether any row straddles a page cut, slice/page geometry vs the
// paper's printable box, and writes <OUT>/<scenario>-p<N>.jpg page images.

import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { INDUSTRY_IDS } from "../src/constants/industryConfig.js";

const BASE = process.env.BASE || "http://localhost:5173";
const OUT =
  process.env.OUT ||
  "/private/var/folders/00/0hss351j5gg438t18z9lyntw0000gn/T/opencode/einvoice-stress";
const PROFILE = path.join(OUT, ".profile");

const requested = process.argv.slice(2);
const SCENARIOS_ALL = [
  { name: "rows40", query: "rows=40" },
  { name: "rows100", query: "rows=100" },
  { name: "igst60", query: "rows=60&igst=1" },
  { name: "long18", query: "rows=18&long=1" },
  { name: "big15", query: "rows=15&big=1" },
  { name: "nohsn30", query: "rows=30&nohsn=1" },
  { name: "rates40", query: "rows=40&rates=1" },
  { name: "mega8", query: "rows=8&mega=1" },
  { name: "a5-rows40", query: "rows=40&paper=A5" },
  { name: "mega-a5", query: "rows=6&mega=1&paper=A5" },
  // New-block coverage: compensation cess, and the no-extras path (no e-Way
  // Bill / Notes / Terms) where rows fold away instead of printing empty cells.
  { name: "cess20", query: "rows=20&cess=1" },
  { name: "bare12", query: "rows=12&noeway=1&nonotes=1&noterms=1" },
  // Field-extreme coverage for the ruled meta grid: the sparse profile prints
  // almost no values, the dense profile needs ellipsis on every one.
  { name: "sparse10", query: "rows=10&sparse=1" },
  { name: "dense10", query: "rows=10&dense=1" },
  // Volume: a document far past anything a real invoice carries.
  { name: "huge200", query: "rows=200" },
  // One run per configured industry — each profile hides a different set of
  // fields (services industries blank six meta cells at once) and brings its
  // own units / HSN-SAC codes / GST rates / description lengths.
  ...INDUSTRY_IDS.map((id) => ({
    name: `ind-${id.toLowerCase()}`,
    query: `rows=45&industry=${id}`,
  })),
  // Industry × extremes: dense text, mixed rates, big money, small paper.
  { name: "ind-services90", query: "rows=90&industry=PROFESSIONAL_SERVICES&long=1" },
  { name: "ind-mfg150", query: "rows=150&industry=MANUFACTURING&rates=1&big=1" },
  { name: "ind-trans70-igst", query: "rows=70&industry=TRANSPORT&igst=1" },
  { name: "ind-health-a5", query: "rows=60&industry=HEALTHCARE&paper=A5" },
  { name: "ind-food-cess", query: "rows=55&industry=FOOD&cess=1&dense=1" },
];
const SCENARIOS = requested.length
  ? SCENARIOS_ALL.filter((s) => requested.includes(s.name))
  : SCENARIOS_ALL;

const PAPER = {
  A4_PORTRAIT: { contentW: 190, usableH: 277 },
  A5: { contentW: 128, usableH: 190 },
  LETTER: { contentW: 195.9, usableH: 262 },
  A4_LANDSCAPE: { contentW: 277, usableH: 190 },
};

// Mirrors TARGET_CAPTURE_SCALE / MIN_CAPTURE_SCALE / MAX_CAPTURE_AREA in
// src/utils/invoicePdf.js — needed to put DOM rects into canvas coordinates.
const captureScale = (natW, natH) => {
  const areaScale = natW * natH > 0 ? Math.sqrt(16_000_000 / (natW * natH)) : 3;
  return Math.min(3, Math.max(2, areaScale));
};

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox"],
  userDataDir: PROFILE,
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("  [console]", m.text());
});
await page.setViewport({ width: 1400, height: 1200, deviceScaleFactor: 1 });

const results = [];

for (const sc of SCENARIOS) {
  await page.goto(`${BASE}/__einv-lab?${sc.query}`, {
    waitUntil: "networkidle2",
    timeout: 90_000,
  });
  await page.waitForFunction(() => window.__iiStress?.getElement, {
    timeout: 30_000,
  });
  await page.waitForSelector("[data-ii-seal-spec]", { timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 400));

  // ---- 1. DOM-level checks (what the screen / capture sees) ------------
  const dom = await page.evaluate(() => {
    const el = window.__iiStress.getElement();
    const root = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll('[id^="section-item-row-"]')];
    const clipped = [];
    el.querySelectorAll("td, th").forEach((c) => {
      if (c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1) {
        clipped.push(
          `${c.tagName}:${(c.textContent || "").trim().slice(0, 24)} ` +
            `sw=${c.scrollWidth}/cw=${c.clientWidth} sh=${c.scrollHeight}/ch=${c.clientHeight}`
        );
      }
    });
    // anything sticking out past the document frame
    const overflowing = [];
    el.querySelectorAll("*").forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width > 0 && (r.right > root.right + 0.5 || r.left < root.left - 0.5)) {
        overflowing.push(`${n.tagName}.${n.className || ""}`.slice(0, 60));
      }
    });
    return {
      natW: el.offsetWidth,
      natH: el.offsetHeight,
      rectW: root.width,
      rowCount: rows.length,
      clipped: clipped.slice(0, 8),
      clippedCount: clipped.length,
      overflowing: [...new Set(overflowing)].slice(0, 8),
      overflowingCount: overflowing.length,
      rowTops: rows.map((r) => {
        const rr = r.getBoundingClientRect();
        return {
          id: r.id,
          top: rr.top - root.top,
          bottom: rr.bottom - root.top,
          h: rr.height,
        };
      }),
    };
  });

  // ---- 1b. Ruled-grid integrity — must hold for ANY field set ----------
  // Whatever an industry fills in or leaves out: the meta column is always
  // two 184px cells per row with one continuous vertical divider and exactly
  // one rule per row boundary, values are bold single-line text, and the item
  // and HSN tables keep their columns aligned with their own headers.
  const grid = await page.evaluate(() => {
    const el = window.__iiStress.getElement();
    const bad = [];
    const r2 = (n) => Math.round(n * 100) / 100;
    const widths = (row) => [...row.cells].map((c) => c.getBoundingClientRect().width);
    const sum = (a) => a.reduce((s, x) => s + x, 0);
    const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
    const info = {};

    // --- meta grid -------------------------------------------------------
    const meta = el.querySelector("#einv-meta-grid");
    if (!meta) {
      bad.push("meta grid missing");
    } else {
      const rows = [...meta.querySelectorAll("tr")];
      info.metaRows = rows.length;
      let empty = 0;
      let solo = 0;
      rows.forEach((tr, i) => {
        const cells = [...tr.querySelectorAll("td")];
        const last = i === rows.length - 1;
        const leftLabel = (cells[0]?.innerText || "").trim();
        const isSolo = cells.length === 1 && cells[0].colSpan === 2;
        const checkCell = (td, ci, width) => {
          const w = td.getBoundingClientRect().width;
          if (!near(w, width)) bad.push(`meta row ${i} cell ${ci}: ${r2(w)}px (want ${width})`);
          const cs = getComputedStyle(td);
          const wantR = ci === 0 && !isSolo ? "1px" : "0px";
          const wantB = last ? "0px" : "1px";
          if (cs.borderRightWidth !== wantR)
            bad.push(`meta row ${i} cell ${ci}: border-right ${cs.borderRightWidth} (want ${wantR})`);
          if (cs.borderBottomWidth !== wantB)
            bad.push(`meta row ${i} cell ${ci}: border-bottom ${cs.borderBottomWidth} (want ${wantB})`);
          if (!td.children.length) {
            empty += 1;
            bad.push(`meta row ${i} cell ${ci}: empty`);
          }
          [...td.children].forEach((d) => {
            const cs2 = getComputedStyle(d);
            const bold = cs2.fontWeight === "700";
            if (!bold && cs2.fontWeight !== "400")
              bad.push(`meta row ${i} cell ${ci}: font-weight ${cs2.fontWeight}`);
            const isNotes = leftLabel.startsWith("Notes");
            const wraps = cs2.whiteSpace !== "nowrap";
            if (wraps && !(bold && isNotes && cs2.whiteSpace === "pre-line"))
              bad.push(
                `meta row ${i} cell ${ci}: white-space ${cs2.whiteSpace} on "${d.innerText.slice(0, 20)}"`
              );
          });
        };
        if (isSolo) {
          // one field on the row → full width, no divider down the middle
          solo += 1;
          checkCell(cells[0], 0, 368);
          return;
        }
        if (cells.length !== 2) bad.push(`meta row ${i}: ${cells.length} cells (want 2)`);
        cells.forEach((td, ci) => checkCell(td, ci, 184));
      });
      info.metaEmptyCells = empty;
      info.metaSoloRows = solo;
      info.metaDatedLabels = [...meta.querySelectorAll("div")]
        .filter((d) => d.innerText.trim() === "Dated").length;
    }

    // --- item table ------------------------------------------------------
    const items = el.querySelector("#einv-items");
    if (!items) {
      bad.push("items table missing");
    } else {
      const head = widths(items.tHead.rows[0]);
      info.itemsHeadW = r2(sum(head));
      info.itemCols = head.length;
      if (!near(sum(head), 714, 1)) bad.push(`items header ${r2(sum(head))}px (want 714)`);
      const wantBorders = (row, label) => {
        const cells = [...row.cells];
        cells.forEach((td, ci) => {
          const cs = getComputedStyle(td);
          // one rule under every cell, one rule between every pair of columns
          if (cs.borderBottomWidth !== "1px")
            bad.push(`${label} col ${ci}: border-bottom ${cs.borderBottomWidth} (want 1px)`);
          const wantR = ci < cells.length - 1 ? "1px" : "0px";
          if (cs.borderRightWidth !== wantR)
            bad.push(`${label} col ${ci}: border-right ${cs.borderRightWidth} (want ${wantR})`);
        });
      };
      wantBorders(items.tHead.rows[0], "items header");
      const body = items.tBodies[0];
      [...body.rows].forEach((row, i) => {
        // the "No items" placeholder spans every column
        if (row.cells.length === 1 && row.cells[0].colSpan > 1) {
          wantBorders(row, `items row ${i}`);
          return;
        }
        const w = widths(row);
        if (w.length !== head.length) {
          bad.push(`items row ${i}: ${w.length} cells (header ${head.length})`);
          return;
        }
        if (!near(sum(w), 714, 1)) bad.push(`items row ${i}: ${r2(sum(w))}px (want 714)`);
        w.forEach((x, j) => {
          if (!near(x, head[j])) bad.push(`items row ${i} col ${j}: ${r2(x)}px (header ${r2(head[j])}px)`);
        });
        wantBorders(row, `items row ${i}`);
      });
      info.itemsRows = body.rows.length;
    }

    // --- HSN/SAC table ---------------------------------------------------
    const hsn = el.querySelector("#einv-hsn");
    if (!hsn) {
      bad.push("hsn table missing");
    } else {
      const head0 = widths(hsn.tHead.rows[0]);
      info.hsnHeadW = r2(sum(head0));
      if (!near(sum(head0), 714, 1)) bad.push(`hsn header ${r2(sum(head0))}px (want 714)`);
      const body = hsn.tBodies[0];
      [...body.rows].forEach((row, i) => {
        const w = widths(row);
        if (!near(sum(w), 714, 1)) bad.push(`hsn row ${i}: ${r2(sum(w))}px (want 714)`);
      });
      info.hsnRows = body.rows.length;
    }

    return { bad, info };
  });

  await page.screenshot({
    path: path.join(OUT, `${sc.name}-dom.jpg`),
    type: "jpeg",
    quality: 70,
    fullPage: true,
  });

  // ---- 2. Run the real PDF builder, capturing its slice canvases --------
  const pdf = await page.evaluate(async () => {
    const canvases = [];
    const origCreate = document.createElement.bind(document);
    document.createElement = function (tag, ...rest) {
      const node = origCreate(tag, ...rest);
      if (String(tag).toLowerCase() === "canvas") canvases.push(node);
      return node;
    };
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const slices = [];
    HTMLCanvasElement.prototype.toDataURL = function (type, quality) {
      const out = origToDataURL.call(this, type, quality);
      if (type === "image/jpeg") {
        slices.push({ w: this.width, h: this.height, data: out });
      }
      return out;
    };

    try {
      const st = window.__iiStress;
      const doc = await st.build(st.getElement(), st.paper);
      const source = canvases
        .filter((c) => c.width > 0 && c.height > 0)
        .sort((a, b) => b.height - a.height)[0];
      // Keep the raster + slice ends so the harness can zoom into each cut.
      let acc = 0;
      const ends = slices.map((s) => (acc += s.h));
      window.__stressCtx = { source, ends };
      return {
        ok: true,
        pages: doc.getNumberOfPages ? doc.getNumberOfPages() : doc.internal?.numberOfPages,
        slices: slices.map((s) => ({ w: s.w, h: s.h, data: s.data })),
        source: source ? { w: source.width, h: source.height } : null,
        paper: st.paper,
        scenario: st.scenario,
      };
    } catch (err) {
      return { ok: false, error: String(err && err.stack ? err.stack : err) };
    } finally {
      document.createElement = origCreate;
      HTMLCanvasElement.prototype.toDataURL = origToDataURL;
    }
  });

  if (!pdf.ok) {
    results.push({ name: sc.name, fatal: pdf.error });
    console.log(`\n✗ ${sc.name}  BUILD FAILED\n${pdf.error}`);
    continue;
  }

  // ---- 3. Persist the pages so they can be looked at --------------------
  const pageFiles = [];
  pdf.slices.forEach((s, i) => {
    const file = path.join(OUT, `${sc.name}-p${i + 1}.jpg`);
    fs.writeFileSync(file, Buffer.from(s.data.split(",")[1], "base64"));
    pageFiles.push(path.basename(file));
  });

  // ---- 4. Geometry checks ----------------------------------------------
  const paper = PAPER[pdf.paper] || PAPER.A4_PORTRAIT;
  const canvasW = pdf.source?.w || pdf.slices[0]?.w;
  const canvasH = pdf.source?.h ?? pdf.slices.reduce((s, x) => s + x.h, 0);
  const sliceSum = pdf.slices.reduce((s, x) => s + x.h, 0);
  const pxToMm = paper.contentW / canvasW;
  const onePagePx = paper.usableH / pxToMm;
  const scale = captureScale(dom.natW, dom.natH);

  const bounds = [];
  let acc = 0;
  pdf.slices.forEach((s, i) => {
    bounds.push({ page: i + 1, start: acc, end: acc + s.h, h: s.h, mm: s.h * pxToMm });
    acc += s.h;
  });

  // Rows must sit entirely inside ONE page. Slice boundaries are integers in
  // device px while DOM rects are fractional, and a cut within 1.5 device px
  // of a row edge IS that edge — checked against the raster: the rule always
  // ends on one side of the cut and the first row of the next page is white
  // (see scripts/einvoice-band-audit.mjs). Only a cut landing strictly inside
  // a row splits it, and only rows that could actually fit on a page count: a
  // block taller than the sheet is carried over by the slicer and HAS to be
  // split.
  const EPS = 1.5;
  const cuts = bounds.slice(0, -1).map((b) => b.end);
  const splitRows = [];
  let edgeCuts = 0;
  let oversizedRows = 0;
  dom.rowTops.forEach((r) => {
    const top = r.top * scale;
    const bottom = r.bottom * scale;
    if (cuts.some((c) => Math.abs(c - top) <= EPS || Math.abs(c - bottom) <= EPS)) edgeCuts += 1;
    const inside = cuts.filter((c) => c > top + EPS && c < bottom - EPS);
    if (bottom - top > onePagePx) {
      if (inside.length) oversizedRows += 1;
      return;
    }
    if (inside.length) {
      const cut = inside[0];
      splitRows.push({
        id: r.id,
        rowTop: Math.round(top),
        rowBottom: Math.round(bottom),
        cut,
        pxInsideRow: cut - Math.round(top),
        cssInsideRow: +((cut - top) / scale).toFixed(2),
      });
    }
  });

  // Zoom into every page cut straight off the captured raster, so the break
  // can be eyeballed instead of inferred.
  const bands = await page.evaluate(() => {
    const ctx = window.__stressCtx;
    if (!ctx?.source) return [];
    const BAND = 90;
    return ctx.ends.slice(0, -1).map((cut, i) => {
      const y = Math.max(0, cut - BAND);
      const h = Math.min(BAND * 2, ctx.source.height - y);
      const c = document.createElement("canvas");
      c.width = ctx.source.width;
      c.height = h;
      const g = c.getContext("2d");
      g.drawImage(ctx.source, 0, y, c.width, h, 0, 0, c.width, h);
      return { page: i + 2, cut, data: c.toDataURL("image/jpeg", 0.9) };
    });
  });
  const bandFiles = [];
  bands.forEach((b) => {
    const file = `${sc.name}-cut-before-p${b.page}.jpg`;
    fs.writeFileSync(
      path.join(OUT, file),
      Buffer.from(b.data.split(",")[1], "base64")
    );
    bandFiles.push(file);
  });

  const overflowPages = bounds
    .filter((b) => b.mm > paper.usableH + 0.01)
    .map((b) => ({ page: b.page, mm: +b.mm.toFixed(2) }));

  const report = {
    name: sc.name,
    query: sc.query,
    paper: pdf.paper,
    items: dom.rowCount,
    docPx: `${dom.natW}×${dom.natH}`,
    rectW: dom.rectW,
    horizontalOverflowPx: +(dom.rectW - 716).toFixed(2),
    clippedCells: dom.clippedCount,
    clippedSample: dom.clipped,
    elementsPastFrame: dom.overflowingCount,
    elementsPastFrameSample: dom.overflowing,
    canvas: `${canvasW}×${canvasH}`,
    scale,
    pages: pdf.pages,
    slices: pdf.slices.length,
    sliceSum,
    sourceH: canvasH,
    sliceCoverageOk: sliceSum === canvasH,
    onePagePx: Math.round(onePagePx),
    tallestSlicePx: Math.max(...bounds.map((b) => b.h)),
    pagesTallerThanPaper: overflowPages,
    splitRows,
    gridIssues: grid.bad,
    grid: grid.info,
    cutsOnRowEdges: edgeCuts,
    oversizedRowsSplit: oversizedRows,
    pageFiles,
    bandFiles,
  };
  results.push(report);

  const fails = [];
  if (!report.sliceCoverageOk) fails.push(`slice sum ${sliceSum} != canvas ${canvasH}`);
  if (report.horizontalOverflowPx > 0.5) fails.push(`overflow ${report.horizontalOverflowPx}px`);
  if (report.clippedCells) fails.push(`${report.clippedCells} clipped cells`);
  if (report.elementsPastFrame) fails.push(`${report.elementsPastFrame} nodes past frame`);
  if (splitRows.length) fails.push(`${splitRows.length} rows split across pages`);
  if (overflowPages.length) fails.push(`${overflowPages.length} pages taller than paper`);
  if (grid.bad.length) fails.push(`${grid.bad.length} ruled-grid violations`);

  console.log(
    `\n${fails.length ? "✗" : "✓"} ${sc.name}  items=${dom.rowCount} doc=${dom.natW}×${dom.natH} ` +
      `pages=${pdf.pages} slices=${pdf.slices.length} coverage=${report.sliceCoverageOk} ` +
      `tallest=${report.tallestSlicePx}px (page=${Math.round(onePagePx)}px)` +
      `${grid.info.metaRows ? ` meta=${grid.info.metaRows}r/${grid.info.metaSoloRows}solo/${grid.info.metaEmptyCells}empty` : ""}` +
      `${grid.info.hsnRows !== undefined ? ` hsn=${grid.info.hsnRows}r` : ""}`
  );
  report.fails = fails;
  if (fails.length) console.log("   FAIL: " + fails.join(" | "));
  if (grid.bad.length)
    console.log("   grid: " + grid.bad.slice(0, 10).join(" | ") + (grid.bad.length > 10 ? ` …(+${grid.bad.length - 10})` : ""));
  if (report.clippedSample.length) console.log("   clipped: " + JSON.stringify(report.clippedSample));
  if (report.elementsPastFrameSample.length)
    console.log("   past-frame: " + JSON.stringify(report.elementsPastFrameSample));
  if (splitRows.length)
    console.log(
      "   split rows: " +
        JSON.stringify(
          splitRows.map((r) => `${r.id} cut=${r.cut} top=${r.rowTop} Δ=${r.pxInsideRow}px/${r.cssInsideRow}css`)
        )
    );
  if (overflowPages.length) console.log("   over-tall pages: " + JSON.stringify(overflowPages));

  fs.writeFileSync(path.join(OUT, `${sc.name}.json`), JSON.stringify(report, null, 2));
}

const failed = results.filter((r) => r.fatal || (r.fails && r.fails.length));
console.log(
  `\n${results.length - failed.length}/${results.length} scenarios clean` +
    (failed.length ? ` — FAILING: ${failed.map((r) => r.name).join(", ")}` : "")
);
console.log(`Artifacts → ${OUT}`);
await browser.close();
