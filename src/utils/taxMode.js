// Invoice-level GST tax mode (CGST_SGST vs IGST) — the frontend mirror of the
// backend rules in invoice/entity/TaxMode.java. One definition lives here so
// the Create/Edit forms, the preview, every template, the Excel export and the
// public share page always agree on the structure they present.
//
// The legally applicable mode follows the SUPPLIER's (business) state vs the
// Place of Supply — never the customer's billing address or Destination.
// The stored invoice selection always wins; the heuristic only fills the gap
// for legacy invoices that predate the field. All tax AMOUNTS stay
// backend-authoritative: this module only chooses the presentation structure.

export const TAX_MODE_SPLIT = "CGST_SGST";
export const TAX_MODE_IGST = "IGST";

export function isValidTaxMode(mode) {
  return mode === TAX_MODE_SPLIT || mode === TAX_MODE_IGST;
}

const norm = (s) => (typeof s === "string" ? s.trim() : "");

/** Applicable mode for the supply, or null when it cannot be established. */
export function determineTaxMode(businessState, placeOfSupply) {
  const supplier = norm(businessState);
  const pos = norm(placeOfSupply);
  if (!supplier || !pos) return null;
  return supplier.toLowerCase() === pos.toLowerCase() ? TAX_MODE_SPLIT : TAX_MODE_IGST;
}

/**
 * Mode to present: the stored selection (if valid) -> the legal heuristic ->
 * the intra-state split (exactly what every template printed before the
 * field existed, so unresolved invoices render unchanged).
 */
export function resolveTaxMode(storedMode, businessState, placeOfSupply) {
  if (isValidTaxMode(storedMode)) return storedMode;
  return determineTaxMode(businessState, placeOfSupply) || TAX_MODE_SPLIT;
}

/**
 * False only when the applicable mode is KNOWN and differs from the selection.
 * Missing state/place-of-supply info cannot make a selection inconsistent.
 */
export function isTaxModeConsistent(mode, businessState, placeOfSupply) {
  if (!isValidTaxMode(mode)) return true;
  const applicable = determineTaxMode(businessState, placeOfSupply);
  return !applicable || applicable === mode;
}

const conflictMessage = (mode, state, pos) => {
  if (mode === TAX_MODE_IGST) {
    return `IGST applies to inter-state supplies, but the place of supply (${pos}) matches your business state (${state}). GST rules require CGST + SGST/UTGST here.`;
  }
  return `CGST + SGST/UTGST applies to intra-state supplies, but the place of supply (${pos}) differs from your business state (${state}). GST rules require IGST here.`;
};

/**
 * Validation for the Create/Edit invoice screens.
 *
 *  - consistent        -> { ok, level: "ok" }
 *  - cannot determine  -> { ok: true, level: "info", cannotDetermine: true }
 *                         (the established flow: allow, but say what is missing)
 *  - conflict          -> { ok: false, level: "warning", message } — the UI
 *                         shows the warning and gates finalization behind an
 *                         explicit confirmation. The user's selection is
 *                         NEVER silently changed.
 */
export function validateTaxMode(mode, businessState, placeOfSupply) {
  const supplier = norm(businessState);
  const pos = norm(placeOfSupply);
  const applicable = determineTaxMode(supplier, pos);

  if (!applicable) {
    const missing = !supplier && !pos
      ? "Your business state and the place of supply are both missing"
      : `The ${!supplier ? "business state" : "place of supply"} is missing`;
    return {
      ok: true,
      level: "info",
      cannotDetermine: true,
      message: `${missing}, so the tax mode can't be verified automatically. It will be presented exactly as selected.`,
    };
  }
  if (applicable === mode) {
    return { ok: true, level: "ok", cannotDetermine: false, message: null };
  }
  return {
    ok: false,
    level: "warning",
    cannotDetermine: false,
    message: conflictMessage(mode, supplier, pos),
  };
}
