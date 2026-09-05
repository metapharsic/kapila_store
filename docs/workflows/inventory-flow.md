# Inventory Flow — Department-wise Workflow

Reference doc for how stock moves through Kapila Hotel system. Use before
touching purchase/store/issuance code — know the flow before editing it.

## 1. Purchase Department

```
Requisition (implicit) → PO create → PO approval (if non-admin) → GRN receive
  → stock incremented → supplier invoice → 3-way match → payment
```

- **PO create**: `purchaseOrderController.js`. Non-admin creator → forced
  `status: "Pending"` → routed to `createApprovalRequest`
  (purchaseOrderController.js:115-139).
- **GRN receive**: `grnController.js`. Stock incremented on receipt —
  `trx("stock").insert({qty: it.qty_accepted, ...})` (grnController.js:148-162).
  Sets PO `status="Received"` on ANY GRN, even partial (grnController.js:167-174).
- **GRN delete**: reverts PO status to "Sent", cascade-deletes stock rows via FK
  (grnController.js:196-207) — PO becomes editable again, no trace GRN existed.
- **Supplier invoice**: 3-way match exists structurally but **no amount-variance
  tolerance check** — any invoice total accepted regardless of PO total.

**Known holes (see gap-analysis.md for full list + fixes):**
- No PO-vs-GRN qty cap — can over-receive beyond ordered qty, multiple GRNs stack.
- No duplicate-invoice guard — same `invoice_no` can be received twice
  (`goods_receipt_notes.invoice_no` just `nullable()`, no unique constraint).
- No invoice-amount tolerance vs PO total.

## 2. Store / Stock

```
Stock (from GRN) → batches (cost, expiry, remaining) → FEFO drain on issuance
  → stock_ledger_entries (double-entry in/out/running_balance)
```

- Deduction order: `orderByRaw("expiry_date ASC NULLS LAST")`
  (issuanceController.js:94, 436) — oldest-expiry batch drained first.
- Negative-stock guard **exists**: `create()` throws `Insufficient stock` before
  write if `totalAvailable < toDeduct` (issuanceController.js:110-113).
- Manual adjustment: `stock_adjustments` table + `stockController.js` —
  covers "Audit Correction", "Kitchen Theft" etc, single-item ad hoc only.

**Known holes:**
- FEFO orders by expiry but does NOT exclude `expiry_date < today` — expired
  batch with `remaining > 0` still gets issued, just last in line.
- No cycle-count / physical-reconciliation session feature — only ad hoc
  single-item adjustments, no "count sheet vs system" workflow.
- No row lock (`FOR UPDATE`) on batch read-then-deduct — race condition risk
  under concurrent issuance/transfer/GRN hitting same batch.

## 3. Department / Issuance

```
Indent raised (dept) → indent approval → scan/OCR (optional, paper form)
  → issuance create (single) OR bulkIssue (from approved indent)
  → stock/batch deduction → kafka event → anomaly detector (nightly, 7-day baseline)
```

- `bulkIssue()` checks `indents.status === "approved"` before issuing
  (issuanceController.js:415-418). **Correct.**
- Plain `POST /api/issuances` → `create()` (issuanceController.js:51) has
  **no status check at all** — already-issued/partial indent can be issued
  again through this path → double stock deduction.
- Permission layer: `requirePermission("issuances.create")` /
  `"issuances.delete"` middleware (routes/issuances.js:7-11) +
  `assertDepartmentAccess` scoping. Issuer/approver separation exists at
  permission layer.
- Anomaly detection: `cron/anomalyDetector.js`, runs 2AM daily (node-cron,
  server.js:200-248). Compares yesterday's issued-qty-per-plate vs 7-day
  rolling baseline, item-specific threshold (20-60% spike). WhatsApp alert
  to `ADMIN_WHATSAPP_NUMBER` + `STORE_MANAGER_WHATSAPP_NUMBER` on breach.

**Known holes:**
- `create()` missing indent-status guard (see above) — **highest priority fix**.
- No budget/cost-center cap per department per period.
- No return/reversal flow — once issued, permanently deducted, no path back
  to store for over-issue/wrong-item correction.
- No linkage requirement between issuance and a production/banquet event —
  "ghost draws" possible (stock issued with no linked covers/plates count),
  which also dilutes anomaly-detector baseline accuracy.

## 4. Transfer (inter-department / inter-store)

```
Transfer create (source, dest, items) → accept (dest confirms) → stock deducted from source
```

- `transferController.js` `create()` (line 74-75) only validates
  `items.length` — **zero/negative qty transfers accepted**.
- `accept()` (lines 133-160) deducts stock but does not verify `toDeduct`
  reaches 0 — if source batch `remaining` insufficient, loop silently
  under-deducts, transfer still marked "Accepted" with no shortfall error.
- No row lock on the read-then-deduct — same race-condition class as store
  section above.

## 5. Audit Trail

- PO/GRN edit-delete only `publish()` a Kafka event
  (purchaseOrderController.js:152-243, grnController.js:188-214) — **no
  durable `audit_log`/`change_history` table**. If Kafka event lost/unread,
  no queryable record of who changed/deleted what.

---

See `docs/workflows/gap-analysis.md` for the full clause list (44 items,
technical + business-process) and `docs/architecture/roadmap.md` Phase 8+
for the fix plan.
