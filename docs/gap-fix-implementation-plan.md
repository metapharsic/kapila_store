# Kapila IMS — Gap Fix Implementation Plan
**Status: APPROVED by manager — 2026-07-27 | Revised 2026-07-30 v5.0 (final amendments incorporated)**
**Owner: Technology Team**
**Relates to:** `docs/priority-execution-plan.md` Section 7 (Priority 3 — Policy Controls)

---

> All items verified against live codebase. No scope creep.
> Each phase must pass its acceptance criteria before the next phase begins.
> Phase 0 is approved to start immediately after adding the shared helper.
> Phases 1-5 are blocked on management decisions listed in each section.

---

## Gap Execution Order

| Phase | Gap | Status | Effort |
|---|---|---|---|
| **0** | Role ID bug in 5 cron files | ✅ COMPLETED — 2026-07-30 | ~2 hours |
| **1** | Indent Cutoff Time | Not Started — blocked on D1 and D7 | 3-5 days |
| **2** | Banquet / Event Ring-Fencing | Not Started — blocked on D1, D4 | 5-8 days |
| **3** | Two-Level Write-Off Sign-Off | Not Started — blocked on D1-D6 | 6-8 days |
| **4** | Month-End Stock Freeze | Not Started — blocked on D1-D4 | 4-6 days |
| **5** | Split-PO Detection (monitoring only) | Not Started — blocked by prerequisite: live approval_rules rows must exist first | 4-5 days |
| **6** | Staff Meal Allowance Cap | Deferred — no price data | 4-5 days |

**Total Phases 0-5: approximately 24-33 development days.**

---

## Phase 0 — Fix Role ID Bug in 5 Cron Files
**Status: ✅ COMPLETED — 2026-07-30**
**Effort: ~2 hours**

### Problem
Five cron jobs are broken because they reference role ID 5 (STORE_MANAGER) which never existed in the live database (only roles 1-4 exist).

Precise breakdown by cron:
- kafkaDigest.js — STORE_MANAGER_ROLE_ID = 5 — digest sent nowhere ✗
- reorderSuggestion.js — STORE_MANAGER_ROLE_ID = 5 — reorder alerts lost ✗
- predictiveStockout.js — STORE_MANAGER_ROLE_ID = 5 — stockout alerts lost ✗
- chefStoreCrossCheck.js — hard-coded array [1, 5, 3] — role 5 silent failure; roles 1 and 3 may or may not exist ✗
- recipeCostDrift.js — ADMIN_ROLE_ID = 1 (Admin exists, so this half works ✓), STORE_MANAGER_ROLE_ID = 5 (fails ✗) — Manager never receives cost drift alerts

All five files must use the shared helper even where the current hard-coded ID accidentally works, so the pattern is consistent and survivable across future role changes.

### Confirmed Decision
Notifications go to the manager role (key: "manager") for now. If a store_manager role is created later, update the RECIPIENT_ROLE_KEYS config in the shared helper — no cron file changes needed.

### Files to Fix

| File | Line | Current (broken) |
|---|---|---|
| backend/cron/kafkaDigest.js | 7 | const STORE_MANAGER_ROLE_ID = 5; |
| backend/cron/recipeCostDrift.js | 10-11 | const ADMIN_ROLE_ID = 1; const STORE_MANAGER_ROLE_ID = 5; |
| backend/cron/reorderSuggestion.js | 10 | const STORE_MANAGER_ROLE_ID = 5; |
| backend/cron/predictiveStockout.js | 5 | const STORE_MANAGER_ROLE_ID = 5; |
| backend/cron/chefStoreCrossCheck.js | 32 | for (const role of [1, 5, 3]) — all hard-coded IDs |

### Implementation: Shared Helper

Create `backend/services/cronNotifyRecipients.js`:

```js
const db = require("../db");

// Role keys to notify — change here, not in individual cron files.
// Add "store_manager" here if that role is created later.
const RECIPIENT_ROLE_KEYS = {
  manager: "manager",
  admin: "admin",
  chef: "chef",
};

// Resolves a single role key to its live DB ID.
// Logs a clear error if not found. Does NOT throw — cron must continue.
async function resolveRoleId(roleKey, cronName) {
  const role = await db("roles").where({ key: roleKey }).first();
  if (!role) {
    console.error(`[${cronName}] WARNING: Role key "${roleKey}" not found in roles table. Notification skipped.`);
    return null;
  }
  return role.id;
}

// Resolves multiple role keys at once. Skips missing ones.
// IMPORTANT: call this ONCE per cron run, before any notification loop —
// not inside a per-item loop, to avoid redundant DB queries.
async function resolveRoleIds(roleKeys, cronName) {
  const results = await Promise.all(
    roleKeys.map((key) => resolveRoleId(key, cronName))
  );
  return results.filter((id) => id !== null);
}

module.exports = { resolveRoleId, resolveRoleIds, RECIPIENT_ROLE_KEYS };
```

### Pattern — Single Recipient (kafkaDigest, reorderSuggestion)
```js
const { resolveRoleId, RECIPIENT_ROLE_KEYS } = require("../services/cronNotifyRecipients");

// Resolve ONCE at the top of the function, before any loop
const recipientId = await resolveRoleId(RECIPIENT_ROLE_KEYS.manager, "ReorderSuggestion");
if (recipientId) {
  await sendNotification({ recipient_role_id: recipientId, ... });
}
// Job continues regardless — no silent return, no throw
```

### Pattern — Per-Item Loop (predictiveStockout)
```js
// Resolve role ONCE before the alerts loop — not inside the loop
const recipientId = await resolveRoleId(RECIPIENT_ROLE_KEYS.manager, "PredictiveStockout");

for (const alert of alerts) {
  if (recipientId) {
    await sendNotification({ recipient_role_id: recipientId, ... });
  }
}
```

### Pattern — Multiple Recipients (chefStoreCrossCheck, recipeCostDrift)
```js
const { resolveRoleIds, RECIPIENT_ROLE_KEYS } = require("../services/cronNotifyRecipients");

// Resolve ONCE before any loop
const recipientIds = await resolveRoleIds(
  [RECIPIENT_ROLE_KEYS.admin, RECIPIENT_ROLE_KEYS.manager, RECIPIENT_ROLE_KEYS.chef],
  "ChefStoreCrossCheck"
);

for (const roleId of recipientIds) {
  await sendNotification({ recipient_role_id: roleId, ... });
}
```

### Acceptance Criteria
- [ ] backend/services/cronNotifyRecipients.js created and used by all 5 cron files
- [ ] No cron file contains any hard-coded numeric role ID
- [ ] Role IDs resolved ONCE per cron run, before notification loops
- [ ] If a role key is not found, a clear log line is printed and the cron continues without throwing
- [ ] chefStoreCrossCheck.js sends to admin, manager, chef — dynamically resolved
- [ ] recipeCostDrift.js sends to admin and manager — dynamically resolved (ADMIN_ROLE_ID = 1 replaced even though role 1 currently works, to eliminate all hard-coded IDs)
- [ ] Unit/integration tests for cronNotifyRecipients.js verify: given a populated roles table, resolveRoleId returns the actual DB row id; given a missing role key, it returns null and logs; no test relies on hard-coded expected IDs
- [ ] Note: manually triggering crons against the live system may produce zero notifications if stock, kafka events, or recipe snapshots are empty — tests must use fixture data or mock the DB query to confirm recipient_role_id correctness regardless of operational data volume

### Rollback Plan
Changes confined to 5 cron files + one new service file. No migration involved.
Before production data: revert cron files, delete cronNotifyRecipients.js.
After production data: notifications are stateless — no data loss from reverting.

---

## Phase 1 — Indent Cutoff Time
**Status: NOT STARTED — blocked on D1 and D7**
**Effort: 3-5 days**

### Management Decisions Required

| # | Decision | Answer |
|---|---|---|
| D1 | What time does indent submission close? | (fill in) |
| D2 | Timezone | Confirmed: Asia/Kolkata |
| D3 | Which permission key allows post-cutoff submission? | Confirmed: indent.override_cutoff |
| D4 | Who holds that permission? | Confirmed: Admin only |
| D5 | Must overrides be logged? | Yes — mandatory |
| D6 | Does the window open at a fixed time? | Confirmed: 6:00 AM |
| D7 | Should manager receive a notification when the window opens? | (fill in) |

### Implementation Notes

**Where the check lives:**
Add the time-window check in indentController.js create(), AFTER validate("indent") middleware runs, AFTER department validation. Do NOT add to validate.ts — Zod handles field shape only, not business time rules.

**Permission-based check (verified pattern):**
The indent route uses requirePermission("indents.create") — consistent with this pattern.
The override check must test `req.user.permissions.has("indent.override_cutoff")`.
Do NOT check role names or hard-code role keys in the controller.

**Cutoff applies to:**
The submission timestamp (server clock in HOTEL_TIMEZONE) — not the requested indent date.

**Missing env var behaviour (must be explicit):**
If INDENT_CUTOFF_TIME or HOTEL_TIMEZONE is not set in .env, the server must log a startup warning and treat the window as ALWAYS OPEN (permissive fallback), not crash. The warning must be visible in logs so the misconfiguration is caught.

**New env vars:** INDENT_CUTOFF_TIME, INDENT_OPEN_TIME, HOTEL_TIMEZONE

**New permission:** indent.override_cutoff (Admin only)

### Backend Files to Change
- backend/controllers/indentController.js — add time window check inside create(), after validate("indent") and department checks
- backend/routes/indents.js — add GET /api/indents/window-status route using requireAnyPermission or a lightweight auth check; route registered in this file and handled by indentController.js (new function: getWindowStatus)
  Response shape: { open: bool, cutoff: "HH:MM", open_time: "HH:MM", timezone: "...", server_time: "..." }
  Available to any authenticated user — needed to show banner before submission, not only on 403
- New migration 054_add_indent_cutoff_permissions.js — insert indent.override_cutoff permission, assign to Admin only
- backend/.env — add INDENT_CUTOFF_TIME, INDENT_OPEN_TIME, HOTEL_TIMEZONE

### Frontend Files to Change
- Indent creation screen — call GET /api/indents/window-status on page load, show window status near Submit button
- Do NOT rely solely on a 403 response to inform users — status must appear before they try to submit
- If window closed and user has override — show amber warning banner before submit

### Acceptance Criteria
- [ ] Indent rejected (HTTP 403, code: INDENT_WINDOW_CLOSED) outside window for roles without indent.override_cutoff
- [ ] Role holding indent.override_cutoff can submit at any time
- [ ] Override recorded in audit_logs: action indent.cutoff_override, actor ID, target indent date, submission time, timezone offset
- [ ] GET /api/indents/window-status returns correct state for any authenticated user
- [ ] Frontend shows window status on page load — not only after a failed submit
- [ ] Missing env var logs startup WARNING and defaults to always-open — not a crash

### Rollback Plan
Before production data: revert indentController.js check, rollback migration 054, remove env vars, remove the status route.
After production data: no data loss from this phase (it only adds a control, not new data tables).

---

## Phase 2 — Banquet / Event Ring-Fencing
**Status: NOT STARTED — blocked on D1, D4**
**Effort: 5-8 days**

### Management Decisions Required

| # | Decision | Answer |
|---|---|---|
| D1 | Which indent types beyond routine and adhoc? | (fill in — recommend banquet and event first; hold staff_meal until D4 resolved) |
| D2 | Exclude banquet/event from anomaly 7-day baseline? | Yes |
| D3 | Show event consumption separately in reports? | Yes |
| D4 | Is staff_meal an event type, normal operational, or its own cost centre? | (fill in before implementing staff_meal) |
| D5 | indent_type for production-plan issuances (no linked indent) | Confirmed: default "routine" |

### All Creation Paths That Must Be Updated (verified)

1. **backend/middleware/validate.ts line 25** — MUST update z.enum(["routine","adhoc"]) to include new types. This is the only real validation gate; without it, new indent_type values are rejected before reaching any controller. (indentController.js has no validation list — it only destructures indent_type with a default of "routine". Do NOT add a separate list there; validate.ts is the single source of truth.)
2. **validate.ts issuance schema** — MUST add production_plan_id: z.number().int().positive().nullable().optional(). The controller at line 53 reads production_plan_id from req.body, but Zod .parse() strips unknown fields — production_plan_id is currently being silently dropped before the controller sees it.
3. **backend/controllers/issuanceController.js create()** — snapshot indent_type from linked indent onto issuance record at insert time
4. **backend/controllers/issuanceController.js bulkIssue()** — also snapshot indent_type onto each issuance record (confirmed: separate full stock deduction path at controller line 439)
5. **backend/cron/anomalyDetector.js** — update 7-day baseline query to filter WHERE issuances.indent_type NOT IN ('banquet', 'event'). Use the issuances.indent_type snapshot column — do NOT JOIN to the indents table. The snapshot exists precisely to preserve historical classification; joining indents would break for production-plan issuances (no indent row) and would be invalidated if an indent's type is ever edited.
6. **frontend indent form** — add new types to indent_type dropdown
7. **frontend smart-autofill/voice-parse adapters** — pass indent_type through AI-parsed output

### New Migration Required
055_add_indent_type_snapshot_to_issuances.js
- Add indent_type column to issuances table (not nullable, default "routine")
- Backfill all existing rows to "routine"

### Production-Plan Issuances (No Indent)
When production_plan_id is set and indent_id is null, assign indent_type = "routine" unless the production plan table is extended to carry an event classification (that is a separate task and must not be included in Phase 2 scope).

### Acceptance Criteria
- [ ] validate.ts accepts new indent_type values — new types do NOT return 400 from validation middleware
- [ ] validate.ts issuance schema includes production_plan_id — it is not stripped before the controller
- [ ] banquet and event accepted by POST /api/indents
- [ ] Both POST /api/issuances (single) and POST /api/issuances/bulk-issue carry indent_type snapshot on the issuance record
- [ ] Anomaly detector baseline query filters on issuances.indent_type (not a JOIN to indents) — excluding banquet and event issuances
- [ ] Issuances linked to production_plan (no indent) default to "routine"
- [ ] Existing routine and adhoc indents and issuances are completely unaffected

### Rollback Plan
Before production data: revert validate.ts, indentController, issuanceController (single + bulk), anomalyDetector, frontend. Rollback migration 055 drops the indent_type column.
After production data: do NOT drop the column. Use a forward migration to remove new type options from validation if needed; existing classified rows retain their value.

---

## Phase 3 — Two-Level Write-Off Sign-Off
**Status: NOT STARTED — blocked on D1-D7**
**Effort: 6-8 days**

### Management Decisions Required

| # | Decision | Answer |
|---|---|---|
| D1 | Threshold requiring two approvals? | (fill in — e.g. > 5 kg or > Rs.500 value) |
| D2 | Level 1 approver role? | Recommended: Manager |
| D3 | Level 2 approver role? | Recommended: Admin |
| D4 | Stock reduced when? | Confirmed: only after Level 2 approval |
| D5 | Minimum reason field length? | Confirmed: 20 characters |
| D6 | Reason types? | Damage / Theft / Expiry / Spillage — confirm final list |
| D7 | Write-off scope: department-linked or store-wide? | (fill in — e.g., each write-off tagged to the department where the loss occurred, or store-wide with no department field) |

### Stock Reduction Bypass Paths — Confirmed in Code
Three existing routes reduce stock without an approval gate:

1. **PATCH /api/stock/:id** (stockController.js:147-184) — accepts free-text `reason` + `remaining`, writes deduction directly. Active bypass.
2. **POST /api/stock/reconcile** (stockController.js:313-400) — FIFO deduction for count discrepancies found during physical counts. Also free-text `reason`.
3. **POST /api/audits/:id/finalise** (auditController.js:353-384) — commits physical-audit discrepancies to stock.remaining.

**Policy boundary that must be decided before coding:**
Routes 2 and 3 exist for legitimate physical count corrections. They must NOT be funnelled into the write-off workflow. The boundary is:
- Count discrepancy found during a physical audit or reconciliation → remains in reconcile/audit finalise flow (uncontrolled adjustment)
- Deliberate destruction/loss event (Damage, Theft, Expiry, Spillage) → MUST go through write-off workflow with two-level approval

**Required code change — PATCH /api/stock/:id:**
Block ALL downward remaining changes on this route, regardless of any request_type field or reason value. A caller must not be able to reduce stock through a direct edit — not even if they label it "adjustment". The only permitted downward paths are:
- `POST /api/stock/reconcile` — physical count correction via supervised reconciliation flow
- `POST /api/writeoffs/:id/approve-l2` — deliberate loss after two-level approval

Implementation: in `stockController.js update()`, after computing `delta`, if `delta < 0` return HTTP 400:
`{ error: "Direct stock reductions are not permitted. Use POST /api/stock/reconcile for count corrections or the write-off workflow for damage/loss." }`

Upward adjustments (delta > 0) and metadata-only edits (name, unit, price, category, min_alert_qty, item_code) remain allowed on this route.

Reconcile and audit finalise retain their own flows unchanged; they exist for count discrepancies and are not write-offs.

### Multi-Item Write-Off Schema
A write-off must support multiple items in one request (e.g., a spillage event affecting several items). Use a parent/child structure:

```
stock_writeoffs (parent)
  id,
  department_id (integer, nullable FK to departments — set per D7 decision;
                 NULL = store-wide; populated if D7 = department-linked),
  reason_type (enum — from D6 confirmed list),
  reason_detail (text, min 20 chars),
  status (proposed|pending_l1|pending_l2|approved|rejected),
  proposed_by (FK users), l1_approved_by (FK users), l1_approved_at,
  l2_approved_by (FK users), l2_approved_at,
  rejected_by (FK users), rejected_at, rejection_reason (text),
  created_at, updated_at

stock_writeoff_items (child)
  id, writeoff_id (FK to stock_writeoffs),
  stock_id (FK to stock), item_name, item_code, qty, unit,
  before_qty (snapshot at proposal time),
  after_qty (set only after L2 approval)
```

### Backend Files to Change
- New migration 056_create_stock_writeoffs.js — parent + child tables
- New controller backend/controllers/writeoffController.js
  Endpoints: propose (multi-item), approve-l1, approve-l2, reject, list
  Stock deducted ONLY in approve-l2: transaction with row locks (.forUpdate()), batch-level availability check, proposer !== L1 !== L2 enforced at API level
  Department scope: user can only propose write-offs for departments they have access to
- New route backend/routes/writeoffs.js
- New migration 057_seed_writeoff_permissions.js — insert permissions, assign to roles
- PATCH /api/stock/:id — add request_type enum check (redirect write-off intent; leave reconcile-style adjustments unchanged)

### Frontend Files to Change (Phase 3)
- Write-Off Propose screen — multi-item form, reason_type dropdown (from D6 list), reason_detail text (min 20 chars enforced on frontend and backend), item search, quantity input
- Write-Off List screen — filterable by status (proposed/pending_l1/pending_l2/approved/rejected), department
- L1 Approval modal — show items + quantities + proposer; Approve / Reject with mandatory rejection note
- L2 Approval modal — same, plus show L1 approval timestamp and actor
- Write-Off Detail view — full lifecycle timeline: proposed → l1 approved → l2 approved / rejected

### Acceptance Criteria
- [ ] Proposing a write-off does NOT change any stock.remaining value
- [ ] stock.remaining deducted ONLY after Level 2 Admin approval, inside a transaction with forUpdate() row locks
- [ ] Batch-level availability confirmed at deduction time — not at proposal time
- [ ] Proposer, L1, and L2 must be distinct user IDs (API-level enforcement)
- [ ] audit_logs: l1_approved_by, l2_approved_by, timestamps, before_qty and after_qty per item
- [ ] Rejection at either level leaves stock unchanged
- [ ] reason_detail shorter than 20 characters rejected with HTTP 400
- [ ] reason_type must be from the confirmed enum list — no free-text categories accepted
- [ ] PATCH /api/stock/:id with any negative delta returns HTTP 400 — no exceptions, no request_type override
- [ ] Multi-item write-offs supported in a single request
- [ ] department_id field present on stock_writeoffs (nullable, per D7 policy)

### Rollback Plan
Before any approved write-offs in production: rollback migrations 056 and 057, revert stockController bypass guard.
After approved write-offs exist in production: do NOT drop the tables. Use a forward corrective migration; preserve all write-off and audit history. Mark this explicitly before going live.

---

## Phase 4 — Month-End Stock Freeze
**Status: NOT STARTED — blocked on D1-D4**
**Effort: 4-6 days**

### Management Decisions Required

| # | Decision | Answer |
|---|---|---|
| D1 | Who can activate the freeze? | Confirmed: Admin only |
| D2 | System-wide or per-department? | Confirmed: system-wide |
| D3 | Who issues emergency override? | Confirmed: Admin only, mandatory reason |
| D4 | Does freeze block all writes or only some? | Confirmed: all stock quantity writes |

### Complete Verified List of Routes to Freeze

| Route | Source File | Stock Mutation Confirmed |
|---|---|---|
| POST /api/stock | routes/stock.js:17 | Creates new batch |
| PATCH /api/stock/:id | routes/stock.js:26 | Updates remaining/qty |
| PATCH /api/stock/unit | routes/stock.js:21 | Rescales batch quantities |
| DELETE /api/stock/:id | routes/stock.js:27 | Removes batch |
| POST /api/stock/reconcile | routes/stock.js:18 | Commits count adjustments |
| POST /api/issuances | routes/issuances.js:10 | Deducts stock |
| POST /api/issuances/bulk-issue | routes/issuances.js:9 | Deducts stock (separate path) |
| DELETE /api/issuances/:id | routes/issuances.js:12 | Reverses stock deduction |
| POST /api/grn | routes/grn.js:11 | Adds stock batches (NOT /api/grns) |
| DELETE /api/grn/:id | routes/grn.js:12 | Removes stock batches |
| POST /api/transfers | routes/transfers.js:10 | Initiates transfer record |
| PATCH /api/transfers/:id/accept | routes/transfers.js:11 | Deducts stock (confirmed: transferController.js:159) |
| POST /api/returns | routes/returnRoutes.js:7 | Records pending return |
| POST /api/returns/:id/approve | routes/returnRoutes.js:8 | Adds stock back (confirmed: returnController.js:103) |
| POST /api/approved-delivery/commit | routes/approvedDelivery.js:12 | Writes GRN/stock |
| POST /api/audits/:id/finalise | routes/audits.js:14 | Updates stock.remaining (confirmed: auditController.js:353-384) |
| POST /api/store-issuance/auto-issue | server.ts:55 | Deducts stock — INLINE IN server.ts |

**Total: 17 stock-mutating paths. Route middleware alone cannot cover the server.ts inline endpoint.**

### Backend Files to Change
- New migration 058_create_system_settings_and_freeze_permission.js
  (One migration — NOT 058 and 058b — for predictable Knex ordering)
  Creates system_settings key-value table, seeds stock_frozen = false
  Inserts stock.override_freeze permission, assigns to Admin only
- New middleware backend/middleware/stockFreezeGuard.js
  Returns HTTP 423 when stock_frozen = true
  Admin with stock.override_freeze may proceed; override requires a freeze_override_reason field in the request body (string, minimum 10 characters, validated in the middleware before allowing through)
  Logs every override in audit_logs: action stock.freeze_override, actor ID, route, freeze_override_reason, timestamp
  If freeze_override_reason is absent or too short, return HTTP 400 (do not silently ignore)
- Apply stockFreezeGuard middleware to all 16 route-based endpoints above
- Add explicit freeze check inside server.ts auto-issue handler (lines 55-end):
  Read system_settings.stock_frozen before calling issuance controller
  Return 423 with same structure as middleware if frozen
  Apply same freeze_override_reason contract if override is attempted here
- New route GET /api/stock/freeze-status — returns { frozen: bool } — available to any authenticated user
- New route PUT /api/admin/stock-freeze — Admin only, toggles freeze, logs in audit_logs

### Frontend Files to Change
- On page load: fetch GET /api/stock/freeze-status and show amber banner if frozen
- On any 423 response: also show amber banner (belt-and-suspenders)
- Admin panel: freeze toggle with confirmation dialog listing the blocked operations

### Acceptance Criteria
- [ ] All 16 route-based stock-mutating endpoints return HTTP 423 when stock_frozen = true
- [ ] POST /api/store-issuance/auto-issue also returns 423 when frozen (tested separately from route tests)
- [ ] PATCH /api/stock/unit returns 423 when frozen
- [ ] Admin override attempt without freeze_override_reason (or reason < 10 chars) returns HTTP 400
- [ ] Valid Admin override proceeds, logged in audit_logs with freeze_override_reason, actor ID, route
- [ ] Freeze state persists across server restarts (stored in DB, not memory)
- [ ] GET /api/stock/freeze-status returns correct state for any authenticated user
- [ ] Frontend shows amber banner on page load when frozen — not only after a failed submit
- [ ] All read-only GET endpoints are completely unaffected
- [ ] Migration 058 is a single file covering both the system_settings table and the permission seed

### Rollback Plan
Before any freeze has been activated in production: rollback migration 058, remove middleware from routes, remove freeze check from server.ts.
After a freeze has been activated and override records exist in audit_logs: do NOT rollback the migration. Remove the middleware (which makes all routes permissive again) but preserve system_settings and audit entries. Use a forward migration to set stock_frozen = false permanently.

### Operational Rule — External Scripts
No import script, repair script, or direct DB operation may modify stock quantities during an active freeze. This cannot be enforced by HTTP middleware. Add this as a documented operational gate: before running any backend script that touches stock, check system_settings WHERE key = 'stock_frozen' = false. If a script must run anyway (emergency), require Admin sign-off and log it manually in audit_logs before running.

---

## Phase 5 — Split-PO Detection (Monitoring Only)
**Status: NOT STARTED — blocked by prerequisite: live approval_rules must have rows first**
**Effort: 4-5 days**

### Prerequisite — Must Complete Before Phase 5
Live approval_rules table has ZERO rows. Migration 032 conditionally seeded rules only if store_manager role existed — it does not. Before any detection code is written:
1. Management confirms the actual PO approval thresholds (D1)
2. New migration seeds the live approval rules
3. Rules verified in the database

### Management Decisions Required

| # | Decision | Answer |
|---|---|---|
| D1 | PO approval threshold amounts? (required for rule seeding) | (fill in — e.g., below Rs.X: Manager; above Rs.X: Admin) |
| D2 | Detection window | Confirmed: same calendar day (by PO creation date, not delivery date) |
| D3 | Who investigates flags? | Confirmed: Admin |
| D4 | Legitimate multi-PO exemptions? | (fill in — e.g., different item categories from same supplier) |
| D5 | Cancelled POs included or excluded from totals? | Confirmed: exclude cancelled |
| D6 | Previously reviewed-legitimate groups re-flagged if amended? | Confirmed: create new flag, do not update old one |
| D7 | Creator-matching: must all POs in a flagged group share the same created_by user? | (fill in — e.g., same user = automatic flag; cross-user = higher-risk review candidate; no grouping restriction) |

### Backend Files to Change
- New migration 059_seed_live_approval_rules.js
  Seed ONLY after D1 answer is confirmed and written into this document.
  Rules are resolved by role key (never hard-coded role IDs); migration must look up role IDs at seed time:
  ```js
  const managerRole = await knex('roles').where({ key: 'manager' }).first();
  const adminRole   = await knex('roles').where({ key: 'admin' }).first();
  if (!managerRole || !adminRole) throw new Error('Required roles missing — cannot seed approval rules');
  ```
  Rules to insert (columns match approval_rules schema from migration 032):
  ```
  module            | min_amount | max_amount | role_id           | department_id | sequence
  purchase_orders   | 0.00       | 25000.00   | managerRole.id    | null          | 1
  purchase_orders   | 25000.01   | null       | adminRole.id      | null          | 1
  ```
  Note: the Rs.25,000 threshold is the value migration 032 originally attempted to seed. Confirm or revise per D1 before running this migration.
  Note: department_id = null means the rule applies to all departments (system-wide).
  Note: max_amount = null on the Admin row means no upper limit.
  Timezone for "same creation day" detection: Asia/Kolkata (IST). PO created_at timestamps are stored in UTC; the cron must convert to IST before grouping by date.
- New migration 060_create_split_po_flags.js — split_po_flags table with status + review columns
- New cron backend/cron/splitPoDetector.js
  Reads threshold from approval_rules at runtime — never hard-codes amounts
  Threshold query must handle null max_amount on the highest band: use WHERE min_amount <= combined_total AND (max_amount IS NULL OR max_amount >= combined_total)
  Handles no-matching-rule case: log warning and skip that group without throwing
  Excludes POs with status = 'Cancelled' from combined totals
  Applies creator-matching per D7 decision before implementation
  Idempotent: uses fingerprint of {supplier_id, po_creation_date, sorted_po_ids} to avoid re-flagging the same group on reruns
  Skips groups where an existing split_po_flags row for the same fingerprint exists with status = 'legitimate'
  Matches POs by PO creation date (not delivery/business date) for consistency
- New endpoint GET /api/admin/split-po-report (Admin only)
- New endpoint POST /api/admin/split-po-flags/:id/review — mandatory notes, status update

### Acceptance Criteria
- [ ] approval_rules table has at least one live row before this phase starts (prerequisite)
- [ ] Cron correctly identifies same-supplier same-creation-day PO groups where combined total exceeds threshold
- [ ] Threshold query handles null max_amount on highest band without error
- [ ] Cancelled POs excluded from combined totals
- [ ] Rerunning the cron on the same data does not create duplicate flag rows (idempotent fingerprint check)
- [ ] Groups previously marked "legitimate" are not re-flagged
- [ ] If no matching approval rule exists, cron logs a warning and completes without error
- [ ] Creator-matching logic (from D7) applied consistently
- [ ] Admin receives in-app notification for each new flagged group
- [ ] NO PO is automatically blocked
- [ ] Mark-as-legitimate records reviewer ID, timestamp, and mandatory notes

### Rollback Plan
Before any flags exist in production: rollback migrations 060 (drops split_po_flags), optionally 059 if approval rules need re-seeding.
After flags exist in production: do NOT drop split_po_flags. Drop the cron to stop detection, keep the flag table for audit history.

---

## Phase 6 — Staff Meal Allowance Cap
**Status: DEFERRED**

Deferred until:
1. Real stock prices exist (current stock = 0)
2. Management decides: daily/weekly allowance, quantity or value, warn or hard block
3. Phase 2 decision on whether staff_meal is event type or own cost centre is resolved

---

## Execution Rules

1. Each phase completed and acceptance criteria verified before next phase begins
2. Every schema change uses a numbered migration file — no direct ALTER in production
3. Every permission inserted via migration, every role assignment via migration — no manual DB edits
4. Backend restart test after each phase — confirm no startup errors
5. Confirm audit_logs entries are correct after Phases 1, 3, 4
6. Management decisions must be written into this document before coding starts
7. Role model decision (manager vs. store_manager) must be resolved before Phases 1-5 acceptance criteria referencing "Store Manager" can be finalised

---

Document version: 5.0 — 2026-07-30
Cross-reference: docs/priority-execution-plan.md Section 7

---

## Test Matrix — All Phases

Every phase must pass the rows below that are relevant to it. Tests must be written before the phase is marked complete.

### Authorization Tests (401 / 403)

| Phase | Scenario | Expected HTTP |
|---|---|---|
| 1 | Unauthenticated POST /api/indents | 401 |
| 1 | Authenticated user without indents.create submits indent | 403 |
| 1 | Authenticated user without indent.override_cutoff submits outside window | 403 INDENT_WINDOW_CLOSED |
| 1 | Admin with indent.override_cutoff submits outside window | 201 Created |
| 3 | Unauthenticated POST /api/writeoffs | 401 |
| 3 | User without writeoffs.create proposes write-off | 403 |
| 3 | L1 approver attempts L2 approve (same user) | 400 (self-approval) |
| 3 | Proposer attempts L1 approve (same user) | 400 (self-approval) |
| 4 | Unauthenticated PUT /api/admin/stock-freeze | 401 |
| 4 | Non-Admin attempts to toggle freeze | 403 |
| 4 | Admin attempts freeze override without freeze_override_reason | 400 |
| 5 | Unauthenticated GET /api/admin/split-po-report | 401 |
| 5 | Non-Admin accesses split-po-report | 403 |

### Cutoff / Freeze Denial Tests (423 / 403)

| Phase | Scenario | Expected HTTP |
|---|---|---|
| 1 | POST /api/indents outside window, no override permission | 403 INDENT_WINDOW_CLOSED |
| 1 | GET /api/indents/window-status during closed window | 200 { open: false } |
| 4 | POST /api/stock while stock_frozen = true | 423 |
| 4 | PATCH /api/stock/:id while stock_frozen = true | 423 |
| 4 | PATCH /api/stock/unit while stock_frozen = true | 423 |
| 4 | POST /api/issuances while stock_frozen = true | 423 |
| 4 | POST /api/issuances/bulk-issue while stock_frozen = true | 423 |
| 4 | DELETE /api/issuances/:id while stock_frozen = true | 423 |
| 4 | POST /api/grn while stock_frozen = true | 423 |
| 4 | DELETE /api/grn/:id while stock_frozen = true | 423 |
| 4 | PATCH /api/transfers/:id/accept while stock_frozen = true | 423 |
| 4 | POST /api/returns/:id/approve while stock_frozen = true | 423 |
| 4 | POST /api/approved-delivery/commit while stock_frozen = true | 423 |
| 4 | POST /api/audits/:id/finalise while stock_frozen = true | 423 |
| 4 | POST /api/store-issuance/auto-issue while stock_frozen = true | 423 |
| 4 | GET /api/stock while stock_frozen = true | 200 (reads unaffected) |
| 4 | Admin with stock.override_freeze — POST /api/stock frozen + valid reason | 201 + audit entry |

### Approval Separation Tests (Phase 3)

| Scenario | Expected Result |
|---|---|
| Propose write-off: stock.remaining unchanged | Confirmed: query stock before and after propose |
| L1 approve: stock.remaining still unchanged | Confirmed: query stock before and after L1 |
| L2 approve: stock.remaining reduced by write-off qty | Confirmed: delta must equal sum of item qtys |
| L1 approver = proposer user ID | HTTP 400 rejected |
| L2 approver = L1 approver user ID | HTTP 400 rejected |
| L2 approver = proposer user ID | HTTP 400 rejected |
| Reject at L1: stock.remaining unchanged | Confirmed |
| Reject at L2: stock.remaining unchanged | Confirmed |
| Reason detail < 20 chars | HTTP 400 |
| reason_type not in enum list | HTTP 400 |
| PATCH /api/stock/:id with negative remaining delta | HTTP 400 (no exception for any reason value) |

### Migration Rollback Tests

| Phase | Migration | Rollback behaviour |
|---|---|---|
| 1 | 054 | Drops indent.override_cutoff permission row; cutoff check reverted in controller |
| 2 | 055 | Drops issuances.indent_type column (only safe before production data) |
| 3 | 056 | Drops stock_writeoffs and stock_writeoff_items (only before approved write-offs exist) |
| 3 | 057 | Drops write-off permission rows |
| 4 | 058 | Drops system_settings table (only before any freeze ever activated) |
| 5 | 059 | Removes seeded approval_rules rows |
| 5 | 060 | Drops split_po_flags table (only before any flags exist in production) |
| All | Post-data | If production data exists in any table, use forward corrective migration only; do NOT run down() |

### Successful Workflow Tests

| Phase | Scenario | Expected Result |
|---|---|---|
| 0 | All 5 crons triggered with populated roles table | Notification rows created with correct recipient_role_id from live DB |
| 0 | cronNotifyRecipients.resolveRoleId with missing key | Returns null; log line printed; no throw |
| 1 | Indent submitted inside open window | 201 Created |
| 1 | Override: Admin submits outside window | 201 Created + audit_logs entry with cutoff_override action |
| 2 | POST /api/indents with indent_type=banquet | 201 Created; issuance snapshot carries banquet |
| 2 | POST /api/issuances/bulk-issue for banquet indents | indent_type=banquet on each created issuance row |
| 3 | Full approve path: propose → L1 approve → L2 approve | stock.remaining reduced exactly once, at L2 step |
| 3 | Multi-item propose (3 items) then L2 approve | All 3 items deducted atomically |
| 4 | Freeze toggled on, all writes denied, freeze toggled off, write succeeds | Full cycle tested |
| 4 | Admin override during freeze with valid reason | 201 + override entry in audit_logs |
| 5 | Two POs to same supplier on same day exceeding threshold | Flag row created; Admin notified |
| 5 | Same data re-run (idempotency) | No second flag row created |
