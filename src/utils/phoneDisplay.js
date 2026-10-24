// Invoice documents print Indian numbers with the country code: a bare
// 10-digit mobile becomes "+91 XXXXXXXXXX". Numbers that already carry a
// country code (+…) or an STD 0-prefix (landlines) are shown untouched, so
// nothing the owner typed is ever mangled.
export const formatPhone = (raw) => {
  const trimmed = (raw ?? "").toString().trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[\s().-]/g, "");
  if (/^\+?91[6-9]\d{9}$/.test(digits)) return `+91 ${digits.slice(-10)}`;
  // 10-digit mobiles (and a stray extra digit the owner kept) get the prefix;
  // the digits are preserved as typed so nothing is silently dropped.
  if (/^[6-9]\d{9,10}$/.test(digits)) return `+91 ${digits}`;
  return trimmed;
};

// The alternate phone prints as its own line under the primary number in the
// Retro letterhead (a fixed-height box with PDF cut points, so the letterhead
// grows by exactly this many pixels when the line is present — same
// discipline as SPECIALIST_IN_EXTRA_H — and Retro's item box shrinks by the
// same amount to keep the frame one A4 page).
export const ADDITIONAL_PHONE_EXTRA_H = 13;

// Single-line business contact for every template EXCEPT Retro:
// "Mob.: +91 A, +91 B" — the alternate number joins the primary after a
// comma+space, and the whole line is empty when neither number is saved.
export const mobileLine = (business) => {
  const nums = [business?.phone, business?.additionalPhone]
    .filter(Boolean)
    .map(formatPhone);
  return nums.length ? `Mob.: ${nums.join(", ")}` : "";
};
