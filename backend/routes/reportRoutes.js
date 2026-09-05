const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");

// Streaming Excel Export
router.get("/inventory-excel", reportController.exportInventoryExcel);

// Metadata Preview for UI / Status
router.get("/inventory-preview", reportController.previewInventoryMetadata);

module.exports = router;
