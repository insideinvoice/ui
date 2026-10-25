import api from "./axios";

// Settings → GST & Compliance → E-Invoicing. Credentials are write-only:
// the backend encrypts them at rest and never returns them.
export const eInvoiceAPI = {
  getConfig: () => api.get("/einvoice/config"),
  saveConfig: (data) => api.put("/einvoice/config", data),
  testConnection: () => api.post("/einvoice/config/test"),
  audit: () => api.get("/einvoice/audit"),
  getStatus: (invoiceId) => api.get(`/einvoice/status/${invoiceId}`),
  register: (invoiceId) => api.post(`/einvoice/register/${invoiceId}`),
};
