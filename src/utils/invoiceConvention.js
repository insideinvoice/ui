const TRAILING_SEPARATORS = /[-_/.]+$/;
const TRAILING_DIGITS = /^(.*?)(\d+)$/;

export function parseInvoiceConvention(convention) {
  let s = (convention ?? "").trim().replace(/[-_/.]+$/, "");
  const m = s.match(TRAILING_DIGITS);
  if (m) {
    const digits = m[2];
    if (digits.length >= 2 && digits.startsWith("0")) {
      return { prefix: m[1].replace(/[-_/.]+$/, ""), padding: digits.length };
    }
  }
  return { prefix: s, padding: 0 };
}

export function formatInvoiceNumber(convention, sequence) {
  const { prefix, padding } = parseInvoiceConvention(convention);
  const number = padding > 0 ? String(sequence).padStart(padding, "0") : String(sequence);
  return prefix ? `${prefix}-${number}` : number;
}
