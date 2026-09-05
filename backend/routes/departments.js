const router = require("express").Router();
const ctrl = require("../controllers/departmentController");
const { validate } = require("../middleware/validate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

router.get("/", requireAnyPermission(["departments.view", "recipes.view", "indents.view", "production.view"]), ctrl.list);
router.get("/items", requireAnyPermission(["departments.view", "indents.create"]), ctrl.getDepartmentItems);
router.post("/", requirePermission("departments.create"), validate("department"), ctrl.create);
router.patch("/:id", requirePermission("departments.edit"), validate("department"), ctrl.update);
router.delete("/:id", requirePermission("departments.delete"), ctrl.remove);

module.exports = router;
