const VB_W = 400;
const VB_H = 160;
// inner border spans x=12..388; keep 12 units of padding on each side
const MAX_TEXT_W = 352;

/* Arial average advance factors (em) — used only to decide WHETHER a
   string needs squeezing; the browser then does the exact fit itself via
   textLength + lengthAdjust, so short strings keep their natural width. */
const boldF = 0.72;
const regF = 0.6;
const estW = (t, fs, factor) => String(t || "").length * fs * factor;
const fit = (t, fs, factor) =>
  estW(t, fs, factor) > MAX_TEXT_W
    ? { textLength: MAX_TEXT_W, lengthAdjust: "spacingAndGlyphs" }
    : {};

export default function CompanyStamp({
  companyName = "RS HARDWARE GLASS & ELECTRICALS",
  addressLine1 = "Building No-3/7, Shop No-6, Gowri Shankar Complex",
  addressLine2 = "Arekere Main Road, Bangalore - 560076",
  phone = "Ph: +91 8147465517, 9066309842",
  email = "E-Mail: rshardware2210@gmail.com",
  color = "#0000cc",
  width = 400,
}) {
  const height = Math.round(width * 0.4);
  const nameFs = 24;
  const bodyFs = 13;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", overflow: "hidden" }}
    >
      <rect x="4" y="4" width="392" height="152" rx="3" ry="3"
            fill="none" stroke={color} strokeWidth="4" />

      <rect x="12" y="12" width="376" height="136" rx="2" ry="2"
            fill="none" stroke={color} strokeWidth="1.5" />

      {/* baseline lifted to y=47 so descenders clear the rule at y=60 */}
      <text x="200" y="47" textAnchor="middle"
            fontFamily="Arial, sans-serif" fontWeight="bold"
            fontSize={nameFs} fill={color}
            {...fit(companyName, nameFs, boldF)}>
        {companyName}
      </text>

      <line x1="24" y1="60" x2="376" y2="60"
            stroke={color} strokeWidth="1" />

      <text x="200" y="80" textAnchor="middle"
            fontFamily="Arial, sans-serif" fontSize={bodyFs} fill={color}
            {...fit(addressLine1, bodyFs, regF)}>
        {addressLine1}
      </text>

      <text x="200" y="97" textAnchor="middle"
            fontFamily="Arial, sans-serif" fontSize={bodyFs} fill={color}
            {...fit(addressLine2, bodyFs, regF)}>
        {addressLine2}
      </text>

      <text x="200" y="114" textAnchor="middle"
            fontFamily="Arial, sans-serif" fontSize={bodyFs} fill={color}
            {...fit(phone, bodyFs, regF)}>
        {phone}
      </text>

      <text x="200" y="131" textAnchor="middle"
            fontFamily="Arial, sans-serif" fontSize={bodyFs} fill={color}
            {...fit(email, bodyFs, regF)}>
        {email}
      </text>
    </svg>
  );
}
