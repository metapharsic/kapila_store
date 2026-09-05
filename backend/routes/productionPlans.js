const router = require("express").Router();
const ctrl = require("../controllers/productionPlannerController");
const { requirePermission } = require("../middleware/authorize");

router.get("/", requirePermission("production.view"), ctrl.listPlans);
router.post("/", requirePermission("production.create"), ctrl.createPlan);
router.patch("/:id", requirePermission("production.edit"), ctrl.completePlan);
router.delete("/:id", requirePermission("production.delete"), ctrl.removePlan);
router.get("/analytics", requirePermission("waste_analytics.view"), ctrl.getAnalytics);

module.exports = router;
