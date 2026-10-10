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
