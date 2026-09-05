const router = require("express").Router();
const ctrl = require("../controllers/purchaseOrderController");
const { validate } = require("../middleware/validate");
const paginate = require("../middleware/paginate");
const { requirePermission, requirePermissionForPurchaseOrderUpdate } = require("../middleware/authorize");

const sorts = ["po_number", "date", "status", "total_amount", "created_at"];

router.get("/", requirePermission("purchase_orders.view"), paginate(sorts), ctrl.list);
router.get("/:id", requirePermission("purchase_orders.view"), ctrl.getOne);
router.post("/", requirePermission("purchase_orders.create"), validate("purchase_order"), ctrl.create);
router.post("/auto-draft", requirePermission("purchase_orders.create"), ctrl.createAutoDraft);
router.patch("/:id", requirePermissionForPurchaseOrderUpdate, validate("purchase_order"), ctrl.update);
router.delete("/:id", requirePermission("purchase_orders.delete"), ctrl.remove);

module.exports = router;
