const router = require("express").Router();
const ctrl   = require("../controllers/transferController");
const paginate = require("../middleware/paginate");
const { requirePermission } = require("../middleware/authorize");

const sorts = ["date", "status", "transfer_number", "created_at"];

router.get("/",             requirePermission("transfers.view"), paginate(sorts), ctrl.list);
router.get("/:id",          requirePermission("transfers.view"), ctrl.getOne);
router.post("/",            requirePermission("transfers.create"), ctrl.create);
router.patch("/:id/accept", requirePermission("transfers.approve"), ctrl.accept);
router.patch("/:id/reject", requirePermission("transfers.approve"), ctrl.reject);
router.delete("/:id",       requirePermission("transfers.delete"), ctrl.remove);

module.exports = router;
