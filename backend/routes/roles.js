const router = require("express").Router();
const ctrl = require("../controllers/roleController");
const { requirePermission } = require("../middleware/authorize");

router.get("/", requirePermission("roles.view"), ctrl.list);
router.post("/", requirePermission("roles.manage"), ctrl.create);
router.patch("/:id", requirePermission("roles.manage"), ctrl.update);
router.delete("/:id", requirePermission("roles.manage"), ctrl.remove);

module.exports = router;
