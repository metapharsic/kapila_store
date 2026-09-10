const router = require("express").Router();
const ctrl = require("../controllers/maintenanceController");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

// Analytics & Reports
router.get("/analytics", requirePermission("maintenance.view"), ctrl.getAnalytics);
router.get("/export-excel", requirePermission("maintenance.view"), ctrl.exportExcel);

// Assets
router.get("/assets", requirePermission("maintenance.view"), paginate(["created_at", "name"]), ctrl.listAssets);
router.get("/assets/:id", requirePermission("maintenance.view"), ctrl.getAssetDetails);
router.post("/assets", requirePermission("maintenance.create"), ctrl.createAsset);
router.patch("/assets/:id", requirePermission("maintenance.edit"), ctrl.updateAsset);

// Work Orders
router.get("/work-orders", requirePermission("maintenance.view"), paginate(["created_at", "priority"]), ctrl.listWorkOrders);
router.post("/work-orders", requirePermission("maintenance.create"), ctrl.createWorkOrder);
router.patch("/work-orders/:id", requirePermission("maintenance.edit"), ctrl.updateWorkOrder);
router.post("/work-orders/:id/parts", requirePermission("maintenance.create"), ctrl.consumeParts);
router.post("/work-orders/:id/complete", requirePermission("maintenance.complete"), ctrl.completeWorkOrder);

// Preventive Maintenance Schedules
router.get("/schedules", requirePermission("maintenance.view"), ctrl.listSchedules);
router.post("/schedules/:id/complete", requirePermission("maintenance.complete"), ctrl.completeSchedule);

module.exports = router;
