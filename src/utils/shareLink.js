import toast from "react-hot-toast";

/**
 * Hands a share URL to the user: the OS share sheet where the browser has one (mobile →
 * pick WhatsApp, mail, notes, …) and the clipboard everywhere else.
 *
 * Cancelling the sheet does nothing — a copy must never happen behind the user's back.
 * A share attempt that fails for any other reason (expired user activation, blocked
 * permission) falls back to copying so the link still leaves the device.
 *
 * @returns {Promise<boolean>} true when the URL was handed off (shared or copied).
 */
export async function shareLinkToUser({
  url,
  title = "Invoice",
  copyMessage = "Share link copied to clipboard",
}) {
  if (!url) return false;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
      return true;
    } catch (err) {
      if (err?.name === "AbortError") return true; // user closed the share sheet
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.success(copyMessage);
    return true;
  } catch {
    toast(`Share link: ${url}`, { duration: 8000 });
    return false;
  }
}

/** Public URL for the proforma document rendered from an invoice's existing share link. */
export function proformaShareUrl(shareUrl) {
  if (!shareUrl) return "";
  return `${shareUrl}${shareUrl.includes("?") ? "&" : "?"}type=PROFORMA_INVOICE`;
}
