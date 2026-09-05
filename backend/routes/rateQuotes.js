const router = require("express").Router();
const ctrl = require("../controllers/rateQuoteController");
const { requireAnyPermission } = require("../middleware/authorize");

router.get("/compare", requireAnyPermission(["purchase_orders.create", "stock.edit"]), ctrl.compare);
router.post("/", requireAnyPermission(["purchase_orders.create", "stock.edit"]), ctrl.create);

module.exports = router;
