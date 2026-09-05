# Express + Knex

**Express version:** ^4.19.2 | **Knex version:** ^3.1.0
**Location:** `backend/` — 30 controllers, 29 route files, entry point `server.js`
**Security middleware stack:** helmet, cors, express-rate-limit (login 429 confirmed hit
during this session's repeated test runs — real control, not simulated), cookie-parser,
compression
**Validation:** zod schemas in `middleware/validate.js`
**Auth:** jsonwebtoken + bcryptjs, permission gate via `middleware/authorize.js:requirePermission()`

**What it does:** REST API + query builder/migrations for every screen — stock, indents,
issuances, recipes, production, purchase orders, GRN, suppliers, users/roles, dashboard
analytics, handoffs, notifications, anomaly alerts.

**Controllers touched this session:**
| Controller | Change |
|---|---|
| `issuanceController.js` | Fixed FEFO batch ordering in both `create()` (single) and `bulkIssue()` paths — was `ORDER BY date, id`, now `ORDER BY expiry_date ASC NULLS LAST, date, id`. Added real-time anomaly check inside `create()` — queries 7-day dept+item baseline via `issuance_items`/`issuances` join, reuses `cron/anomalyDetector.js`'s `getThreshold()` (newly exported), inserts to `anomaly_alerts` + publishes `issuance.anomaly` on trip, returns `anomalies: []` in the response — never blocks. |
| `handoffController.js` | No code change — the bug was missing permissions, not controller logic. Verified `create()`'s activity-aggregation (issuances/GRNs/indents for the day) feeds `generateShiftHandoffSummary()` correctly once reachable. |
| `stockController.js` | Not modified this round — its `create()` (`item_code` reuse-by-name logic, `publish("stock-events", ...)` on every insert) is *why* every bulk load this session went through the real API instead of a raw `db("stock").insert()` script. |
| `recipeController.js` | Not modified — confirmed `createRecipe()` deliberately has no kafka publish (recipes are master data, not an inventory-movement event — correct by design, not a gap). |

**New migrations this session:**
- `048_add_handoffs_permissions.js` — seeds `handoffs.view`/`handoffs.create`, grants to
  Admin + Store Manager.
- `049_create_recipe_cost_snapshots.js` — new table for #16. First attempt failed
  (`table.real()` isn't a valid knex column builder method — got literal `type "undefined"
  does not exist` from Postgres), fixed to `table.specificType("total_cost", "real")`.

**What's been done overall:** 2 controller-logic fixes (FEFO ordering, anomaly hook), 2 new
migrations, 1 confirmed-correct-by-design check (recipes have no kafka publish, intentional).
