// Units of measurement offered on invoice items. All industries share this
// list so every sector's common units are covered without per-industry
// columns. Stored as a plain string on the item and rendered in the invoice
// "per" column — purely a display label; qty x rate maths is unchanged.

export const UNITS = [
  "", // blank = no unit selected (legacy behaviour: templates print "Piece")
  "Unit",
  "Nos",
  "Pieces",
  "Piece",
  "Kg",
  "Gram",
  "Quintal",
  "Ton",
  "Litre",
  "Metre",
  "Square Metre",
  "Box",
  "Bag",
  "Pack",
  "Set",
  "Pair",
  "Dozen",
  "Hour",
  "Day",
  "Month",
  "Year",
  "Job",
  "Service",
  "Course",
  "Plate",
  "Serving",
  "Table",
  "Project",
  "Licence",
  "Connection",
  "User",
  "Device",
];

// Legacy invoices (null unit) render "Piece" in templates — the value every
// template has always printed in the per column.
export const DEFAULT_UNIT = "Piece";

export default UNITS;

// Official UQC (Unique Quantity Code) abbreviations from the GST master. The
// item stores the human unit ("Kg"); documents print the UQC alongside it
// ("25 KGS") because GST portals and e-invoices expect the code, not the name.
export const UQC_CODES = {
  "Nos": "NOS",
  "Pieces": "PCS",
  "Piece": "PCS",
  "Kg": "KGS",
  "Gram": "GMS",
  "Quintal": "QTL",
  "Ton": "TON",
  "Litre": "LTR",
  "Metre": "MTR",
  "Square Metre": "SQM",
  "Box": "BOX",
  "Bag": "BAG",
  "Pack": "PAC",
  "Set": "SET",
};

// "Kg" -> "KGS"; units outside the GST list fall back to their own name.
export const uqcFor = (unit) => UQC_CODES[unit] || unit || "";
