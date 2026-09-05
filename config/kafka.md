# Apache Kafka (KRaft mode — no Zookeeper)

**Version:** kafkajs client ^2.2.4
**Install:** `C:\infra\kafka`, broker at localhost:9092
**Broker config:** `C:\infra\kafka\config\server.properties`
**Client config:** `KAFKA_BROKER` env var (defaults `localhost:9092`), used by
`backend/services/kafkaProducer.js` and `backend/services/kafkaConsumer.js`
**Startup:** no admin-required watchdog — `C:\infra\watchdog.ps1`, polls port 9092 every 15s,
respawns broker if dead, auto-starts on login via Startup-folder shortcut. A wrapped
`KapilaKafka` NSSM service also exists but sits `Stopped` (install needed admin rights this
agent didn't have) — watchdog is what's actually keeping it alive.

**What it does:** Event bus for every stock/indent/issuance/production/recipe mutation.
`kafka_event_log` table mirrors every message for SQL-queryable audit trail — 5746 events
logged as of this session, 5698 of those `stock-events` (bulk loads dominate the count).

**Topics (11 total in `kafkaConsumer.js` TOPICS array):**
| Topic | Events logged | Producer | Consumer reaction |
|---|---|---|---|
| `stock-events` | 5698 | `stockController.js` create/edit/delete/unit_change | mirrors to log |
| `indent-events` | 21 | `indentController.js` | mirrors to log |
| `issuance-events` | 19 | `issuanceController.js` | mirrors to log, triggers reorder-breach check |
| `rate-quote-events` | 3 | `rateQuoteController.js` | mirrors to log |
| `supplier-events` | 2 | `supplierController.js` | mirrors to log |
| `purchase-order-events` | 1 | `purchaseOrderController.js` | mirrors to log |
| `production-events` | 1 | `productionController.js` | mirrors to log |
| `recipe-events` | 1 | **new this session** — `cron/recipeCostDrift.js` | mirrors to log |
| `grn-events` | 0 (not exercised this session) | `grnController.js` | mirrors to log |
| `transfer-events` | 0 | `transferController.js` | mirrors to log |
| `leftover-events` | 0 | `leftoverController.js` | mirrors to log |

(8 of 11 topics have logged events; grn/transfer/leftover not exercised this session. Live
total: 5746 events.)

**Producer contract (`services/kafkaProducer.js`):** `publish(topic, event)` is fire-and-forget
— lazy-connects on first call, catches all errors, returns `true`/`false` so callers can run a
synchronous fallback path when the broker's unreachable (e.g. `issuanceController.js` runs
`checkAndDraftReorderPOs` in-process if `publish()` returns `false`). Kafka being down must
never break a mutation.

**What's been done:**
- Diagnosed and fixed a real broadcast outage: broker got restarted by its own watchdog at
  23:30:15, the long-lived backend process's producer connection went stale (cached
  `connected=true` flag never reset), silently stopped publishing — 2 real stock creates went
  to DB with zero broadcast during the dead window. Killed the stale backend PID, fresh
  `producer.connect()` on restart fixed it — confirmed via exact-timestamp match between a new
  stock row and its `kafka_event_log` entry.
- Added new topic `recipe-events` — required editing the consumer's fixed `TOPICS` array in
  `services/kafkaConsumer.js` (line 15-20) and a full backend restart (consumer group
  resubscribes on connect, doesn't pick up new topics live).
- Reused `issuance-events` topic with a new `type: "issuance.anomaly"` for the real-time
  anomaly hook — deliberately avoided a second new-topic restart risk in the same session.
- 2026-07-10: `cron/anomalyDetector.js` (nightly 7-day-baseline spike scan) had zero Kafka
  publish — DB insert + WhatsApp only, broke the audit-trail pattern every other mutation
  follows (found during gap-analysis governance review, see `docs/workflows/gap-analysis.md`
  #11-12). Fixed: publishes `issuance-events` with `type: "issuance.anomaly.nightly"` after
  each new alert insert, `recipients_notified` count included. Reused existing topic again,
  no consumer restart needed.
- Verified broadcast end-to-end after every single feature via timestamp-windowed
  `kafka_event_log` queries (`WHERE produced_at > NOW() - INTERVAL 'N minutes'`) — never
  trusted DB row existence alone as proof of broadcast.
- Hit the same zombie-process pattern twice more this session (frontend port 8008, backend
  port 3001 again after a cron-related restart) — same root cause each time (Windows nodemon
  child not fully releasing the port on restart), same fix (find PID via
  `Get-NetTCPConnection`, force-kill, confirm clean restart via `/api/health`).
