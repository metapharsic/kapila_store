# Kapila IMS — Gap Fix Progress Report

**Owner:** Technology Team
**Started:** 2026-07-27 (plan approved)
**Report Updated:** 2026-07-30
**Reference:** `docs/gap-fix-implementation-plan.md` v5.0

---

## Overall Progress

| Phase | Gap | Status | Completed |
|---|---|---|---|
| **0** | Role ID bug in 5 cron files | ✅ COMPLETED | 2026-07-30 |
| **1** | Indent Cutoff Time | ⏳ Not Started — blocked on D1, D7 | — |
| **2** | Banquet / Event Ring-Fencing | ⏳ Not Started — blocked on D1, D4 | — |
| **3** | Two-Level Write-Off Sign-Off | ⏳ Not Started — blocked on D1-D7 | — |
| **4** | Month-End Stock Freeze | ⏳ Not Started — blocked on D1-D4 | — |
| **5** | Split-PO Detection | ⏳ Not Started — blocked: approval_rules has 0 rows | — |
| **6** | Staff Meal Allowance Cap | 🔁 Deferred — no price data | — |

---

## Phase 0 — Role ID Bug Fix ✅

### What Was Fixed
Five cron jobs were silently failing because they referenced role ID 5 (`STORE_MANAGER`), which never existed in the live database (only roles 1–4: admin, manager, chef, employee).

Precise per-cron impact before fix:
- `kafkaDigest.js` — daily digest never delivered to anyone
- `reorderSuggestion.js` — reorder alerts lost
- `predictiveStockout.js` — stockout alerts lost
- `chefStoreCrossCheck.js` — mismatch alerts sent to hard-coded IDs `[1, 5, 3]`; role 5 silently failed
- `recipeCostDrift.js` — Admin (role 1) received cost drift ✓; Manager (role 5) never received it ✗

### Files Created / Modified

| File | Change |
|---|---|
| `backend/services/cronNotifyRecipients.js` | **CREATED** — shared helper |
| `backend/cron/kafkaDigest.js` | Removed `STORE_MANAGER_ROLE_ID = 5`; uses `resolveRoleId(manager)` |
| `backend/cron/reorderSuggestion.js` | Removed `STORE_MANAGER_ROLE_ID = 5`; role resolved ONCE before send |
| `backend/cron/predictiveStockout.js` | Removed `STORE_MANAGER_ROLE_ID = 5`; role resolved ONCE before per-alert loop |
| `backend/cron/chefStoreCrossCheck.js` | Removed hard-coded `[1, 5, 3]`; uses `resolveRoleIds([admin, manager, chef])` |
| `backend/cron/recipeCostDrift.js` | Removed `ADMIN_ROLE_ID = 1` and `STORE_MANAGER_ROLE_ID = 5`; uses `resolveRoleIds([admin, manager])` |
| `backend/tests/cronNotifyRecipients.test.js` | **CREATED** — 9 unit tests |
| `backend/package.json` | Added jest, supertest devDependencies; added test script |

### Test Results

```
PASS tests/cronNotifyRecipients.test.js

  resolveRoleId
    ✓ returns the DB row id when the role key exists
    ✓ returns null (does not throw) when role key is missing
    ✓ logs a clear WARNING when role key is missing
    ✓ returned ID comes from the DB row — not a hard-coded constant

  resolveRoleIds
    ✓ returns IDs for resolved keys and filters out nulls for missing keys
    ✓ returns empty array when all keys are missing
    ✓ returns all IDs when all keys resolve

  RECIPIENT_ROLE_KEYS
    ✓ exposes manager, admin, and chef string keys
    ✓ does not contain any hard-coded numeric role IDs

Tests: 9 passed, 9 total — Time: 0.157 s
```

### Phase 0 Acceptance Criteria — All Passed

- [x] `backend/services/cronNotifyRecipients.js` created and used by all 5 cron files
- [x] No cron file contains any hard-coded numeric role ID (verified by grep — zero matches)
- [x] Role IDs resolved ONCE per cron run, before notification loops (not inside per-item loops)
- [x] If a role key is not found, clear log printed; cron continues without throwing
- [x] `chefStoreCrossCheck.js` sends to admin, manager, chef — dynamically resolved
- [x] `recipeCostDrift.js` sends to admin and manager — both IDs removed and replaced
- [x] 9 unit tests passing; no test relies on hard-coded expected IDs

---

## Pending Management Decisions (blocks Phases 1–5)

### Phase 1 — Indent Cutoff Time
| # | Decision |
|---|---|
| D1 | What time does indent submission close? |
| D7 | Should manager receive a notification when the window opens? |

### Phase 2 — Banquet / Event Ring-Fencing
| # | Decision |
|---|---|
| D1 | Which indent types beyond routine and adhoc? |
| D4 | Is staff_meal an event type, normal operational, or its own cost centre? |

### Phase 3 — Two-Level Write-Off Sign-Off
| # | Decision |
|---|---|
| D1 | Threshold requiring two approvals (quantity or value)? |
| D2 | Level 1 approver role? |
| D6 | Confirm final reason types list? |
| D7 | Write-off scope: department-linked or store-wide? |

### Phase 5 — Split-PO Detection
| # | Decision |
|---|---|
| D1 | PO approval threshold amounts? |
| D4 | Legitimate multi-PO exemptions? |
| D7 | Creator-matching: same created_by user required? |

**Prerequisite:** `approval_rules` table currently has 0 rows — must be seeded (migration 059) before Phase 5.

---

## Next Steps

1. Get management answers for Phase 1 D1 and D7 — minimum needed to unlock Phase 1.
2. Once D1/D7 confirmed, proceed with **Phase 1 — Indent Cutoff Time**.
3. Continue sequentially — each phase verified before next begins.

---

*Run tests: `cd backend && npx jest tests/cronNotifyRecipients.test.js --forceExit`*
