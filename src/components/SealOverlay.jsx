import SealMark from "./SealMark";
import { PX_PER_MM, normalizeSealConfig, resolveSealConfig, sealBoxMm } from "../utils/sealConfig";

/**
 * Absolutely positions the active seal on a page-sized container.
 *
 * The wrapper carries `ii-seal-dom`, which the PDF capture explicitly ignores:
 * the downloaded document gets the seal stamped onto every page in real
 * millimetres instead of baking one copy into the captured raster.
 */
export default function SealOverlay({
  business,
  type = "round",
  config,
  color,
  className = "",
  pxPerMm = PX_PER_MM,
  // Some surfaces (the delivery-challan sheet) render the CONTENT box only,
  // with the paper's 10 mm margins outside it. Passing the margin here keeps
  // the on-screen position measured from the same paper edge as the PDF.
  insetMm = 0,
  // Extra paper drawn OUTSIDE this container (on top of insetMm): how far a
  // negative gap may push the mark beyond the container's own edge. Surfaces
  // that show a sheet of paper around the content — the Settings preview —
  // pass the sheet margin so the seal can sit flush with the paper's edge;
  // containers without visible paper keep the seal inside their own box.
  bleedMm = 0,
}) {
  const variant = type === "stamp" ? "stamp" : "round";
  const cfg = normalizeSealConfig(config || resolveSealConfig(business));
  const variantCfg = cfg[variant];
  const box = sealBoxMm(variant, cfg);
  // Never let the mark travel past the paper that this container sits on.
  const bleed = insetMm + bleedMm;
  const rightOffset = Math.max(variantCfg.rightMm - insetMm, -bleed);
  const bottomOffset = Math.max(variantCfg.bottomMm - insetMm, -bleed);

  return (
    <div
      className={`ii-seal-dom${className ? ` ${className}` : ""}`}
      style={{
        position: "absolute",
        right: `${rightOffset * pxPerMm}px`,
        bottom: `${bottomOffset * pxPerMm}px`,
        width: `${box.w * pxPerMm}px`,
        height: `${box.h * pxPerMm}px`,
        zIndex: 4,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <SealMark business={business} type={variant} config={cfg} color={color} pxWidth={box.w * pxPerMm} />
    </div>
  );
}
