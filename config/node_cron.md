# node-cron

**Version:** ^4.4.1
**Location:** `backend/cron/`, all schedules registered in `backend/server.js` (lines ~197-240)

**Full schedule (6 jobs):**
| Time | Job | File | Status |
|---|---|---|---|
| 2:00 AM | Nightly anomaly scan | `anomalyDetector.js` | pre-existing |
| 3:00 AM | Recipe cost drift | `recipeCostDrift.js` | **new this session** |
| 6:00 AM | Kafka activity digest | `kafkaDigest.js` | **new this session** |
| every 30 min | Approval escalation | `approvalEscalation.js` | pre-existing |
| every 30 min | Stale indent escalation | `staleIndentEscalation.js` | pre-existing |
| every 5 min | Kafka health check | inline in `server.js` | pre-existing |

**What it does:** Scheduled jobs — nightly anomaly scan, approval/indent escalation, kafka
health check, and now recipe cost drift + kafka digest.

**What's been done:**
- New: `cron/recipeCostDrift.js` (3 AM) — for every recipe, recomputes real cost
  (`Σ recipe_items.base_qty × latest stock.price` per ingredient name), compares to the most
  recent `recipe_cost_snapshots` row, alerts at ≥15% drift (`DRIFT_THRESHOLD = 0.15`). On trip:
  publishes `recipe-events` / `recipe.cost_drift`, sends 2 notifications (Admin role 1, Store
  Manager role 5), then always writes a fresh snapshot row regardless of drift. Manually
  triggered twice: once for baseline (0 alerts, correct — no prior snapshot to compare), once
  after forcing Boiled Rice's price ₹45.5→₹80 (1 alert, 75.8% drift, math verified correct:
  (80-45.5)×12kg = ₹414 delta / ₹546 old total = 75.8%). Reset the price + snapshot table
  clean after proving it.
- New: `cron/kafkaDigest.js` (6 AM) — groups yesterday's `kafka_event_log` rows by
  `event_type`, sends one notification to Store Manager (role 5) with the tally. Manually
  triggered, produced notification id 43 with a real count breakdown (397 events: indent.create
  12, issuance.create 8, stock.create 361, etc — from actual `kafka_event_log` data, not
  invented numbers).
- Both new crons reuse the existing `sendNotification()` helper from
  `controllers/notificationController.js` rather than inserting into `notifications` directly
  — stays consistent with how every other notification in the app gets created.
