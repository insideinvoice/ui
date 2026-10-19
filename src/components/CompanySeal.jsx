import { useMemo, useId } from "react";

export default function CompanySeal({
  companyName = "BUSINESS NAME PRIVATE LIMITED",
  year = new Date().getFullYear(),
  size = 120,
  color = "#0A4BFF",
  // slight hand-stamped skew instead of sitting perfectly straight; applied
  // inside the SVG so it survives rasterization into the PDFs too
  tilt = -8,
}) {
  const uid = useId();
  const vw = 300;
  const cx = vw / 2;
  const cy = vw / 2;
  const outerR = 148;
  const innerR = 112;
  const textR = 121;
  const font = "Arial, sans-serif";

  // Ring text: every glyph is placed INDIVIDUALLY around the full circle.
  // The old approach stretched one <textPath> with textLength — Chromium
  // applies that inconsistently, so short names rendered at natural width
  // and bunched on one side of the stamp. Measuring each glyph and walking
  // the arc makes ANY length cover the ENTIRE circle: short names simply
  // get wider, evenly distributed gaps between the letters.
  const ring = useMemo(() => {
    const name = companyName.toUpperCase().trim();
    const chars = `\u2736 ${name} \u2736`.split("");

    const usable = 2 * Math.PI * textR; // full circumference
    const hasDom = typeof document !== "undefined";
    // Pre-render (SSG) has no DOM: fall back to average glyph widths.
    const measure = (size2, ch) => {
      if (!hasDom) return size2 * 0.66;
      const canvas = measure._canvas || (measure._canvas = document.createElement("canvas"));
      const ctx = canvas.getContext("2d");
      ctx.font = `bold ${size2}px ${font}`;
      return ctx.measureText(ch).width;
    };

    let fontSize = 26;
    const MIN_GAP = 3; // minimum breathing room between glyphs
    const totalWidth = (size2) => chars.reduce((sum, ch) => sum + measure(size2, ch), 0);
    // Shrink the font until the glyphs + minimum gaps fit the whole circle.
    while (totalWidth(fontSize) + MIN_GAP * (chars.length - 1) > usable && fontSize > 12) {
      fontSize -= 1;
    }
    const widths = chars.map((ch) => measure(fontSize, ch));
    const totalW = widths.reduce((a, b) => a + b, 0);
    // Leftover arc, distributed evenly as gaps → the string spans exactly 360°.
    const gap = chars.length > 1 ? (usable - totalW) / (chars.length - 1) : 0;

    const glyphs = [];
    let arc = 0; // current position along the unrolled circumference
    for (let i = 0; i < chars.length; i++) {
      const centerArc = arc + widths[i] / 2;
      arc += widths[i] + gap;
      // Center the string on 12 o'clock and read clockwise around the stamp.
      const theta = ((centerArc - usable / 2) * 360) / usable - 90;
      const rad = (theta * Math.PI) / 180;
      const x = cx + textR * Math.cos(rad);
      const y = cy + textR * Math.sin(rad);
      // Glyph stays tangent to the ring (upright at the top, rotated at the sides).
      const rot = theta + 90;
      glyphs.push({ ch: chars[i], x, y, rot, fontSize });
    }
    return glyphs;
  }, [companyName, cx, cy]);

  const clipId = `seal-clip-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vw} ${vw}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", overflow: "hidden" }}
    >
      <defs>
        {/* words can never draw past the seal's outer ring */}
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={outerR - 2} />
        </clipPath>
      </defs>

      <g transform={`rotate(${tilt} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={color} strokeWidth={3.5} />
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={color} strokeWidth={2} />

        <g clipPath={`url(#${clipId})`}>
          {ring.map((g, i) => (
            <text
              key={i}
              x={g.x}
              y={g.y}
              transform={`rotate(${g.rot} ${g.x} ${g.y})`}
              fontFamily={font}
              fontSize={g.fontSize}
              fontWeight="bold"
              fill={color}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {g.ch}
            </text>
          ))}
        </g>

        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={font}
          fontSize={34}
          fontWeight="bold"
          fill={color}
          letterSpacing={9}
        >
          SEAL
        </text>

        <text
          x={cx}
          y={cy + 27}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={font}
          fontSize={30}
          fontWeight="bold"
          fill={color}
        >
          {String(year)}
        </text>
      </g>
    </svg>
  );
}
