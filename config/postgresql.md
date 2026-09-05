# PostgreSQL

**Version driver:** `pg` ^8.12.0, query builder `knex` ^3.1.0
**Connection:** `DATABASE_URL` in `.env` → `postgresql://postgres:password@localhost:5432/kapila`
**Client setup:** `backend/db/index.js` — single shared knex instance, no manual pool config
(uses knex/pg defaults).
**Migrations:** `backend/db/migrations/` — 50 numbered files (prefixes 001–049, with two
sharing the `021` prefix) + 2 timestamp-named = 52 total, run via `npx knex migrate:latest`
(also aliased `npm run migrate`).
**Scale:** 44 tables in `public` schema as of this session.

**What it does:** Single source of truth — stock, indents, issuances, recipes, production
plans, users/roles/permissions, kafka_event_log mirror, notifications, anomaly_alerts.

**Key tables touched this session:**
| Table | Role |
|---|---|
| `stock` | Batch-level inventory rows — `item_code`, `qty`/`remaining`, `expiry_date`, `batch_no`, `category`, `price` |
| `indents` / `indent_items` | Department requests, `status`: pending/partial/issued |
| `issuances` / `issuance_items` | Actual stock movement out to a department |
| `recipes` / `recipe_items` | Ingredient lists per dish, joined to `stock.name` for costing |
| `recipe_cost_snapshots` | **New (migration 049)** — `recipe_id`, `total_cost`, `computed_at` |
| `permissions` / `role_permissions` / `roles` | RBAC — `permissions.key` (not `name`!), `roles.name` is human-readable ("Store Manager", not `store_manager`) |
| `kafka_event_log` | Read-side mirror of every kafka message — proof-of-broadcast query target all session |
| `anomaly_alerts` | Both nightly-cron and new real-time flags land here |
| `shift_handoffs` | AI-summarized shift notes (was dead — see permissions fix below) |

**What's been done:**
- Replaced entire 357-item stock inventory with 351 real items (real categories, units,
  prices) via real API calls (not raw insert) so every side effect fired.
- Seeded 15 days × 355 items of stock history (5325 rows) for consumption-trend features.
- New table: `recipe_cost_snapshots` (migration `049_create_recipe_cost_snapshots.js`) — had to
  fix `table.real()` (not a valid knex column builder) to `table.specificType("total_cost",
  "real")` after first migration attempt failed with `type "undefined" does not exist`.
- New permission rows: `handoffs.view` / `handoffs.create` (migration
  `048_add_handoffs_permissions.js`) — previously referenced by
  `middleware/authorize.js:requirePermission()` and routed in `routes/handoffRoutes.js`, but
  never seeded into `permissions` — the shift-handoff AI feature was dead for every role
  including Admin. Granted to Admin (role id 1) + Store Manager (role id 5).
- Fixed FEFO ordering bug in stock deduction (`controllers/issuanceController.js`, both
  `create()` and `bulkIssue()`) — was `ORDER BY date ASC, id ASC` (FIFO-by-received-date only),
  ignored `expiry_date` column that already existed on every row but was never read. Now
  `ORDER BY expiry_date ASC NULLS LAST, date ASC, id ASC`.
- Caught (not fixed, false alarm on inspection): migration `036_add_recipes_create_permissions.js`
  queries `permissions.name` (real column is `key`) and matches `roles.name === "store_manager"`
  (real value is `"Store Manager"`) — silently no-ops every run. Turned out harmless: Store
  Manager already has `recipes.create`/`edit` granted through a different path.

**Verification pattern used all session:** never trust app-level success alone — always follow
with a direct `psql` query (row counts, `kafka_event_log` timestamp windows, permission joins)
before calling anything done.
