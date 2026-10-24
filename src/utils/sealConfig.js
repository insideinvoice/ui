import { resolveSeal } from "./seal.js";

/**
 * Millimetre → CSS reference pixel. The A4 templates are drawn at 714 px for
 * the 190 mm content width, so the reference pixel is close enough to place a
 * seal inline; the PDF path stamps in real millimetres and is unaffected.
 */
export const PX_PER_MM = 96 / 25.4;

/**
 * Built-in defaults. These reproduce the historical look: the round seal at
 * its 80 px A4 diameter, the rubber stamp at its 240 px width, both in the
 * bottom-right corner with the components' hand-stamped tilts.
 *
 * allPages defaults to OFF — a fresh business stamps only the final page, the
 * one carrying the grand total and the signature band. Owners opt into
 * repeating the mark on every continuation page.
 */
export const SEAL_DEFAULTS = Object.freeze({
  allPages: false,
  round: Object.freeze({ sizeMm: 21, tilt: -8, rightMm: 10, bottomMm: 8, color: "#0A4BFF" }),
  stamp: Object.freeze({ sizeMm: 64, tilt: -6, rightMm: 10, bottomMm: 8, color: "#0000CC" }),
});

/**
 * The ink colour each variant has always used. "Reset to default" restores
 * these, and a missing/invalid stored value falls back to them so an older
 * seal_config (saved before colour existed) keeps looking unchanged.
 */
export const SEAL_DEFAULT_COLOR = Object.freeze({
  round: "#0A4BFF",
  stamp: "#0000CC",
});

/** Accepts #RGB or #RRGGBB (either case); anything else returns the fallback. */
export function normalizeSealColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  return full ? `#${full[1]}`.toUpperCase() : fallback;
}

/**
 * A4 portrait in millimetres. The seal offsets are measured from the paper's
 * right/bottom edge, so the usable range depends on the paper AND on the seal's
 * own footprint: a 64 mm stamp can only travel 210-64 = 146 mm to the left
 * before its edge reaches x=0. Renderers clamp against this so a saved config
 * can never push the mark off the sheet.
 */
export const SEAL_PAGE = Object.freeze({ widthMm: 210, heightMm: 297 });

export const SEAL_LIMITS = Object.freeze({
  round: Object.freeze({ minSize: 5, maxSize: 120 }),
  stamp: Object.freeze({ minSize: 10, maxSize: 180 }),
  minTilt: -45,
  maxTilt: 45,
  minEdge: 0,
  // Coarse ceiling only (the whole page); per-variant travel is tighter and is
  // derived from the seal footprint in sealEdgeRange().
  maxEdge: SEAL_PAGE.widthMm,
});

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const roundTo2 = (value) => Math.round(value * 100) / 100;

const toBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
};

function normaliseVariant(raw, defaults, limits, variant) {
  const size = toNumber(raw?.sizeMm);
  const tilt = toNumber(raw?.tilt);
  const right = toNumber(raw?.rightMm);
  const bottom = toNumber(raw?.bottomMm);

  const sizeMm = roundTo2(clamp(size == null ? defaults.sizeMm : size, limits.minSize, limits.maxSize));
  // Edge travel is capped by the page minus the seal's own footprint, so the
  // mark can reach every point of the sheet but never hang off it.
  const box = sealBoxMm(variant, { [variant]: { sizeMm } });
  const maxRight = Math.max(0, SEAL_PAGE.widthMm - box.w);
  const maxBottom = Math.max(0, SEAL_PAGE.heightMm - box.h);

  return {
    sizeMm,
    tilt: roundTo2(clamp(tilt == null ? defaults.tilt : tilt, SEAL_LIMITS.minTilt, SEAL_LIMITS.maxTilt)),
    rightMm: roundTo2(clamp(right == null ? defaults.rightMm : right, SEAL_LIMITS.minEdge, maxRight)),
    bottomMm: roundTo2(clamp(bottom == null ? defaults.bottomMm : bottom, SEAL_LIMITS.minEdge, maxBottom)),
    color: normalizeSealColor(raw?.color, defaults.color),
  };
}

/**
 * Accepts either the JSON string the backend persists or an already-parsed
 * object (older/newer payloads) and always returns a complete configuration.
 */
export function normalizeSealConfig(raw) {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      value = null;
    }
  }
  if (!value || typeof value !== "object") value = null;

  return {
    allPages: toBoolean(value?.allPages, SEAL_DEFAULTS.allPages),
    round: normaliseVariant(value?.round, SEAL_DEFAULTS.round, SEAL_LIMITS.round, "round"),
    stamp: normaliseVariant(value?.stamp, SEAL_DEFAULTS.stamp, SEAL_LIMITS.stamp, "stamp"),
  };
}

/**
 * Server value wins (public share pages run on the customer's device and only
 * have the payload); localStorage is the fallback for the logged-in app and
 * documents rendered before the business profile arrives.
 */
export function resolveSealConfig(business) {
  if (business?.sealConfig) return normalizeSealConfig(business.sealConfig);
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("seal_config");
    if (stored) return normalizeSealConfig(stored);
  }
  return normalizeSealConfig(null);
}

/** Footprint of the active variant in millimetres (stamp keeps its 2.5:1 art). */
export function sealBoxMm(type, config) {
  const variant = type === "stamp" ? "stamp" : "round";
  // Accept either the full { round, stamp } config or a single variant object
  // (PDF specs carry the active variant's fields at the top level).
  const source = config?.[variant] || config || SEAL_DEFAULTS[variant];
  const width = Number.isFinite(source?.sizeMm) ? source.sizeMm : SEAL_DEFAULTS[variant].sizeMm;
  return variant === "stamp"
    ? { w: width, h: width * 0.4 }
    : { w: width, h: width };
}

/**
 * How far the active seal can travel from the right/bottom edge before part of
 * it leaves the page. Used by the Settings inputs as their `max`, so a user can
 * drag the mark to every reachable point of an A4 sheet and no further.
 */
export function sealEdgeRange(type, config) {
  const box = sealBoxMm(type, config);
  return {
    rightMm: Math.max(0, roundTo2(SEAL_PAGE.widthMm - box.w)),
    bottomMm: Math.max(0, roundTo2(SEAL_PAGE.heightMm - box.h)),
  };
}

/**
 * Plain-data description of the seal for one document render. It is embedded
 * in the document root as `data-ii-seal-spec` so the PDF builder can stamp the
 * seal on every page without every caller having to pass the business object
 * through the download/share helpers.
 */
export function sealSpecFor(business) {
  const { sealVisible, sealType } = resolveSeal(business);
  const config = resolveSealConfig(business);
  const type = sealType === "stamp" ? "stamp" : "round";
  const variant = config[type];

  return {
    enabled: !!sealVisible,
    allPages: config.allPages !== false,
    type,
    sizeMm: variant.sizeMm,
    tilt: variant.tilt,
    rightMm: variant.rightMm,
    bottomMm: variant.bottomMm,
    color: variant.color,
    companyName: business?.businessName || business?.name || "COMPANY NAME",
    addressLine1: business?.addressLine1 || "",
    addressLine2: [business?.addressLine2, business?.city, business?.state, business?.pincode ? "-" + business.pincode : ""]
      .filter(Boolean)
      .join(", "),
    phone: business?.phone ? `Ph: ${business.phone}` : "",
    email: business?.email ? `E-Mail: ${business.email}` : "",
  };
}

export const sealSpecAttribute = (business) => JSON.stringify(sealSpecFor(business));
