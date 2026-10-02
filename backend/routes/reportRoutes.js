const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { requireAnyPermission, requirePermission } = require("../middleware/authorize");

// ── Existing endpoints ─────────────────────────────────────────────────────────
router.get("/inventory-excel",   reportController.exportInventoryExcel);
router.get("/inventory-preview", reportController.previewInventoryMetadata);

// ── Granular Admin Intelligence Reporting (Admin-gated) ────────────────────────

// All searchable dimensions: items, vendors, categories, departments, dishes
router.get(
  "/admin-dimensions",
  requireAnyPermission(["dashboard.view", "stock.view"]),
  reportController.getAdminDimensions
);

// Full item history chain: PO → GRN → Batch → Ledger → Issuance → Department
router.get(
  "/item-history/:itemCode",
  requireAnyPermission(["dashboard.view", "stock.view"]),
  reportController.getItemHistory
);

// Vendor 360°: categories, items, POs, GRNs, spend, price trend over time
router.get(
  "/vendor-profile/:supplierId",
  requireAnyPermission(["dashboard.view", "stock.view"]),
  reportController.getVendorProfile
);

// Indent trace: indent → approved line items → issuances → stock deductions
router.get(
  "/indent-trace/:indentId",
  requireAnyPermission(["dashboard.view", "indents.view"]),
  reportController.getIndentTrace
);

// Category + dish lens: pivot by category or dish with spend/consumption
router.get(
  "/category-lens",
  requireAnyPermission(["dashboard.view", "stock.view"]),
  reportController.getCategoryLens
);

// Cross-Module Intelligence & Anomaly Engine (Multi-Agent: Analyst, Scout, Indent, PO-GRN, Composer)
router.get(
  "/cross-module-insights",
  requireAnyPermission(["dashboard.view", "stock.view"]),
  reportController.getCrossModuleInsights
);

// System Integrity & Data Quality Audit Engine (Agent Veritas)
router.get(
  "/data-quality-audit",
  requireAnyPermission(["dashboard.view", "stock.view"]),
  reportController.getDataQualityAudit
);

// Report settings (admin-configurable thresholds for cross-module insights)
router.get(
  "/settings",
  requireAnyPermission(["dashboard.view", "stock.view", "settings.view", "settings.manage"]),
  reportController.getReportSettings
);
router.put(
  "/settings",
  requirePermission("settings.manage"),
  reportController.updateReportSettings
);

// Inventory valuation trend over time (stock_ledger total_value grouped by day)
router.get(
  "/valuation-trend",
  requireAnyPermission(["dashboard.view", "stock.view"]),
  reportController.getValuationTrend
);

// End-of-Day stock report: every item's opening/received/issued/adjusted/
// closing qty + value for the day, sent to admin via WhatsApp digest and
// returned here as an Excel download. Admin-gated, same pattern as
// system-reset ("system.reset") / report-settings ("settings.manage").
router.post(
  "/eod/run",
  requirePermission("reports.eod_run"),
  reportController.runEodReport
);

module.exports = router;

