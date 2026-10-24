import html2canvas from "../vendor/html2canvas.esm.js";
import { jsPDF } from "jspdf";
import { getPaperDimensions } from "../constants/paperSizes";

// Delivery challan pages are pre-chunked by the caller so every page element
// is exactly one A4 content page. Each element is captured and placed as its
// own PDF page; a safety slice still runs if an element ever overflows one
// page so a row/box can never be silently cut without a page rule.
export const DC_ITEMS_PER_PAGE = 20;
export const DC_PAGE_W = 714;
export const DC_PAGE_H = 1040;

export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

export function fmtQty(qty) {
  const n = parseFloat(qty);
  return Number.isNaN(n) ? String(qty ?? "") : String(n);
}

export function panFromGstin(gstin) {
  return gstin && gstin.length >= 12 ? gstin.substring(2, 12) : "";
}

export function chunkDcItems(items, perPage = DC_ITEMS_PER_PAGE) {
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages.length ? pages : [[]];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

// `h` defaults to `w` (the round seal is square); the rectangular rubber
// stamp passes its own height so the raster keeps the 2.5:1 aspect.
export async function svgToPngDataUrl(svg, w = 512, h = w) {
  const img = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  );
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

export async function buildDeliveryChallanPdf(pageElements, options = {}) {
  const {
    stampSvg = null,
    stampSizeMm = 26,
    // rectangular rubber stamp: width/height in mm (default = square seal)
    stampWMm = stampSizeMm,
    stampHMm = stampSizeMm,
    stampRightMm = 10,
    stampBottomMm = 6,
    // false = seal the final page only (the one carrying the totals/signature);
    // earlier pages stay clean. true = every page.
    stampAllPages = true,
  } = options;

  const dim = getPaperDimensions("A4_PORTRAIT");
  const SCALE = 2;
  const CONTENT_W = dim.contentW;
  const LEFT = dim.left;
  const PAGE_H = dim.usableH;

  const pdf = new jsPDF(dim.orientation, "mm", dim.format);

  let stampPng = null;
  if (stampSvg) {
    // rasterize at the stamp's own aspect so the rubber stamp isn't squashed;
    // ~300 DPI at the configured physical width, with a 512 px floor
    const pxW = Math.min(2400, Math.max(512, Math.round(stampWMm * 12)));
    const pxH = Math.max(1, Math.round((pxW * stampHMm) / stampWMm));
    stampPng = await svgToPngDataUrl(stampSvg, pxW, pxH);
  }

  // Fixed stamp position in page coordinates: the configured gap from the
  // paper's right/bottom edge, identical on every page (page 1, overflow pages,
  // single pages).
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const stampX = pageWidth - stampRightMm - stampWMm;
  const stampY = pageHeight - stampBottomMm - stampHMm;

  let firstPage = true;

  for (const element of pageElements) {
    // Opt into the line-height-independent font baseline: without it
    // html2canvas paints every text run ~6px too low on this page and the
    // overflow:hidden boxes clip the glyphs.
    window.__II_H2C_ASCENT_FIX = true;
    let canvas;
    try {
      canvas = await html2canvas(element, {
        scale: SCALE,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        ignoreElements: (node) => node?.classList?.contains?.("ii-seal-dom"),
      });
    } finally {
      window.__II_H2C_ASCENT_FIX = false;
    }

    const pxToMm = CONTENT_W / canvas.width;
    const onePagePx = PAGE_H / pxToMm;
    let start = 0;
    let continuation = false;

    while (start < canvas.height) {
      const end = Math.min(start + onePagePx, canvas.height);
      const sliceHeightPx = end - start;
      if (sliceHeightPx <= 0) break;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext("2d");
      ctx.drawImage(
        canvas,
        0,
        start,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );

      if (continuation) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, 2);
      }
      if (end < canvas.height) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, sliceHeightPx - 2, canvas.width, 2);
      }

      if (!firstPage) pdf.addPage();

      const sliceHeightMM = sliceHeightPx * pxToMm;
      pdf.addImage(
        sliceCanvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        LEFT,
        10,
        CONTENT_W,
        sliceHeightMM
      );

      if (stampPng && stampAllPages) {
        pdf.addImage(stampPng, "PNG", stampX, stampY, stampWMm, stampHMm);
      }

      firstPage = false;
      continuation = true;
      start = end;
    }
  }

  // Multi-page OFF: stamp only the final page, which carries the totals and
  // the signature band. The slicing loop can't know which page is last until
  // it finishes, so this is applied as a post-pass.
  if (stampPng && !stampAllPages) {
    pdf.setPage(pdf.getNumberOfPages());
    pdf.addImage(stampPng, "PNG", stampX, stampY, stampWMm, stampHMm);
  }

  return pdf;
}
