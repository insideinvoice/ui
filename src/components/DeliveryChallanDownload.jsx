import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import CompanySeal from "./CompanySeal";
import DeliveryChallanDoc from "./DeliveryChallanDoc";
import { chunkDcItems, buildDeliveryChallanPdf } from "../utils/deliveryChallanPdf";

function buildSealSvg(companyName) {
  return renderToStaticMarkup(
    <CompanySeal companyName={companyName || "COMPANY"} size={256} />
  );
}

// Renders every page of a saved (or form-built) delivery challan offscreen,
// captures them, and returns a jsPDF with the fixed bottom-right seal stamped
// on every page when sealOn is set.
export async function renderDeliveryChallanPdf(
  dc,
  business,
  { variant = "classic", sealOn = true } = {}
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
    const stampSvg = sealOn
      ? buildSealSvg(business?.businessName || business?.name || "COMPANY")
      : null;
    return await buildDeliveryChallanPdf(pages, { stampSvg });
  } finally {
    root.unmount();
    container.remove();
  }
}
