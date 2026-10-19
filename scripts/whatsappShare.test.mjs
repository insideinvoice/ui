/**
 * Unit tests for WhatsApp share routing + the customer-facing message.
 * Runs with plain `node` (node:assert/strict):  npm run test:unit
 *
 * Covers the three production failures being fixed:
 *   1. the message (with the invoice link) must survive encodeURIComponent
 *      end-to-end on every target URL — never truncated by &, # or spaces,
 *   2. Android/iOS must deep-link into the app's recipient picker
 *      (whatsapp://send) with a universal api.whatsapp.com fallback,
 *   3. desktop must open WhatsApp Web's share screen (web.whatsapp.com/send),
 *      not a redirect hop that can drop the ?text= payload.
 */
import assert from "node:assert/strict";
import { buildInvoiceWhatsAppMessage, whatsappShareTargets } from "../src/utils/whatsappTargets.js";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPADOS_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

const SHARE_URL = "http://localhost:5173/i/CL2eOS8fBxrf0tk1TeQ6i4ss4eaLlYoOYCbLvP831mg";

// ── 1. the exact customer-facing message (invoice 129 copy) ────────────────
const msg = buildInvoiceWhatsAppMessage({
  customerName: "Rahul Sharma",
  invoiceNumber: "ADMIN-79",
  invoiceType: "TAX_INVOICE",
  total: "62245",
  businessName: "Gritx Technologies",
  shareUrl: SHARE_URL,
});
assert.equal(
  msg,
  "Hi Rahul Sharma,\n\nThank you for shopping with Gritx Technologies!\n\nTax Invoice ADMIN-79\nTotal Bill: Rs. 62,245.00\n\nView invoice online:\nhttp://localhost:5173/i/CL2eOS8fBxrf0tk1TeQ6i4ss4eaLlYoOYCbLvP831mg",
);

// Proforma label flips correctly, fallbacks for missing fields
const proforma = buildInvoiceWhatsAppMessage({
  invoiceNumber: "PI-1",
  invoiceType: "PROFORMA_INVOICE",
  total: "1000.5",
});
assert.ok(proforma.includes("Proforma Invoice PI-1"));
assert.ok(proforma.includes("Total Bill: Rs. 1,000.50"));
assert.ok(proforma.startsWith("Hello,"));
assert.ok(!proforma.includes("undefined")); // nothing leaks JS undefined

// ── 2. encoding round-trip: full message + link survive ?text= ─────────────
const platforms = [
  // Android: primary deep link + universal fallback both carry the message
  { label: "android", ua: ANDROID, primaryPrefix: "whatsapp://send?text=", fallbackPrefix: "https://api.whatsapp.com/send?text=" },
  // Desktop: WhatsApp Web target carries the message
  { label: "desktop", ua: WINDOWS, primaryPrefix: "https://web.whatsapp.com/send?text=" },
];
for (const text of [
  msg,
  "a&b=c#d 100% great",
  "Hi राहुल,\nView invoice online: https://kiosk.example/i/tok?ref=mail&type=PROFORMA_INVOICE",
  "plus+space/slash:colon?q=u&x=y",
]) {
  for (const p of platforms) {
    const kind = whatsappShareTargets({ text, userAgent: p.ua });
    assert.ok(kind.primary.startsWith(p.primaryPrefix), `${p.label}: primary must embed the text`);
    assert.equal(
      decodeURIComponent(kind.primary.slice(p.primaryPrefix.length)),
      text,
      `${p.label}: primary round-trip failed`,
    );
    if (p.fallbackPrefix) {
      assert.ok(kind.fallback.startsWith(p.fallbackPrefix), `${p.label}: fallback must embed the text`);
      assert.equal(
        decodeURIComponent(kind.fallback.slice(p.fallbackPrefix.length)),
        text,
        `${p.label}: fallback round-trip failed`,
      );
    }
  }
}

// ── 3. routing matrix ───────────────────────────────────────────────────────
// Android + iPhone → app deep link, universal fallback, same-tab
const android = whatsappShareTargets({ text: msg, userAgent: ANDROID });
assert.equal(android.isMobile, true);
assert.equal(android.primary, `whatsapp://send?text=${encodeURIComponent(msg)}`);
assert.equal(android.fallback, `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
assert.ok(android.fallbackDelayMs >= 800 && android.fallbackDelayMs <= 2500);
assert.equal(android.newTab, false);

const iphone = whatsappShareTargets({ text: msg, userAgent: IPHONE });
assert.equal(iphone.isMobile, true);
assert.equal(iphone.primary, `whatsapp://send?text=${encodeURIComponent(msg)}`);

// iPadOS masquerading as desktop Safari (touch give-away)
const ipad = whatsappShareTargets({ text: msg, userAgent: IPADOS_DESKTOP_UA, maxTouchPoints: 5 });
assert.equal(ipad.isMobile, true);
assert.equal(ipad.primary, `whatsapp://send?text=${encodeURIComponent(msg)}`);

// True desktops → WhatsApp Web share screen, new tab, NO other hop
const win = whatsappShareTargets({ text: msg, userAgent: WINDOWS, maxTouchPoints: 0 });
assert.equal(win.isMobile, false);
assert.equal(win.primary, `https://web.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
assert.equal(win.fallback, null);
assert.equal(win.newTab, true);

const mac = whatsappShareTargets({ text: msg, userAgent: MAC_SAFARI, maxTouchPoints: 0 });
assert.equal(mac.isMobile, false);
assert.equal(mac.primary, `https://web.whatsapp.com/send?text=${encodeURIComponent(msg)}`);

// A Mac with <=1 touch point stays desktop; trackpad-press does not flip it
assert.equal(whatsappShareTargets({ text: msg, userAgent: MAC_SAFARI, maxTouchPoints: 1 }).isMobile, false);

// ── 4. empty-text safety (outlets that share without a message) ────────────
assert.equal(whatsappShareTargets({ text: "", userAgent: WINDOWS }).primary, "https://web.whatsapp.com/");
assert.equal(whatsappShareTargets({ text: "", userAgent: ANDROID }).primary, "whatsapp://send");
assert.equal(
  whatsappShareTargets({ text: "", userAgent: ANDROID }).fallback,
  "https://api.whatsapp.com/send",
);

console.log("✓ whatsappShare: message template, encoding round-trips, routing matrix — all pass");
