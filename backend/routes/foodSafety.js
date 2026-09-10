const router = require("express").Router();
const ctrl = require("../controllers/foodSafetyController");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

// Telemetry & Export
router.get("/telemetry", requirePermission("quality.view"), ctrl.getTelemetry);
router.get("/export-excel", requireAnyPermission(["quality.view", "waste.export"]), ctrl.exportExcel);

// HACCP Receiving Inspections
router.get("/inspections", requirePermission("quality.view"), paginate(["inspection_date", "created_at"]), ctrl.listInspections);
router.post("/inspections", requirePermission("quality.create"), ctrl.createInspection);

// Pest Control & Hygiene
router.get("/pest-logs", requirePermission("quality.view"), paginate(["service_date", "created_at"]), ctrl.listPestLogs);
router.post("/pest-logs", requirePermission("quality.create"), ctrl.createPestLog);

module.exports = router;
