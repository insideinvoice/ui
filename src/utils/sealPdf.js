import { sealSvgMarkup } from "./sealSvg";
import { sealBoxMm } from "./sealConfig";
import { sealStampOrigin } from "./sealStamp";
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
 * Position is measured in millimetres from the invoice's CONTENT FRAME — the
 * same box the on-screen overlay and the shared invoice link anchor to — so
 * what the owner places in Settings is what prints: over/near the signature
 * band, never drifting toward the paper edge and into the printer's
 * non-printable margin (the old paper-edge maths is what half-cut the mark).
 *
 * `frame` carries the geometry collected while slicing the pages:
 *   right   — frame's right edge in mm from the paper's left
 *   bottoms — per-page frame bottom in mm from the paper's top
 * Callers without a frame keep the legacy paper-edge fallback.
 *
 * With multi-page OFF the seal is stamped only on the LAST page — the one that
 * carries the grand total and the signature band. A seal on the cover page of a
 * multi-page invoice is meaningless, so the mark follows the money.
 */
export async function stampSealOnEveryPage(pdf, element, frame) {
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

  const pages = pdf.getNumberOfPages();
  // Multi-page is the default. When the owner turns it off, only the final
  // page (grand total + signature) carries the mark.
  const firstStamped = spec.allPages === false ? Math.max(1, pages) : 1;
  for (let page = firstStamped; page <= pages; page += 1) {
    // sealStampOrigin does the frame-relative maths (and clamps the result
    // inside the sheet): horizontal anchor from the frame's right edge,
    // vertical anchor from THIS page's content bottom — so every stamped page
    // hangs the mark at the same spot relative to its content, and a
    // degenerate frame can shift the seal but never push it off the page.
    const { x, y } = sealStampOrigin(
      spec,
      box,
      { right: frame?.right, bottom: frame?.bottoms?.[page - 1] },
      pageWidth,
      pageHeight
    );
    pdf.setPage(page);
    pdf.addImage(png, "PNG", x, y, box.w, box.h);
  }
  return pdf;
}
