import assert from "node:assert/strict";
import { normalizeSealConfig, SEAL_DEFAULTS, sealBoxMm, sealSpecAttribute } from "../src/utils/sealConfig.js";

// Defaults preserve the historical round/stamp geometry.
const defaults = normalizeSealConfig(null);
assert.equal(defaults.allPages, true);
assert.deepEqual(defaults.round, { sizeMm: 21, tilt: -8, rightMm: 10, bottomMm: 8 });
assert.deepEqual(defaults.stamp, { sizeMm: 64, tilt: -6, rightMm: 10, bottomMm: 8 });

// Backend JSON strings are parsed, partial objects keep defaults per field.
const parsed = normalizeSealConfig('{"allPages":false,"round":{"sizeMm":30,"rightMm":4}}');
assert.equal(parsed.allPages, false);
assert.equal(parsed.round.sizeMm, 30);
assert.equal(parsed.round.rightMm, 4);
assert.equal(parsed.round.tilt, SEAL_DEFAULTS.round.tilt);
assert.equal(parsed.stamp.sizeMm, SEAL_DEFAULTS.stamp.sizeMm);

// Out-of-range and malformed values clamp instead of leaking into the PDF.
const clamped = normalizeSealConfig({
  round: { sizeMm: 999, tilt: -999, rightMm: -5, bottomMm: 500 },
  stamp: { sizeMm: "not-a-number", tilt: 20, rightMm: "12", bottomMm: 3 },
});
assert.equal(clamped.round.sizeMm, 120);
assert.equal(clamped.round.tilt, -45);
assert.equal(clamped.round.rightMm, 0);
assert.equal(clamped.round.bottomMm, 100);
assert.equal(clamped.stamp.sizeMm, SEAL_DEFAULTS.stamp.sizeMm);
assert.equal(clamped.stamp.tilt, 20);
assert.equal(clamped.stamp.rightMm, 12);
assert.equal(clamped.stamp.bottomMm, 3);

// The rubber stamp keeps its 2.5:1 artwork aspect; the round seal is square.
assert.deepEqual(sealBoxMm("round", clamped), { w: 120, h: 120 });
const stampBox = sealBoxMm("stamp", clamped);
assert.equal(stampBox.w, 64);
assert.ok(Math.abs(stampBox.h - 25.6) < 1e-9);

// The embedded PDF spec is valid JSON and carries the active variant.
const spec = JSON.parse(sealSpecAttribute({ businessName: "ACME", sealEnabled: true, sealType: "stamp" }));
assert.equal(spec.enabled, true);
assert.equal(spec.type, "stamp");
assert.equal(spec.companyName, "ACME");
assert.equal(spec.sizeMm, SEAL_DEFAULTS.stamp.sizeMm);
assert.equal(spec.allPages, true);

// The PDF spec carries a first-page-only choice through to the stamping loop.
const firstPageOnly = JSON.parse(
  sealSpecAttribute({
    businessName: "ACME",
    sealEnabled: true,
    sealType: "round",
    sealConfig: { allPages: false },
  })
);
assert.equal(firstPageOnly.allPages, false);

console.log("sealConfig tests passed");
