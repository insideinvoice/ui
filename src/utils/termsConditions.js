// Shared parser for businesses.terms_conditions (V40 canonical JSON array).
// Settings writes it; the invoice view page, the printed PDF templates and the
// share page all read it through here. A malformed or legacy value degrades
// to an empty list instead of throwing — a broken string must never take down
// an invoice render.
export const parseTermsList = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => typeof t === "string" && t.trim());
  } catch {
    return [];
  }
};
