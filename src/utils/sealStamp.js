/**
 * Pure millimetre geometry for stamping the seal onto a generated PDF page.
 *
 * Deliberately free of DOM/jsPDF/JSX imports so the placement rules can be
 * unit-tested (scripts/sealStamp.test.mjs). This is the maths that decides
 * whether a printed mark lands where the owner placed it in Settings or gets
 * half-cut by the page edge.
 */

/**
 * Origin (millimetres from the paper's top-left) for one page's seal.
 *
 * The gaps `rightMm`/`bottomMm` are the ones SealOverlay uses on screen:
 * measured from the invoice's CONTENT FRAME, not the paper's edges. `frame`
 * mirrors what buildInvoicePdf collected while slicing the capture into pages:
 *   right  — the frame's right edge in mm from the paper's left
 *   bottom — THIS page's content bottom in mm from the paper's top
 * A missing frame value falls back to the matching paper edge (the legacy
 * behaviour, still used by callers that stamp without frame geometry).
 *
 * The result is clamped inside the sheet, so the whole seal always prints: a
 * degenerate frame can shift the mark, but can never push it off the page
 * where the printer would cut it in half.
 *
 * @param {{rightMm: number, bottomMm: number}} gaps stored seal gaps
 * @param {{w: number, h: number}} box seal footprint in mm
 * @param {{right?: number, bottom?: number} | null | undefined} frame
 * @param {number} pageWidth paper width in mm
 * @param {number} pageHeight paper height in mm
 * @returns {{x: number, y: number}}
 */
export function sealStampOrigin(gaps, box, frame, pageWidth, pageHeight) {
  const clamp = (value, max) => Math.min(Math.max(value, 0), Math.max(0, max));
  const rightEdge = Number.isFinite(frame?.right) ? frame.right : pageWidth;
  const bottom = Number.isFinite(frame?.bottom) ? frame.bottom : pageHeight;
  return {
    x: clamp(rightEdge - gaps.rightMm - box.w, pageWidth - box.w),
    y: clamp(bottom - gaps.bottomMm - box.h, pageHeight - box.h),
  };
}
