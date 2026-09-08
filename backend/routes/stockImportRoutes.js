const express = require("express");
const router  = express.Router();
const { upload, preview, commit } = require("../controllers/stockImportController");
const { requirePermission } = require("../middleware/authorize");

// POST /api/stock-import/preview
// multipart/form-data: { file: <.xlsx/.xls/.pdf> } — preview only, no DB writes
router.post("/preview", requirePermission("stock.create"), upload.single("file"), preview);

// POST /api/stock-import/commit
// application/json: { rows: [...], mode: "insert_new_only" | "update_existing" }
router.post("/commit", requirePermission("stock.create"), commit);

module.exports = router;
