const router = require("express").Router();
const ctrl   = require("../controllers/auditLogController");
const { requirePermission } = require("../middleware/authorize");

const canView   = requirePermission("audit_logs.view");
const canExport = requirePermission("audit_logs.export");

router.get("/",          canView,   ctrl.list);
router.get("/stats",     canView,   ctrl.stats);
router.get("/distinct",  canView,   ctrl.distinct);
router.get("/export",    canExport, ctrl.exportCsv);
router.get("/:id",       canView,   ctrl.detail);

module.exports = router;
