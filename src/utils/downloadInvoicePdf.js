let warmed = null;

/**
 * Fetch the heavy PDF chunk (jspdf + html2canvas) during idle time so the
 * first download click doesn't pay the network + parse cost on top of the
 * capture itself. Safe to call repeatedly — one shared import.
 */
export function preloadInvoicePdf() {
  if (!warmed) {
    warmed = import("./invoicePdf").catch(() => {
      warmed = null; // allow retry on the next call / actual download
    });
  }
  return warmed;
}

export async function downloadInvoicePDF(element, filename, paperSizeId) {
  if (!element) return;
  try {
    const { buildInvoicePdf } = await import("./invoicePdf");
    const pdf = await buildInvoicePdf(element, paperSizeId);

    if (filename === null) {
      return pdf.output("bloburl");
    }
    pdf.save(filename);
  } catch (err) {
    console.error("PDF generation error:", err);
    throw err;
  }
}
