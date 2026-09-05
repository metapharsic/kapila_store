const router = require("express").Router();
const ctrl   = require("../controllers/scanController");
const { requirePermission } = require("../middleware/authorize");

router.post("/indent", requirePermission("scan.indent"), ctrl.scanIndent);
router.post("/purchase", requirePermission("scan.purchase"), ctrl.scanPurchase);
router.post("/text", requirePermission("scan.text"), ctrl.scanText);
router.post("/voice", requirePermission("scan.text"), ctrl.scanVoice);

module.exports = router;
