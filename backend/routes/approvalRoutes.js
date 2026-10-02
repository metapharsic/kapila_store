const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/approvalController");
const { requirePermission } = require("../middleware/authorize");

router.get("/pending", ctrl.listPending);
router.post("/:id/approve", ctrl.approveRequest);
router.post("/:id/reject", ctrl.rejectRequest);
router.post("/:id/delegate", ctrl.delegateRequest);
router.post("/bulk-action", ctrl.bulkAction);

router.get("/rules", ctrl.listRules);
router.post("/rules", requirePermission("settings.manage"), ctrl.createRule);
router.patch("/rules/:id", requirePermission("settings.manage"), ctrl.updateRule);
router.delete("/rules/:id", requirePermission("settings.manage"), ctrl.removeRule);

module.exports = router;
