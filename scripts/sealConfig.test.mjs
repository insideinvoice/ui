import assert from "node:assert/strict";
import { normalizeSealConfig, normalizeSealColor, SEAL_DEFAULTS, sealBoxMm, sealEdgeRange, sealSpecAttribute } from "../src/utils/sealConfig.js";

// Defaults preserve the historical round/stamp geometry, but multi-page is OFF:
// a fresh business stamps only the final page (grand total + signature).
const defaults = normalizeSealConfig(null);
assert.equal(defaults.allPages, false);
assert.deepEqual(defaults.round, { sizeMm: 21, tilt: -8, rightMm: 10, bottomMm: 8, color: "#0A4BFF" });
assert.deepEqual(defaults.stamp, { sizeMm: 64, tilt: -6, rightMm: 10, bottomMm: 8, color: "#0000CC" });

// Colour normalises to upper-case #RRGGBB; the historical inks are the
// fallback, so a config saved before colour existed renders unchanged.
assert.equal(normalizeSealColor("#0a4bff", "#FFF"), "#0A4BFF");
assert.equal(normalizeSealColor("#abc", "#FFF"), "#AABBCC");
assert.equal(normalizeSealColor("red", "#0A4BFF"), "#0A4BFF");
assert.equal(normalizeSealColor("", "#0A4BFF"), "#0A4BFF");
assert.equal(normalizeSealColor(null, "#0000CC"), "#0000CC");
// A picked colour survives a round trip through the stored config.
const picked = normalizeSealConfig({ stamp: { color: "#12ab9f" } });
assert.equal(picked.stamp.color, "#12AB9F");
assert.equal(picked.round.color, "#0A4BFF");

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
// Edge travel is capped by the page minus the seal footprint: a 120 mm round
// seal can only move 210-120 = 90 mm right and 297-120 = 177 mm up.
assert.equal(clamped.round.bottomMm, 177);
assert.equal(clamped.stamp.sizeMm, SEAL_DEFAULTS.stamp.sizeMm);
assert.equal(clamped.stamp.tilt, 20);
assert.equal(clamped.stamp.rightMm, 12);
assert.equal(clamped.stamp.bottomMm, 3);

// The rubber stamp keeps its 2.5:1 artwork aspect; the round seal is square.
assert.deepEqual(sealBoxMm("round", clamped), { w: 120, h: 120 });
const stampBox = sealBoxMm("stamp", clamped);
assert.equal(stampBox.w, 64);
assert.ok(Math.abs(stampBox.h - 25.6) < 1e-9);

// Travel range = page minus the seal's own footprint, so the mark can reach
// every point of an A4 sheet but never hang off the edge.
const roundTravel = sealEdgeRange("round", defaults);
assert.deepEqual(roundTravel, { rightMm: 189, bottomMm: 276 });
const stampTravel = sealEdgeRange("stamp", defaults);
assert.equal(stampTravel.rightMm, 146);
assert.ok(Math.abs(stampTravel.bottomMm - 271.4) < 1e-9);
// A huge stamp has almost no right travel left; a tiny seal has nearly the
// whole page width.
assert.deepEqual(sealEdgeRange("stamp", { stamp: { sizeMm: 180 } }), { rightMm: 30, bottomMm: 225 });
assert.deepEqual(sealEdgeRange("round", { round: { sizeMm: 5 } }), { rightMm: 205, bottomMm: 292 });

// Values beyond the travel range clamp to the last reachable point instead of
// silently pushing the seal off the page.
const far = normalizeSealConfig({ round: { sizeMm: 21, rightMm: 250, bottomMm: 400 } });
assert.equal(far.round.rightMm, 189);
assert.equal(far.round.bottomMm, 276);

// The embedded PDF spec is valid JSON and carries the active variant, plus the
// new OFF-by-default multi-page choice.
const spec = JSON.parse(sealSpecAttribute({ businessName: "ACME", sealEnabled: true, sealType: "stamp" }));
assert.equal(spec.enabled, true);
assert.equal(spec.type, "stamp");
assert.equal(spec.companyName, "ACME");
assert.equal(spec.sizeMm, SEAL_DEFAULTS.stamp.sizeMm);
assert.equal(spec.allPages, false);

// An owner who opts into multi-page gets it through to the stamping loop.
const multiPage = JSON.parse(
  sealSpecAttribute({
    businessName: "ACME",
    sealEnabled: true,
    sealType: "round",
    sealConfig: { allPages: true },
  })
);
assert.equal(multiPage.allPages, true);

// A disabled seal never stamps, whatever the multi-page choice.
const off = JSON.parse(sealSpecAttribute({ businessName: "ACME", sealEnabled: false, sealType: "round" }));
assert.equal(off.enabled, false);

console.log("sealConfig tests passed");
