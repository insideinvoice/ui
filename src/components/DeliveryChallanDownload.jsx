import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import CompanySeal from "./CompanySeal";
import CompanyStamp from "./CompanyStamp";
import DeliveryChallanDoc from "./DeliveryChallanDoc";
import { chunkDcItems, buildDeliveryChallanPdf, DC_SEAL_MM, DC_STAMP_MM } from "../utils/deliveryChallanPdf";

function buildStampSvg(business, sealType) {
  const name = business?.businessName || business?.name || "COMPANY";
  if (sealType === "stamp") {
    return renderToStaticMarkup(
      <CompanyStamp
        companyName={name}
        addressLine1={business?.addressLine1 || ""}
        addressLine2={[business?.addressLine2, business?.city, business?.state].filter(Boolean).join(", ")}
        phone={business?.phone ? `Ph: ${business.phone}` : ""}
        email={business?.email || ""}
        width={512}
      />
    );
  }
  return renderToStaticMarkup(<CompanySeal companyName={name} size={256} />);
}

// Renders every page of a saved (or form-built) delivery challan offscreen,
// captures them, and returns a jsPDF with the chosen seal/stamp placed at the
// fixed bottom-right corner on every page when sealOn is set.
export async function renderDeliveryChallanPdf(
  dc,
  business,
  { variant = "classic", sealOn = true, sealType = "round" } = {}
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
    const stampSvg = sealOn ? buildStampSvg(business, sealType) : null;
    const seal = sealType === "stamp" ? DC_STAMP_MM : DC_SEAL_MM;
    return await buildDeliveryChallanPdf(pages, {
      stampSvg,
      stampWMm: seal.w,
      stampHMm: seal.h,
    });
  } finally {
    root.unmount();
    container.remove();
  }
}
