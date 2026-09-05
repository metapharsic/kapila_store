const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");

router.get("/forecast", analyticsController.getForecast);
router.get("/margin-variance", analyticsController.getMarginVariance);
router.post("/auto-po-draft", analyticsController.triggerAutoPoDraft);

module.exports = router;
