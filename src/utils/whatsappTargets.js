/**
 * Pure WhatsApp share-target computation + the invoice share message builder.
 * No browser globals, no side effects — everything here is unit-testable with
 * plain node (scripts/whatsappShare.test.mjs, `npm run test:unit`).
 *
 * The legacy "universal" entry points (wa.me, api.whatsapp.com) hop through
 * WhatsApp's servers first: on a bad day that hop lands on the download page
 * or on the chat list with the ?text= payload dropped ("WhatsApp opens but the
 * message is gone"). The per-platform targets below skip that hop entirely:
 *   - Android + iOS register the whatsapp:// scheme, so `whatsapp://send?text=`
 *     deep-links straight into the app's "send to…" recipient picker with the
 *     message already attached — one tap away from picking the contact.
 *   - web.whatsapp.com/send?text= serves the same picker (web edition) to
 *     desktop browsers, where people chat from WhatsApp Web.
 */

/** Exactly the text the customer receives in the chat. */
export function buildInvoiceWhatsAppMessage({ customerName, invoiceNumber, invoiceType, total, businessName, shareUrl }) {
  const name = customerName?.trim() || "";
  const label = invoiceType === "PROFORMA_INVOICE" ? "Proforma Invoice" : "Tax Invoice";
  const invNo = invoiceNumber?.trim() || "";
  const amount = parseFloat(total);
  const totalStr = !isNaN(amount) && amount >= 0
    ? `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "";
  const biz = businessName?.trim() || "";

  const lines = [];
  if (name) {
    lines.push(`Hi ${name},`, "");
  } else {
    lines.push("Hello,", "");
  }
  if (biz) {
    lines.push(`Thank you for shopping with ${biz}!`, "");
  } else {
    lines.push("Thank you for shopping with us!", "");
  }
  const invLine = invNo ? `${label} ${invNo}` : label;
  lines.push(invLine);
  if (totalStr) {
    lines.push(`Total Bill: ${totalStr}`);
  }
  if (shareUrl) {
    lines.push("", `View invoice online:`, shareUrl);
  }
  return lines.join("\n");
}

/**
 * Picks the deep-link targets for sharing `text` on WhatsApp.
 *
 * @param {object} argv
 * @param {string} [argv.text]           prebuilt share message
 * @param {string} [argv.userAgent]       navigator.userAgent
 * @param {number} [argv.maxTouchPoints]  navigator.maxTouchPoints (iPads spoof
 *   desktop Safari since iPadOS 13 — touch is the only tell)
 * @returns {{ isMobile: boolean, primary: string, fallback: string|null,
 *            fallbackDelayMs: number, newTab: boolean }}
 */
export function whatsappShareTargets({ text = "", userAgent = "", maxTouchPoints = 0 } = {}) {
  const encoded = encodeURIComponent(text);
  const withText = (base) => (text ? `${base}?text=${encoded}` : base);
  const ua = userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua)
    || (/Macintosh/.test(ua) && Number(maxTouchPoints) > 1);

  if (isMobile) {
    return {
      isMobile,
      // Deep link directly into the installed app's recipient picker.
      primary: withText("whatsapp://send"),
      // App missing / scheme swallowed: the universal server link still
      // reaches the app (or WhatsApp Web) with the same message.
      fallback: withText("https://api.whatsapp.com/send"),
      fallbackDelayMs: 1200,
      newTab: false,
    };
  }
  return {
    isMobile,
    // WhatsApp Web's own share screen, opened in a new tab.
    primary: text ? `https://web.whatsapp.com/send?text=${encoded}` : "https://web.whatsapp.com/",
    fallback: null,
    fallbackDelayMs: 0,
    newTab: true,
  };
}
