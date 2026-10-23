// linkUnderline.test.mjs — automated verification of the .link-underline
// hover animation used by the invoices-list reference number.
//
// Usage: node scripts/linkUnderline.test.mjs
//
// Extracts the REAL .link-underline rules from src/index.css (so a stylesheet
// edit is what gets tested, not a copy), renders a sample button in headless
// Chrome, hovers it, and samples the ::after pseudo-element's transform every
// animation frame. Asserts:
//   - the pseudo-box is left:0 / width:100% (spans the button exactly)
//   - transform-origin is the LEFT edge
//   - scaleX grows monotonically 0 → 1 (left-to-right, never pops/jumps)
//   - the rise completes within the declared 700ms ± tolerance
//   - un-hovering retracts it back toward 0
//
// The whole hover capture runs TWICE — once under
// prefers-reduced-motion: no-preference and once under `reduce` — and each
// pass asserts the transition is STILL 0.7s. Regression guard: a
// `transition: none` override under the reduce query once killed the draw
// entirely for a user with macOS "Reduce motion" enabled, so every timing
// change shipped looked like the same instant pop ("not starting from left,
// not ending at right"). The animation must play in BOTH motion modes.
//
// Exits non-zero if any check fails.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
let checksRun = 0;

function check(name, cond, detail = "") {
  checksRun += 1;
  if (!cond) {
    failures.push({ name, detail });
    console.log(`  ✗ ${name} ${detail}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}

// Pull every contiguous .link-underline-related rule block out of the real
// stylesheet via balanced-brace scanning: base, ::after, hover/focus, and any
// media-query block that mentions the class (so a re-added reduce-motion
// override is included — and caught — rather than silently skipped).
function extractRules(css) {
  const start = css.indexOf(".link-underline {");
  if (start === -1) return null;
  let cursor = start;
  let lastGoodEnd = -1;
  while (cursor < css.length) {
    const open = css.indexOf("{", cursor);
    if (open === -1) break;
    let depth = 0;
    let close = -1;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) { close = i; break; }
      }
    }
    if (close === -1) break;
    const block = css.slice(cursor, close + 1);
    if (!block.includes(".link-underline")) break; // next unrelated rule
    lastGoodEnd = close + 1;
    cursor = close + 1;
  }
  return lastGoodEnd === -1 ? null : css.slice(start, lastGoodEnd);
}

const scaleXOf = (m) => {
  if (!m || m === "none") return null;
  const nums = m.match(/-?[\d.]+/g);
  return nums ? parseFloat(nums[0]) : null; // matrix(a,b,c,d,e,f) → a = scaleX
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Frame-by-frame capture of one hover-in draw (mouse starts OFF the button).
async function captureDraw(page) {
  await page.mouse.move(0, 0);
  await sleep(400);
  await page.evaluate(() => {
    window.__samples = [];
    const el = document.getElementById("t");
    const t0 = performance.now();
    const loop = () => {
      const m = getComputedStyle(el, "::after").transform;
      window.__samples.push({ t: performance.now() - t0, sx: m === "none" ? 1 : parseFloat(m.match(/-?[\d.]+/g)[0]) });
      if (performance.now() - t0 < 1500) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.hover("#t");
  await sleep(1600);
  return (await page.evaluate(() => window.__samples))
    .filter((s, i, a) => i === 0 || Math.abs(s.sx - a[i - 1].sx) > 0.0005 || i === a.length - 1);
}

function verifyDraw(samples, label) {
  const p = (n) => `[${label}] ${n}`;
  const start = samples.find((s) => s.sx > 0.01);
  // FIRST sample at/near full width — not the last (it stays at 1 forever).
  const end = samples.find((s) => s.sx > 0.98);
  const trace = samples.filter((_, i) => i % Math.ceil(samples.length / 8) === 0)
    .map((s) => `${s.t.toFixed(0)}ms:${s.sx.toFixed(2)}`).join("  ");
  console.log(`  [${label}] hover-in trace (time:scaleX): ${trace}\n`);

  check(p("animation actually ran (scaleX reached 1)"), !!end, "never reached 1");
  check(p("starts at scaleX 0 (line hidden before hover)"), start && start.sx < 0.05, start ? String(start.sx) : "no start");
  if (start && end) {
    const riseMs = end.t - start.t;
    check(p("left-to-right: scaleX is monotonically non-decreasing"),
      samples.every((s, i) => i === 0 || s.sx >= samples[i - 1].sx - 0.001));
    check(p("rise completes in 700ms ±40%"),
      riseMs >= 420 && riseMs <= 980, `${riseMs.toFixed(0)}ms`);
    // With origin=left, scaleX=1 ⇒ underline right edge == button right edge.
    check(p("ends exactly at the right edge at rest (scaleX = 1)"), end.sx >= 0.99, String(end.sx));
    // Sample nearest the half-way POINT OF THE RISE (not of the capture window).
    const midT = start.t + riseMs * 0.5;
    const mid = samples.reduce((best, s) => Math.abs(s.t - midT) < Math.abs(best.t - midT) ? s : best, samples[0]);
    // Constant-speed (linear) ⇒ at half the rise duration scaleX ≈ 0.5.
    check(p("grows at constant speed through mid-animation (no instant pop)"),
      mid && mid.sx > 0.35 && mid.sx < 0.65, mid ? `${mid.t.toFixed(0)}ms:${mid.sx.toFixed(2)}` : "n/a");
  }
}

async function main() {
  const css = readFileSync(path.join(ROOT, "src", "index.css"), "utf8");
  const rules = extractRules(css);
  if (!rules) {
    check("extract .link-underline rules from src/index.css", false, "not found");
    throw new Error("rules not found");
  }
  console.log(`Extracted ${rules.split("\n").length} lines of real stylesheet rules.\n`);

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await page.setContent(`<!doctype html><html><head><style>
      body { margin: 0; padding: 40px; font-family: sans-serif; background: #fff; }
      ${rules}
      #t { font-size: 14px; font-weight: 600; color: #4f46e5; background: none;
           border: 0; padding: 0; cursor: pointer; display: inline-block; }
    </style></head><body><button id="t" class="link-underline">INV-2026-034</button></body></html>`);

    // ---- Static geometry of the ::after box -------------------------------
    const geo = await page.evaluate(() => {
      const el = document.getElementById("t");
      const s = getComputedStyle(el, "::after");
      return {
        position: s.position,
        left: s.left,
        width: s.width,
        origin: s.transformOrigin,
        duration: s.transitionDuration,
        timing: s.transitionTimingFunction,
        prop: s.transitionProperty,
        btnW: el.getBoundingClientRect().width,
      };
    });
    console.log("::after geometry:", geo, "\n");

    check("::after is absolutely positioned", geo.position === "absolute", geo.position);
    check("::after sits at left edge (left: 0)", geo.left === "0px", geo.left);
    check("::after width spans the full button",
      Math.abs(parseFloat(geo.width) - geo.btnW) <= 1,
      `${geo.width} vs button ${geo.btnW}px`);
    // Computed transform-origin resolves to pixels: "0px <y>" = horizontal
    // origin AT the left edge (y is the 1.5px line's vertical centre).
    const originX = parseFloat(geo.origin);
    check("transform-origin is the LEFT edge (x = 0px)", Number.isFinite(originX) && originX <= 0.5, geo.origin);
    check("transition declared 700ms linear on transform",
      geo.duration.includes("0.7") && geo.timing === "linear" && geo.prop.includes("transform"),
      `${geo.prop} ${geo.duration} ${geo.timing}`);

    // ---- Hover draw under BOTH motion settings ---------------------------
    for (const mode of ["no-preference", "reduce"]) {
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: mode }]);
      await sleep(200); // let styles recompute under the new media query

      // The regression this loop exists for: the transition must STILL be
      // live under `reduce` — an override with `transition: none` made the
      // line pop in instantly and killed the draw for good.
      const dur = await page.evaluate(() => getComputedStyle(document.getElementById("t"), "::after").transitionDuration);
      check(`[${mode}] transition is still 0.7s (not killed by the media query)`,
        dur.includes("0.7"), dur);

      const samples = await captureDraw(page);
      verifyDraw(samples, mode);

      // ---- Retract on un-hover -------------------------------------------
      await page.mouse.move(0, 0);
      await sleep(900);
      const after = scaleXOf(await page.evaluate(() => getComputedStyle(document.getElementById("t"), "::after").transform));
      check(`[${mode}] retracts toward 0 after mouse leaves`, after !== null && after < 0.05, String(after));
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${checksRun} checks, ${failures.length} failure${failures.length === 1 ? "" : "s"}`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
