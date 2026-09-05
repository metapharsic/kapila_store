const router = require("express").Router();
const ctrl   = require("../controllers/reorderController");
const paginate = require("../middleware/paginate");
const { requirePermission } = require("../middleware/authorize");

const sorts = ["name", "item_code", "min_qty", "created_at"];

router.get("/alerts",     requirePermission("reorder_points.view"), ctrl.alerts);
router.get("/predictive", requirePermission("reorder_points.view"), ctrl.predictive);
router.get("/",           requirePermission("reorder_points.view"), paginate(sorts), ctrl.list);
router.post("/",          requirePermission("reorder_points.create"), ctrl.create);
router.patch("/:id",      requirePermission("reorder_points.edit"), ctrl.update);
router.delete("/:id",     requirePermission("reorder_points.delete"), ctrl.remove);

module.exports = router;
