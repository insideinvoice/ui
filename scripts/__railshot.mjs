// TEMPORARY — ChatGPT-grade sidebar animation harness. Per-frame assertions:
//   - content EDGE (compositor slide) tracks the panel width every frame
//   - zero vertical motion (header height / logo Y / nav-item Y constant)
//   - monotonic motion, no horizontal overflow ever, strip lifecycle correct
// Delete after use.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5198;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vite = spawn(process.execPath, [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"), "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: "ignore" });

for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`${BASE}/__raillab`); if (r.ok) break; } catch { /* not up */ }
  await sleep(500);
}

const results = [];
const check = (name, ok, detail = "") =>
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/__raillab`, { waitUntil: "networkidle0" });
  await page.waitForSelector("aside.app-side-nav", { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(200);

  const readState = () =>
    page.evaluate(() => {
      const aside = document.querySelector("aside.app-side-nav");
      const shell = document.querySelector(".app-shell");
      const head = document.querySelector(".rail-head");
      const logoImg = document.querySelector(".rail-logo img");
      const item = document.querySelector(".rail-item");
      const icon = item && item.querySelector("svg");
      return {
        w: Math.round(aside.getBoundingClientRect().width),
        edge: Math.round(shell.getBoundingClientRect().left),
        headH: Math.round(head.getBoundingClientRect().height),
        logoY: logoImg ? Math.round(logoImg.getBoundingClientRect().top) : null,
        itemY: icon ? Math.round(icon.getBoundingClientRect().top) : null,
        overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
        strip: !!document.querySelector(".rail-slide-strip"),
        transform: getComputedStyle(shell).transform,
      };
    });

  const runToggle = (clickSel) =>
    page.evaluate(async (sel) => {
      const aside = document.querySelector("aside.app-side-nav");
      const shell = document.querySelector(".app-shell");
      const head = document.querySelector(".rail-head");
      document.querySelector(sel).click();
      const rec = [];
      const t0 = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          const logoImg = document.querySelector(".rail-logo img");
          const item = document.querySelector(".rail-item");
          const icon = item && item.querySelector("svg");
          const label = document.querySelector(".rail-item .rail-hide");
          rec.push({
            t: Math.round(performance.now() - t0),
            w: Math.round(aside.getBoundingClientRect().width),
            edge: Math.round(shell.getBoundingClientRect().left),
            headH: Math.round(head.getBoundingClientRect().height),
            logoY: logoImg ? Math.round(logoImg.getBoundingClientRect().top) : null,
            itemY: icon ? Math.round(icon.getBoundingClientRect().top) : null,
            lo: label ? +Number(getComputedStyle(label).opacity).toFixed(2) : null,
            disp: label ? getComputedStyle(label).display : null,
            overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
            strip: !!document.querySelector(".rail-slide-strip"),
          });
          if (performance.now() - t0 < 420) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return rec;
    }, clickSel);

  const c = await readState();
  const base = { headH: c.headH, logoY: c.logoY, itemY: c.itemY };
  check("collapsed: panel 64px, content edge at 64", c.w === 64 && c.edge === 64, `w=${c.w} edge=${c.edge}`);
  check("collapsed: no transform at rest", c.transform === "none", c.transform);
  check("collapsed: no strip at rest", !c.strip);
  await page.screenshot({ path: "/tmp/__rail-collapsed.png" });

  // ---- expand ----
  await page.hover(".rail-logo-wrap");
  await sleep(200);
  const openP = runToggle(".rail-logo-toggle");
  await sleep(110);
  await page.screenshot({ path: "/tmp/__rail-midopen.png" });
  const open = await openP;
  const midOpen = open.filter((s) => s.w > 66 && s.w < 238);
  check("open: captured mid-flight", midOpen.length > 3, `frames=${midOpen.length}`);
  check(
    "open: content edge tracks panel every frame (|edge−w| ≤ 2)",
    open.every((s) => Math.abs(s.edge - s.w) <= 2),
    `maxDiff=${Math.max(...open.map((s) => Math.abs(s.edge - s.w)))}`,
  );
  check(
    "open: monotonic rightward motion",
    open.every((s, i) => i === 0 || s.edge >= open[i - 1].edge - 1),
  );
  check("open: zero vertical motion (head/logoY/itemY)",
    open.every((s) => s.headH === base.headH && s.logoY === base.logoY && s.itemY === base.itemY));
  check("open: strip present while sliding", open.some((s) => s.strip));
  await sleep(350);
  const e = await readState();
  check("expanded: panel 240px, content edge at 240", e.w === 240 && e.edge === 240, `w=${e.w} edge=${e.edge}`);
  check("expanded: transform cleared at rest", e.transform === "none", e.transform);
  check("expanded: strip removed at rest", !e.strip);
  check("expanded: header/logo/nav Y unchanged", e.headH === base.headH && e.logoY === base.logoY && e.itemY === base.itemY);
  await page.screenshot({ path: "/tmp/__rail-expanded.png" });

  // ---- collapse ----
  const closeP = runToggle(".rail-expanded-toggle");
  await sleep(110);
  await page.screenshot({ path: "/tmp/__rail-midclose.png" });
  const close = await closeP;
  const midClose = close.filter((s) => s.w > 66 && s.w < 238);
  check("close: captured mid-flight", midClose.length > 3, `frames=${midClose.length}`);
  check(
    "close: content edge tracks panel every frame (|edge−w| ≤ 2)",
    close.every((s) => Math.abs(s.edge - s.w) <= 2),
    `maxDiff=${Math.max(...close.map((s) => Math.abs(s.edge - s.w)))}`,
  );
  check(
    "close: monotonic leftward motion",
    close.every((s, i) => i === 0 || s.edge <= close[i - 1].edge + 1),
  );
  const fading = midClose.filter((s) => s.lo > 0.02 && s.lo < 0.98);
  check(
    "close: labels FADE gradually, never display:none",
    midClose.length > 0 &&
      midClose.every((s) => s.disp !== "none") &&
      fading.length >= 3,
    `opacities=${midClose.slice(0, 8).map((s) => s.lo).join(",")}`,
  );
  check("close: zero vertical motion",
    close.every((s) => s.headH === base.headH && s.itemY === base.itemY));
  await sleep(350);
  await page.mouse.move(700, 400);
  await sleep(100);
  const f = await readState();
  check("final: back to collapsed 64/64", f.w === 64 && f.edge === 64, `w=${f.w} edge=${f.edge}`);
  check("final: transform cleared", f.transform === "none", f.transform);
  // The close glide extends the shell past the viewport's right edge — it is
  // clipped (html overflow-x: clip), so the user must not be able to pan.
  const panX = await page.evaluate(() => {
    window.scrollTo(300, 0);
    const x = window.scrollX;
    window.scrollTo(0, 0);
    return x;
  });
  check("no horizontal panning possible at rest", panX === 0, `scrollX=${panX}`);

  console.log("\n--- key frames (open) ---");
  console.log(open.filter((_, i) => i % 10 === 0).map((s) => `t=${s.t} panel=${s.w} edge=${s.edge} head=${s.headH} itemY=${s.itemY} strip=${s.strip} ovf=${s.overflowX}`).join("\n"));
  console.log("--- key frames (close) ---");
  console.log(close.filter((_, i) => i % 10 === 0).map((s) => `t=${s.t} panel=${s.w} edge=${s.edge} head=${s.headH} itemY=${s.itemY} ovf=${s.overflowX}`).join("\n"));
  console.log("\n--- results ---");
  console.log(results.join("\n"));
  const fails = results.filter((r) => r.startsWith("FAIL"));
  console.log(`\n${results.length - fails.length}/${results.length} passed`);
  process.exitCode = fails.length ? 1 : 0;
} finally {
  await browser.close();
  vite.kill();
}
