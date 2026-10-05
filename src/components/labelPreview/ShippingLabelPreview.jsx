import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

const ASPECT = {
  "4x6in": [400, 600],
  "4x3in": [400, 300],
  "4x4in": [400, 400],
  "4x8in": [400, 800],
  "100x100mm": [400, 400],
  "100x150mm": [400, 600],
  "a4-2up": [400, 283],
  "a4-4up": [400, 283],
  "letter-2up": [400, 259],
  "letter-30up": [400, 170],
};

const HANDLING = [
  ["thisWayUp", "THIS WAY UP"],
  ["fragile", "FRAGILE"],
  ["keepDry", "KEEP DRY"],
  ["doNotStack", "DO NOT STACK"],
  ["handleWithCare", "HANDLE WITH CARE"],
];

const addressLines = (addr) => [
  addr?.name,
  addr?.company,
  ...(Array.isArray(addr?.addressLines) ? addr.addressLines : []),
  [addr?.city, addr?.state, addr?.pincode].filter(Boolean).join(" "),
  addr?.country,
].filter((l) => l && String(l).trim());

function Text({ x, y, children, size = 13, weight = 400, anchor = "start", fill = "#0f172a" }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      fill={fill}
      fontFamily="Inter, Helvetica, Arial, sans-serif"
    >
      {children}
    </text>
  );
}

function AddressBlock({ x, y, w, lines, title, titleSize = 11, lineSize = 15, maxLines = 6, gap = 17 }) {
  const shown = lines.slice(0, maxLines);
  return (
    <g>
      <Text x={x} y={y} size={titleSize} weight="700" fill="#475569">{title}</Text>
      {shown.map((line, i) => (
        <Text key={i} x={x} y={y + 20 + i * gap} size={i === 0 ? lineSize : lineSize - 3} weight={i === 0 ? 700 : 400}>
          {line}
        </Text>
      ))}
      <line x1={x} y1={y + 30 + shown.length * gap} x2={x + w} y2={y + 30 + shown.length * gap} stroke="#cbd5e1" strokeWidth="1" />
    </g>
  );
}

export default function ShippingLabelPreview({ payload }) {
  const p = payload || {};
  const [w, h] = ASPECT[p.sizeKey] || ASPECT["4x6in"];
  const barcodeRef = useRef(null);

  const tracking = String(p.trackingNumber || "").split(",")[0].trim();
  const barcodeValue = tracking || String(p.invoiceNo || p.ref1 || "000000000").trim();
  const thermal = p.thermalMode !== false;
  const ink = "#000000";
  const muted = thermal ? "#333333" : "#475569";
  const barH = Math.max(56, Math.min(90, h * 0.14));
  const pad = 18;

  useEffect(() => {
    const el = barcodeRef.current;
    if (!el) return;
    const value = barcodeValue || "000000000";
    const boxW = w - 2 * pad;
    try {
      JsBarcode(el, value, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: 60,
        width: 2,
        background: "transparent",
        lineColor: ink,
      });
      const bw = parseFloat(el.getAttribute("width"));
      const bh = parseFloat(el.getAttribute("height"));
      if (Number.isFinite(bw) && Number.isFinite(bh) && bw > 0 && bh > 0) {
        el.setAttribute("viewBox", `0 0 ${bw} ${bh}`);
        el.setAttribute("preserveAspectRatio", "none");
        el.setAttribute("width", String(boxW));
        el.setAttribute("height", String(barH));
      }
    } catch {
      // Fallback: deterministic placeholder bars so the block never renders empty.
      while (el.firstChild) el.removeChild(el.firstChild);
      el.setAttribute("viewBox", `0 0 ${boxW} ${barH}`);
      el.setAttribute("width", String(boxW));
      el.setAttribute("height", String(barH));
      const ns = "http://www.w3.org/2000/svg";
      let x = 0;
      for (let i = 0; i < value.length && x < boxW; i++) {
        const code = value.charCodeAt(i);
        for (let b = 0; b < 4 && x < boxW; b++) {
          const seg = 3 + ((code >> b) & 1) * 3;
          if (b % 2 === 0) {
            const rect = document.createElementNS(ns, "rect");
            rect.setAttribute("x", String(x));
            rect.setAttribute("y", "0");
            rect.setAttribute("width", String(seg));
            rect.setAttribute("height", String(barH));
            rect.setAttribute("fill", ink);
            el.appendChild(rect);
          }
          x += seg;
        }
      }
    }
  }, [barcodeValue, w, barH, pad, ink]);

  const fromLines = addressLines(p.shipFrom);
  const toLines = addressLines(p.shipTo);
  const service = [p.carrier, p.serviceLevel, p.serviceCode].filter(Boolean).join("  ·  ");
  const meta = [
    p.weightKg ? `${p.weightKg} kg` : null,
    Number(p.cartonCount) > 1 ? `${p.cartonCount} CTN` : null,
    p.dimsCm ? p.dimsCm : null,
    p.codAmount ? `COD ₹${p.codAmount}` : null,
    p.billingType || null,
  ].filter(Boolean);
  const refs = [
    p.invoiceNo && `INV ${p.invoiceNo}`,
    p.poNumber && `PO ${p.poNumber}`,
    p.ref1 && `REF1 ${p.ref1}`,
    p.ref2 && `REF2 ${p.ref2}`,
  ].filter(Boolean);

  const topBarH = Math.max(34, h * 0.07);
  const toBlockH = Math.min(h * 0.36, 34 + toLines.length * 17);
  const fromY = topBarH + toBlockH + 12;
  const barcodeY = fromY + Math.max(74, fromLines.length * 17 + 44) + 8;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full max-w-md mx-auto block rounded-lg border border-slate-200 bg-white"
      role="img"
      aria-label="Shipping label preview"
    >
      <rect width={w} height={h} fill="#ffffff" />
      {p.printBorder && <rect x="3" y="3" width={w - 6} height={h - 6} fill="none" stroke={ink} strokeWidth="2" />}

      {/* carrier / service bar */}
      <rect x="0" y="0" width={w} height={topBarH} fill={ink} />
      <Text x={pad} y={topBarH * 0.68} size={Math.min(20, topBarH * 0.5)} weight="800" fill="#ffffff">
        {(service || "SHIPPING LABEL").toUpperCase()}
      </Text>

      {/* ship to */}
      <AddressBlock x={pad} y={topBarH + 24} w={w - 2 * pad} lines={toLines} title="SHIP TO" titleSize={12} lineSize={Math.min(26, h * 0.045)} maxLines={7} gap={Math.max(15, h * 0.03)} />

      {/* ship from + meta */}
      <AddressBlock x={pad} y={fromY} w={w * 0.56} lines={fromLines} title="SHIP FROM" titleSize={11} lineSize={13} maxLines={5} gap={15} />
      <g>
        <Text x={w - pad} y={fromY + 12} size={11} weight="700" fill={muted} anchor="end">DETAILS</Text>
        {meta.map((m, i) => (
          <Text key={i} x={w - pad} y={fromY + 32 + i * 17} size={14} weight="700" anchor="end">{m}</Text>
        ))}
        {refs.map((r, i) => (
          <Text key={r} x={w - pad} y={fromY + 32 + (meta.length + i) * 17} size={12} anchor="end" fill={muted}>{r}</Text>
        ))}
      </g>

      {/* barcode */}
      <g transform={`translate(${pad} ${barcodeY})`}>
        <svg ref={barcodeRef} x="0" y="0" width={w - 2 * pad} height={barH} />
        <Text x={(w - 2 * pad) / 2} y={barH + 20} size={17} weight="700" anchor="middle">
          {barcodeValue}
        </Text>
      </g>

      {/* handling marks */}
      <g transform={`translate(${pad} ${barcodeY + barH + 38})`}>
        {HANDLING.filter(([k]) => p[k]).map(([k, label], i) => {
          const bw = label.length * 8 + 16;
          const offset = HANDLING.filter(([k2]) => p[k2]).slice(0, i).reduce((acc, [, l2]) => acc + l2.length * 8 + 26, 0);
          return (
            <g key={k} transform={`translate(${offset} 0)`}>
              <rect x="0" y="0" width={bw} height="24" rx="4" fill="none" stroke={ink} strokeWidth="2" />
              <Text x={bw / 2} y={17} size={11} weight="800" anchor="middle">{label}</Text>
            </g>
          );
        })}
      </g>

      {p.notes && (
        <Text x={pad} y={h - 34} size={12} fill={muted}>{String(p.notes).slice(0, 70)}</Text>
      )}
      <Text x={pad} y={h - 14} size={10} fill="#94a3b8">Generated by insideinvoice.com</Text>
      <Text x={w - pad} y={h - 14} size={10} fill="#94a3b8" anchor="end">
        {p.preset ? p.preset.replace(/_/g, " ").toLowerCase() : ""}
      </Text>
    </svg>
  );
}
