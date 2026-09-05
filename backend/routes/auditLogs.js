const router = require("express").Router();
const ctrl = require("../controllers/auditLogController");
const { requirePermission } = require("../middleware/authorize");

router.get("/", requirePermission("audit_logs.view"), ctrl.list);

module.exports = router;
