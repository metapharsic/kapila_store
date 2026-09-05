import { api } from "../../api/client";

export const createAudit = (body) => api.post("/audits", body);
export const getAudits = (status) => api.get("/audits", { status });
export const getAudit = (id) => api.get(`/audits/${id}`);
export const patchAuditItem = (id, itemId, body) => api.patch(`/audits/${id}/items/${itemId}`, body);
export const finaliseAudit = (id, body) => api.post(`/audits/${id}/finalise`, body);
export const cancelAudit = (id) => api.delete(`/audits/${id}`);
export const getAuditsSummary = () => api.get("/audits/summary");
