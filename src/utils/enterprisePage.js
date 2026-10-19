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

// Description cell metrics — these MUST mirror the ItemsTable styles exactly,
// otherwise the measured row height and the rendered row disagree.
export const ENT_DESC_FONT_SIZE = 10;
export const ENT_DESC_LINE_HEIGHT = 13;
export const ENT_DESC_PADDING_X = 16;   // the cell's "0 8px" on both sides
export const ENT_BASE_ROW_H = 24;        // one text line + the row's rule
export const ENT_FONT_STACK = "'Segoe UI', Arial, Helvetica, sans-serif";

/** Width of the DESCRIPTION column (HSN hidden → the column widens). */
export const entDescWidth = (showHnSac = true) => (showHnSac ? 292 : 368);

/**
 * How many lines a description really wraps to. With a measurer (canvas
 * measureText, using the template's own font) this is the TRUE wrap count —
 * the old 46-characters-per-line guess was ~15% pessimistic and grew with
 * every wrapped line, so long descriptions reserved far more height than they
 * used and the page ended early with empty space. Without a measurer (SSR /
 * node tests) it falls back to a conservative character estimate.
 */
export function entDescLines(text, { showHnSac = true, measure = null } = {}) {
  const s = String(text ?? "");
  const contentW = entDescWidth(showHnSac) - ENT_DESC_PADDING_X;
  if (measure) {
    const w = measure(s) || 0;
    if (w > 0) return Math.max(1, Math.ceil(w / contentW));
  }
  // conservative chars/line for 10px Segoe UI / Arial in the two column widths
  const cpl = showHnSac ? 51 : 65;
  return Math.max(1, Math.ceil(s.length / cpl));
}

/**
 * Row height + font size for one item row. A row that would be taller than
 * the page budget is first shrunk (10px → 7px) and only clipped as a last
 * resort, so one huge description can never blow the page frame open.
 *
 * Returns { height, fontSize, lines, text, truncated } — the packer uses
 * `height`, the renderer uses `fontSize` + `text`, so both always agree.
 */
export function resolveEntRow(item, { showHnSac = true, maxH = Infinity, measure = null } = {}) {
  const text = String(item?.itemName ?? "");
  const lineHeightFor = (f) => Math.round(f * 1.3);
  const heightFor = (f, l) => Math.max(ENT_BASE_ROW_H, l * lineHeightFor(f) + 8);
  const widthFor = (f) => {
    if (measure) {
      const w = measure(text) || 0;
      return (w * f) / ENT_DESC_FONT_SIZE;
    }
    const cpl = Math.max(8, Math.floor((entDescWidth(showHnSac) - ENT_DESC_PADDING_X) / (f * 0.52)));
    return cpl * text.length;
  };
  const linesFor = (f) => {
    const contentW = entDescWidth(showHnSac) - ENT_DESC_PADDING_X;
    return Math.max(1, Math.ceil(widthFor(f) / contentW));
  };

  let fontSize = ENT_DESC_FONT_SIZE;
  let lines = linesFor(fontSize);
  let out = text;

  if (heightFor(fontSize, lines) > maxH) {
    while (fontSize > 7 && heightFor(fontSize, lines) > maxH) {
      fontSize -= 1;
      lines = linesFor(fontSize);
    }
    if (heightFor(fontSize, lines) > maxH) {
      // Last resort: clip the text so a single row can never exceed the page.
      const lineH = lineHeightFor(fontSize);
      const maxLines = Math.max(1, Math.floor((maxH - 8) / lineH));
      const cpl = Math.max(8, Math.floor((entDescWidth(showHnSac) - ENT_DESC_PADDING_X) / (fontSize * 0.52)));
      if (text.length > maxLines * cpl) {
        out = text.slice(0, Math.max(1, maxLines * cpl - 1)) + "\u2026";
      }
      lines = maxLines;
    }
  }
  return {
    height: heightFor(fontSize, lines),
    fontSize,
    lines,
    text: out,
    truncated: out !== text,
  };
}

/** Estimated rendered height of one item row (never overstates a line). */
export const estimateEntRow = (name, charsPerLine = ENT_CHARS_PER_LINE) =>
  EST_ROW + EST_WRAP * (entLinesFor(name, charsPerLine) - 1);

/**
 * The GST breakup lists one row per (HSN/product, rate) GROUP — not one row
 * per line item. A 53-item invoice spanning 5 rates is 5 summary rows, not 53
 * (the per-item version printed 11 identical rows for the same HSN+rate and
 * inflated the tax table into extra pages, one of them nearly empty).
 */
export function groupTaxSummaryRows(items = [], { showHnSac = true, ratio = 1 } = {}) {
  const groups = new Map();
  items.forEach((item) => {
    const rate = parseFloat(item.gstPercentage) || 0;
    const taxable = (parseFloat(item.taxableValue) || 0) * ratio;
    const half = taxable * rate / 200;
    const key = showHnSac ? (item.hsn || "-") : (item.itemName || "-");
    const mapKey = `${key}|${rate}`;
    const row = groups.get(mapKey);
    if (row) {
      row.taxable += taxable;
      row.cgst += half;
      row.sgst += half;
      row.tax += taxable * rate / 100;
    } else {
      groups.set(mapKey, {
        key,
        rateLabel: `${(rate / 2).toFixed(2)}%`,
        taxable,
        cgst: half,
        sgst: half,
        tax: taxable * rate / 100,
      });
    }
  });
  return [...groups.values()];
}

/**
 * Spread the tax-breakup rows over the pages that carry them.
 *
 * `contCap`  — rows a CONTINUATION breakup page holds (table header only)
 * `finalCap` — rows the FINAL breakup page holds (it also carries the closing
 *              block: totals, amount-in-words, bank/signature band)
 *
 * The old rule filled continuation pages to the brim and handed the final
 * page whatever was left — often a SINGLE row plus the closing block, so that
 * page rendered ~30% full and looked like the document had skipped it. The
 * rows are now spread evenly instead: the same page count, but every breakup
 * page carries a fair share and the final page (which also carries the
 * closing block) ends up looking full.
 *
 * Returns the row count per page, in order (last entry = the final page).
 */
export function distributeBreakupRows(remaining, { contCap, finalCap } = {}) {
  const rows = Math.max(0, Math.floor(remaining) || 0);
  if (rows === 0) return [];
  const cont = Math.max(1, Math.floor(contCap) || 1);
  const fin = Math.max(1, Math.floor(finalCap) || 1);

  // Fewest pages that can hold the rows AND keep the final page within its
  // (smaller) budget.
  const pageCount = rows <= fin ? 1 : Math.ceil((rows - fin) / cont) + 1;

  const base = Math.floor(rows / pageCount);
  let extra = rows % pageCount;
  const counts = new Array(pageCount).fill(base);
  // Extras go to the CONTINUATION pages — the final page already carries the
  // closing block, so it has the largest visual weight either way.
  for (let i = 0; i < pageCount - 1 && extra > 0; i++) {
    counts[i] += 1;
    extra--;
  }
  if (extra > 0) counts[pageCount - 1] += extra;

  // The final page must fit its rows AND the closing block: hand any surplus
  // back to the continuation pages (they have the headroom).
  const last = pageCount - 1;
  if (counts[last] > fin) {
    let surplus = counts[last] - fin;
    counts[last] = fin;
    for (let i = last - 1; i >= 0 && surplus > 0; i--) {
      const move = Math.min(cont - counts[i], surplus);
      counts[i] += move;
      surplus -= move;
    }
  }
  return counts;
}

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
