import assert from "node:assert/strict";
import { sealStampOrigin } from "../src/utils/sealStamp.js";
import { normalizeSealConfig, sealBoxMm } from "../src/utils/sealConfig.js";

const approx = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !≈ ${expected}`);

// The configuration under test matches the field setup this fix was written
// for: a 64 mm stamp, 6 mm from the frame's right edge, 12 mm above its bottom.
const cfg = normalizeSealConfig({ stamp: { sizeMm: 64, rightMm: 6, bottomMm: 12 } });
const box = sealBoxMm("stamp", cfg.stamp); // 64 × 25.6 mm
approx(box.h, 25.6);

// 1. Frame anchoring: A4 content frame runs 10..200 mm across and ends at
// 287 mm down (the sheet's own 10 mm margins outside it). The stamp lands at
// the configured gaps FROM THE FRAME — the same spot the shared link shows it.
const origin = sealStampOrigin(cfg.stamp, box, { right: 200, bottom: 287 }, 210, 297);
approx(origin.x, 130); // 200 − 6 − 64 → 16 mm clear of the paper's right edge
approx(origin.y, 249.4); // 287 − 12 − 25.6 → 22 mm clear of the paper's bottom
// The printed mark can never leave the sheet's content box, so a printer's
// non-printable margin clips nothing: this is the half-cut guarantee.
assert.ok(origin.x + box.w <= 200, "seal crosses the frame's right edge");
assert.ok(origin.y + box.h <= 287, "seal crosses the frame's bottom edge");
assert.ok(origin.y + box.h <= 297 - 10, "seal enters the paper's bottom margin");

// 2. No frame geometry → the legacy paper-edge fallback, byte-identical to
// the pre-fix behaviour for callers that do not pass a frame.
const paper = sealStampOrigin(cfg.stamp, box, null, 210, 297);
approx(paper.x, 210 - 6 - 64);
approx(paper.y, 297 - 12 - 25.6);
const partial = sealStampOrigin(cfg.stamp, box, { right: 200 }, 210, 297);
approx(partial.x, 130);
approx(partial.y, 297 - 12 - 25.6); // bottom missing → paper edge

// 3. A degenerate final page (only 20 mm of content) would put the stamp
// above the sheet — clamped to the top edge instead of drawn off-page, where
// the page boundary would slice it in half.
const degenerate = sealStampOrigin(cfg.stamp, box, { right: 200, bottom: 30 }, 210, 297);
assert.equal(degenerate.y, 0);
assert.ok(degenerate.y + box.h <= 297, "degenerate frame pushes seal off-page");

// 4. Extreme gaps (typed far beyond the frame) clamp to the sheet on both
// axes rather than producing negative coordinates.
const extreme = sealStampOrigin(
  { rightMm: 300, bottomMm: 400 },
  box,
  { right: 200, bottom: 287 },
  210,
  297
);
assert.equal(extreme.x, 0);
assert.equal(extreme.y, 0);

// 5. Landscape A4 (297 × 210, content frame right at 287, bottom at 200):
// frame anchoring follows the geometry instead of hard-coding A4 portrait.
const landscape = sealStampOrigin(cfg.stamp, box, { right: 287, bottom: 200 }, 297, 210);
approx(landscape.x, 287 - 6 - 64);
approx(landscape.y, 200 - 12 - 25.6);
assert.ok(landscape.x + box.w <= 297 && landscape.y + box.h <= 210);

// 6. A full-page round seal (box fills the sheet): the clamp keeps it exactly
// on the paper even when the gaps say otherwise.
const roundBox = sealBoxMm("round", normalizeSealConfig({ round: { sizeMm: 120 } }));
const round = sealStampOrigin({ rightMm: 0, bottomMm: 0 }, roundBox, { right: 210, bottom: 297 }, 210, 297);
assert.equal(round.x, 90); // 210 − 0 − 120
assert.equal(Math.round(round.y), 177); // 297 − 0 − 120
assert.ok(round.x + roundBox.w <= 210 && round.y + roundBox.h <= 297);

console.log("sealStamp tests passed");
