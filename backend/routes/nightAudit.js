const router = require("express").Router();
const ctrl = require("../controllers/nightAuditController");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

// Telemetry & Export
router.get("/telemetry", requirePermission("night_audit.view"), ctrl.getTelemetry);
router.get("/export-excel", requireAnyPermission(["night_audit.view", "night_audit.export"]), ctrl.exportExcel);

// Audit Preview & Execution
router.get("/preview", requirePermission("night_audit.view"), ctrl.getAuditPreview);
router.post("/execute", requirePermission("night_audit.execute"), ctrl.executeAudit);

// Audit History Logs
router.get("/logs", requirePermission("night_audit.view"), paginate(["audit_date", "created_at"]), ctrl.listAuditLogs);

module.exports = router;
