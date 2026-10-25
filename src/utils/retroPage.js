// Layout budget + item packing for the Retro fixed-page invoice template.
// Kept outside the component so both templates and the PDF pipeline (and the
// smoke test) can read the numbers without pulling in React.

export const RETRO_PAGE_METRICS = {
  width: 714,      // A4 content width in px (matches every other template)
  header: 112,
  details: 96,     // 3 rows x 32 (no rules between them)
  thead: 39,       // 24 + 15
  body: 548,       // fixed open item box
  totals: 104,     // 4 rows x 26
  footer: 108,
  borders: 10,     // 4 outer + 6 inner rules
  rowFudge: 4,     // collapsed-table row rounding allowance (measured real = 1012px)
  gap: 0,          // stacked frames touch (double 2px rule between them); a gap
                   // here becomes its own 1px-black PDF page — the slicer cuts
                   // on retro-page boundaries and would emit the gap alone
};

// Everything except the item box, rounded up so the cut point always
// clears the page height.
export const RETRO_FIXED_H =
  RETRO_PAGE_METRICS.header +
  RETRO_PAGE_METRICS.details +
  RETRO_PAGE_METRICS.thead +
  RETRO_PAGE_METRICS.totals +
  RETRO_PAGE_METRICS.footer +
  RETRO_PAGE_METRICS.borders +
  RETRO_PAGE_METRICS.rowFudge;

// One screen of an A4 page is 277mm tall at 190mm wide -> ~1041px at
// this width. The page (plus its gap) must stay under that or the PDF
// slicer would have to cut inside the frame.
export const RETRO_PAGE_BUDGET_PX = 1041;
export const RETRO_MIN_ITEMS_PER_PAGE = 15;

export const COLS = { no: 44, particulars: 276, hsn: 62, qty: 76, rate: 100, rs: 104, ps: 48 };
export const TABLE_W = Object.values(COLS).reduce((s, w) => s + w, 0); // 710 (inside the 2px frame)
export const RULE_X = [
  COLS.no,
  COLS.no + COLS.particulars,
  COLS.no + COLS.particulars + COLS.hsn,
  COLS.no + COLS.particulars + COLS.hsn + COLS.qty,
  COLS.no + COLS.particulars + COLS.hsn + COLS.qty + COLS.rate,
  COLS.no + COLS.particulars + COLS.hsn + COLS.qty + COLS.rate + COLS.rs,
];

// HSN/SAC hidden: the whole column is removed and its 62px folds into
// PARTICULARS, so the frame width and every other column keep their exact
// position. COLS/RULE_X above stay the default (HSN on) for anything that
// imports them directly.
export const COLS_NO_HSN = { no: 44, particulars: 338, qty: 76, rate: 100, rs: 104, ps: 48 };

// V45 per-line (INDIVIDUAL) discounts: a DISC.% column appears in EVERY
// template, funded by PARTICULARS so the frame width stays 710. Absent for
// FULL/none — the classic layout is untouched.
export const COLS_DISC = { no: 44, particulars: 220, hsn: 62, qty: 76, rate: 100, disc: 56, rs: 104, ps: 48 };
export const COLS_NO_HSN_DISC = { no: 44, particulars: 282, qty: 76, rate: 100, disc: 56, rs: 104, ps: 48 };

export const retroCols = (showHnSac = true, showDisc = false) =>
  showDisc
    ? (showHnSac ? COLS_DISC : COLS_NO_HSN_DISC)
    : (showHnSac ? COLS : COLS_NO_HSN);

export const retroRuleX = (cols = COLS) => {
  const keys = cols.disc !== undefined
    ? cols.hsn !== undefined
      ? ["no", "particulars", "hsn", "qty", "rate", "disc", "rs"]
      : ["no", "particulars", "qty", "rate", "disc", "rs"]
    : cols.hsn !== undefined
      ? ["no", "particulars", "hsn", "qty", "rate", "rs"]
      : ["no", "particulars", "qty", "rate", "rs"];
  let x = 0;
  return keys.map((k) => {
    x += cols[k];
    return x;
  });
};

export const ROW_H = 26;
const EST_ROW = 26;          // measured floor for one-line particular (td min-height)
const EST_WRAP = 16;         // each text line
const ROW_PADDING = 8;       // td padding 4px top + 4px bottom
const BODY_BUDGET = RETRO_PAGE_METRICS.body - 4; // safety lip above the frame

/* Width-aware wrap estimate, not a blunt character count. A 34-chars/line
   rule (the old model) assumed every glyph is a wide capital, so mixed-case
   names were budgeted 30-50% taller than they render — pages broke at ~70%
   full. Per-class widths below track 12.5px Arial closely while still
   rounding in the safe direction (slightly wide). */
const CHAR_W_CAPITAL = 7.7;  // A-Z, digits, & @ # %
const CHAR_W_WIDE = 10.2;    // m M W w
const CHAR_W_NARROW = 3.7;   // i l j t f . , ' ! : ;
const CHAR_W_SPACE = 3.4;
const CHAR_W_AVG = 6.0;      // remaining lowercase

export const retroTextWidth = (text) => {
  let w = 0;
  for (const ch of String(text || "")) {
    if (/[A-Z0-9&@#%]/.test(ch)) w += CHAR_W_CAPITAL;
    else if (/[mMW]/.test(ch)) w += CHAR_W_WIDE;
    else if (ch === "w") w += 8.4;
    else if (/[iljtf.,'!:;]/.test(ch)) w += CHAR_W_NARROW;
    else if (ch === " ") w += CHAR_W_SPACE;
    else w += CHAR_W_AVG;
  }
  return w;
};

// Text area grows with PARTICULARS when HSN is hidden, so the wrap estimate
// must follow it or long names would over-chunk onto extra pages.
export const retroTextArea = (cols = COLS) => Math.max(40, cols.particulars - 12); // td padding 6px each side

// Worst case (all one-line particulars): how many rows one page holds.
export const RETRO_CAPACITY_NOTE = Math.floor(BODY_BUDGET / EST_ROW);

const linesFor = (name, areaW) => Math.max(1, Math.ceil(retroTextWidth(name) / areaW));

/** Estimated rendered height of one particular: text lines + padding, never
 *  below the td's own min-height (a one-line row is exactly ROW_H tall). */
export const estimateRow = (name, areaW = retroTextArea()) =>
  Math.max(EST_ROW, EST_WRAP * linesFor(name, areaW) + ROW_PADDING);

/**
 * Pack items into fixed pages. A page takes as many rows as fit inside
 * the body budget, so a 15+ item bill flows onto repeat pages instead of
 * stretching the frame. `bodyH` lets the caller shrink the box when the
 * header grows (e.g. the Specialist In line) so the outer frame height
 * never exceeds one A4 page.
 */
export function chunkRetroItems(items, bodyH = RETRO_PAGE_METRICS.body, areaW = retroTextArea()) {
  const budget = bodyH - 4; // safety lip above the frame
  const estimate = (name) => estimateRow(name, areaW);
  const pages = [];
  let current = [];
  let used = 0;
  (items || []).forEach((item) => {
    const h = estimate(item?.itemName);
    if (current.length > 0 && used + h > budget) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(item);
    used += h;
  });
  if (current.length > 0 || pages.length === 0) pages.push(current);
  return pages;
}

export const splitAmount = (val) => {
  const cents = Math.round((Math.abs(parseFloat(val) || 0)) * 100);
  const negative = (parseFloat(val) || 0) < 0;
  return {
    rs: (negative ? "-" : "") + Math.floor(cents / 100).toLocaleString("en-IN"),
    ps: String(cents % 100).padStart(2, "0"),
  };
};

export const fmtQty = (q) => {
  const n = parseFloat(q);
  return Number.isFinite(n) ? String(n) : "";
};

// Qty with the unit appended (e.g. "10.00 Kg"). Missing unit falls back to
// "Piece" so every template agrees on the legacy default. Returns "" when the
// qty itself is empty.
export const fmtQtyUnit = (q, unit) => {
  const n = parseFloat(q);
  if (!Number.isFinite(n)) return "";
  return `${n} ${unit || "Piece"}`;
};

export const fmtDate = (d) => {
  const str = String(d || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : str;
};
