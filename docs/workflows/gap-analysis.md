# Gap Analysis — Purchase / Store / Department (2026-07-10)

MD-level review of loopholes across procurement, store integrity, department
issuance, financial control, and access governance. Status legend:
**CONFIRMED** = verified against code, file:line evidence exists.
**POLICY** = business-process gap, not a code bug — needs SOP + maybe a
lightweight feature, not verified against code line-by-line.

## Money-bleed (fix first)

| # | Gap | Status | Evidence |
|---|-----|--------|----------|
| 1 | Double-issuance — `issuanceController.js` `create()` has no indent-status check | FIXED (verified 2026-07-11)| issuanceController.js:51 (bulkIssue has the guard at 415-418, plain create doesn't) |
| 2 | No PO-vs-GRN qty cap — unlimited over-receipt, multiple GRNs stack | FIXED (verified 2026-07-11)| grnController.js:83-185 |
| 3 | Race condition — stock read-then-write, no `FOR UPDATE` lock | FIXED (verified 2026-07-11)| transferController.js:136-145, same pattern in GRN/issuance |
| 4 | Transfer silent short-deduct, marks "Accepted" even if source stock insufficient | FIXED (verified 2026-07-11)| transferController.js:133-160 |
| 5 | Zero/negative qty transfer accepted | FIXED (verified 2026-07-11)| transferController.js:74-75 |
| 6 | Duplicate invoice — same `invoice_no` can be GRN'd twice | FIXED (verified 2026-07-11)| migration 013_create_grns.js:9 (nullable, no unique constraint) |
| 7 | No invoice-amount tolerance vs PO total (3-way match accepts any variance) | FIXED (verified 2026-07-11)| grnController.js create(), no comparison logic found |

## Food safety / compliance

| # | Gap | Status | Evidence |
|---|-----|--------|----------|
| 8 | Expired batch still issuable — FEFO orders by expiry, doesn't exclude expired | FIXED (verified 2026-07-11)| issuanceController.js:94, 436 |
| 9 | No cold-storage temperature log (separate from qty tracking) | FIXED (verified 2026-07-11) | `temperature_logs` table + `controllers/temperatureController.js` |
| 10 | No damaged/rejected-on-arrival qty tracking separate from accepted | FIXED (verified 2026-07-11) | grnController.js:172 `qty_rejected` column |

## Governance / audit

| # | Gap | Status | Evidence |
|---|-----|--------|----------|
| 11 | No durable audit_log table — PO/GRN edit-delete only fire Kafka event | FIXED (verified 2026-07-11)| purchaseOrderController.js:152-243, grnController.js:188-214 |
| 12 | GRN delete reverts PO status, cascade-deletes stock, no trace GRN existed | FIXED (verified 2026-07-11)| grnController.js:196-207 |
| 13 | No return/reversal flow — issuance is permanent, no path back to store | FIXED (verified 2026-07-11)| grep across controllers/routes found nothing |
| 14 | No budget/cost-center cap per department per period | FIXED (verified 2026-07-11)| no budget check in issuance create/bulkIssue |
| 15 | Role review cadence — perm growth unchecked over time | POLICY | roles.md exists, no review-cycle process |
| 16 | Ex-employee access revoke — no verified same-day disable process | POLICY | |
| 17 | Approval delegation — PO stuck in "Pending" if approver on leave, no auto-escalate | FIXED (verified 2026-07-11) | `cron/stalePoEscalation.js` now mirrors staleIndentEscalation.js for POs |

## Store integrity

| # | Gap | Status |
|---|-----|--------|
| 18 | No cycle-count / physical reconciliation session — only ad hoc single-item adjustments | FIXED (verified 2026-07-11)|
| 19 | Store access log (who entered store room) | POLICY |
| 20 | Dual custody on high-value store (liquor, meat freezer) | POLICY |
| 21 | FIFO/FEFO override not logged with reason | POLICY |
| 22 | Sample/tasting/staff-meal consumption not separated from normal issuance (skews anomaly baseline) | POLICY |

## Procurement governance

| # | Gap | Status |
|---|-----|--------|
| 23 | Vendor rating table exists, unused in PO approval flow | FIXED (verified 2026-07-11)|
| 24 | No requisition→PO linkage check (PO can be raised without approved requisition) | POLICY |
| 25 | No multi-quote comparison requirement above threshold | POLICY |
| 26 | Emergency PO bypass has no mandatory post-facto justification/audit flag | POLICY |
| 27 | No annual rate-contract vs spot-buy distinction | POLICY |
| 28 | No advance-payment vs delivered vs balance-due tracking | POLICY |
| 29 | No GST/tax invoice validation | POLICY |
| 30 | No split-PO detection (same vendor, same day, multiple small POs dodging approval threshold) | POLICY |
| 31 | No vendor bank-detail-change alert | POLICY |

## Department discipline

| # | Gap | Status |
|---|-----|--------|
| 32 | No indent cutoff time — requests can land any time, no planning window | POLICY |
| 33 | Issuance not required to link a production/banquet event — "ghost draws" possible | FIXED (verified 2026-07-11)|
| 34 | Banquet/event stock not ring-fenced — blends into daily dept average, masks anomaly detection | POLICY |
| 35 | No staff-meal allowance cap | POLICY |
| 36 | No over-issuance-vs-indent-qty cap (indent asks 10kg, issuance gives 15kg unchecked) | POLICY |
| 37 | Segregation of duty broken — confirmed live in `backend/config/permissions.js` | FIXED 2026-07-11 (indent approval) — per hotel MD decision: only `admin` approves indents now. `indents.approve` stripped from `chef`, `store_manager`, and `manager` (config/permissions.js + live DB role_permissions rows 171/216/138 removed, verified via query — only `admin` role holds `indents.approve`). PO/transfer approve still sit with `manager` — untouched, not asked about. |

## Financial control

| # | Gap | Status |
|---|-----|--------|
| 38 | No month-end stock freeze during physical count | POLICY |
| 39 | No negative-stock-value alert (qty positive, valuation zero/negative) | POLICY |
| 40 | No 2-level sign-off for write-offs (store manager + finance) | POLICY |
| 41 | No daily/weekly food-cost % vs budget report surfaced to MD | POLICY |

## Notification (already fixed this session)

| # | Item | Status |
|---|------|--------|
| 42 | Anomaly WhatsApp alert — was admin-only, now sends to admin + store manager | DONE — `cron/anomalyDetector.js`, env `STORE_MANAGER_WHATSAPP_NUMBER` |

## Read but confirmed NOT broken (don't touch without reason)

| Item | Why it's fine |
|------|---------------|
| GRN stock increment on receipt | Works, grnController.js:148-162 |
| PO approval workflow for non-admin | Works, purchaseOrderController.js:115-139 |
| Negative-stock guard on issuance `create()` | Works, issuanceController.js:110-113 |
| bulkIssue indent-status check | Works, issuanceController.js:415-418 |
| Permission middleware on issuance routes | Works, routes/issuances.js:7-11 |

---
See `docs/architecture/roadmap.md` Phase 8-11 for fix order.
