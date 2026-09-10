const router = require("express").Router();
const ctrl = require("../controllers/wasteController");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

// Analytics & Export
router.get("/analytics", requirePermission("waste.view"), ctrl.getAnalytics);
router.get("/export-excel", requireAnyPermission(["waste.view", "waste.export"]), ctrl.exportExcel);

// Food Waste Logs
router.get("/logs", requirePermission("waste.view"), paginate(["waste_date", "created_at"]), ctrl.listWaste);
router.post("/logs", requirePermission("waste.create"), ctrl.logWaste);

// RUCO FSSAI Logs
router.get("/ruco", requirePermission("waste.view"), paginate(["log_date", "created_at"]), ctrl.listRuco);
router.post("/ruco", requirePermission("waste.create"), ctrl.logRuco);
router.post("/ruco/disposal", requirePermission("waste.create"), ctrl.recordDisposal);

module.exports = router;
