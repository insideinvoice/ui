import React from "react";
import CompanySeal from "./CompanySeal";
import CompanyStamp from "./CompanyStamp";
import { getSpecialistInLine } from "../utils/specialistIn";
import {
  DC_PAGE_W,
  DC_PAGE_H,
  DC_SEAL_MM,
  DC_STAMP_MM,
  fmtDate,
  fmtQty,
  panFromGstin,
} from "../utils/deliveryChallanPdf";

const SANS = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const SCRIPT =
  "'Snell Roundhand', 'Apple Chancery', 'Edwardian Script ITC', 'Brush Script MT', cursive";
const SERIF_IT = "Georgia, 'Times New Roman', serif";

const BORDER2 = "2px solid #000";
const BORDER1 = "1px solid #000";
const MM = DC_PAGE_W / 190; // px per mm at A4 content width

function clip(text, max) {
  const s = String(text ?? "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function businessLines(b = {}) {
  const line1 = [b.addressLine1, b.addressLine2].filter(Boolean).join(", ");
  let line2 = [b.city, b.pincode ? `- ${b.pincode}` : ""]
    .filter(Boolean)
    .join(" ");
  if (b.state) line2 = [line2, b.state].filter(Boolean).join(", ");
  const contact = [
    b.phone ? `Mob.: ${b.phone}` : "",
    b.email ? `Email: ${b.email}` : "",
  ]
    .filter(Boolean)
    .join("   ");
  return { line1: clip(line1, 72), line2: clip(line2, 48), contact: clip(contact, 78) };
}

function customerAddress(c = {}) {
  return clip([c.billingAddress, c.city].filter(Boolean).join(", "), 110);
}

/* ------------------------------- CLASSIC (NOBLE) ------------------------------- */

function ClassicPage({ business, customer, challan, items }) {
  const b = businessLines(business);
  const gst = business?.gstIn || "";
  const pan = panFromGstin(gst);
  const specialist = getSpecialistInLine(business);

  return (
    <div
      data-dc-page
      data-variant="classic"
      style={{
        width: DC_PAGE_W,
        height: DC_PAGE_H,
        boxSizing: "border-box",
        background: "#fff",
        color: "#000",
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Top strip: GST | DELIVERY CHALLAN | PAN */}
      <div
        style={{
          height: 24,
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, whiteSpace: "nowrap" }}>{gst && `GST : ${gst}`}</div>
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2.5 }}>
          DELIVERY CHALLAN
        </div>
        <div style={{ flex: 1, textAlign: "right", whiteSpace: "nowrap" }}>
          {pan && `PAN : ${pan}`}
        </div>
      </div>

      {/* Company box */}
      <div
        style={{
          height: 96,
          border: BORDER2,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "4px 10px",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: 0.4 }}>
          {business?.businessName}
        </div>
        {specialist && (
          <div
            style={{
              fontSize: 10.5,
              lineHeight: "14px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            SPECIALIST IN : {specialist}
          </div>
        )}
        {b.line1 && <div style={{ fontSize: 10.5, lineHeight: "14px" }}>{b.line1}</div>}
        {b.line2 && <div style={{ fontSize: 10.5, lineHeight: "14px" }}>{b.line2}</div>}
        {b.contact && (
          <div style={{ fontSize: 10.5, lineHeight: "14px" }}>{b.contact}</div>
        )}
      </div>

      {/* Party box: M/s + No/Date */}
      <div
        style={{
          height: 78,
          border: BORDER2,
          marginTop: -2,
          boxSizing: "border-box",
          display: "flex",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: "0 0 72%",
            borderRight: BORDER2,
            padding: "4px 8px",
            overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800 }}>M/s:</div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              lineHeight: "18px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {customer?.name}
          </div>
          <div style={{ fontSize: 10.5, lineHeight: "14px" }}>
            {customerAddress(customer)}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: "7px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 800 }}>
            No.: {challan.challanNumber}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800 }}>
            Date : {fmtDate(challan.challanDate)}
          </div>
        </div>
      </div>

      {/* P.O box */}
      <div
        style={{
          height: 36,
          border: BORDER2,
          marginTop: -2,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          fontSize: 11.5,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden" }}>
          Your P.O No.: {challan.poNumber || ""}
        </div>
        <div style={{ whiteSpace: "nowrap" }}>
          Date : {challan.poDate ? fmtDate(challan.poDate) : ""}
        </div>
      </div>

      {/* Items table */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          border: BORDER2,
          marginTop: -2,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          flexShrink: 1,
        }}
      >
        <div
          style={{
            height: 32,
            borderBottom: BORDER2,
            display: "flex",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 78,
              borderRight: BORDER2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            Sl. No.
          </div>
          <div
            style={{
              flex: 1,
              borderRight: BORDER2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            DESCRIPTION
          </div>
          <div
            style={{
              width: 106,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            Quantity
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {items.map((item) => (
            <div
              key={item.sno}
              id={`section-item-row-${item.sno}`}
              style={{ height: 35, display: "flex", flexShrink: 0 }}
            >
              <div
                style={{
                  width: 78,
                  borderRight: BORDER2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11.5,
                }}
              >
                {item.sno}
              </div>
              <div
                style={{
                  flex: 1,
                  borderRight: BORDER2,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 8px",
                  fontSize: 11.5,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {clip(item.description, 92)}
              </div>
              <div
                style={{
                  width: 106,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11.5,
                }}
              >
                {fmtQty(item.quantity)}
              </div>
            </div>
          ))}
          {/* filler: keeps column dividers running to the table's bottom line */}
          <div
            aria-hidden="true"
            style={{ flex: "1 1 auto", minHeight: 0, display: "flex" }}
          >
            <div style={{ width: 78, borderRight: BORDER2 }} />
            <div style={{ flex: 1, borderRight: BORDER2 }} />
            <div style={{ width: 106 }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        id="section-footer"
        style={{
          height: 72,
          border: BORDER2,
          marginTop: -2,
          boxSizing: "border-box",
          display: "flex",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: "0 0 62%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "5px 8px",
          }}
        >
          <div style={{ fontSize: 10.5 }}>
            Received the above mentioned goods in good condition.
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 700 }}>Receiver's Signature</div>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingRight: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textAlign: "center" }}>
            For {business?.businessName}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- ROYAL ---------------------------------- */

function RoyalPage({ business, customer, challan, items }) {
  const b = businessLines(business);
  const gst = business?.gstIn || "";
  const pan = panFromGstin(gst);
  const specialist = getSpecialistInLine(business);

  const cellBase = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div
      data-dc-page
      data-variant="royal"
      style={{
        width: DC_PAGE_W,
        height: DC_PAGE_H,
        boxSizing: "border-box",
        background: "#fff",
        color: "#000",
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Title + company block */}
      <div
        style={{
          height: 82,
          display: "flex",
          alignItems: "flex-start",
          padding: specialist ? "4px 8px 0" : "6px 8px 0",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "44%",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 2,
            paddingTop: 10,
          }}
        >
          DELIVERY CHALLAN
        </div>
        <div style={{ flex: 1, textAlign: "right", overflow: "hidden" }}>
          <div
            style={{
              fontFamily: SCRIPT,
              fontSize: 24,
              lineHeight: specialist ? "24px" : "27px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {business?.businessName}
          </div>
          <div style={{ fontSize: 10, lineHeight: "13px" }}>{b.line1}</div>
          <div style={{ fontSize: 10, lineHeight: "13px" }}>{b.line2}</div>
          {b.contact && (
            <div style={{ fontSize: 10, lineHeight: "13px" }}>{b.contact}</div>
          )}
          {specialist && (
            <div
              style={{
                fontSize: 10,
                lineHeight: "13px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              SPECIALIST IN : {specialist}
            </div>
          )}
        </div>
      </div>

      {/* M/s dotted box (left) */}
      <div
        style={{
          height: 60,
          width: "47%",
          border: BORDER1,
          boxSizing: "border-box",
          padding: "3px 8px",
          flexShrink: 0,
          fontFamily: SERIF_IT,
        }}
      >
        <div style={{ fontSize: 11.5, fontStyle: "italic", fontWeight: 700 }}>
          M/s:
        </div>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            lineHeight: "16px",
            borderBottom: "1px dotted #000",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {customer?.name}
        </div>
        <div
          style={{
            fontSize: 10,
            lineHeight: "15px",
            borderBottom: "1px dotted #000",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {customerAddress(customer)}
        </div>
        <div style={{ borderBottom: "1px dotted #000", height: 14 }} />
      </div>

      {/* No/Date + GSTIN/PAN + salutation stack */}
      <div
        style={{
          marginTop: 4,
          border: BORDER1,
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: 26,
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            fontSize: 10.5,
            borderBottom: BORDER1,
          }}
        >
          <div style={{ flex: 1 }}>No.: {challan.challanNumber || ""}</div>
          <div>Date : {challan.challanDate ? fmtDate(challan.challanDate) : ""}</div>
        </div>
        <div
          style={{
            height: 26,
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            fontSize: 11,
            fontWeight: 800,
            borderBottom: BORDER1,
          }}
        >
          <div style={{ flex: 1 }}>
            {gst ? `GSTIN : ${gst}` : "GSTIN :"}
          </div>
          <div>{pan ? `PAN No.: ${pan}` : "PAN No.:"}</div>
        </div>
        <div
          style={{
            height: 52,
            padding: "5px 8px",
            fontFamily: SERIF_IT,
            fontWeight: 700,
            fontSize: 10.5,
            lineHeight: "14px",
          }}
        >
          <div>Your Ref.:{challan.poNumber ? ` ${challan.poNumber}` : ""}</div>
          <div>Dear Sir,</div>
          <div>
            We are sending here with the following materials, Request Kindly
            Acknowledge
          </div>
        </div>
      </div>

      {/* Items table */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          border: BORDER1,
          borderTop: "none",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: 30,
            borderBottom: BORDER1,
            display: "flex",
            flexShrink: 0,
            fontFamily: SERIF_IT,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 11,
          }}
        >
          <div
            style={{
              width: 56,
              borderRight: BORDER1,
              ...cellBase,
              flexDirection: "column",
              lineHeight: "11px",
              fontSize: 10,
            }}
          >
            <span>Sl.</span>
            <span>No.</span>
          </div>
          <div
            style={{
              flex: 1,
              borderRight: BORDER1,
              ...cellBase,
              fontSize: 12,
            }}
          >
            Description of Materials
          </div>
          <div style={{ width: 106, borderRight: BORDER1, ...cellBase }}>
            Quantity
          </div>
          <div style={{ width: 150, ...cellBase }}>Remarks</div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {items.map((item) => (
            <div
              key={item.sno}
              id={`section-item-row-${item.sno}`}
              style={{ height: 35, display: "flex", flexShrink: 0 }}
            >
              <div
                style={{
                  width: 56,
                  borderRight: BORDER1,
                  ...cellBase,
                  fontSize: 10.5,
                }}
              >
                {item.sno}
              </div>
              <div
                style={{
                  flex: 1,
                  borderRight: BORDER1,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 6px",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {clip(item.description, 70)}
              </div>
              <div
                style={{
                  width: 106,
                  borderRight: BORDER1,
                  ...cellBase,
                  fontSize: 11,
                }}
              >
                {fmtQty(item.quantity)}
              </div>
              <div style={{ width: 150, fontSize: 10.5, padding: "0 6px" }} />
            </div>
          ))}
          {/* filler: keeps column dividers running to the table's bottom line */}
          <div
            aria-hidden="true"
            style={{ flex: "1 1 auto", minHeight: 0, display: "flex" }}
          >
            <div style={{ width: 56, borderRight: BORDER1 }} />
            <div style={{ flex: 1, borderRight: BORDER1 }} />
            <div style={{ width: 106, borderRight: BORDER1 }} />
            <div style={{ width: 150 }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        id="section-footer"
        style={{
          height: 56,
          border: BORDER1,
          borderTop: "none",
          boxSizing: "border-box",
          flexShrink: 0,
          fontFamily: SERIF_IT,
        }}
      >
        <div
          style={{
            height: 28,
            display: "flex",
            alignItems: "center",
            borderBottom: BORDER1,
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "0 8px",
              fontSize: 10.5,
              fontStyle: "italic",
            }}
          >
            Material received in good condition
          </div>
          <div
            style={{
              padding: "0 8px",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>For</span>
            <span
              style={{
                fontFamily: SCRIPT,
                fontSize: 15,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {business?.businessName}
            </span>
          </div>
        </div>
        <div
          style={{
            height: 27,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "0 8px",
              fontSize: 10,
              fontStyle: "italic",
            }}
          >
            Receiver's Signature
          </div>
          <div style={{ padding: "0 8px", fontSize: 10, fontStyle: "italic" }}>
            Authorised Signatory
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- WRAPPER --------------------------------- */

function DeliveryChallanDoc({
  variant = "classic",
  business,
  customer,
  challanNumber,
  challanDate,
  poNumber,
  poDate,
  items = [],
  showSeal = false,
  sealType = "round",
}) {
  const challan = { challanNumber, challanDate, poNumber, poDate };
  const Page = variant === "royal" ? RoyalPage : ClassicPage;
  const stampBox = sealType === "stamp" ? DC_STAMP_MM : DC_SEAL_MM;

  return (
    <div style={{ position: "relative", width: DC_PAGE_W, flexShrink: 0 }}>
      <Page business={business} customer={customer} challan={challan} items={items} />
      {showSeal && (
        <div
          style={{
            position: "absolute",
            right: 10 * MM,
            bottom: 6 * MM,
            width: stampBox.w * MM,
            height: stampBox.h * MM,
            pointerEvents: "none",
          }}
        >
          {sealType === "stamp" ? (
            <CompanyStamp
              companyName={business?.businessName}
              addressLine1={business?.addressLine1 || ""}
              addressLine2={[business?.addressLine2, business?.city, business?.state].filter(Boolean).join(", ")}
              phone={business?.phone ? `Ph: ${business.phone}` : ""}
              email={business?.email || ""}
              width={Math.round(stampBox.w * MM)}
            />
          ) : (
            <CompanySeal
              companyName={business?.businessName}
              size={Math.round(stampBox.w * MM)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(DeliveryChallanDoc);
