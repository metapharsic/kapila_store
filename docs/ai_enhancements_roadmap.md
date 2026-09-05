# AI Enhancement Roadmap — Store Keeper / Store Manager

Grounded in existing infra: Gemini OCR (`services/localAI.js`, `controllers/scanController.js`),
anomaly cron (`cron/anomalyDetector.js`), kafka event bus (`services/kafkaProducer.js` +
`services/kafkaConsumer.js`), shift handoffs (`controllers/handoffController.js`), and the
`stock` / `recipe_items` / `production_plans` schema. Each item below builds on something that
already exists — no new infra unless noted.

---

## 1. Smart Reorder Suggestion
**What:** Feed 15-day stock history (date-stamped rows in `stock` table) + consumption rate into
Gemini, auto-suggest PO reorder qty per item.
**Why:** Today `min_alert_qty` is a static number set once, never adjusted for seasonal/real usage.
**Touch points:** `controllers/stockController.js`, new `services/reorderAI.js`, Purchase Order screen.

## 2. Anomaly Detector → Store Issuance Link
**What:** Wire `cron/anomalyDetector.js` into the issuance confirm flow — flag issue qty that's
10x normal for that item/dept combo, before confirm, not just after-the-fact alert.
**Why:** Anomaly detector exists but runs isolated on a cron; no real-time hook into the screen
where the anomaly actually originates.
**Touch points:** `controllers/anomalyController.js`, `screens/Issuance/index.jsx` confirm handler.

## 3. AI-Assisted ALL-Confirm Substitute Suggestion
**What:** When bulk-confirm skips an insufficient item (per the sufficiency-gate fix already
shipped in `handleToggleAll`), ask Gemini to suggest a same-category substitute from `stock`.
**Why:** Silent skip today just drops the item; store keeper has to manually go hunt a substitute.
**Touch points:** `screens/Issuance/index.jsx`, new `services/substituteAI.js`.

## 4. Voice-to-Indent
**What:** Store Keeper speaks item + qty, Gemini transcribes + parses into indent rows.
**Why:** Typing 47 items one by one (real indent seen this session) is slow; voice is faster on floor.
**Touch points:** `screens/Indent/index.jsx`, browser Web Speech API + Gemini parse endpoint.

## 5. Expiry-Risk Ranking (FEFO Suggestion)
**What:** `stock.batch_no` + `stock.expiry_date` columns exist, unused for ranking. Rank/highlight
"issue this batch first" on the issuance screen.
**Why:** Columns already captured at GRN time, currently dead data — no FEFO logic reads them.
**Touch points:** `controllers/stockController.js` availability query, `IssuanceItemRow.jsx`.

## 6. Natural-Language Stock Search
**What:** "show me spices under 5kg expiring this week" → parsed filter instead of manual dropdown
+ input combo.
**Why:** Stock screen already has category/date/qty filters; NL wrapper just needs to map to
existing query params.
**Touch points:** `screens/Stock` search bar, Gemini intent-parse endpoint.

## 7. Shift Handoff AI Summary
**What:** Auto-generate handoff note from the day's `kafka_event_log` rows (issued X, created Y,
anomaly Z) instead of manual typing into `shift_handoffs`.
**Why:** All the raw data is already flowing through kafka; handoff today is 100% manual text entry.
**Touch points:** `controllers/handoffController.js`, `db/migrations/037_create_shift_handoffs.js`.

## 8. Predictive Stockout Alert
**What:** Combine `reorder_points` table + daily consumption trend (from #1's history) to push
"Atta runs out in 3 days" before it hits zero, not a reactive low-stock ping after the fact.
**Why:** Current reorder alert (`routes/reorder`) fires only once already below threshold.
**Touch points:** `controllers/reorderController` (or equivalent), notification service.

## 9. Duplicate/Near-Duplicate Item Merge Suggestion
**What:** Fuzzy-match `stock.name` for likely typos (real example seen this session:
"BOBBERLU" vs "BOBBARLU" — same item, two item_codes). Flag for manager merge review.
**Why:** 355+ items accumulated via manual entry and bulk loads — duplicates are inevitable and
silently split stock/reporting.
**Touch points:** new one-off admin screen or CLI script, `stock` table `name` trigram index
(already exists: `idx_stock_name_trgm`).

## 10. Paper-Scan Confidence + Auto-Correct
**What:** AI Scan Paper Form (`scanController.js`, Gemini OCR) currently trusts every parsed field
blind. Add a per-field confidence score, auto-flag low-confidence reads for manual check.
**Why:** OCR misreads on handwriting are common; today a bad read goes straight into an indent
with no signal to the user.
**Touch points:** `controllers/scanController.js`, `services/localAI.js`.

## 11. Chef/Store Cross-Check via Kafka
**What:** Both `production-events` and `stock-events` flow through the same bus. Cross-check
planned recipe qty vs actual store issuance qty in real time, flag mismatch immediately instead
of discovering it at EOD waste report.
**Touch points:** `services/kafkaConsumer.js` — new consumer group joining both topics.

## 12. Supplier Reliability Score
**What:** `stock.supplier_id` + GRN events already exist. Rank suppliers by delivery-delay and
price-variance history, surface score on the Purchase Order screen.
**Touch points:** `controllers/supplierController.js`, `controllers/grnController.js`.

## 13. Auto-Categorize New Items
**What:** Gemini suggests category on Add Item form instead of manual pick from a fixed dropdown.
**Why:** Also patches a real gap found this session — `STOCK_CATEGORIES` in `styles/colors.js`
is missing 6 real categories (Dals, Linen, Fuel, Bakery, Ice Cream, Chemicals) that exist in DB
but aren't selectable in the UI dropdown.
**Touch points:** `styles/colors.js`, `screens/Stock` Add Item drawer.

## 14. Waste-Reason Clustering
**What:** `production_plans.waste_reason` is free text today, never analyzed. NLP-cluster into
buckets ("over-prepared", "spoiled", "wrong recipe qty") for the Waste Analytics chart.
**Touch points:** `controllers/productionController.js`, Waste Analytics tab in ProductionPlanner.

## 15. Batch-Level FEFO Auto-Pick on Issuance
**What:** Extends #5 — when confirming an item, auto-select the oldest-expiry `batch_no`
instead of the store keeper eyeballing which lot to pull.
**Touch points:** `controllers/issuanceController.js` batch selection logic.

## 16. Recipe Cost Drift Alert
**What:** Join `recipe_items.base_qty` with today's `stock.price`; alert manager when a recipe's
real cost drifts >X% from its last-costed value — catches supplier price hikes silently eating
margin.
**Touch points:** `controllers/recipeController.js`, new cron similar to `anomalyDetector.js`.

## 17. Smart Indent Template
**What:** Most dept indents repeat weekly (real example this session: "Atta 10kg" submitted 3x
for STAFF). AI pre-fills a new indent from that dept's last-N-days pattern instead of a blank form.
**Touch points:** `screens/Indent/index.jsx`, `indents`/`indent_items` history query.

## 18. Login Anomaly Guard
**What:** JWT + rate-limit already exist (hit the 429 myself this session). Layer an AI flag for
odd login pattern (new device/time-of-day) on top of the existing brute-force rate cap.
**Touch points:** `middleware/auth` or equivalent, login controller.

## 19. OCR Paper-Form → GRN Loop Close
**What:** AI Scan exists for indents already. Extend the same Gemini OCR pipe to GRN paper
receipts, auto-populate the stock-create form instead of typing items by hand (351+ items typed
manually this session alone).
**Touch points:** `controllers/scanController.js`, `controllers/grnController.js`.

## 20. Kafka Event Digest for Store Manager
**What:** Daily digest (notification or email) summarizing `kafka_event_log` — X issued, Y
created, Z anomalies. All data already sits in the table; just needs a cron + template.
**Touch points:** new cron job, `services/notifications` (email module already exists per
`backend/notifications/email.js`), `kafka_event_log` table.

---

## Priority read (grounded, not a guess)
- **Quick wins (data already captured, no new infra):** #5, #9, #13, #15, #20 — all just read
  columns/tables that already exist and sit unused.
- **Medium (needs a small new service):** #1, #2, #7, #11, #16, #18.
- **Bigger lift (new UI + AI parse flow):** #4, #6, #17, #19.

No kafka broadcast needed for this doc itself — it's a markdown file, no DB/API action, nothing
to fire an event for.
