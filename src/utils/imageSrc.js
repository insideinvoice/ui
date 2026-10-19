/**
 * Normalises an uploaded image (logo / signature) into a renderable src.
 *
 * The business profile stores uploads as raw Base64, but some clients (and
 * the preview samples) already hold a full data: URI. Blindly prefixing
 * "data:image/png;base64," would produce an invalid URL for those — so a
 * data: URI is passed through untouched.
 */
export const asImageSrc = (value) => {
  const v = String(value || "").trim();
  if (!v) return null;
  return v.startsWith("data:") ? v : `data:image/png;base64,${v}`;
};
