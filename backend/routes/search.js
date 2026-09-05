const router = require("express").Router();
const ctrl   = require("../controllers/searchController");
const { requirePermission } = require("../middleware/authorize");

router.get("/", requirePermission("search.view"), ctrl.globalSearch);

module.exports = router;
