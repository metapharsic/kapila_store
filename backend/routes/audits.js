const router = require("express").Router();
const ctrl = require("../controllers/auditController");
const { validate } = require("../middleware/validate");
const paginate = require("../middleware/paginate");
const { requirePermission } = require("../middleware/authorize");

// GET /api/audits/summary (must be registered BEFORE GET /api/audits/:id)
router.get("/summary", requirePermission("audit.view"), ctrl.summary);

router.get("/", requirePermission("audit.view"), paginate(["created_at"]), ctrl.list);
router.post("/", requirePermission("audit.create"), validate("audit"), ctrl.create);
router.get("/:id", requirePermission("audit.view"), ctrl.getOne);
router.patch("/:id/items/:itemId", requirePermission("audit.enter_counts"), validate("auditItemUpdate"), ctrl.updateItem);
router.post("/:id/finalise", requirePermission("audit.finalise"), validate("auditFinalise"), ctrl.finalise);
router.delete("/:id", requirePermission("audit.finalise"), ctrl.cancel);

module.exports = router;
