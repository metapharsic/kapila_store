const router = require("express").Router();
const ctrl = require("../controllers/permissionController");
const { requirePermission } = require("../middleware/authorize");

router.get("/", requirePermission("permissions.view"), ctrl.list);

module.exports = router;
