const router = require("express").Router();
const ctrl = require("../controllers/recipeController");
const { requirePermission } = require("../middleware/authorize");

// Recipe routes
router.get("/", requirePermission("recipes.view"), ctrl.listRecipes);
router.get("/expiry-suggestions", requirePermission("recipes.view"), ctrl.getExpirySuggestions);
router.post("/", requirePermission("recipes.create"), ctrl.createRecipe);
router.patch("/:id", requirePermission("recipes.edit"), ctrl.updateRecipe);
router.delete("/:id", requirePermission("recipes.delete"), ctrl.removeRecipe);

module.exports = router;
