import { useState } from "react";

/**
 * The company logo, in a fixed square box.
 *
 * One box for every template, so the same upload prints identically on the
 * Enterprise sheet, the classic sheet and the gallery variants. The natural
 * size is measured and the CONTAIN-FIT dimensions are written explicitly:
 * html2canvas (the PDF engine) ignores `object-fit`, so without this a
 * non-square upload prints stretched to the box instead of letterboxed.
 */
export default function CompanyLogo({ src, size = 56, style }) {
  const [fit, setFit] = useState(null);

  if (!src) return null;

  const onLoad = (e) => {
    const nw = e.currentTarget.naturalWidth;
    const nh = e.currentTarget.naturalHeight;
    if (!nw || !nh || fit) return;
    const s = Math.min((size - 2) / nw, (size - 2) / nh);
    setFit({ w: Math.round(nw * s), h: Math.round(nh * s) });
  };

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: "1px solid #d6d6d6",
        borderRadius: "4px",
        overflow: "hidden",
        background: "#ffffff",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <img
        src={src}
        alt="logo"
        onLoad={onLoad}
        style={
          fit
            ? { width: `${fit.w}px`, height: `${fit.h}px`, display: "block" }
            : { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }
        }
      />
    </div>
  );
}
