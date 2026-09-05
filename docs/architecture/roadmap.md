# Roadmap — Kapila Inventory

## Phase 1 — MVP (current)
- [x] Single-file React app with all 6 modules
- [x] localStorage persistence
- [x] AI scan for indent forms (Claude vision)
- [x] Stock depletion tracking with progress bars
- [x] Dashboard KPIs

## Phase 2 — Modular Frontend
- [ ] Split into Vite project with proper file structure
- [ ] Extract `COLORS` to `styles/colors.js`
- [ ] Extract reusable components (Btn, Card, Input, Select, Table, Badge)
- [ ] Extract screens to `screens/<Module>/index.jsx`
- [ ] Move AI scan to backend proxy (`POST /api/scan/indent`)
- [ ] Fix missing `x-api-key` header bug in scan

## Phase 3 — Backend API
- [ ] Express server with routes for all 6 modules
- [ ] SQLite via `better-sqlite3`
- [ ] Input validation with Zod
- [ ] Replace localStorage with API calls (`useApi` hook)
- [ ] Claude service wrapper with retry logic

## Phase 4 — Auth & Multi-user
- [ ] Role definitions: Admin, Storekeeper, Department Head
- [ ] JWT auth with login screen
- [ ] Department Heads can only see their own indent/production screens
- [ ] Storekeeper sees issuance + full stock
- [ ] Admin sees everything + dashboard

## Phase 5 — Reports & Analytics
- [ ] Daily summary report (PDF export)
- [ ] Weekly waste report (leftover % per dept)
- [ ] Stock consumption trend chart
- [ ] Low-stock email/SMS alert

## Phase 6 — Advanced Features
- [ ] Supplier master (name, contact, items supplied)
- [ ] Purchase orders linked to stock entries
- [ ] Recipe module (ingredients per dish)
- [ ] Auto material calculation from production plan
- [ ] Mobile-responsive / PWA for storekeeper on phone

## Phase 7 — Production Deployment
- [ ] PostgreSQL on VPS
- [ ] nginx reverse proxy
- [ ] PM2 process manager
- [ ] SSL via Let's Encrypt
- [ ] Daily DB backup to S3 or local

---

# Gap-closure phases (2026-07-10)

Full clause list + evidence: `docs/workflows/gap-analysis.md`.
Full department flow: `docs/workflows/inventory-flow.md`.

## Phase 8 — Money-bleed fixes — DONE (7/7), verified 2026-07-11
- [x] Indent-status check in `issuanceController.js` `create()` (gap #1) —
      line 98-100, blocks issuance unless indent is `approved`/`partial`
- [x] PO-vs-GRN qty cap in `grnController.js` (gap #2) — line 156, throws if
      cumulative received exceeds PO ordered qty
- [x] `FOR UPDATE` row lock on stock/batch read-then-deduct (gap #3) —
      issuanceController.js:148, grnController.js:121, transferController.js:148
- [x] Transfer `accept()` fails on shortfall, no silent short-deduct (gap #4) —
      transferController.js:152-154, throws before any deduction applied
- [x] qty > 0 validation on transfer `create()` (gap #5) — transferController.js:79
- [x] Dupe invoice_no check per supplier (gap #6) — grnController.js:93-99
- [x] Invoice-amount vs PO-amount 10% tolerance check (gap #7) —
      grnController.js:161

## Phase 9 — Food safety — DONE (3/3), verified 2026-07-11
- [x] Expired batches excluded from issuance batch selection (gap #8) —
      issuanceController.js:143 (`expiry_date >= date` filter, not just FEFO-order)
- [x] Cold-storage temperature log (gap #9) — `temperature_logs` table +
      `controllers/temperatureController.js`
- [x] Damaged/rejected-on-arrival qty field (gap #10) — `qty_rejected` column,
      grnController.js:172

## Phase 10 — Governance / audit trail — DONE (5/5), verified 2026-07-11
- [x] Audit trail (gap #11, #12) — `services/auditService.js` +
      `017_create_auth_rbac_audit.js`, called from issuance/GRN/PO create
- [x] Return/reversal flow (gap #13) — `controllers/returnController.js` +
      `20260710000001_create_returns.js`
- [x] Budget control on issuance (gap #14) — CHANGED 2026-07-13 per MD
      decision: dept-wide `monthly_budget_cap` hard-block removed (was
      rejecting legit large orders outright). Replaced by per-item
      trend-based flag — issuanceController.js:234-290, compares issued
      qty vs 7-day avg per item+dept, non-blocking, writes to
      `anomaly_alerts` + publishes `issuance.anomaly` Kafka event.
- [x] Auto-escalation cron for stuck PO approvals (gap #17) —
      `cron/stalePoEscalation.js`
- [x] Vendor-rating wired into PO flow (gap #23) —
      purchaseOrderController.js:70 (`supplier_rating` joined into PO list)

## Phase 11 — Store integrity + policy items
- [x] Cycle-count / physical-reconciliation (gap #18) — `stockController.js`
      reconciliation endpoint + `reconciliations` module in approval matrix
      (`032_create_approval_matrix.js`, amount-tiered sign-off)
- [x] Issuance requires indent_id or production_plan_id linkage — kills ghost
      draws (gap #33) — issuanceController.js:55-57
- [ ] Segregation-of-duty audit on `docs/security/roles.md` — confirm no
      single role holds raise+approve+issue together (gap #37) — not verified,
      needs a manual roles.md read-through, not a code fix
- [ ] Remaining POLICY-tagged items in gap-analysis.md — SOP-level, revisit
      with hotel MD/finance before building features (split-PO detection,
      multi-quote rule, dual custody, month-end freeze, write-off sign-off,
      food-cost % report, etc.)

**Note (2026-07-11):** Phase 8-10 and most of Phase 11 were already implemented
in code by the time this was checked — gap-analysis.md (dated 2026-07-10) and
this roadmap were stale, describing a code state that had since been fixed.
Only gap #37 (manual roles.md audit) and pure-POLICY items remain open.
