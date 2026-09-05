const router = require("express").Router();
const ctrl   = require("../controllers/leftoverController");
const { validate } = require("../middleware/validate");
const paginate = require("../middleware/paginate");
const { requirePermission } = require("../middleware/authorize");

router.get("/",  requirePermission("leftovers.view"), paginate(["date", "created_at", "dept", "qty"]), ctrl.list);
router.post("/", requirePermission("leftovers.create"), validate("leftover"), ctrl.create);

module.exports = router;
