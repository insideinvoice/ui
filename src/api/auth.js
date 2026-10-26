import api from "./axios";

export const authAPI = {
  signup: (data) => api.post("/auth/signup", data),
  login: (data) => api.post("/auth/login", data),
  forgotPassword: (data) => api.post("/auth/forgot-password", data),
  resetPassword: (data) => api.post("/auth/reset-password", data),
  updateProfile: (data) => api.put("/auth/profile", data),
  // Fresh current-user profile: the stored snapshot is only written at login,
  // so the app re-reads it on boot (profile edits show without a re-login).
  me: () => api.get("/auth/me"),
  changePassword: (data) => api.put("/auth/change-password", data),
  // Instagram-style handle availability (case-insensitive server-side).
  checkUsername: (username) => api.get(`/auth/username-available?username=${encodeURIComponent(username)}`),
  // Explicit bearer: storage is wiped synchronously right after this call, so we
  // cannot rely on the axios request interceptor to still find the token.
  logout: (token) =>
    api.post("/auth/logout", null, token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
};

export const businessAPI = {
  setup: (data) => api.post("/business/setup", data),
  getProfile: () => api.get("/business/me"),
  update: (data) => api.put("/business/update", data),
  updateInvoiceSettings: (data) => api.put("/business/invoice-settings", data),
  uploadSignature: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/business/signature", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    });
  },
  removeSignature: () => api.delete("/business/signature"),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/business/logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    });
  },
  removeLogo: () => api.delete("/business/logo"),
  industries: () => api.get("/industries"),
};

export const customerAPI = {
  create: (data) => api.post("/customers", data),
  getAll: (params) => api.get("/customers", { params }),
  getById: (id) => api.get(`/customers/${id}`),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  check: (data) => api.post("/customers/check", data),
};

/**
 * POST /customers rejects with 409 when the phone/email already belongs to a
 * customer of the CALLER's business — uniqueness is per tenant, so another
 * business holding the same details never conflicts. When that happens, look
 * the existing record up and return it in the same shape as create() so the
 * caller links to it instead of failing (invoice saves, offline sync queue).
 */
export const createCustomerOrAdopt = async (data) => {
  try {
    return await api.post("/customers", data);
  } catch (err) {
    if (err.response?.status !== 409) throw err;
    let found = null;
    try {
      found = (await api.post("/customers/check", data)).data?.data;
    } catch {
      /* 404 = no match, fall through to rethrow the original conflict */
    }
    if (!found) throw err;
    return { data: { data: found }, adopted: true };
  }
};

export const productAPI = {
  create: (data) => api.post("/products", data),
  getAll: (params) => api.get("/products", { params }),
  getById: (id) => api.get(`/products/${id}`),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  findByHsn: (hsn) => api.get(`/products/by-hsn/${encodeURIComponent(hsn.trim())}`),
  findByName: (name) => api.get("/products/by-name", { params: { name: name.trim() } }),
};

export const invoiceAPI = {
  create: (data) => api.post("/invoices", data),
  getAll: (params) => api.get("/invoices", { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  // Public share link (idempotent: returns the existing active token or creates one)
  createShare: (id) => api.post(`/invoices/${id}/share`),
  revokeShare: (id) => api.delete(`/invoices/${id}/share`),
  regenerateShare: (id) => api.post(`/invoices/${id}/share/regenerate`),
  // Email the invoice + share link to the customer (backend creates the link on
  // demand). `pdfFile` is the SAME client-rendered PDF the Download button
  // produces (seal/stamp included), attached so the emailed document matches
  // the download exactly. Sent as multipart because of the file part.
  sendInvoiceEmail: (id, origin, pdfFile) => {
    const form = new FormData();
    form.append("frontendOrigin", origin || "");
    if (pdfFile) form.append("pdf", pdfFile);
    // The axios instance defaults every request to application/json, which would
    // be sent alongside this multipart body and get rejected with 415. Override
    // it explicitly, exactly as uploadSignature does.
    return api.post(`/invoices/${id}/email`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    });
  },
};

export const deliveryChallanAPI = {
  create: (data) => api.post("/delivery-challans", data),
  getAll: (params) => api.get("/delivery-challans", { params }),
  getById: (id) => api.get(`/delivery-challans/${id}`),
  delete: (id) => api.delete(`/delivery-challans/${id}`),
};

export const paymentAPI = {
  create: (data) => api.post("/payments", data),
  getAll: (params) => api.get("/payments", { params }),
  getById: (id) => api.get(`/payments/${id}`),
  getByInvoice: (invoiceId) => api.get(`/payments/by-invoice/${invoiceId}`),
  delete: (id) => api.delete(`/payments/${id}`),
};

export const labelAPI = {
  shipping: {
    create: (data) => api.post("/labels/shipping", data),
    list: (params) => api.get("/labels/shipping", { params }),
    get: (id) => api.get(`/labels/shipping/${id}`),
    update: (id, data) => api.put(`/labels/shipping/${id}`, data),
    remove: (id) => api.delete(`/labels/shipping/${id}`),
    preview: (data) =>
      api.post("/labels/shipping/preview", data, { responseType: "blob", timeout: 120000 }),
    previewById: (id) =>
      api.post(`/labels/shipping/${id}/preview`, {}, { responseType: "blob", timeout: 120000 }),
    pdf: (id) => api.get(`/labels/shipping/${id}/pdf`, { responseType: "blob", timeout: 120000 }),
    generate: (id) =>
      api.post(`/labels/shipping/${id}/generate`, {}, { responseType: "blob", timeout: 120000 }),
    bulkPdf: (ids) =>
      api.post(`/labels/shipping/bulk-pdf?ids=${ids.join(",")}`, {}, { responseType: "blob", timeout: 120000 }),
    zpl: (id) => api.get(`/labels/shipping/${id}/zpl`, { responseType: "blob" }),
    markPrinted: (id) => api.post(`/labels/shipping/${id}/mark-printed`),
    fromInvoice: (invoiceId) => api.post(`/labels/shipping/from-invoice/${invoiceId}`),
  },
  hazmat: {
    create: (data) => api.post("/labels/hazmat", data),
    list: (params) => api.get("/labels/hazmat", { params }),
    get: (id) => api.get(`/labels/hazmat/${id}`),
    update: (id, data) => api.put(`/labels/hazmat/${id}`, data),
    remove: (id) => api.delete(`/labels/hazmat/${id}`),
    preview: (data) =>
      api.post("/labels/hazmat/preview", data, { responseType: "blob", timeout: 120000 }),
    pdf: (id) => api.get(`/labels/hazmat/${id}/pdf`, { responseType: "blob", timeout: 120000 }),
    generate: (id) =>
      api.post(`/labels/hazmat/${id}/generate`, {}, { responseType: "blob", timeout: 120000 }),
    bulkPdf: (ids) =>
      api.post(`/labels/hazmat/bulk-pdf?ids=${ids.join(",")}`, {}, { responseType: "blob", timeout: 120000 }),
    zpl: (id) => api.get(`/labels/hazmat/${id}/zpl`, { responseType: "blob" }),
    markPrinted: (id) => api.post(`/labels/hazmat/${id}/mark-printed`),
    unNumbers: (q) => api.get(`/labels/hazmat/un-numbers?q=${encodeURIComponent(q || "")}`),
    classes: () => api.get("/labels/hazmat/classes"),
  },
};

export const adminAPI = {
  createUser: (data) => api.post("/auth/signup", { ...data, businessName: data.businessName || undefined }),
  getStats: () => api.get("/admin/stats"),
  // Paginated admin lists — params: { page, size, q, ...sort } → PagedResponse.
  getAllUsers: (params) => api.get("/admin/users", { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  getAllBusinesses: (params) => api.get("/admin/businesses", { params }),
  getBusinessInvoices: (businessId, params) => api.get(`/admin/businesses/${businessId}/invoices`, { params }),
  // Per-user workspace (admin triage console) — see AdminUserWorkspace.
  getBusinessCustomers: (businessId, params) => api.get(`/admin/businesses/${businessId}/customers`, { params }),
  createBusinessCustomer: (businessId, data) => api.post(`/admin/businesses/${businessId}/customers`, data),
  getBusinessProducts: (businessId, params) => api.get(`/admin/businesses/${businessId}/products`, { params }),
  createBusinessInvoice: (businessId, data) => api.post(`/admin/businesses/${businessId}/invoices`, data),
  deleteInvoiceAsAdmin: (invoiceId) => api.delete(`/admin/invoices/${invoiceId}`),
  deleteCustomerAsAdmin: (customerId) => api.delete(`/admin/customers/${customerId}`),
  getInvoice: (id) => api.get(`/admin/invoices/${id}`),
  updateInvoice: (id, data) => api.put(`/admin/invoices/${id}`, data),
  updatePassword: (id, data) => api.put(`/admin/users/${id}/password`, data),
  updateRole: (id, role, adminPassword) => api.put(`/admin/users/${id}/role`, adminPassword ? { role, adminPassword } : { role }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getAllCustomers: (params) => api.get("/admin/customers", { params }),
  getAllInvoices: (params) => api.get("/admin/invoices", { params }),
  getBusiness: (id) => api.get(`/admin/businesses/${id}`),
  getAnalytics: () => api.get("/admin/analytics"),
  // SQL-side aggregates (KPIs/charts) — { businessId? } → SalesAnalyticsResponse.
  getSalesAnalytics: (params) => api.get("/admin/sales-analytics", { params }),
};
export const patAPI = {
  list: () => api.get("/pats"),
  create: (data) => api.post("/pats", data),
  revoke: (id) => api.delete(`/pats/${id}`),
};
