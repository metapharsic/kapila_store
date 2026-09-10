const express = require("express");
const router = express.Router();
const systemConfigController = require("../controllers/systemConfigController");
const { requirePermission } = require("../middleware/authorize");

router.get("/config", requirePermission("users.view"), systemConfigController.getConfig);
router.post("/check-updates", requirePermission("users.view"), systemConfigController.checkGitHubUpdates);
router.post("/pull-updates", requirePermission("users.view"), systemConfigController.pullGitHubUpdates);
router.post("/apply-patches", requirePermission("users.view"), systemConfigController.applyPatches);
router.post("/push-updates", requirePermission("users.view"), systemConfigController.pushGitHubUpdates);

module.exports = router;
