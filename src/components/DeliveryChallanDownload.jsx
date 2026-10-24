import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import DeliveryChallanDoc from "./DeliveryChallanDoc";
import { chunkDcItems, buildDeliveryChallanPdf } from "../utils/deliveryChallanPdf";
import { resolveSealConfig, sealBoxMm } from "../utils/sealConfig";
import { sealSvgMarkup } from "../utils/sealSvg";

// Renders every page of a saved (or form-built) delivery challan offscreen,
// captures them, and returns a jsPDF with the chosen seal/stamp placed at the
// configured edge offsets on every page when sealOn is set.
export async function renderDeliveryChallanPdf(
  dc,
  business,
  { variant = "classic", sealOn = true, sealType = null } = {}
) {
  const chunks = chunkDcItems(dc.items || []);
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed; left:-10000px; top:0; z-index:-1; pointer-events:none;";
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    flushSync(() => {
      root.render(
        <>
          {chunks.map((chunk, i) => (
            <DeliveryChallanDoc
              key={i}
              variant={variant}
              business={business}
              customer={{
                name: dc.customerName,
                billingAddress: dc.customerAddress,
                phone: dc.customerPhone,
                gstIn: dc.customerGstIn,
              }}
              challanNumber={dc.challanNumber}
              challanDate={dc.challanDate}
              poNumber={dc.poNumber}
              poDate={dc.poDate}
              items={chunk}
            />
          ))}
        </>
      );
    });

    const pages = Array.from(container.querySelectorAll("[data-dc-page]"));
    // Callers that don't track a per-document pick (list download, invoice
    // save flow) inherit the business's saved variant instead of silently
    // falling back to the round seal on a stamp-configured account.
    const chosenType =
      sealType === "stamp" || sealType === "round"
        ? sealType
        : business?.sealType === "stamp"
          ? "stamp"
          : "round";
    const type = chosenType;
    const config = resolveSealConfig(business);
    const variantCfg = config[type];
    const box = sealBoxMm(type, config);
    const stampSvg = sealOn
      ? sealSvgMarkup({
          type,
          tilt: variantCfg.tilt,
          color: variantCfg.color,
          companyName: business?.businessName || business?.name || "COMPANY",
          addressLine1: business?.addressLine1 || "",
          addressLine2: [business?.addressLine2, business?.city, business?.state].filter(Boolean).join(", "),
          phone: business?.phone ? `Ph: ${business.phone}` : "",
          email: business?.email || "",
        })
      : null;

    return await buildDeliveryChallanPdf(pages, {
      stampSvg,
      stampWMm: box.w,
      stampHMm: box.h,
      stampRightMm: variantCfg.rightMm,
      stampBottomMm: variantCfg.bottomMm,
      stampAllPages: config.allPages !== false,
    });
  } finally {
    root.unmount();
    container.remove();
  }
}
