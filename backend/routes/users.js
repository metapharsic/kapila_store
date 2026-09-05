const router = require("express").Router();
const ctrl = require("../controllers/userController");
const { requirePermission } = require("../middleware/authorize");

router.get("/", requirePermission("users.view"), ctrl.list);
router.get("/:id", requirePermission("users.view"), ctrl.getOne);
router.get("/:id/activity", requirePermission("users.view"), ctrl.activity);
router.post("/", requirePermission("users.create"), ctrl.create);
router.patch("/:id", requirePermission("users.edit"), ctrl.update);
router.patch("/:id/activate", requirePermission("users.activate"), ctrl.setActive);
router.post("/:id/reset-password", requirePermission("users.reset_password"), ctrl.resetPassword);

module.exports = router;
