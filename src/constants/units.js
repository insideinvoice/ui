// Units of measurement offered on invoice items. All industries share this
// list so every sector's common units are covered without per-industry
// columns. Stored as a plain string on the item and rendered in the invoice
// "per" column — purely a display label; qty x rate maths is unchanged.

export const UNITS = [
  "", // blank = no unit shown (legacy behaviour: templates print "Piece")
  "Nos",
  "Pieces",
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
