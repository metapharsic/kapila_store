const router = require("express").Router();
const ctrl = require("../controllers/grnController");
const { validate } = require("../middleware/validate");
const paginate = require("../middleware/paginate");
const { requirePermission } = require("../middleware/authorize");

const sorts = ["grn_number", "date", "total_amount", "created_at"];

router.get("/", requirePermission("grn.view"), paginate(sorts), ctrl.list);
router.get("/:id", requirePermission("grn.view"), ctrl.getOne);
router.post("/", requirePermission("grn.create"), validate("grn"), ctrl.create);
router.delete("/:id", requirePermission("grn.delete"), ctrl.remove);

module.exports = router;
