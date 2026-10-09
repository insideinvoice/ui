import toast from "react-hot-toast";

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

// Opens WhatsApp with a prefilled message and opens the contact-picker ("send
// to…") screen. Callers reach this only AFTER async work (save + share-token
// fetch), so the browser's "transient activation" for navigator.share() has often
// already expired — share() then rejects and the old wa.me fallback landed on
// WhatsApp's chat list with the text dropped. To make that impossible:
//   1. the message is always copied to the clipboard first (paste as a fallback),
//   2. navigator.share({ text }) is tried so picking WhatsApp opens its contact
//      picker with the message filled in,
//   3. otherwise we deep-link to api.whatsapp.com/send?text= via a fresh
//      navigation (anchor click), which carries the prefilled text reliably on
//      both iOS and Android.
export async function openWhatsAppChat(text) {
  const message = text || "";
  const encoded = encodeURIComponent(message);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent);

  // 1. Always copy the message so it survives even if every opener below is
  //    blocked or WhatsApp drops it.
  if (message && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      /* clipboard unavailable (insecure context / permission) — ignore */
    }
  }

  // 2. Prefer the OS share sheet: choosing WhatsApp there opens its
  //    contact-picker with the message already filled in.
  if (isMobile && navigator.share) {
    try {
      await navigator.share({ text: message, title: "Invoice" });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // user closed the sheet — do nothing
      // Share blocked / activation expired → fall through to the deep link.
    }
  }

  // 3. Reliable deep link: api.whatsapp.com/send?text= opens the app with the
  //    message prefilled (contact picker on mobile, direct chat on desktop).
  const url = message
    ? `https://api.whatsapp.com/send?text=${encoded}`
    : "https://api.whatsapp.com/";
  const opened = window.open(url, "_blank");
  if (!opened) {
    // Popup blocked — navigate this tab instead.
    window.location.href = url;
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
    const { downloadInvoicePDF } = await import("../components/InvoicePDF");
    const url = await downloadInvoicePDF(element, null, paperSizeId);
    if (!url) return null;
    const blob = await (await fetch(url)).blob();
    URL.revokeObjectURL(url);
    return new File([blob], filename, { type: "application/pdf" });
  } catch {
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