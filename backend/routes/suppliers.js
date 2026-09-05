const router = require("express").Router();
const ctrl = require("../controllers/supplierController");
const { validate } = require("../middleware/validate");
const paginate = require("../middleware/paginate");
const { requirePermission } = require("../middleware/authorize");

const sorts = ["name", "contact_name", "created_at"];

router.get("/", requirePermission("suppliers.view"), paginate(sorts), ctrl.list);
router.get("/:id/performance", requirePermission("suppliers.view"), ctrl.getPerformance);
router.post("/", requirePermission("suppliers.create"), validate("supplier"), ctrl.create);
router.patch("/:id", requirePermission("suppliers.edit"), validate("supplier"), ctrl.update);
router.delete("/:id", requirePermission("suppliers.delete"), ctrl.remove);

module.exports = router;
