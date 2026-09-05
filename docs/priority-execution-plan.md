# Kapila Operational Readiness & Priority Execution Plan

**Prepared:** 2026-07-23  
**Purpose:** Provide management with a practical, risk-based sequence for moving Kapila from a configured system with little live transactional data to controlled day-to-day hotel operations.

## 1. Executive Summary

Kapila's core application is already substantially built: it supports suppliers, purchase orders (POs), goods receipt notes (GRNs), batch stock, indents, approvals, store issuance, production, leftovers, audits, notifications, and role-based access. The immediate problem is not a lack of screens; it is operational activation.

The system should not begin by implementing more AI features. It should first establish correct roles, master data, opening stock, real user workflows, and a controlled pilot. Once genuine stock, issuing, and production history exists, the already-built reorder, anomaly, and cost controls can be validated against real hotel operations.

### Recommended sequence

1. **Priority 0 — Launch controls and master-data readiness**
2. **Priority 1 — Controlled operational pilot and data population**
3. **Priority 2 — Stabilise and validate existing automation**
4. **Priority 3 — Implement approved policy controls**
5. **Priority 4 — Deliver genuinely unbuilt enhancements based on evidence**

## 2. Current State and Readiness Baseline

A read-only database review on 2026-07-22 found the following:

| Area | Current state | Operational consequence |
|---|---:|---|
| Users | 2 | A single Admin and a single Manager exist; kitchen and store teams cannot yet use role-specific workflows. |
| Roles | 4 | `admin`, `manager`, `chef`, and `employee` exist. The code also expects a `store_manager` role, but it is absent from the live database. |
| Departments | 9 | The hotel department master is present and ready for user assignment. |
| Suppliers | 0 | POs and GRNs cannot be used as real procurement records until suppliers are created. |
| Stock batches | 0 | Issuance, consumption analysis, stockout prediction, and valuation cannot operate meaningfully. |
| Purchase orders / GRNs | 0 / 0 | There is no live procurement history. |
| Indents | 1 | The request workflow has only minimal live usage. |
| Issuances / production / leftovers | 0 / 0 / 0 | There is no operational consumption or waste history. |
| Recipes | 504 | Recipe data exists, but must be treated as estimates until chefs validate quantities. |
| Kafka event log | 0 | No operational events have yet been recorded. |

### Critical configuration finding

Several scheduled jobs send notifications to hard-coded Store Manager role ID `5`. The current database has only four roles, with IDs `1` through `4`; therefore, those notifications will not reach an intended Store Manager. This affects the daily Kafka digest, predictive stockout alerts, reorder suggestions, recipe-cost-drift alerts, and chef/store cross-check alerts.

**Management decision required:** confirm whether the hotel should use the existing `manager` role as Store Manager, or create and maintain a distinct `store_manager` role. This must be resolved before live onboarding and alert activation.

## 3. Principles for the Rollout

1. **Do not fabricate historical procurement.** Existing items physically in the store should not be represented by fake POs or GRNs. They need a controlled opening-stock count/import with sign-off.
2. **Use GRNs for all future receipts.** Once opening stock is established, every genuine delivery should follow PO -> approval -> GRN -> stock batch.
3. **Pilot before hotel-wide adoption.** Start with one department and a limited item/supplier set, then correct process and data issues before scaling.
4. **Use current automation only after it has data.** Forecasting, anomaly detection, and cost drift are statistically weak with zero or very little issuance history.
5. **Keep business policy separate from software configuration.** Controls such as cutoff time, emergency purchasing, event allocation, and write-off authority need approved SOPs before implementation.
6. **Avoid unverified alerts.** WhatsApp and escalation alerts should be enabled only after recipient mapping, thresholds, and test cases are confirmed.

## 4. Priority 0 — Launch Controls and Master-Data Readiness

### Objective

Make the environment safe and structurally ready for real hotel users and real data.

### 4.1 Resolve the operating-role model

The product contains both `manager` and `store_manager` concepts. The live database has only `manager`, while some scheduled features explicitly target `store_manager` by a hard-coded role ID.

#### Required actions

1. Management confirms the intended responsibilities for Admin, Store Manager, Department Head/Chef, and Employee.
2. The project team either creates a distinct `store_manager` role or consistently uses the existing `manager` role.
3. Notification code must resolve recipients by role key or assigned user, not by fixed numeric role ID.
4. Review all permissions for segregation of duties: a person should not be able to request, approve, issue, and write off the same transaction without an explicit management exception.
5. Create a named account for each operational user; shared accounts must not be used.
6. Assign each non-admin user to their actual departments.

#### Acceptance criteria

- Every active staff member signs in with an individual account.
- Each user sees only intended navigation and records.
- A Store Manager recipient exists for operational alerts.
- Admin can demonstrate approval, password reset, deactivation, and audit history.

### 4.2 Prepare master data

#### Suppliers

Create the active supplier master before POs or GRNs. At minimum capture supplier name, primary contact, phone, GSTIN if applicable, address, and usual supplied categories.

#### Item master and units

Review the item catalogue before loading stock:

- Remove obvious duplicates only after review; do not merge history blindly.
- Standardise names, units, item codes, categories, and supplier naming.
- Ensure each item has one canonical purchasing/stock unit.
- Record conversion requirements where departments issue in a different unit from procurement.
- Identify perishables that require batch number, expiry date, and temperature monitoring.

#### Departments and ownership

The nine departments already exist. Confirm each department's department head/chef, indent creator(s), and permitted issue recipients.

### 4.3 Establish opening stock correctly

Opening inventory is the controlled baseline of material physically present when the system goes live.

#### Recommended opening-stock process

1. Freeze movements during the physical count window.
2. Count each item by location, batch, unit, and expiry where applicable.
3. Have Store Manager and department/store representative sign the count sheet.
4. Enter/import the count with quantity, unit, estimated/latest cost, supplier if known, expiry, and a clear opening-stock reference.
5. Recheck high-value and perishable items.
6. Reconcile system total with signed count sheets before opening normal issuance.
7. Keep original count sheets as audit evidence.

#### What not to do

- Do not create fictional POs solely to obtain stock balances.
- Do not use a normal GRN for stock that was already in the store before go-live.
- Do not enter unknown units or broad names such as "vegetables" when the item can be identified.
- Do not activate auto-reorder or anomaly thresholds until data is stable.

### 4.4 Operational safeguards before launch

- Verify database backup and restore procedure.
- Confirm production environment variables, especially database, JWT secret, Gemini, Kafka, and WhatsApp credentials.
- Keep `VITE_*` variables free of secrets.
- Confirm health endpoints and API access from the intended hotel network.
- Decide who is on call for login, printer, barcode, and connectivity issues during the pilot.

## 5. Priority 1 — Controlled Operational Pilot and Data Population

### Objective

Use real, limited hotel operations to prove the complete material lifecycle before rolling out to every department.

### 5.1 Why this is the first business priority

With zero stock, suppliers, POs, GRNs, issuances, and production records, several features cannot demonstrate value:

- stock availability and low-stock alerts;
- FEFO batch deductions;
- supplier price trend analysis;
- reorder suggestions;
- anomaly detection;
- recipe cost drift;
- dashboard KPIs;
- waste and production variance analytics.

### 5.2 Pilot scope

Start with one operational department, one or two suppliers, and a manageable set of frequently used items. Select a department with predictable daily usage and a cooperative chef/storekeeper.

### 5.3 Pilot workflow

1. Create supplier records.
2. Create a real PO for a small delivery.
3. Route and approve the PO according to the confirmed approval model.
4. Receive delivery through GRN with accepted/rejected quantity, invoice number, price, batch, and expiry details.
5. Confirm the GRN creates the correct stock batches and stock valuation.
6. Create a department indent for the next operational period.
7. Approve the indent using the approved authority.
8. Issue stock from the store.
9. Verify that stock is deducted, expired batches are excluded, and the issued quantity is visible in history.
10. Record production and leftovers.
11. Compare physical stock with system stock for selected high-risk items.
12. Review dashboard, audit logs, and notifications with management.

### 5.4 Pilot test cases

The pilot must deliberately test normal and exception scenarios:

| Scenario | Expected result |
|---|---|
| GRN quantity exceeds PO quantity | System blocks or flags according to configured tolerance. |
| Duplicate supplier invoice number | System rejects duplicate receipt. |
| Expired batch exists | Issuance excludes it. |
| Insufficient stock | Issuance rejects the shortfall without partial silent deduction. |
| Indent is not approved | Issuance is blocked. |
| Partial stock availability | Issuance records approved partial quantities correctly. |
| Wrong unit | System rejects incompatible conversion. |
| User accesses unassigned department | System returns forbidden access. |
| Physical count differs | Audit/reconciliation records reason and authorised resolution. |
| Return of unused material | Return workflow restores inventory only after approval. |

### 5.5 Training approach

Training should follow the pilot, not precede it by a large margin. Train using the actual process and corrected screens.

#### Store team

- supplier, PO, GRN, stock batch, expiry, adjustment, and issuance workflow;
- handling insufficient stock and return requests;
- daily opening/closing checks;
- how to report exceptions instead of bypassing the system.

#### Chefs and department users

- creating accurate indents;
- cutoff expectations;
- recording production and leftovers;
- reviewing substitutions/partial issuance;
- avoiding duplicate or late requests.

#### Management

- approval queue;
- dashboard interpretation;
- audit trail and reconciliation;
- escalation and exception governance.

### 5.6 Pilot exit criteria

Do not scale to all departments until:

- opening stock agrees with signed physical count;
- at least one full PO -> GRN -> stock -> indent -> approval -> issue -> production -> leftover cycle succeeds;
- role restrictions are checked with real accounts;
- at least one audit/reconciliation is completed;
- user feedback and data-quality defects are addressed;
- the manager signs off on pilot results.

## 6. Priority 2 — Stabilise and Validate Existing Automation

### Objective

Confirm that existing automated controls produce useful, correctly addressed output from real data before building replacements.

### 6.1 Existing capabilities that should not be rebuilt

| Capability | Current state | Required next action |
|---|---|---|
| FEFO issue selection | Implemented in issuance logic; expired batches are excluded and earliest-expiry valid batches are deducted first. | Verify using real multi-batch stock; add UI explanation only if users need it. |
| Automatic FEFO batch pick | Implemented server-side. | Do not rebuild; consider showing selected batch/allocation in the UI. |
| Missing stock categories | Already fixed; six previously missing categories are in the frontend catalogue. | Remove from implementation plan. |
| 15-day reorder suggestion | Implemented as deterministic scheduled logic. | Wait for enough real issuance history, then validate suggestions. |
| Real-time issuance anomaly flag | Implemented after issuance is created; flags, logs, and publishes anomalies without blocking operations. | Decide whether a pre-submit warning is needed after observing real use. |
| AI shift handoff summary | Implemented from same-day operational data and user notes. | Validate quality and permissions. |
| Chef/store cross-check | Implemented nightly, but currently basic. | Improve only after data proves need. |
| Recipe cost drift alert | Implemented nightly using stock prices and recipe snapshots. | Validate after real priced GRNs. |
| Daily Kafka digest | Implemented as in-app notification. | Repair recipient role resolution and validate Kafka events first. |

### 6.2 Automation validation plan

1. Repair Store Manager recipient resolution.
2. Confirm Kafka producer and consumer connectivity.
3. Generate controlled test events from a pilot PO, GRN, indent, and issuance.
4. Verify events are present in `kafka_event_log`.
5. Verify correct recipient receives the daily digest and stock alerts.
6. Compare generated reorder suggestions with storekeeper judgement after at least 15 days of genuine usage.
7. Review anomaly alerts for false positives before enabling WhatsApp delivery.
8. Review recipe-cost drift after multiple priced GRNs for common recipe ingredients.

### 6.3 WhatsApp and observability

WhatsApp should not be enabled merely because a token is available. First confirm recipient, escalation owner, message wording, data sensitivity, quiet hours, and false-positive rate. Start with one approved test recipient.

Kafka should be installed as a Windows service only when the pilot confirms that operational event logging and digest/alert workflows are required continuously. The application has fallback behaviour when Kafka is unavailable, so this is valuable infrastructure but not the first launch blocker.

Grafana and Prometheus are useful for technical monitoring, especially API performance and errors, but rank below user access, stock accuracy, and workflow adoption.

## 7. Priority 3 — Policy Controls Requiring Management Approval

These are genuine business-control gaps. Each requires a policy owner and an approved operating procedure before software work begins.

### 7.1 Indent cutoff time

**Business problem:** late indents create morning store chaos and reduce the ability to plan issues.

**Policy decisions needed:** cutoff time by department, timezone, urgent-indent definition, who can override, reason requirement, and escalation/notification rules.

**System scope:** enforce or warn at indent creation; mark approved exceptions; show late/urgent requests on dashboard; preserve audit trail.

**Recommended timing:** first policy-control feature after the pilot. It is small-to-medium effort because exceptions and authority matter.

### 7.2 Month-end stock freeze

**Business problem:** receipts, issues, transfers, returns, or adjustments during stock count can produce inaccurate reconciliation.

**Policy decisions needed:** affected locations/departments, freeze start/end, emergency override authority, transactions blocked, and post-count adjustment approval.

**System scope:** freeze state, blocked mutation endpoints, read-only operations, emergency override with reason, dashboard banner, and audit record.

**Recommended timing:** before the first formal month-end count, not necessarily before the pilot.

### 7.3 Two-level write-off sign-off

**Business problem:** one person should not be able to turn loss, spoilage, or theft into a final stock adjustment without review.

**Policy decisions needed:** value thresholds, first/second approver roles, Finance participation, supporting evidence, treatment of perishables, and escalation when approvers are unavailable.

**System scope:** write-off request status, two distinct approvals, evidence attachment, immutable audit history, notification, and blocked stock adjustment until final approval.

**Recommended timing:** define policy during pilot; implement before broad authority to write off stock is delegated.

### 7.4 Banquet/event ring-fencing

**Business problem:** exceptional event consumption distorts ordinary departmental demand and anomaly baselines.

**Policy decisions needed:** what is an event, mandatory event code/owner, cost centre, planning/approval route, and reporting treatment.

**System scope:** event reference on indent, issuance, production plan, and report filters; exclude or separately model event consumption in normal baseline calculations.

**Recommended timing:** after the pilot and before the next major event-driven operating period. This is cross-module work and should not be treated as a minor tag field.

### 7.5 Split-PO detection

**Business problem:** an employee can split related purchases below a value threshold to avoid higher approval.

**Policy decisions needed:** matching window, supplier matching, amount threshold, item/category similarity, emergency exceptions, investigator, and whether to warn or block.

**System scope:** detection report first, then alert/approval intervention if policy proves reliable.

**Recommended timing:** later. Start with monitoring; do not automatically block POs before the rule is agreed and real PO data exists.

## 8. Priority 4 — Future Enhancements Based on Evidence

### 8.1 Duplicate-item management

Fuzzy match and alias capability already exist. The next safe step is a read-only duplicate candidate report for manager review. A merge feature is higher risk because item codes, stock batches, historical issuance, reports, aliases, and possibly recipe references must remain correct.

### 8.2 FEFO visibility improvement

The server already selects FEFO batches. A small usability enhancement can display the batch/expiry being consumed and explain why it was selected. This reduces user mistrust without changing stock logic.

### 8.3 Recipe-level actual-versus-expected variance

The current chef/store cross-check identifies a coarse production-without-issuance mismatch. A later enhancement can compare recipe-scale expected ingredients to issued quantities by production plan. Build it only after recipes have chef-validated quantities and sufficient history.

### 8.4 Event-aware anomaly detection

After banquet/event references exist, refine anomaly baselines so event consumptions do not produce false alerts for normal departmental activity.

### 8.5 AI-assisted reorder recommendations

The current deterministic reorder job already calculates usage from 15-day issuance history. Any Gemini-based recommendation should be an advisory layer that explains seasonal or event context; it should not replace the deterministic calculation until accuracy is measured.

## 9. Recommended Delivery Timeline

### Week 1 — Set up and pilot

| Day | Activity | Owner | Output |
|---|---|---|---|
| 1 | Confirm role model, alert recipients, user list, department assignments | Management + system owner | Signed access matrix |
| 1-2 | Create real accounts; repair Store Manager recipient mapping | System owner | Tested logins and alert recipients |
| 2 | Create supplier and item-master baseline | Procurement + store team | Approved supplier/item list |
| 2-3 | Perform signed opening-stock count/import | Store Manager + management witness | Reconciled opening balance |
| 3 | Receive a small real delivery through PO and GRN | Procurement + store team | Verified stock batches |
| 4 | Run one department through indent, approval, issue, production, leftovers | Pilot department + store | Completed end-to-end transaction chain |
| 5 | Conduct reconciliation, collect issues, update SOP/training | Management + pilot users | Pilot sign-off or corrective-action list |

### Weeks 2-3 — Stabilise

- Onboard remaining departments in controlled waves.
- Validate alerts, Kafka events, dashboards, and audit logs.
- Measure stock/count accuracy and user adoption.
- Approve and implement indent cutoff policy.
- Draft month-end freeze and write-off policies.

### Month 2 — Controls and targeted enhancement

- Implement approved cutoff-time control.
- Prepare month-end freeze before first formal close.
- Implement two-level write-off control if authority is delegated beyond Admin.
- Scope event ring-fencing from actual banquet requirements.
- Introduce duplicate-item review report and FEFO visibility improvement if users request them.

## 10. Management Decisions Required

1. Is `store_manager` a distinct role, or should `manager` fulfil that responsibility?
2. Who approves POs, indents, transfers, reconciliations, and write-offs at each threshold?
3. Who owns master-data quality for suppliers, item names, units, and categories?
4. Which department will be the pilot department?
5. Who signs the opening-stock count and accepts the initial valuation?
6. What is the initial indent cutoff and emergency exception procedure?
7. Who receives alerts, and when should WhatsApp be enabled?
8. When is the first formal month-end stock count?
9. What constitutes a banquet/event transaction for separate reporting?

## 11. Success Measures

Management should judge the rollout using measurable results:

| Measure | Target for pilot completion |
|---|---|
| Individual user accounts | 100% of pilot users |
| Department assignments | 100% of non-admin pilot users |
| Opening stock accuracy | Signed physical count reconciled to system |
| GRN completeness | Supplier, item, quantity, unit, price, batch/expiry where applicable |
| End-to-end workflow | At least one successful full cycle in pilot department |
| Failed/blocked transactions | Reviewed and documented, not bypassed |
| Audit/reconciliation | At least one completed pilot reconciliation |
| Notification routing | Test notification delivered to confirmed owner |
| User readiness | Pilot users complete role-based training and acknowledgement |

## 12. Risks of Starting in the Wrong Order

| Wrong action | Likely outcome |
|---|---|
| Building new AI features before operational data | Expensive features with no reliable baseline or user value. |
| Faking historical POs/GRNs | Misleading procurement, supplier, price, and audit history. |
| Creating users before defining roles/departments | Over-privileged staff or inaccessible workflows. |
| Enabling WhatsApp before testing alert quality | Alert fatigue, missed critical alerts, or inappropriate data sharing. |
| Rolling out every department without pilot | Data-quality problems spread rapidly and users lose trust. |
| Automating policy decisions before management approves policy | Software enforces rules the hotel has not agreed to follow. |

## 13. Final Recommendation

Proceed with real operational activation, but start with **Priority 0: role/notification repair, master data, and opening-stock governance**. Then run a narrowly scoped pilot using real GRNs and real departmental issuance. Treat existing automation as features to validate, not features to rebuild. Implement policy-driven controls only after management approves the operating rules they must enforce.

This sequence gives management a controlled, auditable path from an empty stock ledger to reliable daily hotel operations.
