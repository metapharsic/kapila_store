const router = require("express").Router();
const ctrl = require("../controllers/chefStatsController");
const { requirePermission } = require("../middleware/authorize");

router.get("/", requirePermission("chef_stats.view"), ctrl.overview);
router.get("/wastage", requirePermission("chef_stats.view"), ctrl.wastage);
router.get("/:deptId", requirePermission("chef_stats.view"), ctrl.detail);

module.exports = router;
