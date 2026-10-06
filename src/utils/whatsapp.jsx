import toast from "react-hot-toast";

export function buildInvoiceWhatsAppMessage({ customerName, invoiceNumber, invoiceType, total, businessName }) {
  const label = invoiceType === "PROFORMA_INVOICE" ? "Proforma Invoice" : "Tax Invoice";
  let text = `${label}${invoiceNumber ? ` ${invoiceNumber}` : ""}`;
  const amount = parseFloat(total);
  if (!isNaN(amount) && amount > 0) {
    text += ` - Total: Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function saveFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name || "invoice.pdf";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function canShareFiles(files) {
  try {
    return !!(navigator.canShare && navigator.canShare({ files }));
  } catch {
    return false;
  }
}

export async function openWhatsApp({ text, getPdfFile } = {}) {
  // 1. Generate the invoice PDF first — it must be in hand before we can hand
  //    it over to WhatsApp (the icon spinner covers this ~1-2s).
  let file = null;
  try {
    file = getPdfFile ? await getPdfFile() : null;
  } catch {
    file = null;
  }
  if (getPdfFile && !file) {
    toast.error("Could not generate the invoice PDF");
    return false;
  }

  // 2. Preferred: the OS share sheet carrying the PDF + the message. Choosing
  //    WhatsApp there opens its contact picker with the document already
  //    attached and the message as the caption — a deep link can carry text but
  //    never a file, so this is the only way to attach it.
  if (file && navigator.share && canShareFiles([file])) {
    try {
      await navigator.share({ files: [file], text: text || "", title: file.name });
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return true;
      // Activation ran out, or sharing is blocked here → try the next tier.
    }
  }

  // 3. No file sharing on this browser (older Safari, Firefox, an insecure
  //    origin such as http://<lan-ip>:5173). Still open the share sheet so the
  //    user can pick WhatsApp and get the message, rather than silently saving
  //    a file and leaving them to wonder what happened.
  if (navigator.share) {
    try {
      await navigator.share({ text: text || "", title: file ? file.name : "Invoice" });
      if (file) saveFile(file);
      toast.success("Message ready — tap 📎 in the chat to attach the PDF", { duration: 7000 });
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return true;
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
  if (file) {
    saveFile(file);
    toast.success("Invoice PDF saved — tap 📎 in the chat to attach it", { duration: 8000 });
  }
  return true;
}