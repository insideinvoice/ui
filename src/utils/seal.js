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
