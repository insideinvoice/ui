import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InvoiceTemplateVariants from "./src/components/InvoiceTemplateVariants.jsx";
import InvoicePDF from "./src/components/InvoicePDF.jsx";

const sampleBusiness = {
  businessName: "RS Hardware Glass & Electrical",
  gstIn: "29ABCDE1234F1Z5", phone: "+91 98765 43210", email: "acme@example.com",
  addressLine1: "12 MG Road", addressLine2: "Bengaluru", city: "Bengaluru",
  state: "Karnataka", pincode: "560001",
};
const sampleCustomer = { name: "Beta Traders", gstIn: "29XYZAB5678G1Z2", billingAddress: "45 Brigade Road", city: "Bengaluru", state: "Karnataka", pincode: "560025" };
const sampleForm = { invoiceDate: "2026-10-19", dueDate: "2026-10-25", placeOfSupply: "Karnataka", invoiceNumber: "INV-2026-001" };
const sampleItems = [
  { itemName: "Premium Teak Wood Plank 6ft", hsnCode: "4407", qty: 12, rate: 1200, gstRate: 18 },
  { itemName: "Marine Plywood 19mm", hsnCode: "4412", qty: 8, rate: 2500, gstRate: 18 },
];

const which = process.argv[2] || "template-3";
const type = process.argv[3] || "TAX_INVOICE";
const props = { theme: which, business: sampleBusiness, customer: sampleCustomer, form: sampleForm, items: sampleItems, discountPercent: "0", type, invoiceNumber: "INV-2026-001" };
const html = renderToStaticMarkup(which === "template-1" ? <InvoicePDF {...props} /> : <InvoiceTemplateVariants {...props} />);
console.log(html);
