import { INDIAN_JURISDICTION_REGIONS } from "../constants/indianRegions.js";

/**
 * One reusable formatter for the invoice jurisdiction footer.
 *
 *   formatJurisdiction("Bengaluru")        → "SUBJECT TO BENGALURU JURISDICTION"
 *   formatJurisdiction("  new   delhi ")   → "SUBJECT TO NEW DELHI JURISDICTION"
 *   formatJurisdiction("")                 → ""   (never emits malformed text)
 *
 * Rules (mirrored by BusinessServiceImpl on the backend):
 * - trims and collapses repeated whitespace before uppercasing,
 * - city only — never appends the state/region name,
 * - empty/blank input yields "" so callers can simply omit the line.
 */
export function formatJurisdiction(city) {
  const cleaned = String(city || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return cleaned ? `SUBJECT TO ${cleaned} JURISDICTION` : "";
}

/**
 * Display gate: TRUE unless the business explicitly opted out. A missing or
 * legacy `jurisdictionEnabled` keeps the historical behaviour (line shown).
 */
export function shouldShowJurisdiction(business) {
  return business?.jurisdictionEnabled !== false;
}

/**
 * The complete footer line for a business payload — "" when the switch is
 * off or the saved city is blank. This is what every invoice template reads;
 * nothing else hardcodes a city.
 */
export function jurisdictionLine(business) {
  if (!shouldShowJurisdiction(business)) return "";
  return formatJurisdiction(business?.jurisdictionCity);
}

/** Region membership check against the backend-matching reference list. */
export function isValidJurisdictionRegion(region) {
  return INDIAN_JURISDICTION_REGIONS.includes(region);
}
