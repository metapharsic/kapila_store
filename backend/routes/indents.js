const router = require("express").Router();
const ctrl   = require("../controllers/indentController");
const { validate } = require("../middleware/validate");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

router.get("/",      requireAnyPermission(["indents.view", "issuances.view", "issuances.create"]), paginate(["date", "created_at", "dept", "status"]), ctrl.list);
router.get("/recommendations", requirePermission("indents.view"), ctrl.getRecommendations);
router.post("/smart-autofill", requirePermission("indents.create"), ctrl.smartAutofill);
router.post("/voice-parse", requirePermission("indents.create"), ctrl.voiceParse);
router.post("/",     requirePermission("indents.create"), validate("indent"), ctrl.create);
router.post("/day-close", requirePermission("indents.day_close"), ctrl.closeDay);
router.patch("/:id", requirePermission("indents.approve"), ctrl.updateStatus);
router.patch("/:id/items", requirePermission("indents.edit"), ctrl.updateItems);
router.delete("/:id", requirePermission("indents.delete"), ctrl.remove);

module.exports = router;
