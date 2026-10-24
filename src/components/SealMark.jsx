import CompanySeal from "./CompanySeal";
import CompanyStamp from "./CompanyStamp";
import { normalizeSealConfig, resolveSealConfig, sealBoxMm, PX_PER_MM } from "../utils/sealConfig";

/**
 * Renders one company seal/stamp at the configured size and tilt. The
 * component is presentation-only; callers decide where it sits (inline
 * overlay, settings preview, PDF stamp source).
 */
export default function SealMark({ business, type = "round", config, color, pxWidth }) {
  const variant = type === "stamp" ? "stamp" : "round";
  const cfg = normalizeSealConfig(config || resolveSealConfig(business));
  const box = sealBoxMm(variant, cfg);
  const width = pxWidth || box.w * PX_PER_MM;

  if (variant === "stamp") {
    return (
      <CompanyStamp
        companyName={business?.businessName || business?.name || "COMPANY NAME"}
        addressLine1={business?.addressLine1 || ""}
        addressLine2={[business?.addressLine2, business?.city, business?.state, business?.pincode ? "-" + business.pincode : ""]
          .filter(Boolean)
          .join(", ")}
        phone={business?.phone ? `Ph: ${business.phone}` : ""}
        email={business?.email ? `E-Mail: ${business.email}` : ""}
        width={width}
        tilt={cfg.stamp.tilt}
        color={color || cfg.stamp.color}
      />
    );
  }

  return (
    <CompanySeal
      companyName={business?.businessName || business?.name || "COMPANY NAME"}
      year={new Date().getFullYear()}
      size={width}
      tilt={cfg.round.tilt}
      color={color || cfg.round.color}
    />
  );
}
