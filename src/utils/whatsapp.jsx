import toast from "react-hot-toast";

export function buildInvoiceWhatsAppMessage({ customerName, invoiceNumber, invoiceType, total, businessName, shareUrl }) {
  const label = invoiceType === "PROFORMA_INVOICE" ? "Proforma Invoice" : "Tax Invoice";
  let text = `${label}${invoiceNumber ? ` ${invoiceNumber}` : ""}`;
  const amount = parseFloat(total);
  if (!isNaN(amount) && amount > 0) {
    text += ` - Total: Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (shareUrl) {
    text += `\n\nView invoice online: ${shareUrl}`;
  }
  if (customerName) text = `Hello ${customerName},\n\n${text}`;
  if (businessName) text += `\n\n- ${businessName}`;
  return text;
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
function probeFileShare() {
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