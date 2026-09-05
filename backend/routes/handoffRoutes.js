const router = require("express").Router();
const ctrl   = require("../controllers/handoffController");
const { requirePermission } = require("../middleware/authorize");

router.get("/latest", requirePermission("handoffs.view"), ctrl.getLatest);
router.post("/",      requirePermission("handoffs.create"), ctrl.create);

module.exports = router;
