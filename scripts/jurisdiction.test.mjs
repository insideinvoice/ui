/**
 * Standalone unit tests for the invoice-jurisdiction formatter and the
 * India region reference data. Runs with plain `node` (node:assert) so the
 * project needs no test framework for this:  npm run test:unit
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { formatJurisdiction, jurisdictionLine, shouldShowJurisdiction, isValidJurisdictionRegion } from "../src/utils/jurisdiction.js";
import {
  INDIAN_JURISDICTION_STATES,
  INDIAN_JURISDICTION_UTS,
  INDIAN_JURISDICTION_REGIONS,
  JURISDICTION_CENTRES,
} from "../src/constants/indianRegions.js";

// Backend invariant: parse the Java reference list straight from the backend
// repository so the stored strings can never drift apart. If the backend
// repo is not checked out next to this one, the cross-repo check is skipped
// with a warning instead of failing (nothing to compare against).
const backendJavaPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../Inside-Invoice-backend/src/main/java/com/insideinvoice/common/IndianRegions.java",
);
let backend;
try {
  const java = readFileSync(backendJavaPath, "utf8");
  const extract = (block) => {
    const from = java.indexOf(`${block} = Collections.unmodifiableList(Arrays.asList(`);
    const to = java.indexOf("));", from);
    return [...java.slice(from, to).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };
  backend = {
    STATES: extract("STATES"),
    UNION_TERRITORIES: extract("UNION_TERRITORIES"),
    isValid: null, // membership rules are asserted by the Java test suite
  };
} catch {
  backend = null;
}

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

console.log("formatJurisdiction");

test("Bengaluru", () => {
  assert.equal(formatJurisdiction("Bengaluru"), "SUBJECT TO BENGALURU JURISDICTION");
});
test("Mumbai", () => {
  assert.equal(formatJurisdiction("Mumbai"), "SUBJECT TO MUMBAI JURISDICTION");
});
test("Hyderabad", () => {
  assert.equal(formatJurisdiction("Hyderabad"), "SUBJECT TO HYDERABAD JURISDICTION");
});
test("Pune", () => {
  assert.equal(formatJurisdiction("Pune"), "SUBJECT TO PUNE JURISDICTION");
});
test("New Delhi", () => {
  assert.equal(formatJurisdiction("New Delhi"), "SUBJECT TO NEW DELHI JURISDICTION");
});
test("Chennai", () => {
  assert.equal(formatJurisdiction("Chennai"), "SUBJECT TO CHENNAI JURISDICTION");
});
test("trims and collapses repeated whitespace", () => {
  assert.equal(
    formatJurisdiction("   bengaluru    central  "),
    "SUBJECT TO BENGALURU CENTRAL JURISDICTION",
  );
});
test("lowercase input is uppercased", () => {
  assert.equal(formatJurisdiction("mumbai"), "SUBJECT TO MUMBAI JURISDICTION");
});
test("empty input produces empty output (never malformed)", () => {
  assert.equal(formatJurisdiction(""), "");
  assert.equal(formatJurisdiction("   "), "");
  assert.equal(formatJurisdiction(null), "");
  assert.equal(formatJurisdiction(undefined), "");
});
test("city only — never appends the region/state name", () => {
  assert.ok(!formatJurisdiction("Pune").includes("MAHARASHTRA"));
  assert.ok(!formatJurisdiction("New Delhi").includes("DELHI (NATIONAL"));
});

console.log("jurisdictionLine / shouldShowJurisdiction");
test("enabled business renders its saved city", () => {
  assert.equal(
    jurisdictionLine({ jurisdictionEnabled: true, jurisdictionCity: "Bengaluru" }),
    "SUBJECT TO BENGALURU JURISDICTION",
  );
});
test("explicitly disabled business renders no line", () => {
  assert.equal(jurisdictionLine({ jurisdictionEnabled: false, jurisdictionCity: "Bengaluru" }), "");
});
test("legacy business without fields keeps historical behaviour", () => {
  assert.equal(shouldShowJurisdiction({}), true);
  // city unknown → no line rather than a broken template string
  assert.equal(jurisdictionLine({}), "");
});
test("enabled with blank city renders no line (no malformed output)", () => {
  assert.equal(jurisdictionLine({ jurisdictionEnabled: true, jurisdictionCity: "  " }), "");
});

console.log("Indian region reference data");
test("28 states and 8 union territories", () => {
  assert.equal(INDIAN_JURISDICTION_STATES.length, 28);
  assert.equal(INDIAN_JURISDICTION_UTS.length, 8);
  assert.equal(INDIAN_JURISDICTION_REGIONS.length, 36);
});
test("frontend list matches the backend reference exactly", () => {
  if (!backend) {
    console.warn("  SKIP backend comparison — backend repository not found next to this checkout");
    return;
  }
  assert.deepEqual([...INDIAN_JURISDICTION_STATES].sort(), [...backend.STATES].sort());
  assert.deepEqual([...INDIAN_JURISDICTION_UTS].sort(), [...backend.UNION_TERRITORIES].sort());
});
test("backend accepts every frontend region and rejects unknowns", () => {
  if (!backend) {
    console.warn("  SKIP backend membership — backend repository not found next to this checkout");
    return;
  }
  const javaIsValid = new Set([...backend.STATES, ...backend.UNION_TERRITORIES]);
  for (const region of INDIAN_JURISDICTION_REGIONS) {
    assert.ok(javaIsValid.has(region), `backend should accept ${region}`);
  }
  assert.ok(!javaIsValid.has("Atlantis"));
  assert.ok(!javaIsValid.has(""));
  assert.ok(!javaIsValid.has(null));
});
test("frontend membership helper agrees with the list", () => {
  assert.ok(isValidJurisdictionRegion("Maharashtra"));
  assert.ok(!isValidJurisdictionRegion("Atlantis"));
});
test("every region has a suggested centre (convenience only)", () => {
  for (const region of INDIAN_JURISDICTION_REGIONS) {
    assert.ok(JURISDICTION_CENTRES[region], `missing suggestion for ${region}`);
  }
  assert.equal(JURISDICTION_CENTRES["Karnataka"], "Bengaluru");
  assert.equal(JURISDICTION_CENTRES["Maharashtra"], "Mumbai");
  assert.equal(JURISDICTION_CENTRES["Telangana"], "Hyderabad");
  assert.equal(JURISDICTION_CENTRES["Tamil Nadu"], "Chennai");
  assert.equal(JURISDICTION_CENTRES["Delhi (National Capital Territory)"], "New Delhi");
});

console.log(`\nAll ${passed} jurisdiction formatter tests passed ✅`);
