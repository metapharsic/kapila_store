const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

router.get("/handoff-summary", aiController.getHandoffSummary);
router.get("/reorder-suggestion/:item_code", aiController.getReorderSuggestion);

module.exports = router;
