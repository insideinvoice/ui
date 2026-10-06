// Optional letterhead line from Settings → Business → Specialist In.
// Rendered only when the business has the toggle on and text saved, so the
// invoice stays byte-identical otherwise.

export const SPECIALIST_IN_EXTRA_H = 18;

export function getSpecialistInLine(business) {
  if (!business?.specialistInEnabled) return "";
  const text = String(business?.specialistIn || "").trim();
  return text ? text.toUpperCase() : "";
}
