const router = require("express").Router();
const ctrl = require("../controllers/recipeController");
const { requirePermission } = require("../middleware/authorize");

// Menu plan routes
router.get("/", requirePermission("menu.view"), ctrl.listMenu);
router.post("/", requirePermission("menu.create"), ctrl.createMenu);
router.patch("/:id", requirePermission("menu.edit"), ctrl.updateMenu);
router.delete("/:id", requirePermission("menu.delete"), ctrl.removeMenu);

module.exports = router;
