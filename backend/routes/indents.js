const router = require("express").Router();
const ctrl   = require("../controllers/indentController");
const { validate } = require("../middleware/validate");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

router.get("/",      requireAnyPermission(["indents.view", "issuances.view", "issuances.create"]), paginate(["date", "created_at", "dept", "status"]), ctrl.list);
router.get("/telemetry", requireAnyPermission(["indents.view", "dashboard.view"]), ctrl.getTelemetry);
router.get("/disposables", requireAnyPermission(["indents.view", "indents.create"]), ctrl.getDisposables);
router.get("/subcategories", requireAnyPermission(["indents.view", "indents.create"]), ctrl.getSubcategories);
router.get("/subcategories/:idOrCode", requireAnyPermission(["indents.view", "indents.create"]), ctrl.getSubcategoryDetails);
router.get("/templates", requireAnyPermission(["indents.view", "indents.create"]), ctrl.getTemplates);
router.get("/templates/:name", requireAnyPermission(["indents.view", "indents.create"]), ctrl.getTemplateByName);
router.get("/automated-pattern-excel", requireAnyPermission(["indents.view", "stock.export", "dashboard.export"]), ctrl.exportAutomatedIndentExcel);
router.get("/automated-pattern-preview", requireAnyPermission(["indents.view", "dashboard.view"]), ctrl.getAutomatedIndentPreview);
router.get("/chef-radar", requireAnyPermission(["indents.view", "indents.create"]), ctrl.getChefRadar);
router.get("/recommendations", requirePermission("indents.view"), ctrl.getRecommendations);
router.get("/:id/export-excel", requireAnyPermission(["indents.view", "stock.export", "dashboard.export"]), ctrl.exportSingleIndentExcel);
router.post("/subcategories", requirePermission("indents.create"), ctrl.createSubcategory);
router.post("/subcategories/:id/items", requirePermission("indents.create"), ctrl.createSubcategoryItem);
router.post("/chef-submit", requirePermission("indents.create"), ctrl.chefSubmit);
router.post("/notify-stockout", requireAnyPermission(["indents.create", "indents.view"]), ctrl.notifyStockout);
router.post("/:id/process", requireAnyPermission(["indents.approve", "issuances.create"]), ctrl.processFulfillment);
router.post("/smart-autofill", requirePermission("indents.create"), ctrl.smartAutofill);
router.post("/voice-parse", requirePermission("indents.create"), ctrl.voiceParse);
router.post("/",     requirePermission("indents.create"), validate("indent"), ctrl.create);
router.post("/day-close", requirePermission("indents.day_close"), ctrl.closeDay);
router.patch("/:id", requirePermission("indents.approve"), ctrl.updateStatus);
router.patch("/:id/items", requirePermission("indents.edit"), ctrl.updateItems);
router.delete("/:id", requirePermission("indents.delete"), ctrl.remove);

module.exports = router;

