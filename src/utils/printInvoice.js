export async function processPrint(invoiceRef, documentType, filename, paperSizeId) {
  const { downloadInvoicePDF } = await import("./downloadInvoicePdf");
  await downloadInvoicePDF(invoiceRef.current, filename, paperSizeId);
}
