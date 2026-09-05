const router = require("express").Router();
const ctrl   = require("../controllers/productionController");
const { validate } = require("../middleware/validate");
const paginate = require("../middleware/paginate");
const { requirePermission } = require("../middleware/authorize");

router.get("/",  requirePermission("production.view"), paginate(["date", "created_at", "dept", "plates"]), ctrl.list);
router.post("/", requirePermission("production.create"), validate("production"), ctrl.create);

module.exports = router;
