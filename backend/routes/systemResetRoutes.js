const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/systemResetController");
const { requirePermission } = require("../middleware/authorize");

router.get("/groups", requirePermission("system.reset"), ctrl.listResettableGroups);
router.post("/", requirePermission("system.reset"), ctrl.resetGroups);
router.post("/restore-catalog", requirePermission("system.reset"), ctrl.restoreCatalog);

module.exports = router;
