// Invoice documents print Indian numbers with the country code: a bare
// 10-digit mobile becomes "+91 XXXXXXXXXX". Numbers that already carry a
// country code (+…) or an STD 0-prefix (landlines) are shown untouched, so
// nothing the owner typed is ever mangled.
export const formatPhone = (raw) => {
  const trimmed = (raw ?? "").toString().trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[\s().-]/g, "");
  if (/^\+?91[6-9]\d{9}$/.test(digits)) return `+91 ${digits.slice(-10)}`;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91 ${digits}`;
  return trimmed;
};

// The alternate phone prints as its own line under the primary number in the
// Enterprise/Retro letterheads. Both headers are fixed-height boxes with PDF
// cut points, so the letterhead grows by exactly this many pixels when the
// line is present (same discipline as SPECIALIST_IN_EXTRA_H) and Retro's item
// box shrinks by the same amount to keep the frame one A4 page.
export const ADDITIONAL_PHONE_EXTRA_H = 13;
