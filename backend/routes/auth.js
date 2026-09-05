const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const ctrl = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

router.post("/login", loginLimiter, ctrl.login);
router.post("/heartbeat", authenticate, ctrl.heartbeat);
router.post("/refresh", ctrl.refresh);
router.get("/me", authenticate, ctrl.me);
router.post("/logout", authenticate, ctrl.logout);
router.post("/change-password", authenticate, ctrl.changePassword);

module.exports = router;
