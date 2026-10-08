import React from "react";
import { useAuth } from "../context/AuthContext";
import InvoicePDF from "./InvoicePDF";
import InvoiceTemplateVariants from "./InvoiceTemplateVariants";
import { sanitizeTemplate } from "../constants/paperSizes";

const PAPER_WIDTHS = {
  A4_PORTRAIT: 794,
  A4_LANDSCAPE: 1123,
  A5: 559,
  LETTER: 816,
};

// Kept as a separate component so the hook is always called unconditionally —
// calling useAuth() inside try/catch breaks the Rules of Hooks whenever the
// context happens to be available, changing hook order between renders.
function useTemplatePreference() {
  try {
    return useAuth().selectedTemplate;
  } catch {
    return typeof window !== "undefined"
      ? localStorage.getItem("invoice_template") || "template-1"
      : "template-1";
  }
}

const InvoiceTemplateRenderer = React.forwardRef((props, ref) => {
  const { paperSize, template } = props;
  const globalTemplate = useTemplatePreference();

  const templateId = sanitizeTemplate(template || globalTemplate);
  const width = PAPER_WIDTHS[paperSize] || 794;

  const wrapperStyle = { width: `${width}px`, maxWidth: "100%", overflow: "hidden", margin: "0 auto" };

  if (templateId === "template-1") {
    return (
      <div style={{ overflowX: "auto", width: "100%" }}>
        <div style={wrapperStyle}>
          <InvoicePDF ref={ref} {...props} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <div style={wrapperStyle}>
        <InvoiceTemplateVariants ref={ref} theme={templateId} {...props} />
      </div>
    </div>
  );
});

InvoiceTemplateRenderer.displayName = "InvoiceTemplateRenderer";
// Memoized: the wrapped templates are thousands of DOM nodes, so skipping the
// wrapper when every prop is shallow-equal avoids re-diffing the whole document.
export default React.memo(InvoiceTemplateRenderer);
