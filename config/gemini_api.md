# Google Gemini API

**Model:** `gemini-2.0-flash` (hardcoded in `services/localAI.js` — was `gemini-3.5-flash`, an
invalid model id that 400'd every call and silently degraded every scan to garbage; fixed
2026-07-06)
**Access:** raw REST `fetch()` to `generativelanguage.googleapis.com` — no `@google/genai` SDK
dependency, one file owns the integration.
**Config:** `GEMINI_API_KEY` in `.env`
**Retry:** 2 attempts per call (`callGemini()`, `services/localAI.js:72`)
**Known issue (2026-07-06):** all AI-Studio keys tested (4 keys, 4 separate GCP projects) hit
`429 quota: 0` on free tier, or `401 invalid auth` — looks like an account-level region/billing
gate, not a per-project quota issue. Needs billing enabled on a project, or stays on local
fallback chain below.
**Image scan path (2026-07-06): pure Tesseract OCR only, no Gemini/Claude/Ollama.** Removed all
AI-vendor calls from `ocrImage()` / `scanImageStructured()` — user reported "not scanning at all"
persisting despite backend logic proving correct in isolated tests; real risk was an external API
call (Gemini/Claude) hanging on a blocked/slow network path, indistinguishable from "nothing
happens" in the UI. Text/voice scan endpoints (`/scan/text`, `/scan/voice`,
`structureWithOllama()`) still use Gemini → Ollama(qwen) → regex — those aren't image-upload paths.

**Accuracy pipeline (2026-07-06) — `scanImageStructured()` in `services/localAI.js`:**
1. `preprocessImage()` — `sharp`: upscale to 1600px, grayscale, normalize contrast, sharpen,
   threshold(150) → clean B/W. Big lift for faint handwriting / phone shots / shadows.
2. `runTesseract()` — Tesseract `eng+tel+hin`, returns text + confidence (0-1).
3. `localRegexParse()` — deterministic row parse. `normalizeNumericTokens()` fixes OCR
   digit/letter confusion in qty tokens only (O→0, S→5, l/I→1, comma→dot) without touching names.
4. Item-master match via `fuzzyMatchBatch` (passed in from controller to dodge circular require)
   — attaches `item_code`, restores canonical stock name on exact/alias hit, keeps raw OCR in
   `scanned_name`.
5. Per-row `confidence` + `status`: `ok` / `verify` (<0.9) / `manual_review` (missing qty,
   unmatched, or <0.7). Response also carries top-level `ocr_confidence`.
Fully offline, ~500-800ms, no hallucination. Frontend should surface `status` for review-gating.

**Digit-only second OCR pass (2026-07-06) — the fix for real handwritten qty being missed
entirely.** Real scan of the actual 47-row form matched every name/unit correctly (template path
proven working) but qty came back blank for nearly every row — synthetic tests used printed
numbers, real form has handwritten pen digits, which Tesseract's mixed-alphabet pass reads far
worse. Fix: `runTesseract()` switched from the `Tesseract.recognize()` shortcut (which only
returns plain text) to `Tesseract.createWorker()` + `output: {blocks: true}`, exposing per-line
bounding boxes (`flattenLines()`). A second `runDigitTesseract()` pass runs with
`tessedit_char_whitelist: "0123456789.+-"` — digits-only recognition is significantly more
reliable than mixed-alphabet. When the main pass finds no qty for a matched row,
`findDigitLineNear()` cross-references the digit pass by vertical row-band overlap (not text
matching — position only) and uses its number instead. Costs ~2-3s extra per scan (two Tesseract
passes instead of one) — acceptable tradeoff for going from near-zero qty capture to real numbers.

**Template-master matching (2026-07-06) — the accuracy fix for fixed pre-printed sheets:**
Real indents (like the "SOUTH INDIAN" 47-row sheet) have item names/units pre-printed, only qty
is handwritten. Guessing names from OCR was the main error source. New approach: never OCR the
name — match by known row position instead.
- `db/migrations/052_create_indent_templates.js` — `indent_templates` table
  (`template_name`, `row_no`, `item_name`, `item_code`, `default_unit`), seeded with the 47
  "SOUTH INDIAN" rows from the sample sheet.
- `backend/scripts/link_indent_template_codes.js` — links `item_code` via existing
  `fuzzyMatchBatch` (run once after migration + whenever `stock` is reseeded; migration alone
  can't do this since it needs live stock data — 47/47 matched on first run).
- `services/localAI.js`: `detectTemplate()` (does OCR text contain a known template name header,
  e.g. "SOUTH INDIAN") → `matchAgainstTemplate()` (greedy word-overlap match of each template row
  against unclaimed OCR lines, strips leading row-number token before extracting qty — a real bug
  caught in testing: row-number "1" was being read as qty instead of the actual "0.2").
- Wired into `scanImageStructured()`: if `task === "indent"` and a template header is detected,
  use template-row matching (name/unit/item_code trusted from DB, only qty read from image);
  otherwise falls back to the generic `localRegexParse()` path.
- Verified end-to-end via synthetic image (header + rows) — all qty values matched exactly,
  correct item_code, correct unit.
- To add another sheet layout (e.g. "NORTH INDIAN" dual-column): insert new rows into
  `indent_templates` with that `template_name`, re-run the linking script.

**Bug found + fixed (2026-07-06) — header-text detection was too fragile:** original
`detectTemplate()` required an exact substring match of the template name in OCR text. Real
scan showed why that fails: the "SOUTH INDIAN" header is diagonal handwriting — the WORST OCR
region on the page — and got read as "LOUTH TOA". Exact-match found nothing, silently fell back
to the weak generic regex parser (only 8/47 rows, garbled names). Replaced with
`detectBestTemplate()`: tries every known template's row-matching against the OCR text, scores
by how many rows actually resolve, picks the best one if ≥25% of rows resolve — no dependency on
reading the header correctly at all. Verified on a full 47-row synthetic form: 34 exact "ok",
1 "verify", 12 correctly-flagged blank rows (matches the real form's actual blank cells exactly:
Black Olives, Boiled Rice, Chilly Flakes ×2, Chinese Container 1000ml, Chocolate Ice Cream, Dosa
Rice, Dry Coconut, Dust Bin Covers, Dust Pan, Faluda Glass, Fish).

**Second bug found + fixed same session — item names with embedded digits:** rows like "Box
Container 1000 Ml" or "Chinese Container 500ml" have a number IN the printed name. Qty extraction
was grabbing that embedded digit instead of the real handwritten qty (row 24 got `qty:1000`
instead of `5`). Fixed by stripping the row-number prefix AND the template's own item-name text
(literal match, falls back to per-word removal for noisy OCR) before searching for the qty number.

**Unit-mismatch clause added:** template's printed unit is trusted for the DB write, but if the
(name-stripped) OCR text has a DIFFERENT recognizable unit token than expected — e.g. sheet says
"Kg" but handwriting reads "Ltr" — `unit_mismatch: true` is set and status forced to
`manual_review`. Checked against `normalizeUnit()` (`utils/units.js`) so alias spellings
(kgs/kilo/kg) don't false-positive. First version checked the raw OCR line and false-positived on
row 24 ("Box Container 1000 **Ml**" — the unit-looking word is baked into the item's own name);
fixed by checking the name-stripped text instead. `unit_mismatch` now surfaced in the
`/api/scan/indent` response (`controllers/scanController.js`).

**Calculation parsing + sanity validation added:** `parseQtyExpression()` handles handwritten
arithmetic instead of a final value ("30+30" → `60`, "1-0.5" → `0.5`), tried before falling back
to a single plain number. `isQtySane()` rejects numerically absurd results for the unit (e.g.
>500 for kg/L, >5000 for pcs, negative) by nulling the qty back out so it lands in
`manual_review` instead of silently saving a misread. Both verified in a full 47-row test:
"30+30" on Eggs → `qty: 60`, a forced `9999` on Black Salt (kg) → correctly nulled to
`manual_review`. No CV/model needed — pure regex + arithmetic, same offline pipeline.
**PaddleOCR — tried and abandoned (2026-07-06):** attempted table-structure recognition via
PaddleOCR/PaddleX as a table-aware tier. 3 different `paddlepaddle` versions (3.3.1, 2.6.2, 3.0.0)
all crashed inside paddle's C++ inference engine (PIR/oneDNN attribute errors) — a broken
Windows-CPU build issue, not a config mistake. Not worth further time; all files removed.

**What it does (8 functions exported from `services/localAI.js`):**
| Function | Wired in | Purpose |
|---|---|---|
| `ocrImage()` | `controllers/scanController.js` | Paper-form → structured data |
| `scanImageStructured()` | `controllers/scanController.js` | OCR + structuring in one call |
| `generateMorningBriefing()` | `controllers/dashboardController.js:287` | Pending indents + low-stock + expiring + handoff → readable briefing |
| `generateShiftHandoffSummary()` | `controllers/handoffController.js:45` | Day's issuances/GRNs/indents + user note → shift summary |
| `generateSmartIndent()` | `controllers/indentController.js:327` | Recipe scaling + leftovers + stock → suggested indent |
| `generateExpiryMenuSuggestions()` | `controllers/recipeController.js:257` | Expiring stock → recipe suggestions |
| `checkAIHealth()` | health/status checks | AI reachability probe |
| `transcribeAudio()` | (defined, not yet wired to a route) | Voice input — unused hook |

**What's been done:**
- Found `generateShiftHandoffSummary` was fully coded and wired to a controller, but
  completely unreachable — `POST /api/handoffs` 403'd on every role including Admin because
  `handoffs.create` permission was never seeded (see `postgresql.md`). Fixed the permission
  gap, then proved the AI call live: real Gemini response summarized a real day's activity
  ("Successfully processed and completed 4 material issuances for the STAFF department...")
  — first-ever successful call on this endpoint (record id 1).
- No new Gemini wiring needed for reorder-suggestion or recipe-cost-drift features — both use
  plain deterministic math (average consumption, price delta) instead of AI, since the signal
  is exact and doesn't benefit from a language model's judgment.
- `transcribeAudio()` exists in the service file but has no route/controller calling it yet —
  confirmed via grep, left alone (matches Phase-1 scope: quick wins only, voice-to-indent
  (#4) is a bigger-lift item not yet started).
