import html2canvas from "../vendor/html2canvas.esm.js";
import { jsPDF } from "jspdf";
import { getPaperDimensions } from "../constants/paperSizes";
import { stampSealOnEveryPage } from "./sealPdf";

// Sections that must never be cut in half (item rows, totals, footer, seal).
export const INVOICE_ROW_SELECTORS = [
  '[id^="section-item-row-"]',
  '[id^="section-hsn-row-"]',
  "#section-subtotals",
  "#section-amount-words",
  "#section-hsn-header",
  "#section-hsn-total",
  "#section-hsn-words",
  "#section-footer",
  // Tail of the document: the full-width Terms strip and the jurisdiction line
  // sit between the bank/declaration/signature band and the bottom note, so
  // they need to be anchors or the only cuts available skip straight past them
  // and a page break can land mid-strip.
  "#section-terms",
  "#section-jurisdiction",
  "#section-bottom-note",
  // Retro renders fixed repeat pages; cut between them and never inside one.
  '[id^="retro-page-"]',
  '[id^="retro-item-"]',
  // Enterprise: same fixed-page contract — frames cut exactly, item rows keep
  // each page's table lines closed before the cut point.
  '[id^="ent-page-"]',
  '[id^="ent-item-"]',
];

// Measure every page-break anchor and the invoice box in one synchronous
// pass, BEFORE html2canvas runs. Measuring after the async capture lets any
// scroll/layout change shift the cut points mid-flight, which is how a page
// boundary ends up inside the seal or an item row. `scale` is the capture
// scale about to be used, so each CSS-pixel boundary lands on its exact
// raster row — the cut points and the canvas share one coordinate system.
function collectGeometry(element, scale) {
  const invoiceRect = element.getBoundingClientRect();
  // Enterprise frames ARE the pages: each ent-page-* frame is one logical
  // invoice page with its own header/footer. Cutting anywhere else (item-row
  // boundaries) would merge two frames onto one sheet or split a frame in
  // half, so when frames exist they are the only anchors that count.
  const hasEntFrames = element.querySelector('[id^="ent-page-"]') != null;
  const selector = hasEntFrames ? '[id^="ent-page-"]' : INVOICE_ROW_SELECTORS.join(", ");
  const rowEls = Array.from(element.querySelectorAll(selector));
  const rects = rowEls.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: Math.floor((r.top - invoiceRect.top) * scale),
      bottom: Math.ceil((r.bottom - invoiceRect.top) * scale),
    };
  });
  return { rects };
}

// A document that overflows a single page by only a hair (a footer note that
// lands 13mm past the edge) is far worse UX than type set a few percent
// smaller, so near-misses are scaled down to one page instead of paginated.
// Anything longer than this floor still paginates on section boundaries.
const FIT_TO_PAGE_FLOOR = 0.92;

// Rasterize the invoice and slice it into pages, cutting only on section
// boundaries so blocks (item rows, totals, the seal/stamp footer) stay whole.
// A block that does not fit moves entirely to the next page.

// Print-grade capture: ~300 DPI against the 190mm A4 content box, so hairlines
// and type are crisp on paper and in zoomed viewers. The scale is derived ONLY
// from the document's own pixel size — never from the device's DPR or screen —
// so a phone and a laptop produce the same resolution: one invoice, one PDF,
// everywhere. The area cap keeps tall invoices inside the canvas limits of
// older iOS (≈16.7 Mpx); below it the capture degrades to the old 2× rather
// than failing outright.
const TARGET_CAPTURE_SCALE = 3;
const MIN_CAPTURE_SCALE = 2;
const MAX_CAPTURE_AREA = 16_000_000;

export async function buildInvoicePdf(element, paperSizeId, fit = 1) {
  const dim = getPaperDimensions(paperSizeId);
  const PAGE_H = dim.usableH;

  const elRect = element.getBoundingClientRect();
  const natW = element.offsetWidth || elRect.width;
  const natH = element.offsetHeight || elRect.height;
  const areaScale = natW * natH > 0 ? Math.sqrt(MAX_CAPTURE_AREA / (natW * natH)) : TARGET_CAPTURE_SCALE;
  const SCALE = Math.min(TARGET_CAPTURE_SCALE, Math.max(MIN_CAPTURE_SCALE, areaScale));

  const { rects } = collectGeometry(element, SCALE);

  // Opt into the line-height-independent font baseline: without it
  // html2canvas paints every text run ~6px too low on a Tailwind page
  // (line-height 1.5) and the overflow:hidden boxes clip the glyphs.
  window.__II_H2C_ASCENT_FIX = true;
  let canvas;
  try {
    canvas = await html2canvas(element, {
      scale: SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      // The on-screen seal is a placement preview. The PDF gets its own copy
      // stamped onto every page (configured size/tilt/edge offsets), so the
      // preview must not be baked into the captured raster.
      ignoreElements: (node) => node?.classList?.contains?.("ii-seal-dom"),
    });
  } finally {
    window.__II_H2C_ASCENT_FIX = false;
  }

  // `fit` only scales the placed raster, so the shrink decision can be made
  // after the single capture instead of paying for a second one.
  const naturalH = (canvas.height * dim.contentW * fit) / canvas.width;
  let effectiveFit = fit;
  if (naturalH > PAGE_H) {
    const needed = (fit * PAGE_H) / naturalH;
    // 0.5% slack so onePagePx lands just past the last pixel and the slice
    // loop cannot pick a section boundary short of the bottom.
    if (needed * 0.995 >= FIT_TO_PAGE_FLOOR) effectiveFit = needed * 0.995;
  }

  const pdf = new jsPDF(dim.orientation, "mm", dim.format);
  const CONTENT_W = dim.contentW * effectiveFit;
  const LEFT = dim.left + (dim.contentW - CONTENT_W) / 2;
  const pxToMm = CONTENT_W / canvas.width;
  const onePagePx = PAGE_H / pxToMm;

  // Reconcile measured geometry with the captured raster: if layout shifted
  // during the async capture, out-of-range or inverted rects are dropped and
  // the rest clamped so no cut point can ever fall outside the image.
  const H = canvas.height;
  const safeCuts = new Set([0, H]);
  rects.forEach((r) => {
    const top = Math.max(0, Math.min(r.top, H));
    const bottom = Math.max(0, Math.min(r.bottom, H));
    if (bottom > top) {
      safeCuts.add(top);
      safeCuts.add(bottom);
    }
  });
  const cutPoints = [...safeCuts].sort((a, b) => a - b);

  let pageStartPx = 0;
  let isFirstPage = true;

  while (pageStartPx < canvas.height) {
    const pageEndLimit = pageStartPx + onePagePx;

    let pageEndPx = null;
    for (const cut of cutPoints) {
      if (cut > pageStartPx && cut <= pageEndLimit) {
        pageEndPx = cut;
      }
    }

    if (!pageEndPx) {
      // No section boundary fits in the remaining space: end the page at the
      // next boundary anyway so the block is never split across pages.
      pageEndPx = cutPoints.find((cut) => cut > pageStartPx) || H;
    }
    pageEndPx = Math.min(pageEndPx, H);

    const sliceHeightPx = pageEndPx - pageStartPx;
    if (sliceHeightPx <= 0) break;
    const sliceHeightMM = sliceHeightPx * pxToMm;

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;

    const ctx = sliceCanvas.getContext("2d");
    ctx.drawImage(
      canvas,
      0,
      pageStartPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx
    );

    if (!isFirstPage) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, 2);
      pdf.addPage();
    }
    // Close the bottom of every non-final page with a rule so item columns
    // never run open across a page break, even for borderless templates.
    if (pageEndPx < H) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, sliceHeightPx - 2, canvas.width, 2);
    }

    // Maximum-quality JPEG. Lossless PNG was measured here and rejected on
    // evidence: the browser encodes this capture to a compact 559 KB PNG, but
    // jsPDF re-encodes it (alpha split + its own deflate) into a 17 MB page.
    // JPEG at quality 1.0 passes through verbatim — 767 KB final — and at the
    // 300-DPI capture resolution its DCT artifacts sit far below one screen
    // pixel, so the page on paper is visually the page on screen.
    pdf.addImage(
      sliceCanvas.toDataURL("image/jpeg", 1.0),
      "JPEG",
      LEFT,
      10,
      CONTENT_W,
      sliceHeightMM
    );

    pageStartPx = pageEndPx;
    isFirstPage = false;
  }

  // Every page gets the seal at the configured size/tilt, anchored to the
  // paper's right/bottom edge — not just the last page's footer.
  await stampSealOnEveryPage(pdf, element);

  return pdf;
}
