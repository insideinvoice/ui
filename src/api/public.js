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

export const publicInvoiceAPI = {
  getByToken: (token) => publicApi.get(`/public/invoices/${encodeURIComponent(token)}`),
  pdfUrl: (token) => `${getApiBaseURL()}/public/invoices/${encodeURIComponent(token)}/pdf`,
  pdfBlob: (token) =>
    publicApi.get(`/public/invoices/${encodeURIComponent(token)}/pdf`, { responseType: "blob" }),
};

export default publicApi;
