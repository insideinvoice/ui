export const PAPER_SIZES = {
  A4_PORTRAIT: {
    id: "A4_PORTRAIT",
    label: "A4 Portrait",
    width: "210mm",
    height: "297mm",
    contentWidth: 714,
    thermal: false,
  },
  A4_LANDSCAPE: {
    id: "A4_LANDSCAPE",
    label: "A4 Landscape",
    width: "297mm",
    height: "210mm",
    contentWidth: 1020,
    thermal: false,
  },
  A5: {
    id: "A5",
    label: "A5",
    width: "148mm",
    height: "210mm",
    contentWidth: 480,
    thermal: false,
  },
  LETTER: {
    id: "LETTER",
    label: "Letter",
    width: "215.9mm",
    height: "279.4mm",
    contentWidth: 730,
    thermal: false,
  },
  THERMAL_58MM: {
    id: "THERMAL_58MM",
    label: "Thermal 58mm (2\")",
    width: "58mm",
    height: "auto",
    contentWidth: 384,
    thermal: true,
  },
  THERMAL_80MM: {
    id: "THERMAL_80MM",
    label: "Thermal 80mm (3\")",
    width: "80mm",
    height: "auto",
    contentWidth: 576,
    thermal: true,
  },
};

export const PAPER_SIZE_LIST = Object.values(PAPER_SIZES);

export const ALL_TEMPLATES = [
  { id: "template-1", label: "Original", desc: "Default classic black border layout" },
  { id: "template-31", label: "Retro", desc: "Fixed A4 page in classic shop-bill style — No / Particulars / Qty / Rate / Amount" },
  { id: "template-3", label: "Corporate Blue", desc: "Professional navy blue accents" },
  { id: "template-5", label: "Minimalist", desc: "Borderless design with maximum whitespace" },
  { id: "template-8", label: "Premium Gold", desc: "Elegant navy and gold luxury style" },
  { id: "template-10", label: "Slate Professional", desc: "Clean slate-grey corporate style" },
  { id: "template-18", label: "Executive", desc: "Company name in bold header band" },
  { id: "template-19", label: "Divided", desc: "Three-column grid: seller | buyer | details" },
  { id: "template-23", label: "Clean White", desc: "Ultra minimal greyscale" },
  { id: "template-24", label: "Ironclad", desc: "Steel-grey structure with forge-amber accents — iron & steel works" },
  { id: "template-25", label: "Copper Circuit", desc: "Deep navy header with copper highlights — electricals & electronics" },
  { id: "template-26", label: "Timber Line", desc: "Warm walnut serif styling — wood, plywood & furniture" },
  { id: "template-27", label: "Carbon Grid", desc: "Bold black grid with brand-red accent — hardware, tools & fasteners" },
  { id: "template-28", label: "Blueprint Pro", desc: "Engineering blue with light spec-sheet table — fabrication & industrial supply" },
  { id: "template-29", label: "Trade Command", desc: "Gunmetal three-column trade layout with gold accent — distribution & contracting" },
  { id: "template-30", label: "Ledger Formal", desc: "Traditional double-rule ledger with oxblood accents — established merchants" },
];

// Users may still have a removed template id stored locally or on the server;
// fall back to the original template instead of rendering an unknown theme.
export function sanitizeTemplate(id) {
  return ALL_TEMPLATES.some((t) => t.id === id) ? id : "template-1";
}

// No `template` key in the defaults: an explicit "template-1" here used to
// shadow the global choice made on the Templates page (the renderer treats a
// defined prop as an override), so every download printed "Original".
export const DEFAULT_PRINT_SETTINGS = {
  TAX_INVOICE: { paperSize: "A4_PORTRAIT" },
  PROFORMA_INVOICE: { paperSize: "A4_PORTRAIT" },
  QUOTATION: { paperSize: "A4_PORTRAIT" },
  PURCHASE_ORDER: { paperSize: "A4_PORTRAIT" },
};

export function getPrintSettings() {
  try {
    const stored = localStorage.getItem("print_settings");
    if (!stored) return structuredClone(DEFAULT_PRINT_SETTINGS);
    const parsed = JSON.parse(stored);
    const result = {};
    for (const key of Object.keys(DEFAULT_PRINT_SETTINGS)) {
      const val = parsed[key];
      if (!val) {
        result[key] = structuredClone(DEFAULT_PRINT_SETTINGS[key]);
      } else if (typeof val === "string") {
        const tpl = parsed[key + "_template"];
        result[key] = { paperSize: val, ...(tpl ? { template: sanitizeTemplate(tpl) } : {}) };
      } else {
        result[key] = { ...DEFAULT_PRINT_SETTINGS[key], ...val };
        if (result[key].template) {
          result[key].template = sanitizeTemplate(result[key].template);
        } else {
          delete result[key].template;
        }
      }
    }
    return result;
  } catch {
    return structuredClone(DEFAULT_PRINT_SETTINGS);
  }
}

// Per-type template override from Print Settings; null when the type follows
// the global choice from the Templates page.
export function getInvoiceTemplate(type) {
  const t = (getPrintSettings()[type] || {}).template;
  return t ? sanitizeTemplate(t) : null;
}

// Global template chosen on the Templates page (kept in sync by AuthContext).
export function getGlobalTemplate() {
  return sanitizeTemplate(localStorage.getItem("invoice_template") || "template-1");
}

// Drop every per-type template override (paper sizes are kept) so a new
// global choice applies to all document types at once.
export function clearTemplateOverrides() {
  try {
    const stored = localStorage.getItem("print_settings");
    if (!stored) return;
    const parsed = JSON.parse(stored);
    let changed = false;
    Object.keys(DEFAULT_PRINT_SETTINGS).forEach((key) => {
      const val = parsed[key];
      if (val && typeof val === "object" && val.template !== undefined) {
        delete val.template;
        changed = true;
      }
      if (parsed[key + "_template"] !== undefined) {
        delete parsed[key + "_template"];
        changed = true;
      }
    });
    if (changed) localStorage.setItem("print_settings", JSON.stringify(parsed));
  } catch {
    /* ignore malformed settings */
  }
}

export function savePrintSettings(settings) {
  localStorage.setItem("print_settings", JSON.stringify(settings));
}

const PDF_DIMENSIONS = {
  A4_PORTRAIT:  { orientation: "p", format: "a4",     pageW: 210,    pageH: 297,    contentW: 190,   left: 10,  usableH: 277 },
  A4_LANDSCAPE: { orientation: "l", format: "a4",     pageW: 297,    pageH: 210,    contentW: 277,   left: 10,  usableH: 190 },
  A5:           { orientation: "p", format: "a5",     pageW: 148,    pageH: 210,    contentW: 128,   left: 10,  usableH: 190 },
  LETTER:       { orientation: "p", format: "letter", pageW: 215.9,  pageH: 279.4,  contentW: 195.9, left: 10,  usableH: 262 },
  THERMAL_58MM: { orientation: "p", format: [58, 200], pageW: 58,    pageH: 200,    contentW: 48,    left: 5,   usableH: 200 },
  THERMAL_80MM: { orientation: "p", format: [80, 200], pageW: 80,    pageH: 200,    contentW: 70,    left: 5,   usableH: 200 },
};

export function getPaperDimensions(paperSizeId) {
  return PDF_DIMENSIONS[paperSizeId] || PDF_DIMENSIONS.A4_PORTRAIT;
}
