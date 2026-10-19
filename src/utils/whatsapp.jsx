import toast from "react-hot-toast";
import { whatsappShareTargets } from "./whatsappTargets";

export { buildInvoiceWhatsAppMessage } from "./whatsappTargets";

// Opens WHATSAPP ITSELF — never the OS share sheet — straight onto the app's
// own recipient-picker ("send to…") screen with the message attached:
//   • Android/iOS → `whatsapp://send?text=` deep-links into the installed app,
//     landing directly on its pick-a-contact screen (select contact → send).
//   • Desktop     → WhatsApp Web's share screen in a new tab, same message.
// The message MUST survive every hop, so:
//   1. the whole text is encodeURIComponent-ed — the invoice link can never
//      be cut apart by &, # or spaces on any browser,
//   2. NOTHING is awaited before navigating: the old clipboard-only await
//      borrowed time from the tap's user-gesture window and got the popup
//      blocked ("WhatsApp never opens"). The clipboard copy now runs detached
//      as a silent paste-fallback,
//   3. when the app is missing the scheme does nothing, so the universal
//      api.whatsapp.com link fires after a short still-visible check.
export async function openWhatsAppChat(text) {
  const message = text || "";
  const targets = whatsappShareTargets({
    text: message,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints || 0,
  });

  if (message && navigator.clipboard?.writeText) {
    Promise.resolve(navigator.clipboard.writeText(message)).catch(() => {
      /* insecure context / permission denied — the deep link still carries the text */
    });
  }

  if (targets.isMobile) {
    window.location.href = targets.primary;
    setTimeout(() => {
      // document.hidden = the app took over (or the tab already navigated) —
      // never hijack it back to the web flow in that case.
      if (!document.hidden && targets.fallback) window.location.href = targets.fallback;
    }, targets.fallbackDelayMs);
    return;
  }

  const opened = window.open(targets.primary, "_blank", "noopener,noreferrer");
  if (!opened) {
    // Popup blocked — same-tab navigation cannot be blocked.
    window.location.href = targets.primary;
  }
}

// navigator.share() only works while the click that triggered it is still a
// "transient activation" (~5s in Chrome). The first share on a page also has to
// fetch the ~600 kB html2canvas/jsPDF chunk, which is enough to blow that window
// and make share() reject with NotAllowedError. Pulling the chunk in early keeps
// the click -> share window short.
let warmed = null;
export function prefetchInvoicePdf() {
  if (!warmed) {
    warmed = Promise.allSettled([
      import("../components/InvoicePDF"),
      import("jspdf"),
      import("../vendor/html2canvas.esm.js"),
    ]);
  }
  return warmed;
}

export async function createInvoicePdfFile(element, paperSizeId, filename) {
  if (!element) return null;
  try {
    const { downloadInvoicePDF } = await import("./downloadInvoicePdf");
    const url = await downloadInvoicePDF(element, null, paperSizeId);
    if (!url) return null;
    const blob = await (await fetch(url)).blob();
    URL.revokeObjectURL(url);
    return new File([blob], filename, { type: "application/pdf" });
  } catch (err) {
    console.error("createInvoicePdfFile failed:", err);
    return null;
  }
}

// Cheap pre-check with a throwaway file: browsers that cannot hand files to the
// OS share sheet fail here, so we never generate a PDF that cannot be attached.
export function probeFileShare() {
  try {
    if (!navigator.share || !navigator.canShare) return false;
    const probe = new File([new Blob([" "], { type: "application/pdf" })], "probe.pdf", { type: "application/pdf" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function openWhatsApp({ text, getPdfFile } = {}) {
  // 1. Generate the invoice PDF only when this browser can actually attach it.
  const fileShareLikely = probeFileShare();
  let file = null;
  if (fileShareLikely && getPdfFile) {
    try {
      file = await getPdfFile();
    } catch {
      file = null;
    }
    if (!file) {
      toast.error("Could not generate the invoice PDF");
      return false;
    }
  }

  // 2. Preferred: the OS share sheet carrying the PDF + the message. Choosing
  //    WhatsApp there opens its contact picker with the document already
  //    attached and the message as the caption — a deep link can carry text but
  //    never a file, so this is the only way to attach it.
  //    Cancelling the sheet must do nothing: NO automatic download, ever.
  if (file) {
    try {
      await navigator.share({ files: [file], text: text || "", title: file.name });
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return true; // user cancelled
      // Activation ran out, or sharing is blocked here → try the next tier.
    }
  }

  // 3. No file attachment possible here: still open the share sheet so the user
  //    can pick an app and send the message (with the share link when present).
  //    The PDF is deliberately NOT saved/downloaded behind their back — the
  //    Share sheet's explicit "Download PDF" button is the only way to save it.
  if (navigator.share) {
    try {
      await navigator.share({ text: text || "", title: "Invoice" });
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return true; // user cancelled
    }
  }

  // 4. Last resort: wa.me works on desktop (WhatsApp Web) and mobile (the app),
  //    unlike the whatsapp:// scheme which desktop browsers cannot resolve.
  const url = text ? `https://wa.me/?text=${encodeURIComponent(text)}` : "https://wa.me/";
  try {
    window.location.href = url;
  } catch {
    /* the browser handles the navigation */
  }
  if (!(text || "").includes("/i/")) {
    // No share link in the message and no file attached — point the user at the
    // right buttons instead of silently producing a file.
    toast("Tip: use Share → Copy link to send a link they can open online", { icon: "🔗", duration: 6000 });
  }
  return true;
}