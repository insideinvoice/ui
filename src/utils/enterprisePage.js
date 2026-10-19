// Layout budget + item packing for the Enterprise (black & white) invoice
// template. Same contract as retroPage.js: the metrics live outside the
// component so the template, the PDF pipeline and smoke checks agree without
// pulling React in.
//
// The template budgets each page frame to at most A4 height (≈1024px at the
// shared 714px content width, well under the slicer's ≈1040px one-page
// limit) but RENDERS content-height frames: a short invoice ends right
// after its footer and the document grows as items are added. Overflow items
// roll onto continuation pages, every page repeats a slim header and the
// item-table lines close exactly at each page's edge — the PDF slicer cuts
// on `ent-page-*` boundaries so nothing is ever sliced half-open.

export const ENT_PAGE_METRICS = {
  width: 714,        // A4 content width in px (matches every other template)
  pageH: 1024,       // per-page height BUDGET (slicer one-page limit ≈ 1040)
  head: 120,         // letterhead (fixed box, overflow hidden)
  headExtra: 18,     // grows for the optional SPECIALIST IN line (same as Retro)
  partyRow: 132,     // seller | bill-to | invoice-details three-column block
  contHead: 54,      // slim continuation strip on overflow pages
  thead: 30,         // items header row
  summaryHead: 24,   // tax-breakup header row (final page only)
  summarySubHead: 20, // tax-breakup sub-header (CGST/SGST Rate | Amount)
  summaryRow: 22,    // tax-breakup per-product row
  summaryFoot: 24,   // tax-breakup total row
  totalsRow: 24,     // Sub Total / Discount / CGST / SGST rows
  totalsGrand: 26,   // Grand Total row (double rule)
  words: 52,         // amount-in-words strip
  band: 118,         // bank | declaration | signature band
  footer: 26,        // jurisdiction | note | page x of y
  fudge: 8,          // 1px frame top+bottom + collapsed-rule rounding
};

// Items table column widths (sum = 714). HSN hidden: its 76px folds into
// DESCRIPTION so the frame width and every cut point stay put (same trick as
// Retro and the shared variants).
export const ENT_COLS = { sl: 44, desc: 292, hsn: 76, gst: 52, qty: 92, rate: 74, amount: 84 };
export const ENT_COLS_NO_HSN = { sl: 44, desc: 368, gst: 52, qty: 92, rate: 74, amount: 84 };

export const entCols = (showHnSac = true) => (showHnSac ? ENT_COLS : ENT_COLS_NO_HSN);

// Text budget for DESCRIPTION wrap estimates: the (292|368)px description
// column minus cell padding at ~5.2px/char for the 10px row font, with one
// line of safety so an estimate can never overstate what fits on a page.
export const ENT_CHARS_PER_LINE = 46;

const EST_ROW = 24;   // one description line (row baseline incl. rule)
const EST_WRAP = 14;  // each additional wrapped description line

export const entLinesFor = (name, charsPerLine = ENT_CHARS_PER_LINE) =>
  Math.max(1, Math.ceil(String(name || "").length / charsPerLine));

/** Estimated rendered height of one item row (never overstates a line). */
export const estimateEntRow = (name, charsPerLine = ENT_CHARS_PER_LINE) =>
  EST_ROW + EST_WRAP * (entLinesFor(name, charsPerLine) - 1);

/**
 * Pack items into fixed page areas by their estimated rendered heights.
 * `budgets`: { page1, cont, lastSingle, lastCont } (px budgets for the items
 * region of each page kind). Pages fill front-to-back; the LAST page then rolls
 * trailing rows onto a fresh page until its own (smaller) "with-totals" budget
 * fits — each pass moves at least one row, so the loop always terminates.
 * Callers that place their closing furniture AFTER packing (the Enterprise
 * per-product breakup, which can span pages) pass the open budgets again as
 * lastSingle/lastCont, making the roll-forward a no-op there.
 * Returns arrays of item indices per page (in order).
 */
export function packEntPages(heights, budgets) {
  const pages = [];
  let current = [];
  let used = 0;
  heights.forEach((h, i) => {
    const budget = pages.length === 0 ? budgets.page1 : budgets.cont;
    if (current.length > 0 && used + h > budget) {
      pages.push({ items: current, used });
      current = [];
      used = 0;
    }
    // A page always takes at least one row even if the estimate overflows the
    // budget (a wrap estimate short of reality) — the frame clips, never loops.
    current.push(i);
    used += h;
  });
  if (current.length > 0 || pages.length === 0) pages.push({ items: current, used });

  // Final page must still host the GST summary + totals + words + band.
  while (pages.length > 0) {
    const last = pages[pages.length - 1];
    const budget = pages.length === 1 ? budgets.lastSingle : budgets.lastCont;
    if (last.used <= budget) break;
    const moved = [];
    // Leave at least one row on the under-full page; a lone oversize row
    // simply overflows its frame (clipped) rather than spinning forever.
    while (last.used > budget && last.items.length > 1) {
      const idx = last.items.pop();
      last.used -= heights[idx];
      moved.push(idx);
    }
    pages.push({ items: moved, used: moved.reduce((s, i) => s + heights[i], 0) });
  }

  return pages.map((p) => p.items);
}
