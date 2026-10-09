import axios from "axios";
import { getApiBaseURL } from "../config/api";

// Dedicated client for token-gated public invoice endpoints:
// - never attaches the user's JWT (the share token in the URL is the only credential)
// - never force-logs-out on 401 (an anonymous visitor must not touch auth state)
const publicApi = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 20000,
  referrerPolicy: "no-referrer",
});

// Optional `type` ("TAX_INVOICE" | "PROFORMA_INVOICE") picks which of the two documents
// is rendered from the same share token; omit it to use the invoice's stored type.
const typeParams = (type) => (type ? { params: { type } } : {});

export const publicInvoiceAPI = {
  getByToken: (token, type) =>
    publicApi.get(`/public/invoices/${encodeURIComponent(token)}`, typeParams(type)),
  pdfUrl: (token, type) =>
    `${getApiBaseURL()}/public/invoices/${encodeURIComponent(token)}/pdf` +
    (type ? `?type=${encodeURIComponent(type)}` : ""),
  pdfBlob: (token, type) =>
    publicApi.get(`/public/invoices/${encodeURIComponent(token)}/pdf`, {
      responseType: "blob",
      ...typeParams(type),
    }),
};

export default publicApi;
