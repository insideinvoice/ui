import { useMemo, useId } from "react";

export default function CompanySeal({
  companyName = "BUSINESS NAME PRIVATE LIMITED",
  year = new Date().getFullYear(),
  size = 120,
  color = "#0A4BFF",
}) {
  const uid = useId();
  const vw = 300;
  const cx = vw / 2;
  const cy = vw / 2;
  const outerR = 148;
  const innerR = 112;
  const textR = 121;
  const font = "Arial, sans-serif";

  const wrapped = useMemo(() => {
    const name = companyName.toUpperCase().trim();
    const base = `\u2736 ${name} \u2736`;
    // keep the ring text within the circle's circumference so letter spacing
    // never collapses on itself when stretched around the full circle
    const maxChars = 47;
    return base.length > maxChars ? `\u2736 ${name.slice(0, maxChars - 4).trimEnd()} \u2736` : base;
  }, [companyName]);

  const circleId = `seal-path-${uid}`;
  const clipId = `seal-clip-${uid}`;
  const circlePath = `M ${cx},${cy - textR} A ${textR},${textR} 0 1,1 ${cx - 0.01},${cy - textR}`;
  const circumference = 2 * Math.PI * textR;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vw} ${vw}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", overflow: "hidden" }}
    >
      <defs>
        <path id={circleId} d={circlePath} />
        {/* words can never draw past the seal's outer ring */}
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={outerR - 2} />
        </clipPath>
      </defs>

      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={color} strokeWidth={3.5} />
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={color} strokeWidth={2} />

      <g clipPath={`url(#${clipId})`}>
        <text
          fontFamily={font}
          fontSize={26}
          fontWeight="bold"
          fill={color}
          textLength={circumference}
          lengthAdjust="spacing"
        >
          <textPath href={`#${circleId}`} startOffset="0%" textAnchor="start">
            {wrapped}
          </textPath>
        </text>
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
    </svg>
  );
}
