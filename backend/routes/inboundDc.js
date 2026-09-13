const router = require("express").Router();
const ctrl = require("../controllers/inboundDcController");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

router.get("/", requireAnyPermission(["inbound_dc.view", "stock.view"]), paginate(["created_at", "dc_date"]), ctrl.list);
router.get("/:id", requireAnyPermission(["inbound_dc.view", "stock.view"]), ctrl.getOne);
router.post("/", requireAnyPermission(["inbound_dc.create", "stock.create"]), ctrl.create);
router.post("/:id/match-invoice", requireAnyPermission(["inbound_dc.match", "stock.edit"]), ctrl.matchInvoice);
router.delete("/:id", requireAnyPermission(["inbound_dc.cancel", "stock.delete"]), ctrl.cancel);

module.exports = router;
