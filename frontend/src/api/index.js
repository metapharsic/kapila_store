import { api } from "./client";

export const stock = {
  list:   (params) => api.get("/stock", params),
  create: (body)   => api.post("/stock", body),
  update: (id, payload) => api.patch(`/stock/${id}`, payload),
  updateUnit: (item_code, unit) => api.patch("/stock/unit", { item_code, unit }),
  remove: (id, reason) => api.delete(`/stock/${id}`, reason ? { reason } : undefined),
  ledger:   (params) => api.get("/stock/ledger", params),
  insights: () => api.get("/stock/insights"),
  available: (names, codes) => api.get("/stock/available", {
    names: Array.isArray(names) ? names.join(",") : names,
    codes: Array.isArray(codes) ? codes.join(",") : codes,
  }),
  reconcile: (body) => api.post("/stock/reconcile", body),
  supplierRates: (item) => api.get("/stock/supplier-rates", { item }),
  createAlias: (alias, item_code) => api.post("/stock/alias", { alias, item_code }),
  searchNLP: (query) => api.post("/stock/search-nlp", { query }),
  substitute: (name) => api.get("/stock/substitute", { name }),
};

export const indents = {
  list:            (params) => api.get("/indents", params),
  recommendations: (params) => api.get("/indents/recommendations", params),
  smartAutofill:   (body)   => api.post("/indents/smart-autofill", body),
  voiceParse:      (text)   => api.post("/indents/voice-parse", { text }),
  create:          (body)   => api.post("/indents", body),
  updateStatus:    (id, status) => api.patch(`/indents/${id}`, { status }),
  updateItems:     (id, items) => api.patch(`/indents/${id}/items`, { items }),
  remove:          (id) => api.delete(`/indents/${id}`),
  closeDay:        (body) => api.post("/indents/day-close", body),
};

export const issuances = {
  list:        (params) => api.get("/issuances", params),
  bulkPreview: () => api.get("/issuances/bulk-preview"),
  bulkIssue:   (indentIds) => api.post("/issuances/bulk-issue", { indentIds }),
  create:      (body)   => api.post("/issuances", body),
  remove:      (id)     => api.delete(`/issuances/${id}`),
};

export const production = {
  list:   (params) => api.get("/production", params),
  create: (body)   => api.post("/production", body),
};

export const leftovers = {
  list:   (params) => api.get("/leftovers", params),
  create: (body)   => api.post("/leftovers", body),
};

export const dashboard = {
  summary:   (date)   => api.get("/dashboard", { date }),
  storeHome: () => api.get("/dashboard/store-home"),
  morningBriefing: () => api.get("/dashboard/morning-briefing"),
  analytics: (params) => api.get("/dashboard/analytics", params),
  procurement: (params) => api.get("/dashboard/procurement", params),
  adhocSummary: (days) => api.get("/dashboard/adhoc-summary", { days }),
  indentFunnel: () => api.get("/dashboard/indent-funnel"),
};

export const search = {
  global: (q, modules) => api.get("/search", { q, modules }),
};

export const scan = {
  indent:   (image, mimeType) => api.post("/scan/indent", { image, mime_type: mimeType }),
  purchase: (image, mimeType, poId) => api.post("/scan/purchase", { image, mime_type: mimeType, po_id: poId }),
  text:     (text) => api.post("/scan/text", { text }),
  voice:    (audio, mimeType) => api.post("/scan/voice", { audio, mime_type: mimeType }),
};

export const suppliers = {
  list:   (params) => api.get("/suppliers", params),
  create: (body)   => api.post("/suppliers", body),
  update: (id, body) => api.patch(`/suppliers/${id}`, body),
  remove: (id)     => api.delete(`/suppliers/${id}`),
  performance: (id) => api.get(`/suppliers/${id}/performance`),
};

export const rateQuotes = {
  compare: (item_code) => api.get("/rate-quotes/compare", { item_code }),
  create: (body) => api.post("/rate-quotes", body),
};

export const purchaseOrders = {
  list:       (params) => api.get("/purchase-orders", params),
  getOne:     (id)     => api.get(`/purchase-orders/${id}`),
  create:     (body)   => api.post("/purchase-orders", body),
  update:     (id, body) => api.patch(`/purchase-orders/${id}`, body),
  remove:     (id)     => api.delete(`/purchase-orders/${id}`),
  autoDraft:  (supplier_id, preview = false) => api.post("/purchase-orders/auto-draft", { supplier_id, preview }),
};

export const grn = {
  list:   (params) => api.get("/grn", params),
  getOne: (id)     => api.get(`/grn/${id}`),
  create: (body)   => api.post("/grn", body),
  remove: (id)     => api.delete(`/grn/${id}`),
};

export const transfers = {
  list:   (params) => api.get("/transfers", params),
  getOne: (id)     => api.get(`/transfers/${id}`),
  create: (body)   => api.post("/transfers", body),
  accept: (id, body) => api.patch(`/transfers/${id}/accept`, body),
  reject: (id, body) => api.patch(`/transfers/${id}/reject`, body),
  remove: (id)     => api.delete(`/transfers/${id}`),
};

export const reorderPoints = {
  list:   (params) => api.get("/reorder-points", params),
  alerts: ()       => api.get("/reorder-points/alerts"),
  predictive: ()   => api.get("/reorder-points/predictive"),
  create: (body)   => api.post("/reorder-points", body),
  update: (id, body) => api.patch(`/reorder-points/${id}`, body),
  remove: (id)     => api.delete(`/reorder-points/${id}`),
};

export const notifications = {
  list:     () => api.get("/notifications"),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

export const approvals = {
  pending: () => api.get("/approvals/pending"),
  approve: (id, notes) => api.post(`/approvals/${id}/approve`, { notes }),
  reject:  (id, notes) => api.post(`/approvals/${id}/reject`, { notes }),
  rules:   () => api.get("/approvals/rules"),
  createRule: (body) => api.post("/approvals/rules", body),
  updateRule: (id, body) => api.patch(`/approvals/rules/${id}`, body),
  removeRule: (id) => api.delete(`/approvals/rules/${id}`),
};

export const departments = {
  list:   () => api.get("/departments"),
  items:  () => api.get("/departments/items"),
  create: (body)   => api.post("/departments", body),
  update: (id, body) => api.patch(`/departments/${id}`, body),
  remove: (id)     => api.delete(`/departments/${id}`),
};

export const recipes = {
  list: () => api.get("/recipes"),
  expirySuggestions: () => api.get("/recipes/expiry-suggestions"),
  create: (body) => api.post("/recipes", body),
  update: (id, body) => api.patch(`/recipes/${id}`, body),
  remove: (id) => api.delete(`/recipes/${id}`),
};

export const productionPlans = {
  list: (params) => api.get("/production-plans", params),
  create: (body) => api.post("/production-plans", body),
  update: (id, body) => api.patch(`/production-plans/${id}`, body),
  remove: (id) => api.delete(`/production-plans/${id}`),
  analytics: (params) => api.get("/production-plans/analytics", params),
};

export const menu = {
  list: (params) => api.get("/menu", params),
  create: (body) => api.post("/menu", body),
  update: (id, body) => api.patch(`/menu/${id}`, body),
  remove: (id) => api.delete(`/menu/${id}`),
};

export const approvedDelivery = {
  // multipart upload: file (PDF/image) + supplier_id
  scan:   (formData) => api.postUpload("/approved-delivery/scan", formData),
  // JSON commit after user review
  commit: (body)     => api.post("/approved-delivery/commit", body),
};

export const auth = {
  login: (body) => api.post("/auth/login", body),
  heartbeat: (sessionId) => api.post("/auth/heartbeat", { sessionId }),
  me: () => api.get("/auth/me"),
  refresh: () => api.post("/auth/refresh"),
  logout: (body) => api.post("/auth/logout", body),
  changePassword: (body) => api.post("/auth/change-password", body),
};

export const monitoring = {
  liveSessions: () => api.get("/monitoring/live-sessions"),
  terminateSession: (id, reason) => api.post(`/monitoring/terminate-session/${id}`, { reason }),
  streamUrl: () => "/api/monitoring/stream",
};

export const users = {
  list: (params) => api.get("/users", params),
  getOne: (id) => api.get(`/users/${id}`),
  create: (body) => api.post("/users", body),
  update: (id, body) => api.patch(`/users/${id}`, body),
  setActive: (id, is_active) => api.patch(`/users/${id}/activate`, { is_active }),
  resetPassword: (id, temporary_password) => api.post(`/users/${id}/reset-password`, { temporary_password }),
  activity: (id) => api.get(`/users/${id}/activity`),
};

export const roles = {
  list: () => api.get("/roles"),
  update: (id, body) => api.patch(`/roles/${id}`, body),
};

export const permissions = {
  list: () => api.get("/permissions"),
};

export const auditLogs = {
  list: (params) => api.get("/audit-logs", params),
};

export const chefStats = {
  overview: (params) => api.get("/chef-stats", params),
  detail:   (deptId, params) => api.get(`/chef-stats/${deptId}`, params),
};

export const audits = {
  summary: () => api.get("/audits/summary"),
};

export const anomalies = {
  list: (params) => api.get("/anomalies", params),
  update: (id, payload) => api.patch(`/anomalies/${id}`, payload),
};

export const handoffs = {
  latest: () => api.get("/handoffs/latest"),
  create: (body) => api.post("/handoffs", body)
};

export const reports = {
  downloadInventoryExcel: (params) =>
    api.download(
      "/reports/inventory-excel",
      params,
      `Kapila_Inventory_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
    ),
  previewInventoryMetadata: (params) => api.get("/reports/inventory-preview", params),
};

