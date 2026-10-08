import html2canvas from "../vendor/html2canvas.esm.js";
import { jsPDF } from "jspdf";
import { getPaperDimensions } from "../constants/paperSizes";

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
  "#section-bottom-note",
  // Retro renders fixed repeat pages; cut between them and never inside one.
  '[id^="retro-page-"]',
  '[id^="retro-item-"]',
];

// Measure every page-break anchor and the invoice box in one synchronous
// pass, BEFORE html2canvas runs. Measuring after the async capture lets any
// scroll/layout change shift the cut points mid-flight, which is how a page
// boundary ends up inside the seal or an item row.
function collectGeometry(element) {
  const invoiceRect = element.getBoundingClientRect();
  const rowEls = Array.from(element.querySelectorAll(INVOICE_ROW_SELECTORS.join(", ")));
  const rects = rowEls.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: Math.floor((r.top - invoiceRect.top) * 2),
      bottom: Math.ceil((r.bottom - invoiceRect.top) * 2),
    };
  });
  return { rects };
}

// Rasterize the invoice and slice it into pages, cutting only on section
// boundaries so blocks (item rows, totals, the seal/stamp footer) stay whole.
// A block that does not fit moves entirely to the next page.
export async function buildInvoicePdf(element, paperSizeId, fit = 1) {
  const dim = getPaperDimensions(paperSizeId);
  const SCALE = 2;
  const CONTENT_W = dim.contentW * fit;
  const LEFT = dim.left + (dim.contentW - CONTENT_W) / 2;
  const PAGE_H = dim.usableH;

  const { rects } = collectGeometry(element);

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
    });
  } finally {
    window.__II_H2C_ASCENT_FIX = false;
  }

  const pdf = new jsPDF(dim.orientation, "mm", dim.format);
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

    pdf.addImage(
      sliceCanvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      LEFT,
      10,
      CONTENT_W,
      sliceHeightMM
    );

    pageStartPx = pageEndPx;
    isFirstPage = false;
  }

  return pdf;
}
