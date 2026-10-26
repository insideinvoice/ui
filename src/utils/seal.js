/**
 * Resolves the company seal/stamp preference for a document render.
 *
 * The value carried on the `business` object wins: it is server-provided and is
 * the ONLY source available on public share pages (/i/:token), which run in the
 * customer's browser and have none of the owner's localStorage. localStorage is
 * the fallback for the logged-in app and older payloads that predate the
 * server-stored preference.
 *
 * @returns {{ sealVisible: boolean, sealType: "round" | "stamp" }}
 */
export function resolveSeal(business) {
  const bizEnabled = business?.sealEnabled;
  const bizType = business?.sealType;

  const sealVisible =
    typeof bizEnabled === "boolean"
      ? bizEnabled
      : typeof window !== "undefined" && localStorage.getItem("show_seal") === "true";

  const sealType =
    typeof bizType === "string" && bizType
      ? bizType === "stamp"
        ? "stamp"
        : "round"
      : typeof window !== "undefined"
        ? localStorage.getItem("seal_type") || "round"
        : "round";

  return { sealVisible, sealType };
}

/**
 * Per-invoice seal override (V51): an invoice created through the API/PAT can
 * pin its own mark — "ROUND" / "STAMP" / "NONE" — which wins over the
 * business's Settings choice FOR THAT DOCUMENT ONLY. Applies the invoice's
 * choice on top of the business object templates read (`sealEnabled`,
 * `sealType`), so every renderer path (overlay, PDF spec, share payload)
 * flips together. A null/absent override returns the business untouched.
 */
export function applyInvoiceSeal(business, invoice) {
  const raw = invoice?.sealType;
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!value || value === "BUSINESS" || value === "DEFAULT") return business;
  if (!business) business = {};
  if (value === "NONE") return { ...business, sealEnabled: false };
  if (value !== "ROUND" && value !== "STAMP") return business;
  return { ...business, sealEnabled: true, sealType: value.toLowerCase() };
}
