# Kapila Inventory System — Codex Instructions

## Project Identity
- **Project:** Hotel Kapila Inventory Management System
- **Stack:** React (Vite), Node.js/Express backend (planned), SQLite or PostgreSQL
- **Current state:** Single-file MVP (`kapila_inventory.jsx`) — expanding into full modular architecture
- **Style:** Dark theme UI, DM Serif Display + DM Sans fonts, gold accent `#e8a838`

## Architecture (Target)
```
kapila/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/    # Reusable UI (Btn, Card, Table, Input…)
│   │   ├── screens/       # One folder per module
│   │   ├── hooks/         # useStorage, useApi, useAuth…
│   │   ├── context/       # AppContext, AuthContext
│   │   ├── api/           # API client functions
│   │   └── styles/        # COLORS, CSS constants
│   └── public/
├── backend/           # Express API server
│   ├── routes/        # One file per domain
│   ├── controllers/
│   ├── models/        # DB models / queries
│   ├── middleware/    # auth, validation, error handling
│   └── db/            # migrations, seeds
├── docs/              # All .md documentation
└── AGENTS.md          # ← you are here
```

## Modules
1. **Stock** — Incoming purchases from suppliers
   - *Voice Capturing & OCR*: Multi-language speech recognition (Telugu `te-IN`, Hindi `hi-IN`, English `en-IN`, Tamil, Kannada, etc.) & receipt scans (Codex 3.5 Sonnet / Gemini).
   - *Alerts & POs*: WhatsApp PO generation (`https://wa.me/?text=...`) and clipboard copying for low stock items.
   - *Supplier Comparisons*: Auto-ranking active supplier rates under item input to recommend the cheapest.
   - *Expiry tracking*: Spoilage warning widget displaying items expiring in under 3 days.
   - *Stock Ledger & LIFO*: Complete double-entry transactional ledger engine (`stock_ledger`) tracking FIFO/LIFO batches, pack size variations, warehouse positioning (Rack / Shelf / Bin), running audit balances (`balance_qty_before`, `balance_qty_after`), and financial valuations across all movement types (`INWARD_GRN`, `INWARD_PURCHASE`, `OUTWARD_ISSUE`, `ADJUSTMENT_ADD`, `ADJUSTMENT_DEDUCT`, `RETURN_TO_VENDOR`, `OPENING_BALANCE`, `TRANSFER_IN`, `TRANSFER_OUT`, `TRANSFER_LOSS`). Features live financial telemetry summaries, debounced multi-field searching, department filters (including `CENTRAL STORE`), instant filter reset, and high-fidelity streaming Excel (`.xlsx`) and CSV exports.
2. **Stock Reconciliation (Multi-Agent Engine)**
   - *Agent Scanner*: Instant searchable combobox with category grouping, keyboard navigation, and automatic unit matching.
   - *Agent Loader*: Batch theoretical stock loading, real-time variance calculation against physical counts, pack conversion math.
   - *Agent Auditor*: Comprehensive historical reconciliation sessions audit trail, expandable item breakdown, unit-rate valuation.
   - *Agent Veritas*: Two-stage verification dialog with impact ledger preview, automatic inventory level adjustment and atomic double-entry ledger postings (`ADJUSTMENT_ADD` / `ADJUSTMENT_DEDUCT` with session document links).
3. **Indent** — Department nightly material requests
   - *Recipe Planner & Auto-Indent*: Scaled recipe-based portion calculator and historical weekday average trend recommendation engine.
   - *Multi-Agent Indent Processor & Harmonizer*: Multi-department batch ingestion, item alias normalization, unit conversion reconciliation.
   - *Consolidated Disposables & Single Indent Protocol*: Ingests and bundles Central Stores packaging & disposable materials (containers, foil, cling wrap, carry bags, plates, cutlery) directly alongside kitchen food ingredients into **one single unified indent document** across all 9 canonical kitchen departments (`TIFFINS`, `STAFF`, `SI-MEALS`, `NORTH INDIAN`, `CHAT & SOFTY`, `CHINESE & DOSA`, `MOCKTAILS & CONTINENTAL`, `RESTAURANT`, `ROOM SERVICE`).
   - *Requisition Slip & Export Compiler Agent*: Generates branded Hotel Kapila `.xlsx` workbooks (Section A: Kitchen Ingredients & Raw Materials, Section B: Packaging & Disposables, station prep notes callouts, totals, and physical 3-tier signature blocks) and instant browser print/PDF vouchers (`printRequisitionSlip`) immediately upon preparation, in the Store Approvals Queue, and in Master History.
4. **Issuance** — Storekeeper issues goods, AI scan of paper forms, auto batch deduction
5. **Production** — Plates/portions logged per department
6. **Leftovers** — Unsold food carried forward
7. **Kitchen Assets & Maintenance (CMMS)** — Equipment lifecycle, preventive maintenance schedules, breakdown work orders
8. **Security Gate & Utilities** — Returnable/non-returnable gate passes, daily utility consumption meter logging (power, water, gas, diesel)
9. **Food Safety & Waste** — Critical control point logs (temperature, oil quality, cleaning audits), waste logging with financial impact
10. **Staff HRMS & Night Audit** — Shift attendance, roster management, automated day-end closing reconciliation
11. **Dashboard** — Cross-module KPIs and alerts
    - *Store Manager Home*: Live at-a-glance view of pending indents, low stock alerts, offline sync status, recent activity feeds, quick action shortcuts, and shift handoff notes.

## Departments (fixed list)
`TIFFINS | STAFF | SI-MEALS | NORTH INDIAN | CHAT & SOFTY | CHINESE & DOSA | MOCKTAILS & CONTINENTAL | RESTAURANT | ROOM SERVICE`

## Coding Rules
- Never add features beyond what the current task requires
- No comments unless the WHY is non-obvious
- No backwards-compat shims — just change the code
- All monetary/qty values are `float`, dates are `YYYY-MM-DD` strings
- `localStorage` keys are namespaced: `kapila_*`
- **Indent Zero-Reset & Draft Cache Holding Protocol**:
  - All indents when opened for the first time MUST reset item quantities to zero (`0`) and items unselected (`selected: false`).
  - Active/in-progress drafts are held in namespaced local cache (`kapila_chef_draft_${dept}`, `kapila_indent_draft`, `kapila_smart_indent_draft_${dept}`) for a 2-hour operational window (`TTL = 2 * 60 * 60 * 1000`).
  - If a draft is older than 2 hours or no cache exists, the cache is automatically evicted and all lines reset to clean zero.
  - Upon successful requisition submission or clicking "Reset to Zero", the cached draft for that department/flow is immediately purged so the next opening starts clean at zero.
- API calls must include `x-api-key` header for Anthropic endpoints
- Prefer editing existing files over creating new ones

## Known Bugs (Resolved)
- `handleScan` in IssuanceScreen: Routed through backend `/api/scan/indent` proxy with server-side API key management. [RESOLVED]

## Commands
```bash
# Frontend
cd frontend && npm run dev
cd frontend && npm run build

# Backend (when scaffolded)
cd backend && npm run dev
```

## Agents
- See `AGENT.md` for agent roles and responsibilities
- See `docs/` for module-specific documentation

## Zero-Omission Enterprise Development Protocol

### NON-NEGOTIABLE PRINCIPLE
Assume that every change affects multiple layers of the system.
Never assume a module, entity, screen, API, workflow, or database object is isolated.
The burden of proof is on the implementation to demonstrate completeness.
No code may be generated until a completeness audit is performed.

### RULE 1: FULL CODEBASE DISCOVERY
Before any implementation: Scan and inventory all modules, pages, routes, forms, components, layouts, APIs, services, repositories, database tables, views, stored procedures, triggers, queues, schedulers, events, notifications, reports, dashboards, integrations, permissions, feature flags, configuration files, environment variables, tests, and documentation. Create a dependency map. Do not proceed until the map is complete.

### RULE 2: REQUIREMENT DECOMPOSITION
Convert every requirement into: Business capabilities, User actions, System actions, Data operations, Security requirements, Workflow requirements, Reporting requirements, Audit requirements, Integration requirements. Nothing may remain implicit.

### RULE 3: TRACEABILITY MATRIX
Create and maintain mappings for: Requirement -> Screen, Form, Field, API, Service, Database Entity, Workflow, Notification, Report, Permission, Test Case. Every requirement must map to implementation. Every implementation must map back to a requirement. No orphan logic.

### RULE 4: COMPLETE DOMAIN MODELING
For every entity identify: Ownership, Lifecycle, Statuses, Relationships, Parent entities, Child entities, Reference entities, Lookup entities, Audit requirements, History requirements, Retention requirements. Generate complete entity map before coding.

### RULE 5: DATABASE COMPLETENESS CHECK
For every entity verify: Primary Key, Alternate Key, Foreign Keys, Constraints, Indexes, Search Strategy, Audit Columns, Soft Delete Strategy, Versioning Strategy, Concurrency Strategy, Archival Strategy, Historical Tracking. No entity is complete until all are defined.

### RULE 6: UI COMPLETENESS CHECK
For every module verify: Create, Read, Update, Delete, View Details, Search, Filter, Sort, Export, Import, Bulk Actions, Audit History, Attachments, Comments, Activity Timeline, Mobile Layout, Tablet Layout, Desktop Layout, Accessibility. Generate missing screens if absent.

### RULE 7: FORM COMPLETENESS CHECK
For every field define: Label, Tooltip, Placeholder, Data Type, Validation, Dependency Rules, Conditional Visibility, Default Value, Error Message, Security Restrictions. No field may exist without behavior.

### RULE 8: BUSINESS PROCESS MODELING
For every module identify: Entry Point, Approval Flow, Rejection Flow, Escalation Flow, Exception Flow, Reassignment Flow, Closure Flow, Archive Flow, Restore Flow. Generate process diagram mentally before implementation.

### RULE 9: CROSS-MODULE IMPACT ANALYSIS
Before every change evaluate impact on: Master Data, Transactions, Inventory, Finance, HR, Reporting, Analytics, Notifications, Integrations, Security, Auditing. Assume impact exists until disproven.

### RULE 10: SECURITY COMPLETENESS
Verify: Authentication, Authorization, Role Permissions, Record Permissions, Field Permissions, Audit Logging, Data Encryption, Secret Management, OWASP Risks, Input Validation, Output Encoding. Security review is mandatory.

### RULE 11: INTEGRATION COMPLETENESS
Check impact on: Internal APIs, External APIs, Webhooks, Queues, Events, Scheduled Jobs, ETL Processes, Data Warehouses, Reporting Systems. No disconnected implementation.

### RULE 12: REPORTING COMPLETENESS
Determine whether the change affects: KPIs, Reports, Dashboards, Exports, Scheduled Reports, Analytics. Update all dependent assets.

### RULE 13: TEST COMPLETENESS
Generate coverage for: Unit, Integration, API, UI, Database, Security, Permissions, Workflows, Regression, End-to-End. Every requirement must have at least one test.

### RULE 14: MIGRATION COMPLETENESS
If schema changes, Generate: Migration Plan, Backfill Strategy, Rollback Strategy, Data Validation Plan, Deployment Order, Recovery Plan. Never modify production schema without rollback.

### RULE 15: SELF-AUDIT LOOP
Before completion ask if you have checked every: table, API, screen, workflow, role, report, dashboard, integration, notification, scheduled job, audit requirement, test impact. If any answer is uncertain: Continue investigation. Do not finalize.

### RULE 16: COMPLETENESS SCORE
Generate a completion report: Architecture, Database, API, UI, Workflow, Security, Reporting, Testing Coverage %. If any category is below 100%, identify gaps before coding.

### FINAL ENFORCEMENT
Never say: 'Done', 'Complete', 'Implemented' Until: 1. Dependency analysis completed. 2. Traceability matrix completed. 3. Impact analysis completed. 4. Security review completed. 5. Test plan completed. 6. Self-audit completed. 7. No unresolved dependencies remain. Treat every task as production-critical enterprise software.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Kapila_Project-main** (2595 symbols, 5851 relationships, 203 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Kapila_Project-main/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Kapila_Project-main/clusters` | All functional areas |
| `gitnexus://repo/Kapila_Project-main/processes` | All execution flows |
| `gitnexus://repo/Kapila_Project-main/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
