import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CompanySeal from "../components/CompanySeal";
import CompanyStamp from "../components/CompanyStamp";

/**
 * Serialises the active seal to standalone SVG markup. The PDF pipelines
 * rasterise this once and stamp the PNG onto every page, so the downloaded
 * document always uses the configured size/tilt/position rather than whatever
 * happens to be in the captured DOM.
 */
export function sealSvgMarkup(spec) {
  const type = spec?.type === "stamp" ? "stamp" : "round";
  const tilt = Number.isFinite(spec?.tilt) ? spec.tilt : type === "stamp" ? -6 : -8;
  // Ink colour follows the saved config; the components' own defaults remain
  // the fallback so an older spec without a colour renders unchanged.
  const color = typeof spec?.color === "string" && spec.color ? spec.color : undefined;

  if (type === "stamp") {
    return renderToStaticMarkup(
      <CompanyStamp
        companyName={spec?.companyName || "COMPANY NAME"}
        addressLine1={spec?.addressLine1 || ""}
        addressLine2={spec?.addressLine2 || ""}
        phone={spec?.phone || ""}
        email={spec?.email || ""}
        width={512}
        tilt={tilt}
        color={color}
      />
    );
  }

  return renderToStaticMarkup(
    <CompanySeal
      companyName={spec?.companyName || "COMPANY NAME"}
      year={new Date().getFullYear()}
      size={512}
      tilt={tilt}
      color={color}
    />
  );
}
