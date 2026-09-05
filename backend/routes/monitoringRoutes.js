const router = require("express").Router();
const ctrl = require("../controllers/monitoringController");
const { authenticate } = require("../middleware/auth");

router.get("/stream", ctrl.streamLiveMonitoring);
router.get("/live-sessions", authenticate, ctrl.listLiveSessions);
router.post("/terminate-session/:id", authenticate, ctrl.terminateSession);

module.exports = router;
