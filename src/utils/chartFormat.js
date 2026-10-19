// Compact money labels for chart y-axes.
//
// Raw ticks overflow the axis gutter and clip at the SVG's left edge
// (an 11-digit number like 50000000000 loses its leading digits and every
// label reads "0000000"), so ticks are shown in the Indian short scale:
//   47031        -> "47,031"   (under a lakh: exact, grouped)
//   2642640      -> "26.43 L"
//   265500000    -> "26.55 Cr"
//   60000000000  -> "6,000 Cr"
export function formatAxisMoney(v) {
  const abs = Math.abs(v);
  if (abs >= 1e7) return `${Number((v / 1e7).toFixed(2)).toLocaleString("en-IN")} Cr`;
  if (abs >= 1e5) return `${Number((v / 1e5).toFixed(2)).toLocaleString("en-IN")} L`;
  return v.toLocaleString("en-IN");
}
