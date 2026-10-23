import { sealSvgMarkup } from "./sealSvg";
import { sealBoxMm } from "./sealConfig";
import { svgToPngDataUrl } from "./deliveryChallanPdf";

/** Reads the document's embedded seal description (see sealSpecFor). */
export function readSealSpec(element) {
  if (!element) return null;
  const node = element.matches?.("[data-ii-seal-spec]")
    ? element
    : element.querySelector?.("[data-ii-seal-spec]");
  if (!node) return null;
  const raw = node.getAttribute("data-ii-seal-spec");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Stamps the configured seal/stamp onto the invoice's jsPDF.
 *
 * Position is measured in millimetres from the page's right/bottom edge, so a
 * 4-page invoice gets the same hand-stamped mark at the same spot on every
 * page, and changing paper size keeps the seal anchored to the paper edge
 * rather than drifting.
 *
 * With multi-page OFF the seal is stamped only on the LAST page — the one that
 * carries the grand total and the signature band. A seal on the cover page of a
 * multi-page invoice is meaningless, so the mark follows the money.
 */
export async function stampSealOnEveryPage(pdf, element) {
  const spec = readSealSpec(element);
  if (!spec?.enabled) return pdf;

  const type = spec.type === "stamp" ? "stamp" : "round";
  const box = sealBoxMm(type, spec);
  // Raster width follows the configured physical size at ~300 DPI (12 px/mm),
  // with a 512 px floor so a small seal still has crisp ring text.
  const pxWidth = Math.min(2400, Math.max(512, Math.round(box.w * 12)));
  const pxHeight = Math.max(1, Math.round((pxWidth * box.h) / box.w));
  const png = await svgToPngDataUrl(sealSvgMarkup({ ...spec, type }), pxWidth, pxHeight);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const x = pageWidth - spec.rightMm - box.w;
  const y = pageHeight - spec.bottomMm - box.h;

  const pages = pdf.getNumberOfPages();
  // Multi-page is the default. When the owner turns it off, only the final
  // page (grand total + signature) carries the mark.
  const firstStamped = spec.allPages === false ? Math.max(1, pages) : 1;
  for (let page = firstStamped; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.addImage(png, "PNG", x, y, box.w, box.h);
  }
  return pdf;
}
