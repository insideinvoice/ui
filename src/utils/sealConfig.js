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
 */
export const SEAL_DEFAULTS = Object.freeze({
  allPages: true,
  round: Object.freeze({ sizeMm: 21, tilt: -8, rightMm: 10, bottomMm: 8 }),
  stamp: Object.freeze({ sizeMm: 64, tilt: -6, rightMm: 10, bottomMm: 8 }),
});

export const SEAL_LIMITS = Object.freeze({
  round: Object.freeze({ minSize: 5, maxSize: 120 }),
  stamp: Object.freeze({ minSize: 10, maxSize: 180 }),
  minTilt: -45,
  maxTilt: 45,
  minEdge: 0,
  maxEdge: 100,
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

function normaliseVariant(raw, defaults, limits) {
  const size = toNumber(raw?.sizeMm);
  const tilt = toNumber(raw?.tilt);
  const right = toNumber(raw?.rightMm);
  const bottom = toNumber(raw?.bottomMm);

  return {
    sizeMm: roundTo2(clamp(size == null ? defaults.sizeMm : size, limits.minSize, limits.maxSize)),
    tilt: roundTo2(clamp(tilt == null ? defaults.tilt : tilt, SEAL_LIMITS.minTilt, SEAL_LIMITS.maxTilt)),
    rightMm: roundTo2(clamp(right == null ? defaults.rightMm : right, SEAL_LIMITS.minEdge, SEAL_LIMITS.maxEdge)),
    bottomMm: roundTo2(clamp(bottom == null ? defaults.bottomMm : bottom, SEAL_LIMITS.minEdge, SEAL_LIMITS.maxEdge)),
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
    round: normaliseVariant(value?.round, SEAL_DEFAULTS.round, SEAL_LIMITS.round),
    stamp: normaliseVariant(value?.stamp, SEAL_DEFAULTS.stamp, SEAL_LIMITS.stamp),
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
