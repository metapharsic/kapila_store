const router = require("express").Router();
const ctrl = require("../controllers/utilityController");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

// Analytics & Excel Export
router.get("/analytics", requirePermission("utility.view"), ctrl.getAnalytics);
router.get("/export-excel", requireAnyPermission(["utility.view", "utility.export"]), ctrl.exportExcel);

// Shift Readings
router.get("/readings", requirePermission("utility.view"), paginate(["reading_date", "created_at"]), ctrl.listReadings);
router.post("/readings", requirePermission("utility.create"), ctrl.createReading);

module.exports = router;
