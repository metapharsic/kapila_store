const router = require("express").Router();
const ctrl = require("../controllers/securityController");
const paginate = require("../middleware/paginate");
const { requirePermission } = require("../middleware/authorize");

// Telemetry & Excel Export
router.get("/telemetry", requirePermission("security.view"), ctrl.getTelemetry);
router.get("/export-excel", requirePermission("security.view"), ctrl.exportExcel);

// Passes CRUD and Actions
router.get("/passes", requirePermission("security.view"), paginate(["in_time", "created_at", "pass_number"]), ctrl.listPasses);
router.get("/passes/:id", requirePermission("security.view"), ctrl.getPass);
router.post("/passes", requirePermission("security.create"), ctrl.createPass);
router.put("/passes/:id", requirePermission("security.edit"), ctrl.updatePass);
router.delete("/passes/:id", requirePermission("security.delete"), ctrl.deletePass);
router.put("/passes/:id/exit", requirePermission("security.edit"), ctrl.recordExit);
router.put("/passes/:id/reconcile", requirePermission("security.edit"), ctrl.reconcileRgp);

// Line items management (append / delete)
router.post("/passes/:id/items", requirePermission("security.edit"), ctrl.appendItem);
router.delete("/passes/:id/items/:itemId", requirePermission("security.edit"), ctrl.deleteItem);

module.exports = router;
