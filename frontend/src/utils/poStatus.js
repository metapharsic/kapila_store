// Single source of truth for Purchase Order status badges + field labels.
// Before this file, 5 screens each hardcoded their own status→color map —
// 3 of them silently collapsed Pending/Approved/Rejected into a generic
// grey "Draft" look, and Rejected had zero styling anywhere. Import this
// wherever a PO status badge or PO field label is rendered.

export const PO_STATUS_CONFIG = {
  Draft:     { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8", label: "Draft" },
  Pending:   { bg: "#fffbeb", text: "#b45309", dot: "#f59e0b", label: "Pending" },
  Approved:  { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6", label: "Approved" },
  Sent:      { bg: "#ecfdf5", text: "#059669", dot: "#10b981", label: "Sent" },
  Received:  { bg: "#d1fae5", text: "#047857", dot: "#059669", label: "Received" },
  Cancelled: { bg: "#fff1f2", text: "#e11d48", dot: "#f43f5e", label: "Cancelled" },
  Rejected:  { bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444", label: "Rejected" },
};

export function poStatusStyle(status) {
  return PO_STATUS_CONFIG[status] || PO_STATUS_CONFIG.Draft;
}

// All statuses a PO can actually reach — use for filter pills, dropdowns.
export const PO_STATUSES = Object.keys(PO_STATUS_CONFIG);

// Canonical field labels — was "PO Number"/"PO #"/"PO:" and "Unit Price"/"Rate"
// and "PO Date"/"Created Date" across different screens for the same field.
export const PO_LABELS = {
  poNumber: "PO Number",
  poDate: "PO Date",
  unitPrice: "Unit Price",
  screenTitle: "Purchase Orders",
};
