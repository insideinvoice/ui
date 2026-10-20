// zoomGesture.test.mjs — automated gesture verification for DocZoomSurface.
//
// Usage: node scripts/zoomGesture.test.mjs
//
// Spawns a throwaway Vite dev server (or reuses $ZOOMLAB_URL), opens the
// dev-only /__zoomlab bench, and runs the FULL gesture suite 10 times on a
// mobile touch viewport (CDP multi-touch pinch/drag/double-tap) and 10 times
// on a desktop viewport (wheel / ctrl+wheel / mouse drag / double-click).
//
// Every scenario asserts, after every gesture:
//   - scale stays inside [0.35, 5]
//   - translate stays inside the surface-relative pan bounds (panZoom.js math)
//   - everything finite (no NaN), touch-action stays "none"
//   - ZERO buttons inside the surface (enterprise zoom = no on-screen controls)
//
// Exits non-zero if any check in any of the 20 fresh-page runs fails.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.ZOOMLAB_PORT || 5199);
const BASE_URL = process.env.ZOOMLAB_URL || `http://localhost:${PORT}`;
const LAB_URL = `${BASE_URL}/__zoomlab`;
const ITERATIONS = 10;
const PAPER_W = 794;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
let checksRun = 0;

function check(mode, iter, name, cond, detail = "") {
  checksRun += 1;
  if (!cond) {
    failures.push({ mode, iter, name, detail });
    console.log(`  ✗ [${mode} #${iter}] ${name} ${detail}`);
  }
}

// Seeded LCG so a failing stress run is reproducible from its iteration number.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

async function readState(page) {
  return page.evaluate(() => {
    const paper = document.querySelector('[data-testid="doc-zoom-paper"]');
    const surf = document.querySelector('[data-testid="doc-zoom-surface"]');
    if (!paper || !surf) return null;
    const t = getComputedStyle(paper).transform;
    let s = 1, x = 0, y = 0;
    if (t && t !== "none") {
      const m = new DOMMatrixReadOnly(t);
      s = m.a; x = m.e; y = m.f;
    }
    return {
      s, x, y,
      surfW: surf.clientWidth,
      surfH: surf.clientHeight,
      paperW: paper.offsetWidth,
      paperH: paper.offsetHeight,
      touchAction: getComputedStyle(surf).touchAction,
      buttons: surf.querySelectorAll("button").length,
      hint: !!surf.querySelector("[aria-hidden] span"),
    };
  });
}

// The exact panBounds/clampPan contract from src/utils/panZoom.js.
function inBounds(v, tol = 2) {
  const w = v.paperW * v.s;
  const h = v.paperH * v.s;
  const freeX = w > v.surfW + 1e-6;
  const freeY = h > v.surfH + 1e-6;
  const xMin = freeX ? v.surfW - w : (v.surfW - w) / 2;
  const xMax = freeX ? 0 : (v.surfW - w) / 2;
  const yMin = freeY ? v.surfH - h : 0;
  const yMax = 0;
  return (
    v.x >= xMin - tol && v.x <= xMax + tol &&
    v.y >= yMin - tol && v.y <= yMax + tol
  );
}

const scaleOk = (v) => v.s >= MIN_ZOOM - 0.01 && v.s <= MAX_ZOOM + 0.01;
const finite = (v) => [v.s, v.x, v.y].every(Number.isFinite);
const expectFit = (v) => Math.min(1, Math.max(0.2, v.surfW / PAPER_W));

function assertHealthy(page, mode, iter, label) {
  return readState(page).then((v) => {
    check(mode, iter, `${label}: scale in band`, scaleOk(v), `s=${v.s}`);
    check(mode, iter, `${label}: pan in bounds`, inBounds(v), `x=${v.x} y=${v.y} s=${v.s} surf=${v.surfW}x${v.surfH} paper=${v.paperW}x${v.paperH}`);
    check(mode, iter, `${label}: finite`, finite(v), `s=${v.s} x=${v.x} y=${v.y}`);
    return v;
  });
}

// ---------------------------------------------------------------- CDP touch
async function touchStart(cdp, points) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points.map((p, i) => ({ id: i + 1, x: p.x, y: p.y, force: 1, radiusX: 14, radiusY: 14 })),
  });
}
async function touchMove(cdp, points) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points.map((p, i) => ({ id: i + 1, x: p.x, y: p.y, force: 1, radiusX: 14, radiusY: 14 })),
  });
}
async function touchEnd(cdp) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function tap(cdp, x, y) {
  await touchStart(cdp, [{ x, y }]);
  await sleep(35);
  await touchEnd(cdp);
  await sleep(90);
}

async function doubleTap(cdp, x, y) {
  await tap(cdp, x, y);
  await tap(cdp, x, y);
  await sleep(300);
}

async function pinch(cdp, cx, cy, fromHalf, toHalf, steps = 12) {
  await touchStart(cdp, [{ x: cx - fromHalf, y: cy }, { x: cx + fromHalf, y: cy }]);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const half = fromHalf + (toHalf - fromHalf) * t;
    await touchMove(cdp, [{ x: cx - half, y: cy }, { x: cx + half, y: cy }]);
    await sleep(16);
  }
  await touchEnd(cdp);
  await sleep(300); // settle rAF + any flick inertia
}

async function drag(cdp, x, y, dx, dy, steps = 10) {
  await touchStart(cdp, [{ x, y }]);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touchMove(cdp, [{ x: x + dx * t, y: y + dy * t }]);
    await sleep(16);
  }
  await touchEnd(cdp);
  await sleep(450); // settle flick inertia
}

// Linearity guard: two incremental 30px moves must move the sheet ~60px —
// exactly one screen pixel per finger pixel. Measuring each move from the
// pointerdown anchor (instead of the previous point) re-applies the whole
// cumulative displacement every frame, i.e. quadratic acceleration that flings
// the sheet away from the finger. Read mid-gesture, BEFORE release, so flick
// inertia cannot blur the measurement.
async function assertLinearPan(page, cdp, mode, iter, v0) {
  const cx = v0.surfW / 2;
  const cy = v0.surfH / 2;
  await touchStart(cdp, [{ x: cx, y: cy }]);
  await sleep(30);
  await touchMove(cdp, [{ x: cx + 30, y: cy + 30 }]);
  await sleep(30);
  await touchMove(cdp, [{ x: cx + 60, y: cy + 60 }]);
  await sleep(30);
  const vm = await readState(page);
  await touchEnd(cdp);
  await sleep(450);
  const dx = Math.abs(vm.x - v0.x);
  const dy = Math.abs(vm.y - v0.y);
  check(
    mode, iter,
    "pan tracks the finger 1:1 (no acceleration)",
    dx > 45 && dx < 80 && dy > 45 && dy < 80,
    `dx=${dx.toFixed(1)} dy=${dy.toFixed(1)} (want ~60)`,
  );
}

// Two opposite drags: one of them must always move the sheet a substantial
// distance, regardless of which bound the view was parked against.
async function panBothAxes(page, cdp, mode, iter, v0) {
  const cx = v0.surfW / 2;
  const cy = v0.surfH / 2;
  await drag(cdp, cx, cy, 140, 130);
  const v1 = await readState(page);
  await drag(cdp, Math.min(v0.surfW - 20, cx + 140), Math.min(v0.surfH - 20, cy + 130), -280, -260);
  const v2 = await readState(page);
  const xMoved = Math.abs(v1.x - v0.x) > 40 || Math.abs(v2.x - v1.x) > 40;
  const yMoved = Math.abs(v1.y - v0.y) > 40 || Math.abs(v2.y - v1.y) > 40;
  check(mode, iter, "drag pans horizontally", xMoved, `x ${v0.x} → ${v1.x} → ${v2.x}`);
  check(mode, iter, "drag pans vertically", yMoved, `y ${v0.y} → ${v1.y} → ${v2.y}`);
  check(mode, iter, "pan stays clamped", inBounds(v2), `x=${v2.x} y=${v2.y}`);
  return v2;
}

async function openLab(browser) {
  const page = await browser.newPage();
  await page.goto(LAB_URL, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector('[data-testid="doc-zoom-surface"]', { timeout: 30000 });
  await sleep(500); // fit measurement + first paint
  return page;
}

// -------------------------------------------------------------- MOBILE SUITE
async function mobileSuite(browser, iter) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(LAB_URL, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector('[data-testid="doc-zoom-surface"]', { timeout: 30000 });
  await sleep(500);
  const cdp = await page.createCDPSession();

  // 1. Baseline: fit-to-width, top-flush, no controls, touch-action none.
  let v = await readState(page);
  check("mobile", iter, "surface found", !!v);
  const fit = expectFit(v);
  check("mobile", iter, "initial fit ≈ width/794", Math.abs(v.s - fit) < 0.03, `s=${v.s} fit=${fit}`);
  check("mobile", iter, "initial view in bounds", inBounds(v), `x=${v.x} y=${v.y}`);
  check("mobile", iter, "NO zoom buttons in surface", v.buttons === 0, `buttons=${v.buttons}`);
  check("mobile", iter, "touch-action none", v.touchAction === "none", v.touchAction);
  check("mobile", iter, "gesture hint present", v.hint);

  const cx = v.surfW / 2;
  const cy = v.surfH / 2;

  // 2. Pinch OUT (fingers spread) zooms about the midpoint.
  await pinch(cdp, cx, cy, 30, 150);
  const vZoom = await assertHealthy(page, "mobile", iter, "after pinch-out");
  check("mobile", iter, "pinch-out zooms IN", vZoom.s > fit * 1.5, `s=${vZoom.s} fit=${fit}`);

  // 2b. One-finger pan is LINEAR — 1:1 with the finger (zoomed in, so both
  //     axes overflow and nothing is pinned by the clamp).
  await assertLinearPan(page, cdp, "mobile", iter, vZoom);

  // 3. Pinch IN (fingers together) zooms back out.
  await pinch(cdp, cx, cy, 150, 40);
  const vBack = await assertHealthy(page, "mobile", iter, "after pinch-in");
  check("mobile", iter, "pinch-in zooms OUT", vBack.s < vZoom.s * 0.75, `s=${vBack.s} was=${vZoom.s}`);

  // 4. Free left/right + up/down panning with clamping (two opposite drags).
  await panBothAxes(page, cdp, "mobile", iter, vBack);

  // 5. Keyboard fit shortcut puts the sheet back at fit (Ctrl+0).
  await page.keyboard.down("Control");
  await page.keyboard.press("0");
  await page.keyboard.up("Control");
  await sleep(250);
  v = await readState(page);
  check("mobile", iter, "ctrl+0 returns to fit", Math.abs(v.s - fit) < 0.05, `s=${v.s} fit=${fit}`);
  check("mobile", iter, "fit view in bounds", inBounds(v));

  // 6. Double-tap toggles fit ↔ 100% (both directions).
  await doubleTap(cdp, cx, cy);
  v = await assertHealthy(page, "mobile", iter, "after 1st double-tap");
  check("mobile", iter, "double-tap → 100%", Math.abs(v.s - 1) < 0.05, `s=${v.s}`);
  await doubleTap(cdp, cx, cy);
  v = await assertHealthy(page, "mobile", iter, "after 2nd double-tap");
  check("mobile", iter, "double-tap → back to fit", Math.abs(v.s - fit) < 0.05, `s=${v.s} fit=${fit}`);

  // 7. Stress: 12 seeded-random pinch/drag ops — never NaN, never unclamped.
  const rng = makeRng(1000 + iter);
  for (let k = 0; k < 12; k++) {
    const op = Math.floor(rng() * 3);
    const gx = 60 + rng() * (v.surfW - 120);
    const gy = 60 + rng() * (v.surfH - 120);
    if (op === 0) {
      await pinch(cdp, cx, cy, 30 + rng() * 70, 45 + rng() * 150, 8);
    } else if (op === 1) {
      const dx = (rng() - 0.5) * 440;
      const dy = (rng() - 0.5) * 440;
      await drag(cdp, gx, gy, dx, dy, 6);
    } else {
      await pinch(cdp, gx, gy, 40 + rng() * 60, 25 + rng() * 60, 8);
    }
    await assertHealthy(page, "mobile", iter, `stress op ${k + 1}`);
  }

  // 8. Still no controls after everything.
  v = await readState(page);
  check("mobile", iter, "still NO buttons", v.buttons === 0, `buttons=${v.buttons}`);
  check("mobile", iter, "still touch-action none", v.touchAction === "none", v.touchAction);

  await page.close();
}

// ------------------------------------------------------------- DESKTOP SUITE
async function desktopSuite(browser, iter) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(LAB_URL, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector('[data-testid="doc-zoom-surface"]', { timeout: 30000 });
  await sleep(500);
  const cdp = await page.createCDPSession();

  let v = await readState(page);
  check("desktop", iter, "surface found", !!v);
  const fit = expectFit(v); // wide surface → fit capped at 100%
  check("desktop", iter, "initial fit ≈ 100%", Math.abs(v.s - fit) < 0.03, `s=${v.s} fit=${fit}`);
  check("desktop", iter, "initial view in bounds", inBounds(v), `x=${v.x} y=${v.y}`);
  check("desktop", iter, "NO zoom buttons in surface", v.buttons === 0, `buttons=${v.buttons}`);

  const cx = Math.round(v.surfW / 2);
  const cy = Math.round(v.surfH / 2);
  await page.mouse.move(cx, cy);

  // 1. Plain wheel pans the sheet (page scroll is prevented by the engine).
  const y0 = v.y;
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: cx, y: cy, deltaX: 0, deltaY: 400 });
  await sleep(300);
  v = await assertHealthy(page, "desktop", iter, "after wheel-pan");
  check("desktop", iter, "wheel pans vertically", Math.abs(v.y - y0) > 200, `y ${y0} → ${v.y}`);

  // 2. Ctrl + wheel zooms in at the cursor (Mac trackpad pinch emits this).
  const s0 = v.s;
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: cx, y: cy, deltaX: 0, deltaY: -560, modifiers: 2 });
  await sleep(300);
  v = await assertHealthy(page, "desktop", iter, "after ctrl+wheel zoom-in");
  check("desktop", iter, "ctrl+wheel zooms IN", v.s > s0 * 2, `s=${v.s} was=${s0}`);

  // 3. Mouse drag pans both axes with clamping.
  v = await panBothAxes(page, cdp, "desktop", iter, v);

  // 4. Ctrl + wheel zooms back out.
  const s1 = v.s;
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: cx, y: cy, deltaX: 0, deltaY: 900, modifiers: 2 });
  await sleep(300);
  v = await assertHealthy(page, "desktop", iter, "after ctrl+wheel zoom-out");
  check("desktop", iter, "ctrl+wheel zooms OUT", v.s < s1 * 0.7, `s=${v.s} was=${s1}`);

  // 5. Double-click toggles: below fit → 100% (drive scale under 0.97 first).
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: cx, y: cy, deltaX: 0, deltaY: 3000, modifiers: 2 });
  await sleep(300);
  v = await readState(page);
  check("desktop", iter, "ctrl+wheel clamps at MIN_ZOOM", Math.abs(v.s - MIN_ZOOM) < 0.02, `s=${v.s}`);
  // Two raw CDP clicks (clickCount 1 then 2) — Blink synthesizes `dblclick`
  // deterministically on the clickCount=2 release (page.mouse.click's
  // clickCount option is not reliably forwarded across puppeteer versions).
  for (const clickCount of [1, 2]) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", buttons: 1, clickCount });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", buttons: 0, clickCount });
    await sleep(60);
  }
  await sleep(350);
  v = await assertHealthy(page, "desktop", iter, "after double-click");
  check("desktop", iter, "double-click → 100%", Math.abs(v.s - 1) < 0.05, `s=${v.s}`);

  // 6. Stress: 12 seeded-random wheel/drag ops.
  const rng = makeRng(5000 + iter);
  for (let k = 0; k < 12; k++) {
    const op = Math.floor(rng() * 3);
    const gx = Math.round(60 + rng() * (v.surfW - 120));
    const gy = Math.round(60 + rng() * (v.surfH - 120));
    if (op === 0) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: gx, y: gy, deltaX: 0, deltaY: (rng() - 0.5) * 700, modifiers: 2 });
      await sleep(220);
    } else if (op === 1) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: gx, y: gy, deltaX: (rng() - 0.5) * 300, deltaY: (rng() - 0.5) * 300 });
      await sleep(220);
    } else {
      await page.mouse.move(gx, gy);
      await page.mouse.down();
      for (let m = 0; m < 6; m++) {
        await page.mouse.move(gx + (rng() - 0.5) * 400, gy + (rng() - 0.5) * 400);
        await sleep(16);
      }
      await page.mouse.up();
      await sleep(450);
    }
    await assertHealthy(page, "desktop", iter, `stress op ${k + 1}`);
  }

  v = await readState(page);
  check("desktop", iter, "still NO buttons", v.buttons === 0, `buttons=${v.buttons}`);

  await page.close();
}

// ------------------------------------------------------------------- statics
function staticChecks() {
  const share = readFileSync(path.join(ROOT, "src/pages/PublicInvoicePage.jsx"), "utf8");
  check("static", 0, "share page: zoom pill removed", !/aria-label="Zoom in"/.test(share) && !/aria-label="Zoom out"/.test(share));
  const view = readFileSync(path.join(ROOT, "src/pages/InvoiceView.jsx"), "utf8");
  check("static", 0, "invoice view: modal uses DocZoomSurface", /showPdfPreview &&\s*\(/.test(view) && view.includes("<DocZoomSurface"));
  check("static", 0, "invoice view: no embedded PDF viewer", !view.includes('type="application/pdf"'));
}

// --------------------------------------------------------------------- server
async function ensureServer() {
  if (process.env.ZOOMLAB_URL) return null;
  try {
    const r = await fetch(LAB_URL);
    if (r.ok) return null; // already running
  } catch { /* not up */ }
  const viteBin = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteBin, "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  const deadline = Date.now() + 90000;
  for (;;) {
    if (Date.now() > deadline) {
      child.kill("SIGTERM");
      throw new Error(`Vite dev server did not come up on :${PORT}`);
    }
    try {
      const r = await fetch(LAB_URL);
      if (r.ok) break;
    } catch { /* keep waiting */ }
    await sleep(400);
  }
  return child;
}

// ----------------------------------------------------------------------- main
async function main() {
  staticChecks();
  const server = await ensureServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    for (let i = 1; i <= ITERATIONS; i++) {
      process.stdout.write(`run ${i}/${ITERATIONS}: mobile touch … `);
      const before = failures.length;
      await mobileSuite(browser, i);
      process.stdout.write(failures.length === before ? "ok\n" : "FAIL\n");
      process.stdout.write(`run ${i}/${ITERATIONS}: desktop mouse … `);
      const beforeD = failures.length;
      await desktopSuite(browser, i);
      process.stdout.write(failures.length === beforeD ? "ok\n" : "FAIL\n");
    }
  } finally {
    await browser.close();
    server?.kill("SIGTERM");
  }

  console.log("\n──────────────────────────────────────────────");
  console.log(`checks run : ${checksRun}`);
  console.log(`iterations : ${ITERATIONS} mobile + ${ITERATIONS} desktop (fresh page each)`);
  console.log(`failures   : ${failures.length}`);
  if (failures.length) {
    console.log("\nFailure detail:");
    for (const f of failures) console.log(`  - [${f.mode} #${f.iter}] ${f.name} ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log("ALL GESTURE TESTS PASSED ✓");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
