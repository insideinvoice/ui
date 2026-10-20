// Unit tests for the share-viewer pan/zoom engine math (src/utils/panZoom.js).
// The engine writes one transform per frame: translate(x, y) scale(s). These
// tests pin down the contract the gestures depend on:
//
//   - panBounds: a document that fits the surface is PINNED (centred
//     horizontally, flush under the bar vertically); a document larger than
//     the surface is FREEHAND — the pan range must span the entire overflow on
//     BOTH axes (0 ↔ surface - scaled), left edge reachable and right edge
//     reachable.
//   - zoomAt / anchorZoom: the document point under the focal screen point
//     stays nailed to it (zoom feels anchored, no drift).
//   - clamped pan can never fling the document clear of the surface.
//   - decayVelocity: flick inertia decays monotonically and bottoms out.

import assert from "node:assert/strict";
import {
  panBounds,
  clampPan,
  anchorZoom,
  clampScale,
  decayVelocity,
  VELOCITY_EPS,
} from "../src/utils/panZoom.js";

let checks = 0;
const ok = (name, fn) => {
  fn();
  checks += 1;
};

// Reference phone-sized surface under a 66px top bar, showing a 794px-wide A4
// document that is currently 3123px tall (≈3 pages) at scale 1.
const SURF_W = 390;
const SURF_H = 770; // viewport minus header/pill chrome
const DOC_W = 794;
const DOC_H = 3123;

ok("fit-width scale: document wider than surface → freehand full-span X, top-pinned Y", () => {
  // 0.55 zoom: 794*0.55 = 436.7 > 390 → x range must cover the whole overflow
  const s = 0.55;
  const b = panBounds({ surfaceW: SURF_W, surfaceH: SURF_H, contentW: DOC_W, contentH: DOC_H, scale: s });
  const xMin = SURF_W - DOC_W * s; // right edge flush with surface right
  assert.ok(Math.abs(b.xMin - xMin) < 1e-6, `xMin ${b.xMin} != ${xMin}`);
  assert.equal(b.xMax, 0); // left edge flush with surface left
  assert.equal(b.freeX, true);
  // document taller at any sane zoom → y range spans the vertical overflow
  const yMin = SURF_H - DOC_H * s;
  assert.ok(Math.abs(b.yMin - yMin) < 1e-6, `yMin ${b.yMin} != ${yMin}`);
  assert.equal(b.yMax, 0);
});

ok("document narrower than surface → pinned centred horizontally, freehand disabled on X", () => {
  const s = 0.2; // 794*0.2 = 158.8 < 390
  const b = panBounds({ surfaceW: SURF_W, surfaceH: SURF_H, contentW: DOC_W, contentH: DOC_H, scale: s });
  assert.equal(b.freeX, false);
  const centre = (SURF_W - DOC_W * s) / 2;
  assert.ok(Math.abs(b.xMin - centre) < 1e-6);
  assert.ok(Math.abs(b.xMax - centre) < 1e-6);
  // vertical overflow still freehand (a 3-page doc at 0.2 is 625px — fits here)
  if (DOC_H * s <= SURF_H) {
    assert.equal(b.freeY, false);
    assert.equal(b.yMin, 0);
    assert.equal(b.yMax, 0);
  } else {
    assert.equal(b.freeY, true);
  }
});

ok("document fits vertically → Y pinned flush under the bar (y = 0 both ends)", () => {
  const s = 0.2;
  const b = panBounds({ surfaceW: SURF_W, surfaceH: SURF_H, contentW: DOC_W, contentH: 600, scale: s });
  assert.equal(b.freeY, false);
  assert.equal(b.yMin, 0);
  assert.equal(b.yMax, 0);
});

ok("clamped pan never leaves the surface: extremes reachable, nothing beyond", () => {
  const s = 1; // full PDF-size: 794 wide, 3123 tall on a 390x770 surface
  const b = panBounds({ surfaceW: SURF_W, surfaceH: SURF_H, contentW: DOC_W, contentH: DOC_H, scale: s });
  assert.equal(b.freeX, true);
  assert.equal(b.freeY, true);
  const left = clampPan({ x: b.xMin - 500, y: b.yMin - 500 }, b); // far beyond left/top
  assert.ok(Math.abs(left.x - b.xMin) < 1e-6, "left extreme must be clamped to xMin");
  assert.ok(Math.abs(left.y - b.yMin) < 1e-6);
  const right = clampPan({ x: b.xMax + 500, y: b.yMax + 500 }, b); // beyond right/top
  assert.ok(Math.abs(right.x - b.xMax) < 1e-6);
  assert.ok(Math.abs(right.y - b.yMax) < 1e-6);
  // freehand span: dragging from xMax to xMin must be possible (full width seen)
  assert.ok(b.xMax - b.xMin >= 300, `x span too small to feel freehand: ${b.xMax - b.xMin}`);
  assert.ok(b.yMax - b.yMin >= 2000, `y span too small: ${b.yMax - b.yMin}`);
});

ok("anchorZoom: the point under the finger never moves", () => {
  const s0 = 0.55;
  const b0 = panBounds({ surfaceW: SURF_W, surfaceH: SURF_H, contentW: DOC_W, contentH: DOC_H, scale: s0 });
  // document panned somewhere mid-range (s kept alongside — clampPan is bare x/y)
  const vc = clampPan({ x: b0.xMin * 0.4, y: b0.yMax * 0.6 }, b0);
  const view = { s: s0, x: vc.x, y: vc.y };
  const fx = 150, fy = 300; // finger position in surface coords
  const docPoint = { nx: (fx - view.x) / view.s, ny: (fy - view.y) / view.s };
  const s1 = 1.3;
  const b1 = panBounds({ surfaceW: SURF_W, surfaceH: SURF_H, contentW: DOC_W, contentH: DOC_H, scale: s1 });
  const next = anchorZoom(
    { s: view.s, x: view.x, y: view.y },
    docPoint, fx, fy, s1, b1,
  );
  assert.equal(next.s, s1);
  // nail check: unproject the same screen point; it must land on the same doc point
  const nx2 = (fx - next.x) / next.s;
  const ny2 = (fy - next.y) / next.s;
  assert.ok(Math.abs(nx2 - docPoint.nx) < 1e-6, `nx drifted ${nx2} vs ${docPoint.nx}`);
  assert.ok(Math.abs(ny2 - docPoint.ny) < 1e-6, `ny drifted ${ny2} vs ${docPoint.ny}`);
  // and the result is inside the new bounds (no flung-off sheet)
  const c = clampPan(next, b1);
  assert.ok(Math.abs(c.x - next.x) < 1e-9 && Math.abs(c.y - next.y) < 1e-9, "anchorZoom result must already be clamped");
});

ok("anchorZoom at extreme scale keeps the sheet on-screen (zoom to MAX from far pan)", () => {
  const s0 = 2.5;
  const b0 = panBounds({ surfaceW: SURF_W, surfaceH: SURF_H, contentW: DOC_W, contentH: DOC_H, scale: s0 });
  const view = clampPan({ x: b0.xMin, y: b0.yMin }, b0);
  const next = anchorZoom({ s: view.s, x: view.x, y: view.y }, { nx: 0, ny: 0 }, 10, 10, 5, b0);
  assert.equal(next.s, 5);
  assert.ok(next.x <= b0.xMax + 1e-6 && next.x >= b0.xMin - 1e-6);
  assert.ok(next.y <= b0.yMax + 1e-6 && next.y >= b0.yMin - 1e-6);
});

ok("clampScale honours the zoom band", () => {
  assert.equal(clampScale(0.1, 0.35, 5), 0.35);
  assert.equal(clampScale(9, 0.35, 5), 5);
  assert.equal(clampScale(1.5, 0.35, 5), 1.5);
});

ok("decayVelocity: monotonic decay that bottoms out at the epsilon", () => {
  let v = 2.4;
  let frames = 0;
  while (Math.abs(v) > VELOCITY_EPS && frames < 1000) {
    v = decayVelocity(v, 16.7);
    frames += 1;
    assert.ok(Math.abs(v) <= 2.4, "velocity must never grow");
  }
  assert.ok(frames > 10 && frames < 600, `decay should take a believable number of frames: ${frames}`);
});

ok("decayVelocity respects frame dt (slow frames decay faster per call)", () => {
  const afterNormal = (() => { let v = 1; for (let i = 0; i < 6; i++) v = decayVelocity(v, 16.7); return v; })();
  const afterSlow = (() => { let v = 1; for (let i = 0; i < 6; i++) v = decayVelocity(v, 64); return v; })();
  assert.ok(Math.abs(afterSlow) < Math.abs(afterNormal), "64ms frames must decay harder than 16.7ms frames");
});

console.log(`panZoom.test.mjs: ${checks} checks passed`);
