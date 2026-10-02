const router = require("express").Router();
const ctrl = require("../controllers/departmentController");
const { validate } = require("../middleware/validate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

router.get("/", requireAnyPermission(["departments.view", "recipes.view", "indents.view", "production.view"]), ctrl.list);
router.get("/chef-config", requireAnyPermission(["departments.view", "indents.view", "indents.create"]), ctrl.getChefConfig);
router.get("/items", requireAnyPermission(["departments.view", "indents.create"]), ctrl.getDepartmentItems);
router.get("/item-counts", requireAnyPermission(["departments.view", "indents.create"]), ctrl.getDepartmentItemCounts);
router.get("/summary", requireAnyPermission(["departments.view", "indents.view", "recipes.view", "production.view"]), ctrl.getSummary);
router.post("/template-item", requireAnyPermission(["departments.edit", "indents.create"]), ctrl.addItemToDepartmentTemplate);
router.post("/", requirePermission("departments.create"), validate("department"), ctrl.create);
router.patch("/:id", requirePermission("departments.edit"), validate("department"), ctrl.update);
router.delete("/:id", requirePermission("departments.delete"), ctrl.remove);

module.exports = router;
