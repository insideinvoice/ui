import { PX_PER_MM, normalizeSealConfig, signatureBoxMm } from "../utils/sealConfig";

/**
 * Free-form signature overlay — the placement counterpart of SealOverlay.
 *
 * Renders ONLY when the business saved a signature placement (sealConfig
 * .signature, set from Settings' placement modal); every template otherwise
 * keeps its inline signature image untouched, so existing documents never
 * change appearance. The overlay floats above the frame like the seal, and
 * travels with drag-placement in the Settings preview.
 */
export default function SignatureOverlay({
  business,
  sigSrc,
  config,
  className = "",
  pxPerMm = PX_PER_MM,
  insetMm = 0,
  bleedMm = 0,
}) {
  if (!sigSrc) return null;
  const cfg = normalizeSealConfig(config || business?.sealConfig || null);
  const sig = cfg.signature;
  if (!sig) return null; // no saved placement → inline rendering as always

  const box = signatureBoxMm(sig);
  const bleed = insetMm + bleedMm;
  const rightOffset = Math.max(sig.rightMm - insetMm, -bleed);
  const bottomOffset = Math.max(sig.bottomMm - insetMm, -bleed);

  return (
    <img
      src={sigSrc}
      alt=""
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        right: `${rightOffset * pxPerMm}px`,
        bottom: `${bottomOffset * pxPerMm}px`,
        width: `${box.w * pxPerMm}px`,
        height: "auto",
        transform: `rotate(${sig.tilt}deg)`,
        transformOrigin: "center",
        zIndex: 5,
        pointerEvents: "none",
        opacity: 0.95,
        mixBlendMode: "multiply",
      }}
    />
  );
}
