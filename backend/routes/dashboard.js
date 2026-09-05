const router = require("express").Router();
const ctrl   = require("../controllers/dashboardController");
const { requirePermission } = require("../middleware/authorize");

router.get("/",          requirePermission("dashboard.view"), ctrl.summary);
router.get("/morning-briefing", requirePermission("dashboard.view"), ctrl.morningBriefing);
router.get("/analytics", requirePermission("dashboard.view"), ctrl.analytics);
router.get("/procurement", requirePermission("purchase_orders.view"), ctrl.procurement);
router.get("/adhoc-summary", requirePermission("dashboard.view"), ctrl.adhocSummary);
router.get("/indent-funnel", requirePermission("dashboard.view"), ctrl.indentFunnel);
router.get("/store-home", requirePermission("dashboard.view"), ctrl.storeHome);

module.exports = router;
