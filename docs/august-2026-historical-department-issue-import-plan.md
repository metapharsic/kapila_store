# August 2026 Historical Department Issue Import Plan

**Status:** Draft for review - no data changes authorized  
**Scope:** Record the department issue documents dated 8 August 2026 and 9 August 2026 as historical indents and issuances.  
**Out of scope:** No `department_stock` table, no department balance columns, no transfer-balance feature, and no modification to `indent_templates` for balances.

## 1. Objective

Convert the two image-only source documents below into complete, auditable historical records:

- `documentation/8th Aug Transfers.pdf` - 16 pages
- `documentation/9th Aug Transfers.pdf` - 14 pages

For every verified document line, the final database state must show:

```text
Department request (indents + indent_items)
  -> approved historical request
  -> department issue (issuances + issuance_items)
  -> central stock batch deduction (stock.remaining only)
  -> audit and source-document evidence
```

The import represents historical goods issued from the central Store to operating departments. It does **not** create stock owned by a department.

## 2. Confirmed Data Model

| Table | Role in this import | Quantity/balance role |
| --- | --- | --- |
| `departments` | Canonical list of 9 operating departments | None |
| `indent_templates` | Approved department-to-item mapping with item codes and default units | None |
| `indents` | Historical department request header | Request status only |
| `indent_items` | Requested item, quantity, unit, item code | Requested quantity and issued quantity |
| `issuances` | Historical issue header linked to an indent | None |
| `issuance_items` | Quantity actually issued to a department | Issued quantity |
| `stock` | Central-store batches | `remaining` is the only central balance to deduct |
| `stock_adjustments` | Per-batch transfer/issue audit entries | No running balance |
| `audit_logs` | User/action/source audit evidence | No running balance |

### Non-negotiable rules

1. Never create a department stock balance.
2. Never reduce `stock.qty`; it is the original received quantity for the batch.
3. Deduct only `stock.remaining`.
4. Do not use `stock_transfers` / `stock_transfer_items` for these papers unless management later confirms that departments hold independent stock balances.
5. Do not run `backend/scripts/execute_transfers.js`; it changes `stock.qty`, does not create proper history, and is not safe for this import.
6. Do not insert a line until its department, item code, quantity, and unit are verified.

## 3. Import Safety Design

### 3.1 Source-document idempotency

The current transaction tables have no source PDF/page fields. Before importing, add one small audit-only migration with these tables:

```text
historical_import_runs
  id, import_key (unique), source_file, document_date,
  source_sha256, status (draft|approved|applied|rolled_back|failed),
  extracted_by, approved_by, applied_by,
  created_at, approved_at, applied_at, notes

historical_import_lines
  id, import_run_id, source_page, source_line,
  raw_parent_department, canonical_department_id,
  raw_section_name,
  raw_item_name, canonical_item_code, canonical_item_name,
  raw_qty, canonical_qty, raw_unit, canonical_unit,
  resolution_status (pending|verified|exception|skipped|applied),
  exception_reason, indent_id, indent_item_id,
  issuance_id, issuance_item_id, source_fingerprint (unique),
  created_at, updated_at
```

`source_fingerprint` must be deterministic from source hash, page, line, normalized parent department, section, raw item, quantity, and unit. A unique constraint prevents the same handwritten line from being imported twice.

This is import/audit metadata only. It does not create any department-level stock balance.

### 3.2 Historical import identity

Create exactly two import runs:

| Import key | Source | Accounting date |
| --- | --- | --- |
| `HIST-ISSUE-20260808` | `8th Aug Transfers.pdf` | `2026-08-08` |
| `HIST-ISSUE-20260809` | `9th Aug Transfers.pdf` | `2026-08-09` |

Store each PDF's SHA-256 hash. If the file changes, stop and create a new review run rather than overwriting the old result.

## 4. Phase A - Extract Documents Without Writing Inventory

### 4.1 Render and OCR

1. Render every PDF page to an image at readable resolution.
2. OCR every page and retain the page image and extracted text as working evidence.
3. Create one staging row for every handwritten item line.
4. Never infer a quantity, unit, or **parent department** that cannot be read.
5. Treat section headings as context under the last identified parent department; never treat a section heading as a new department.

### 4.2 Required staging fields

| Field | Requirement |
| --- | --- |
| Source file and SHA-256 | Required |
| Page number and handwritten line number | Required |
| Document date | Exactly `2026-08-08` or `2026-08-09` |
| Raw parent department label | Verbatim OCR/transcription of the department heading |
| Raw section heading | Verbatim OCR/transcription; nullable when the page has no section |
| Raw item name | Verbatim OCR/transcription |
| Raw quantity | Numeric text plus confidence/review flag |
| Raw unit | Verbatim if written; otherwise `missing` and exception |
| Image/PDF evidence reference | Required |
| OCR confidence / reviewer note | Required for ambiguous writing |

### 4.3 Extraction acceptance gate

No database stock-changing action may begin until:

- all 30 PDF pages are accounted for;
- all staging lines have a page and source-line reference;
- every unreadable entry is marked `exception`, not guessed;
- a human reviewer has approved the staging report.

## 5. Phase B - Map Parent Departments and Preserve Sections

The application accepts only these canonical department names:

```text
TIFFINS
STAFF
SI-MEALS
NORTH INDIAN
CHAT & SOFTY
CHINESE & DOSA
MOCKTAILS & CONTINENTAL
RESTAURANT
ROOM SERVICE
```

### 5.1 Parent department rule

The database stores issues only against one of the nine canonical departments. A PDF can contain several operational **sections** beneath that parent department. A section is not a department, must not be rejected as an unknown department, and must not create its own indent or issuance.

**Required extraction behaviour:**

1. Identify the parent department at the start of each paper/form.
2. Carry that parent department forward to all later item lines until another parent department heading begins.
3. Capture intervening headings as `raw_section_name` only.
4. Resolve each item against the parent department's `indent_templates` rows, regardless of section name.
5. Save the section name in import evidence/audit metadata for traceability, but write the canonical parent department to `indents.dept` and `issuances.dept`.

### 5.2 Known hierarchy from the source sheets

| Parent department on paper | Canonical database department | Examples of sections beneath it | Import treatment |
| --- | --- | --- | --- |
| `SOUTH INDIAN-- MEALS` | `SI-MEALS` | Vegetables, Disposables, HK Cleaning | Import every verified item to `SI-MEALS`; preserve section only as source context. |
| `SOUTH INDIAN-- TIFFINES` | `TIFFINS` | Dosa Batter, Idly, Vegetables, Tea & Coffee Shop | Import every verified item to `TIFFINS`; preserve section only as source context. |
| `CHAT` / `CHAT, JP Disposal, Softy.` | `CHAT & SOFTY` | Disposal, Softy, or other internal headings | Import to `CHAT & SOFTY`; do not create a department per heading. |
| `DOSA` when written under the Tiffins paper | `TIFFINS` | Dosa Batter or Dosa section | Import to `TIFFINS`, not `CHINESE & DOSA`. |
| `DOSA` when it is the parent heading on a Chinese/Dosa paper | `CHINESE & DOSA` | Parent context must be confirmed from the page/form | Import to `CHINESE & DOSA`. |
| `TEA`, `JUICE`, `VEGETABLES`, `HK CLEANING`, `DISPOSABLES` | The parent department shown on that paper | Section labels, not standalone departments | Do not flag as unknown; attach to the parent department. |

The extraction report must show both fields for every line: `parent department -> section -> item`. This makes the assignment reviewable without incorrectly creating departments.

### 5.3 Parent-department mapping decisions required before import

The handwritten parent labels may not exactly equal the database values. Confirm each parent mapping in the staging report before any issue is created.

| PDF label example | Proposed canonical department | Status |
| --- | --- | --- |
| `SOUTH INDIAN-- MEALS` | `SI-MEALS` | Confirm |
| `SOUTH INDIAN-- TIFFINES` | `TIFFINS` | Confirm |
| `CHAT` | `CHAT & SOFTY` | Confirm |
| `DOSA` as parent on the Chinese/Dosa form | `CHINESE & DOSA` | Confirm from PDF/form context |
| `RESTAURANT` | `RESTAURANT` | Exact |

`TEA`, `JUICE`, `VEGETABLES`, `HK CLEANING`, `DISPOSABLES`, `DOSA BATTER`, and `IDLY` are section labels when they occur beneath a known parent department. They must be imported under that parent department and must not be treated as unmatched departments.

## 6. Phase C - Resolve Every Item by Code and Unit

### 6.1 Matching hierarchy

For each verified staging line, resolve the item in this strict order:

1. Exact `indent_templates` row for the canonical department with matching `item_code` or exact normalized item name.
2. Confirm exact stock record for that resolved `item_code`.
3. Confirm the staging unit is either:
   - equal to `indent_templates.default_unit` and `stock.unit`; or
   - convertible through the existing approved unit conversion rules.
4. Record the resolved canonical code, name, and unit in `historical_import_lines`.

### 6.2 Exceptions that must stop a line

Mark the line `exception`; do not import it, if any of the following occurs:

- no canonical **parent** department mapping;
- no matching department template item;
- more than one possible item code;
- no central stock record for the resolved item code;
- unit mismatch without a safe approved conversion;
- missing, zero, negative, or unreadable quantity;
- insufficient central `stock.remaining`;
- duplicate source fingerprint;
- item is not allowed for that department and no management exception is supplied.

### 6.3 Unit policy

- Preserve the source unit in the staging/audit row.
- Store the canonical issue unit in `indent_items.unit` and `issuance_items.unit`.
- Convert the quantity only where the application conversion function supports the conversion reliably.
- Packaging units (`pkt`, `tin`, `bottle`, `box`, `bulk`) require an explicit item-specific pack conversion; never assume one packet equals one kilogram.
- If the PDF has no unit but the template has a default unit, require human confirmation before using the default.

## 7. Phase D - Pre-Import Reconciliation and Approval

Generate a dry-run report grouped by date and department. It must show:

| Field | Purpose |
| --- | --- |
| PDF / page / source line | Trace back to paper evidence |
| Canonical parent department | Confirms the database department assignment |
| Source section | Shows the original section without treating it as a department |
| Raw item and resolved item code | Confirms no guessed match |
| Raw and canonical quantity/unit | Shows any conversion |
| Central stock before | Availability evidence |
| Proposed issue quantity | Quantity to deduct |
| Central stock after | Verifies no negative stock |
| Import status | Verified, exception, or skipped |

Required approvals:

1. Operations owner approves every mapping and exception resolution.
2. Store manager confirms quantities against the physical papers.
3. Admin authorizes the final import run.

Only lines marked `verified` may move to Phase E.

## 8. Phase E - Create Historical Indents and Issuances

### 8.1 Grouping rule

Create **one indent and one issuance per canonical parent department per document date**. A section does not create its own indent or issuance. Aggregate duplicate lines only when all of these match:

- same date;
- same canonical parent department;
- same resolved `item_code`;
- same canonical unit.

Keep source-line links to every aggregated input row in `historical_import_lines`.

### 8.2 Indent records

For each group, create:

```text
indents
  dept              = canonical department name
  date              = source document date
  status            = approved before issuance, then issued/partial after issuance
  indent_type       = routine
  created_by        = dedicated historical-import system user or approved admin user
  updated_by        = same actor

indent_items
  indent_id, name, item_code,
  qty               = approved requested/issued quantity
  issued_qty        = 0 before issuance; updated by issuance flow
  unit              = approved canonical unit
```

The import must use an approved actor; it must not invent a chef/storekeeper identity.

### 8.3 Issuance records

For each created approved indent, create one matching issuance:

```text
issuances
  indent_id         = imported indent ID
  dept              = same canonical department
  date              = source document date
  scanned           = true
  created_by        = approved import actor
  updated_by        = approved import actor

issuance_items
  issuance_id, name, item_code,
  qty               = requested quantity
  issued            = actual issued quantity
  unit              = canonical unit
  unit_price        = stock batch price used for valuation
```

Use the production-plan fields as `null`; these historical documents are department issues, not production-plan issues.

### 8.4 Stock deduction

For each issuance item:

1. Lock matching central `stock` batches with `FOR UPDATE`.
2. Use FEFO order: earliest non-expired `expiry_date`, then oldest `date`, then ID.
3. Deduct only `remaining` across batches.
4. Reject the full department/date transaction if any verified item lacks enough stock; do not partially write a group.
5. Add one `stock_adjustments` row for every batch actually reduced, with:
   - negative quantity;
   - reason `Historical department issuance`;
   - document date;
   - notes containing import key, source PDF, page/line evidence, parent department, source section, indent ID, issuance ID, and batch ID.
6. Update the imported indent's `issued_qty` and final status through the issuance workflow.

### 8.5 Atomicity and idempotency

Use one database transaction per import group (one date + one department):

```text
validate import run + source fingerprints
  -> lock stock batches
  -> create indent and items
  -> create issuance and items
  -> update stock.remaining
  -> insert stock adjustments
  -> update indent issued quantities/status
  -> insert audit log
  -> mark import lines applied
```

If any step fails, roll back the entire group. No half-issued department record, stock deduction, or line status may remain.

Before each group begins, verify the relevant source fingerprints are not already `applied`. The unique fingerprint constraint is the final duplicate-import protection.

## 9. Audit Trail Requirements

For every applied group, create an `audit_logs` entry with:

- action: `historical_issue.import`;
- resource: `issuances`;
- resource ID: created issuance ID;
- actor: the authenticated admin/import actor;
- department ID and canonical department name;
- `before`: stock batch quantities before deduction;
- `after`: stock batch quantities after deduction;
- metadata: import key, PDF hash, PDF file, pages/lines, source date, indent ID, issuance ID, conversion details, and any approved exception reference.

The PDF files must remain unchanged in `documentation/` during and after the import.

## 10. Verification After Each Import Run

Run the following checks before marking the run `applied`:

1. Every verified source line has one and only one applied import-line record.
2. Every applied import line links to one indent item and one issuance item.
3. Every issued item has a matching resolved item code and unit.
4. Sum of issued quantities matches the approved dry-run report.
5. Sum of stock batch deductions equals issued quantity after conversion.
6. No stock row has `remaining < 0`.
7. No stock row has changed `qty`.
8. Each group has an audit log and stock-adjustment entries for every reduced batch.
9. No item from an exception line was imported.
10. Re-running the import produces zero new rows and reports every source fingerprint as already applied.

## 11. Rollback and Recovery

### Before approval / before apply

- Delete only draft staging rows.
- Do not change `stock`, `indents`, or `issuances`.

### After an applied run

Do not delete historical records manually. Use a controlled reversal transaction per affected issuance:

1. Confirm the import key and affected source lines.
2. Lock the exact batches recorded in adjustment/audit data.
3. Restore `stock.remaining` by the exact deducted quantities.
4. Create compensating positive `stock_adjustments` rows with reason `Historical import reversal`.
5. Mark issuance/indent/import-line records `reversed` or create a dedicated reversal audit event; preserve all original records.
6. Mark the import run `rolled_back` and record the reason and actor.

Never delete audit evidence or reuse a rolled-back source fingerprint without an explicit new corrective import run.

## 12. Tests Required Before Production Import

| Test | Expected result |
| --- | --- |
| Exact template + stock item-code match | Line becomes verified |
| Recognized section under a known parent department | Line uses the parent department; section remains audit context and causes no exception |
| No readable parent department | Line becomes exception; no writes |
| Unknown item or ambiguous match | Line becomes exception; no writes |
| Unit mismatch without conversion | Line becomes exception; no writes |
| Insufficient stock | Whole department/date transaction rolls back |
| Duplicate source fingerprint | Import is rejected before any deduction |
| Multi-batch FEFO item | Correct batches reduce; total deduction is exact |
| One failed item in a group | No indent, issuance, stock change, or adjustment remains for that group |
| Successful group | Correct indent, issuance, stock adjustments, audit log, and line links exist |
| Re-run applied import | No duplicate indent, issuance, or stock deduction |
| Reversal | Exact stock restoration and compensating audit records |

## 13. Deliverables for Approval

Before any live write, provide:

1. OCR/staging workbook or CSV with every PDF line and page reference.
2. Parent-department mapping decision list, showing every section under its parent department.
3. Item-code and unit-resolution report with all exceptions.
4. Dry-run stock impact report by date, department, and item.
5. Import manifest containing only approved/verified lines.
6. Backup/export of affected stock rows before execution.

After execution, provide:

1. Created indent IDs and issuance IDs.
2. Applied import-line count, skipped-line count, and exception count.
3. Stock before/after reconciliation by item code.
4. Audit-log and adjustment reconciliation.
5. Final import-run status and hash evidence.

## 14. Explicit Approval Required to Proceed

Implementation may begin only after all of the following are confirmed:

- [ ] Record the documents as historical **indents plus issuances**, not department-stock transfers.
- [ ] Do not add department current-stock or balance fields anywhere.
- [ ] Approve the import-audit/idempotency tables described in Section 3.
- [ ] Confirm parent-department mappings and the known section hierarchy; no section is to be treated as a standalone department.
- [ ] Approve the extracted staging report and all exception resolutions.
- [ ] Nominate the approved import actor and historical approver.
