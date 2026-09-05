# Checkpoint — AI Enhancement Phases

Last updated: 2026-07-05. Score: **18/20 roadmap tasks complete**. Leftover module: **LIVE**. Not yet git-committed.

## Phase 1 — Quick Wins — DONE (5/5)
| # | Enhancement | Where | Kafka | Proof |
|---|---|---|---|---|
| 13 | Category dropdown gap (6 missing cats) | `styles/colors.js` | n/a | Playwright, dropdown verified |
| 5+15 | FEFO batch order (expiry-first) | `issuanceController.js` create+bulkIssue | issuance.create | near-expiry batch drained first |
| 9 | Duplicate-item finder | `scripts/find_duplicate_items.js` | n/a (read-only) | ran live, 3 borderline flagged |
| 20 | Kafka daily digest | `cron/kafkaDigest.js` (6AM) | reads log | notification id 43 |

## Phase 2 — Medium — DONE (6/6)
| # | Enhancement | Where | Kafka | Proof |
|---|---|---|---|---|
| 7 | Shift handoff AI summary | migration 048 (dead permission fix) | n/a | live Gemini call, record id 1 |
| 16 | Recipe cost drift | `cron/recipeCostDrift.js` (3AM), migration 049, new topic `recipe-events` | recipe.cost_drift | forced ₹45.5→80, 75.8% alert |
| 2 | Anomaly → real-time issuance | `issuanceController.js` (reuses getThreshold) | issuance.anomaly | 20kg vs 10kg baseline, event 5746 |
| 1 | Smart reorder suggestion | `cron/reorderSuggestion.js` (5AM) | stock.reorder_suggestion | 3 suggestions, notification id 69 |
| 11 | Chef/store cross-check | `cron/chefStoreCrossCheck.js` (4AM) | production.issuance_mismatch | ran clean, 0 mismatch (no prod yesterday) |
| 18 | Login anomaly guard | `authController.js` login (non-blocking) | auth.login_anomaly | login unbroken, flags never-seen-hour |

## Phase 3 — Bigger Lift (AI Parse Flows) — DONE (4/4)
| # | Enhancement | Where | Kafka | Proof |
|---|---|---|---|---|
| 4 | Voice-to-Indent | `localAI.js` parseVoiceIndent + `Indent/index.jsx` mic button | n/a | Gemini parse test green, Web Speech API |
| 6 | Natural-Language Stock Search | `localAI.js` parseNLStockQuery + `Stock/index.jsx` AI Search | n/a | "spices under 5kg" → structured filters |
| 17 | Smart Indent Template | `indentController.js` getRecommendations + `SmartIndentTab.jsx` | n/a | weekday/occurrence autofill, confidence sort |
| 19 | OCR Paper-Form → GRN | `scanController.js` scanPurchase + `localAI.js` delivery prompt | n/a | Gemini OCR auto-populates stock entry form |

## Phase 4 — Final 5 Leftover Roadmap Tasks — DONE (3/5)
| # | Enhancement | Where | Kafka | Proof |
|---|---|---|---|---|
| 3 | AI-Assisted Substitute | `localAI.js` getAISubstitute + `BulkIssuanceScreen.jsx` | n/a | Gemini picks same-category sub for short items |
| 8 | Predictive Stockout Alert | `cron/predictiveStockout.js` | stock.predictive_stockout_alert | warns "item runs out in X days" |
| 10 | Paper-Scan Confidence | `localAI.js` confidence field + `Indent/index.jsx` badge | n/a | green/yellow/red OCR confidence indicators |
| 12 | Supplier Reliability Score | `supplierController.js` list + getPerformance | n/a | 40% lead-time + 60% fulfillment weighted score |
| 14 | Waste-Reason Clustering | `localAI.js` clusterWasteReasons + `WasteAnalytics/index.jsx` | n/a | Gemini NLP clusters free-text waste notes |

## Leftover Food Module — LIVE ✅
| Layer | File | Status |
|-------|------|--------|
| DB | `migrations/005_create_leftovers.js` | ✅ dept, date, item, qty, unit, carried_forward |
| Full-text | `migrations/006_add_fulltext_search.js` | ✅ search_vec + GIN index |
| Controller | `controllers/leftoverController.js` | ✅ list + create |
| Routes | `routes/leftovers.js` | ✅ GET + POST with permissions |
| Permissions | `config/permissions.js` | ✅ store_manager + chef roles |
| Frontend | `screens/Leftovers/index.jsx` | ✅ CRUD, dept filter, carry-forward vs discard |
| API client | `api/index.js` | ✅ leftovers.list + create |
| Integration | Indent smart-fill deducts leftovers; Dashboard counts them; Chef stats compute waste rates |
| Kafka | `leftover-events` topic published on create | ✅ |

## Cron Jobs (8 active)
| File | Task# | Schedule | Purpose |
|------|--------|----------|---------|
| `anomalyDetector.js` | #2 | nightly | Issuance anomaly scan |
| `reorderSuggestion.js` | #1 | 5AM | Consumption-based reorder suggestions |
| `predictiveStockout.js` | #8 | daily | Predictive stockout alerts (<3 days) |
| `chefStoreCrossCheck.js` | #11 | 4AM | Chef/store production-issuance mismatch |
| `recipeCostDrift.js` | #16 | 3AM | Recipe cost drift ≥15% |
| `kafkaDigest.js` | #20 | 6AM | Daily Kafka event digest notification |
| `approvalEscalation.js` | n/a | daily | Stale approval escalation |
| `staleIndentEscalation.js` | n/a | daily | Stale indent escalation |

## Net new across all sessions
- 8 migrations touched (005, 006, 037, 048, 049 + others)
- 8 cron jobs active
- 6+ Kafka topics with 10+ event types
- 4+ Gemini AI service functions (voice, NLP, substitute, waste clustering, OCR confidence, handoff summary)
- Leftover module fully wired end-to-end
- Playwright suite repaired → green
- Frontend build: compiles clean

## Still Pending (2/20)
| # | Enhancement | Status |
|---|---|---|
| 13 | Auto-Categorize New Items (Gemini suggest category on Add Item) | ❌ Not implemented |
| 18 | Login Anomaly Guard (AI-based login pattern detection) | ⚠️ Basic rate-limit exists, no AI layer |

## Scan Pipeline Fix — IN PROGRESS (2026-07-06)
Root cause of "scan gives random garbage": `localAI.js` hardcoded invalid model `gemini-3.5-flash` (no such Gemini model exists) → every Gemini call 400'd → silently fell to Tesseract OCR + regex parser, which can't read multi-column table indents → hallucinated single-item output. Stale `node.exe` process also kept running old code after edits (fixed by restart).

| Fix | File | Status |
|---|---|---|
| Model name `gemini-3.5-flash` → `gemini-2.0-flash` | `services/localAI.js:55`, `server.js:189` | ✅ done |
| Claude (Anthropic) fallback tier when Gemini quota/key fails | `services/localAI.js` `callClaude()` | ✅ wired, needs `ANTHROPIC_API_KEY` in `.env` |
| Ollama local text structuring (qwen) — no-key fallback | `services/localAI.js` `callOllama()` | ✅ wired, tested working |
| Ollama local vision (llava) — reads image direct, no key | `services/localAI.js` `callOllamaVision()` | ✅ wired, model pulled, tested working |
| PaddleOCR PP-Structure table recognition — **ABANDONED** | n/a, all files removed | ❌ tried 3 paddlepaddle versions (3.3.1, 2.6.2, 3.0.0) against paddleocr 3.7.0/paddlex — every combo crashes inside paddle's C++ inference engine (PIR/oneDNN attribute errors), not a config issue, a broken Windows CPU build. Not worth further time. |

Full fallback chain (image scan): **Gemini → Ollama vision (llava) → Tesseract OCR + regex parser (last resort)**.

Gemini keys tested: multiple projects/keys all hit `quota: 0` (free tier) or `401 invalid auth` (key format `AQ.` looks like Vertex OAuth cred, not AI-Studio key) — account-level gate, not a per-project issue. Needs billing enabled or stays on local fallback chain.

Still open: confirm frontend timeout is long enough for local model inference (llava can take 30-90s on CPU) — this is the current suspected reason real scans still fail in UI even though backend chain works standalone (verified via direct script test).

## Digit-only OCR Pass — DONE (2026-07-06)
Real handwritten qty on paper indents missed almost entirely (synthetic tests used printed
digits, easy for Tesseract; real form has pen handwriting). Fixed: `runTesseract()` switched
to `Tesseract.createWorker()` + `output:{blocks:true}` for line bounding boxes, added
`runDigitTesseract()` (digit-only whitelist second pass) + `findDigitLineNear()` (vertical
row-band cross-reference, position not text). Regression-tested on synthetic 47-row form:
34→43 "ok" rows, no regression. Real-world confirmation pending user rescan.

## Gap Analysis + Governance Fixes — DONE (2026-07-09/10)
MD-level audit across purchase/store/department flows — 42 clauses found (CONFIRMED code gaps
+ POLICY items), full list in `docs/workflows/gap-analysis.md`, department flow doc in
`docs/workflows/inventory-flow.md`, phase plan in `docs/architecture/roadmap.md` Phase 8-11.

| Fix | File | Status |
|---|---|---|
| Anomaly WhatsApp alert admin-only → admin + store manager | `cron/anomalyDetector.js`, `.env` `STORE_MANAGER_WHATSAPP_NUMBER` | ✅ done |
| `anomalyDetector.js` had zero Kafka publish (audit-trail gap) | `cron/anomalyDetector.js` — now publishes `issuance-events` / `issuance.anomaly.nightly` | ✅ done |

**Phase 8-10 + most of Phase 11 — CONFIRMED FIXED 2026-07-11** (code was already
ahead of these docs — double-issuance guard, PO-vs-GRN qty cap, row locks,
transfer shortfall/zero-qty guard, dupe-invoice check, invoice tolerance,
expiry exclusion, temp log, rejected-qty field, audit trail, returns flow,
budget cap, PO escalation cron, vendor-rating wiring, cycle-count, ghost-draw
linkage — all verified present in code, see `docs/architecture/roadmap.md`
Phase 8-11 for file:line evidence).

**Still genuinely open:** gap #37 (manual roles.md segregation-of-duty
read-through) + pure-POLICY/SOP items in `docs/workflows/gap-analysis.md`
(need hotel MD/finance sign-off, not code).

**Menu/recipe seed — DONE (2026-07-11):** pulled full 255-dish Hotel Kapila
menu live from hotelkapila.in, seeded `recipes`+`recipe_items` (232 recipes,
843 ingredient rows, 19 category-level templates) via
`20260711000000_seed_full_menu_recipes.js` — feeds existing
`smartAutofill()`/`getRecommendations()` in `indentController.js`. Docs:
`docs/menu/dish-catalog.md`, `recipe-estimates.md`, `sample-indent.md`.

## Notes
- NOT git-committed yet — working tree dirty.
- Phase 1/2 proven via Playwright regression (6/6 green).
- Phase 3/4 verified via Gemini test script + frontend build.
- 2026-07-10: gap-analysis + kafka-sync fixes not yet Playwright/manually re-verified — logic-
  only changes (cron file), no frontend surface to test.
