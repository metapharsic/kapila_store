import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("CRITICAL: JWT_SECRET environment variable is missing.");
  process.exit(1);
}
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import errorHandler from "./middleware/errorHandler";
import { authenticate } from "./middleware/auth";
import { checkAIHealth } from "./services/localAI";
import promClient from "prom-client";

const app = express();
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:8008",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Prometheus metrics — default Node.js process metrics + a request-duration
// histogram per route, scraped by the local Prometheus service (C:\infra\prometheus).
promClient.collectDefaultMetrics({ prefix: "kapila_" });
const httpDuration = new promClient.Histogram({
  name: "kapila_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
});
app.use((req: Request, res: Response, next: NextFunction) => {
  const end = httpDuration.startTimer();
  res.on("finish", () => end({ method: req.method, route: req.route?.path || req.path, status: res.statusCode }));
  next();
});
app.get("/metrics", async (req: Request, res: Response) => {
  res.set("Content-Type", promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.use("/api/auth", require("./routes/auth"));
app.get("/api/health", (req: Request, res: Response) => res.json({ ok: true }));

const { verifyAccessToken } = require("./services/authService");
const { getUserAuthContext } = require("./services/permissionService");
const db = require("./db");
const issuanceController = require("./controllers/issuanceController");

app.post("/api/store-issuance/auto-issue", async (req: any, res: Response, next: NextFunction) => {
  try {
    let data = req.body;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) {}
    }
    const bearerToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const { indentId, items } = data;
    const token = bearerToken || data.token;
    if (!token) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    const payload = verifyAccessToken(token);
    const user = await getUserAuthContext(parseInt(payload.sub, 10));
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: "User inactive or not found" });
    }

    req.user = { ...user, permissions: new Set(user.permissions || []) };

    if (!req.user.permissions.has("issuances.create")) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const indent = await db("indents").where("id", indentId).first();
    if (!indent) {
      return res.status(404).json({ success: false, error: "Indent not found" });
    }
    if (!["pending", "approved", "partial"].includes(indent.status)) {
      return res.status(409).json({ success: false, error: `Indent already '${indent.status}' — cannot auto-issue.` });
    }

    // Idempotency: any issuance already recorded against this indent blocks a re-fire.
    // (Partial issuances are legitimate re-issues, so only block on an exact recent duplicate.)
    const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
    const existing = await db("issuances")
      .where("indent_id", indentId)
      .andWhere("created_at", ">=", twoMinutesAgo)
      .first();
    if (existing) {
      return res.status(200).json({ success: true, message: "Duplicate request ignored", data: existing });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    req.body = {
      indent_id: indentId,
      dept: indent.dept,
      date: todayStr,
      scanned: false,
      items
    };

    return issuanceController.create(req, res, next);
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid token or session expired" });
  }
});

app.post("/api/approvals/whatsapp-webhook", require("./controllers/approvalController").whatsappWebhook);

app.use("/api", authenticate);

app.use("/api/users",     require("./routes/users"));
app.use("/api/roles",     require("./routes/roles"));
app.use("/api/permissions", require("./routes/permissions"));
app.use("/api/audit-logs", require("./routes/auditLogs"));
app.use("/api/stock",      require("./routes/stock"));
app.use("/api/stock-import", require("./routes/stockImportRoutes"));
app.use("/api/indents",    require("./routes/indents"));
app.use("/api/issuances",  require("./routes/issuances"));
app.use("/api/production", require("./routes/production"));
app.use("/api/leftovers",  require("./routes/leftovers"));
app.use("/api/dashboard",  require("./routes/dashboard"));
app.use("/api/analytics",  require("./routes/analyticsRoutes"));
app.use("/api/ai",         require("./routes/aiRoutes"));
app.use("/api/search",     require("./routes/search"));
app.use("/api/anomalies",  require("./routes/anomalyRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/approvals",   require("./routes/approvalRoutes"));
app.use("/api/scan",       require("./routes/scan"));
app.use("/api/handoffs",   require("./routes/handoffRoutes"));
app.use("/api/temperature-logs", require("./routes/temperatureLogs"));
app.use("/api/returns", require("./routes/returnRoutes"));
app.use("/api/suppliers",       require("./routes/suppliers"));
app.use("/api/departments",     require("./routes/departments"));
app.use("/api/purchase-orders", require("./routes/purchaseOrders"));
app.use("/api/rate-quotes",     require("./routes/rateQuotes"));
app.use("/api/grn",             require("./routes/grn"));
app.use("/api/transfers",       require("./routes/transfers"));
app.use("/api/reorder-points",  require("./routes/reorderPoints"));
app.use("/api/approved-delivery", require("./routes/approvedDelivery"));
app.use("/api/chef-stats",  require("./routes/chefStats"));
app.use("/api/production-plans", require("./routes/productionPlans"));
app.use("/api/audits",          require("./routes/audits"));
app.use("/api/recipes",         require("./routes/recipes"));
app.use("/api/menu",            require("./routes/menu"));
app.use("/api/monitoring",      require("./routes/monitoringRoutes"));
app.use("/api/reports",         require("./routes/reportRoutes"));
app.use("/api/system-reset",    require("./routes/systemResetRoutes"));
app.use("/api/maintenance",     require("./routes/maintenance"));
app.use("/api/security",        require("./routes/security"));
app.use("/api/utility",         require("./routes/utility"));
app.use("/api/food-safety",     require("./routes/foodSafety"));
app.use("/api/waste",           require("./routes/waste"));
app.use("/api/staff",           require("./routes/staffHrms"));
app.use("/api/night-audit",     require("./routes/nightAudit"));
app.use("/api/system",          require("./routes/systemConfigRoutes"));

// AI health check — tells the frontend if Gemini API is configured
app.get("/api/ai-health", authenticate, async (req: Request, res: Response) => {
  const status = await checkAIHealth();
  res.status(status.ok ? 200 : 503).json(status);
});

// Kafka health check — surfaces broker connectivity so admin can see the
// "silent single point of failure" instead of just wondering why auto-PO
// drafting stopped.
app.get("/api/kafka-health", authenticate, async (req: Request, res: Response) => {
  const { isHealthy, ensureConnected } = require("./services/kafkaProducer");
  const ok = isHealthy() || (await ensureConnected());
  res.status(ok ? 200 : 503).json({ ok, broker: process.env.KAFKA_BROKER || "localhost:9092" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Kapila backend running on http://localhost:${PORT}`);
  // Auto-run pending migrations on startup
  try {
    const [batch, migrations] = await db.migrate.latest();
    if (migrations.length) {
      console.log(`✅ Migrations ran (batch ${batch}): ${migrations.join(", ")}`);
    } else {
      console.log("✅ DB schema up to date");
    }
  } catch (e: any) {
    console.error("❌ Migration failed on startup:", e.message);
  }

  // Start the Kafka consumer that mirrors stock/indent/issuance events into
  // kafka_event_log. Non-blocking — if the broker isn't up yet it just retries.
  require("./services/kafkaConsumer").start();

  // Eagerly connect the producer at boot instead of lazily on first publish —
  // the very first stock/indent mutation broadcasts immediately, no cold-connect lag.
  require("./services/kafkaProducer").ensureConnected()
    .then((ok: boolean) => console.log(ok ? "✅ Kafka producer connected" : "⚠️  Kafka producer not connected yet (broker may still be starting)"));

  // Check AI health on startup
  const aiHealth = await checkAIHealth();
  if (aiHealth.ok) {
    console.log(`✅ Gemini API ready (model: gemini-2.0-flash)`);
  } else {
    console.warn(`⚠️  Gemini API not ready: ${aiHealth.reason}`);
    console.warn(`   Scan and text-parse features will be unavailable until a key is provided.`);
  }

  // Predictive stockout scan on boot
  require("./cron/predictiveStockout")().catch((e: any) => console.error("Predictive stockout boot scan failed:", e.message));
});

// Schedule Anomaly Detection (runs every night at 2:00 AM)
const cron = require('node-cron');
const detectAnomalies = require('./cron/anomalyDetector');
cron.schedule('0 2 * * *', () => {
  console.log('[CRON] Running nightly anomaly detection...');
  detectAnomalies();
});

// Recipe cost drift check — catches supplier price hikes eating margin silently (runs 3:00 AM)
const detectRecipeCostDrift = require('./cron/recipeCostDrift');
cron.schedule('0 3 * * *', () => {
  console.log('[CRON] Running recipe cost drift scan...');
  detectRecipeCostDrift();
});

// Chef/store cross-check — planned plates vs actual issuance mismatch (runs 4:00 AM)
const crossCheckChefStore = require('./cron/chefStoreCrossCheck');
cron.schedule('0 4 * * *', () => { console.log('[CRON] Chef/store cross-check...'); crossCheckChefStore(); });

// Consumption-based reorder suggestions to Store Manager (runs 5:00 AM)
const suggestReorders = require('./cron/reorderSuggestion');
cron.schedule('0 5 * * *', () => { console.log('[CRON] Reorder suggestions...'); suggestReorders(); });

// Predictive stockout alerts (runs 5:30 AM)
const checkPredictiveStockouts = require('./cron/predictiveStockout');
cron.schedule('30 5 * * *', () => { console.log('[CRON] Predictive stockout check...'); checkPredictiveStockouts(); });

// Daily digest of kafka_event_log activity, pushed to Store Manager (runs 6:00 AM)
const generateKafkaDigest = require('./cron/kafkaDigest');
cron.schedule('0 6 * * *', () => {
  console.log('[CRON] Running daily kafka digest...');
  generateKafkaDigest();
});

// Escalate approvals stuck pending too long (e.g. store manager unreachable) to Admin
const escalateStaleApprovals = require('./cron/approvalEscalation');
cron.schedule('*/30 * * * *', () => {
  escalateStaleApprovals().catch((e: any) => console.error('[CRON] Approval escalation failed:', e.message));
});

// Escalate indents approved but never issued — SM at 2h, Admin at 8h
const escalateStaleIndents = require('./cron/staleIndentEscalation');
cron.schedule('*/30 * * * *', () => {
  escalateStaleIndents().catch((e: any) => console.error('[CRON] Stale indent escalation failed:', e.message));
});

// Escalate Purchase Orders pending approval too long — SM at 2h, Admin at 8h
const escalateStalePOs = require('./cron/stalePoEscalation');
cron.schedule('*/30 * * * *', () => {
  escalateStalePOs().catch((e: any) => console.error('[CRON] Stale PO escalation failed:', e.message));
});

// Alert Admin if Kafka has been unreachable — auto-PO drafting depends on it
// as the sync bus, and a downed broker used to fail completely silently.
let kafkaWasDown = false;
cron.schedule('*/5 * * * *', async () => {
  try {
    const { isHealthy, ensureConnected } = require('./services/kafkaProducer');
    const ok = isHealthy() || (await ensureConnected());
    if (!ok && !kafkaWasDown) {
      kafkaWasDown = true;
      const { sendNotification } = require('./controllers/notificationController');
      const adminRole = await db('roles').where({ key: 'admin' }).first();
      if (adminRole) {
        await sendNotification({
          recipient_role_id: adminRole.id,
          title: 'Kafka Broker Unreachable',
          message: 'Event bus (Kafka) is down. Reorder-breach auto-PO drafting is falling back to direct in-process checks; audit/event logging to kafka_event_log has stopped.',
          type: 'system_health',
          severity: 'critical',
        });
      }
    } else if (ok && kafkaWasDown) {
      kafkaWasDown = false;
    }
  } catch (e: any) { console.error('[CRON] Kafka health check failed:', e.message); }
});
