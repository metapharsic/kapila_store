const router = require("express").Router();
const ctrl   = require("../controllers/stockController");
const { validate } = require("../middleware/validate");
const paginate = require("../middleware/paginate");
const { requirePermission, requireAnyPermission } = require("../middleware/authorize");

const sorts = ["name", "date", "remaining", "qty", "created_at"];

router.get("/ledger/export-excel", requirePermission("stock.view"), ctrl.exportLedgerExcel);
router.get("/ledger", requirePermission("stock.view"), paginate(["date", "created_at"]), ctrl.getLedger);
router.get("/insights", requirePermission("stock.view"), ctrl.getInsights);
router.get("/supplier-rates", requirePermission("stock.view"), ctrl.getSupplierRates);
router.get("/available", requireAnyPermission(["stock.view", "indents.create", "issuances.create"]), ctrl.getAvailableStock);
router.post("/search-nlp", requirePermission("stock.view"), ctrl.searchNLP);
router.get("/substitute", requirePermission("stock.view"), ctrl.getSubstituteRecommendation);
router.get("/suggest-category", requireAnyPermission(["stock.create", "stock.view"]), ctrl.getSuggestedCategory);
router.get("/export-excel", requireAnyPermission(["stock.view", "stock.create", "stock.edit"]), ctrl.exportStockExcel);
router.get("/lifo-suggestions", requireAnyPermission(["stock.view", "issuances.create", "indents.view", "purchase_orders.view"]), ctrl.getLIFOSuggestions);
router.get("/agent-status", requireAnyPermission(["stock.view", "issuances.create", "stock.create"]), ctrl.getMultiAgentStatus);
router.get("/details/:id", requireAnyPermission(["stock.view", "stock.create", "stock.edit"]), ctrl.getItemDetails);
router.post("/:id/append", requireAnyPermission(["stock.create", "stock.edit"]), ctrl.appendBatch);
router.get("/",      requireAnyPermission(["stock.view", "recipes.view", "indents.view", "production.view"]), paginate(sorts), ctrl.list);
router.post("/",     requirePermission("stock.create"), validate("stock"), ctrl.create);
router.get("/reconcile/history", requirePermission("stock.reconcile"), ctrl.getReconciliationHistory);
router.get("/reconcile/history/:id", requirePermission("stock.reconcile"), ctrl.getReconciliationSession);
router.get("/adjustments", requirePermission("stock.reconcile"), ctrl.getAdjustmentLedger);
router.post("/reconcile", requirePermission("stock.reconcile"), ctrl.reconcile);

// Correct an item's base unit (used from the Issuance screen to fix a mismatch).
// Must be declared BEFORE "/:id" so "unit" isn't parsed as an id.
router.patch("/unit", requireAnyPermission(["stock.edit", "issuances.create"]), ctrl.updateItemUnit);
// Teach a scanned-name → stock-item mapping so the next OCR scan auto-matches.
// Any role that can raise a scanned indent/issuance can teach — this is a
// name-typo fix, not a stock mutation, so it doesn't need stock.edit.
router.post("/alias", requireAnyPermission(["indents.create", "issuances.create", "stock.edit"]), ctrl.createAlias);
router.patch("/:id", requirePermission("stock.edit"), ctrl.update);
router.delete("/:id", requirePermission("stock.delete"), ctrl.remove);

module.exports = router;
