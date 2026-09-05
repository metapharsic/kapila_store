# 🏨 Hotel Kapila — Inventory Management System

> A full-stack, AI-powered inventory management platform for hotel kitchens. Built for the real-world pace of hotel operations — multi-department indents, voice capture, OCR scanning, supplier management, issuance workflows, production planning, and a live store-manager dashboard.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Prerequisites](#4-prerequisites)
5. [Installation](#5-installation)
6. [Environment Configuration](#6-environment-configuration)
7. [Database Setup](#7-database-setup)
8. [Running the Application](#8-running-the-application)
9. [Modules & Features](#9-modules--features)
10. [Departments](#10-departments)
11. [User Roles & Permissions](#11-user-roles--permissions)
12. [API Reference](#12-api-reference)
13. [AI & OCR Services](#13-ai--ocr-services)
14. [Scripts & Utilities](#14-scripts--utilities)
15. [Testing](#15-testing)
16. [Monitoring & Observability](#16-monitoring--observability)
17. [Kafka Event Bus](#17-kafka-event-bus)
18. [WhatsApp Notifications](#18-whatsapp-notifications)
19. [Project Structure](#19-project-structure)
20. [Known Issues & Bugs](#20-known-issues--bugs)
21. [AI Enhancement Roadmap](#21-ai-enhancement-roadmap)
22. [Contributing & Development Rules](#22-contributing--development-rules)

---

## 1. Project Overview

The **Hotel Kapila Inventory Management System** is a web application designed to replace paper-based inventory tracking in hotel kitchens. It covers the complete supply chain loop:

```
Supplier → Purchase Order → Goods Receipt (GRN) → Stock → Indent (Dept. Request) → Issuance → Production → Leftover Tracking
```

### Core Design Goals

| Goal | How |
|---|---|
| Speed | Voice + OCR capture; no manual typing for common tasks |
| Accuracy | AI-assisted quantity parsing, anomaly detection, FEFO batch selection |
| Visibility | Live store-manager dashboard with KPIs, alerts, and activity feed |
| Traceability | Full audit trail with RBAC, shift handoffs, and Kafka event log |
| Resilience | Multi-tier AI fallback (Gemini → Claude → Ollama → regex) |

---

## 2. Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.x | UI framework |
| Vite | 8.x | Build tool & dev server |
| TypeScript | 7.x | Type safety |
| Zustand | 5.x | Client-side state management |
| Recharts | 3.x | Charts & data visualization |
| Lucide React | 1.x | Icon library |
| Zod | 4.x | Schema validation |
| HuggingFace Transformers | 4.x | On-device AI (browser worker) |
| Playwright | 1.x | End-to-end testing |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Runtime |
| TypeScript | 7.x | Type safety |
| Express | 4.x | HTTP server |
| Knex.js | 3.x | Query builder & migrations |
| PostgreSQL | 14+ | Primary database |
| Tesseract.js | 7.x | OCR (local fallback) |
| KafkaJS | 2.x | Event bus |
| Zod | 3.x | Input validation |
| Helmet + CORS | latest | Security headers |
| Prom-Client | 15.x | Prometheus metrics |
| JWT (jsonwebtoken) | 9.x | Auth tokens |
| bcryptjs | 3.x | Password hashing |
| node-cron | 4.x | Scheduled jobs |
| Sharp | 0.35.x | Image processing |

### AI Services (Multi-Tier Fallback)

```
Tier 1: Google Gemini API  (OCR, voice parse, smart suggestions)
Tier 2: Anthropic Claude   (fallback if Gemini hits quota)
Tier 3: Ollama (local)     (self-hosted, no API key needed)
Tier 4: Regex/mock         (last resort, always available)
```

### Infrastructure

- **Database:** PostgreSQL (local or remote)
- **Event Bus:** Apache Kafka (optional — app runs without it)
- **Metrics:** Prometheus + Grafana (optional)
- **Notifications:** WhatsApp via Meta Graph API (optional)

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React + Vite)                   │
│  screens/ ── components/ ── hooks/ ── context/ ── store/ (Zustand)│
│       ↕ HTTP (fetch via api/ layer)                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ :3001
┌──────────────────────────▼──────────────────────────────────────┐
│                    BACKEND (Express + TypeScript)                │
│  routes/ → middleware/auth → controllers/ → services/ → db/     │
│       ↕                          ↕                              │
│  PostgreSQL (Knex)          Gemini / Claude / Ollama            │
│       ↕                                                         │
│  Kafka Event Bus (optional)                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow — Indent Lifecycle

```
Chef/Dept Head → creates Indent → Store Manager reviews → Approves/Rejects
                                                                ↓
                                              Store Keeper issues stock items
                                                                ↓
                                              Issuance recorded → Stock deducted
                                                                ↓
                                              Chef logs Production → Leftover tracked
```

---

## 4. Prerequisites

Before installing, ensure the following are available on your machine:

| Requirement | Minimum Version | Check Command |
|---|---|---|
| Node.js | 20.x | `node -v` |
| npm | 9.x | `npm -v` |
| PostgreSQL | 14.x | `psql --version` |
| Git | any | `git --version` |

**Optional (for full AI features):**

- Google Gemini API key (for OCR, voice parse)
- Anthropic API key (fallback AI)
- Ollama running locally (self-hosted fallback)
- Apache Kafka 3.x (for event bus)

---

## 5. Installation

### Step 1 — Clone the repository

```bash
git clone <your-repo-url>
cd Kapila_Project
```

### Step 2 — Install backend dependencies

```bash
cd backend
npm install
```

### Step 3 — Install frontend dependencies

```bash
cd ../frontend
npm install
```

### Step 4 — Configure environment variables

See [Section 6](#6-environment-configuration) for the full `.env` setup.

```bash
# Copy the example env file
cd ../backend
copy .env.example .env   # Windows
cp .env.example .env     # Mac/Linux
```

Edit `.env` with your actual values.

### Step 5 — Set up the database

```bash
cd backend
npm run migrate
npm run seed       # Optional: seeds recipes and demo data
```

### Step 6 — Start both servers

**Option A — Windows quick start (recommended):**

Double-click `Start Kapila.bat` in the project root. This will:
1. Verify/create the PostgreSQL `kapila` database
2. Start backend on `:3001` in a new terminal window
3. Start frontend on `:8008` in a new terminal window
4. Open `http://localhost:8008` in your browser

**Option B — Manual start:**

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

**Option C — Stop all servers (Windows):**

Double-click `Stop Kapila.bat` in the project root.

---

## 6. Environment Configuration

The backend reads from `backend/.env`. All required and optional variables are listed below.

### Required Variables

```env
PORT=3001
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/kapila
NODE_ENV=development
JWT_SECRET=<at-least-32-random-characters>
```

> ⚠️ **The app will refuse to start if `JWT_SECRET` is missing.**

### AI Keys (Recommended)

```env
# Primary AI — OCR, voice parse, smart suggestions
GEMINI_API_KEY=<your-google-gemini-api-key>

# Fallback AI — used when Gemini hits quota or billing limits
# Voice transcription stays Gemini-only (Claude has no audio input)
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

### Ollama (Local AI — No API Key Required)

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen
OLLAMA_VISION_MODEL=llava
```

### Kafka Event Bus (Optional)

```env
# App runs fine without Kafka — publish calls fail-safe and just log a warning
KAFKA_BROKER=localhost:9092
```

### WhatsApp Notifications (Optional)

```env
# Meta Graph API credentials for WhatsApp alerts
WHATSAPP_TOKEN=<your-meta-access-token>
WHATSAPP_PHONE_ID=<your-whatsapp-phone-number-id>
ADMIN_WHATSAPP_NUMBER=<admin-phone-number-with-country-code>
STORE_MANAGER_WHATSAPP_NUMBER=<store-manager-phone-number>
```

> Without these, alerts just `console.log` a mock message instead of actually sending.

### CORS

```env
# Defaults to http://localhost:5173 if not set
FRONTEND_ORIGIN=http://localhost:8008
```

---

## 7. Database Setup

The app uses **PostgreSQL** with **Knex.js** for migrations.

### Create the database manually (if `Start Kapila.bat` fails)

```bash
psql -U postgres
CREATE DATABASE kapila;
\q
```

### Run all migrations

```bash
cd backend
npm run migrate
```

### Rollback last migration

```bash
npm run migrate:rollback
```

### Seed the database

```bash
npm run seed
```

> Seeds include: recipe library (50+ recipes), full menu items, department configurations, default roles and permissions, and indent templates.

### Database Schema Overview

The schema has **62 migrations** covering:

| Category | Tables |
|---|---|
| Core Inventory | `stock`, `stock_adjustments` |
| Procurement | `suppliers`, `purchase_orders`, `grns`, `grn_items`, `supplier_rate_quotes` |
| Indent Workflow | `indents`, `indent_items`, `indent_templates` |
| Issuance | `issuances`, `issuance_items` |
| Production | `production`, `production_plans`, `recipe_cost_snapshots` |
| Leftovers | `leftovers` |
| Transfers | `transfers`, `transfer_items` |
| Recipes & Menu | `recipes`, `recipe_items`, `menu_items` |
| Auth & RBAC | `users`, `roles`, `permissions`, `role_permissions`, `user_roles` |
| Approvals | `approval_matrix`, `approval_requests` |
| Audit | `audit_sessions`, `audit_items`, `audit_logs` |
| Alerts | `reorder_points`, `notifications`, `anomaly_alerts` |
| Operations | `departments`, `shift_handoffs`, `temperature_logs`, `returns` |
| Events | `kafka_event_log` |

---

## 8. Running the Application

### Development

```bash
# Backend (auto-restarts on file changes via nodemon + tsx)
cd backend && npm run dev
# → API: http://localhost:3001
# → Health: http://localhost:3001/api/health
# → Metrics: http://localhost:3001/metrics

# Frontend (hot-reload via Vite)
cd frontend && npm run dev
# → App: http://localhost:8008
```

### Production Build

```bash
# Build backend TypeScript
cd backend && npm run build

# Build frontend for deployment
cd frontend && npm run build
# → Output: frontend/dist/
```

### Start in production

```bash
cd backend && npm start
```

---

## 9. Modules & Features

### 9.1 Stock Management

**Screen:** `StoreManagerStockPurchase` / `Stock`

- **View & search** all stock items with live quantity, category, and status badges
- **Add stock** with supplier, unit, price, batch number, and expiry date
- **Low-stock alerts** — items below `min_alert_qty` highlighted in red
- **Expiry tracking** — items expiring in ≤3 days shown in a spoilage warning widget
- **Supplier comparison** — auto-ranks active supplier rates to recommend the cheapest
- **Category filter** — filter by Vegetables, Dairy, Spices, Pulses, Linen, Fuel, etc.
- **WhatsApp Purchase Orders** — one-click PO generation sent via `https://wa.me/?text=…` with clipboard copy fallback
- **Voice Capture** — speak item + quantity in Telugu, Hindi, English, Tamil, or Kannada; Gemini parses into stock row
- **OCR scan** — photograph a delivery receipt; Gemini extracts item names, quantities, and prices

### 9.2 Indent (Department Requests)

**Screen:** `Indent`

- Departments submit nightly material requests
- **Recipe Planner integration** — portion-scaled ingredient auto-fill from the recipe library
- **Historical trend recommendations** — weekday average consumption auto-suggests quantities
- **Indent templates** — pre-saved patterns per department (e.g. STAFF dept "Atta 10kg" template)
- **Approval workflow** — indents flow through `pending → approved → issued / partial / rejected`
- **Escalation** — overdue indents escalate to the next approval tier automatically
- **Day-close indent** — end-of-day bulk confirmation by store manager

### 9.3 Issuance

**Screen:** `Issuance`

- Store keeper confirms which indent items can be issued based on current stock
- **Sufficiency gate** — prevents over-issuance; items with insufficient stock are auto-skipped in bulk-confirm
- **FEFO batch selection** — oldest expiry batch is highlighted for pick priority
- **AI scan of paper forms** — OCR pipeline reads handwritten/printed issuance forms
- **Anomaly detection** — flags quantities that are 10× the normal range for that item/department before confirming
- **Auto-issue endpoint** — `POST /api/store-issuance/auto-issue` for programmatic bulk issuance

### 9.4 Production

**Screen:** `Production` / `ProductionPlanner`

- Log plates/portions per department per shift
- Link to **Production Plans** (scheduled output targets)
- Track **waste reasons** (free text, structured for future AI clustering)
- **Waste Analytics** tab — charts showing waste trends by department

### 9.5 Leftovers

**Screen:** `Leftovers`

- Record unsold food carried forward
- Integrated with production to calculate actual vs planned output

### 9.6 Goods Receipt (GRN)

**Screen:** `GoodsReceipt`

- Record items received against a Purchase Order
- Attach supplier, batch number, expiry, and unit price
- **Approved Delivery** screen for manager sign-off on received goods

### 9.7 Purchase Orders

**Screen:** `PurchaseOrders`

- Create and track POs against active suppliers
- Escalation columns for overdue POs
- Supplier rate quotes attached per item

### 9.8 Suppliers

**Screen:** `Suppliers`

- Manage supplier master data
- View supplier reliability score (delivery delay + price variance history)
- Rate quote comparison per item

### 9.9 Transfers

**Screen:** `Transfers`

- Inter-department stock transfers
- Full item-level tracking with source and destination departments

### 9.10 Reorder Points

**Screen:** `ReorderPoints`

- Set `min_alert_qty` per item
- Auto-PO engine (`services/reorderAutoPO.js`) raises a PO when stock falls below threshold

### 9.11 Reports

**Screen:** `Reports`

- Daily / weekly department-level reports
- Waste rate, consumption rate, and leftover analytics
- Export to Excel via backend scripts

### 9.12 Audit

**Screen:** `audit` / `AuditLogs`

- Physical stock count sessions (`audit_sessions`, `audit_items`)
- Variance report comparing system stock vs physical count
- Full audit log of all user actions

### 9.13 Store Manager Dashboard

**Screen:** `StoreManagerHome`

- **Live KPI cards** — pending indents, low-stock count, open anomaly alerts, today's issuance value
- **Recent activity feed** — last 20 events across all modules
- **Pending indent list** — quick approve/reject without navigating to the Indent screen
- **Shift handoff notes** — write and read handoff summaries between shifts
- **Notification panel** — in-app alerts for approvals, low stock, anomalies
- **Quick action shortcuts** — jump to Stock, Indent, Issuance, Reports in one click
- **Offline sync status** — indicator for any queued offline actions

### 9.14 Chef Home

**Screen:** `ChefHome`

- Chef-facing view of today's production plan
- Mark items as prepared, log portions served
- View department-level stats (`ChefStats`)

### 9.15 User Management

**Screen:** `UserManagement`

- Create, edit, deactivate users
- Assign roles (admin, store_manager, store_keeper, chef, department_head)
- View per-user permission matrix

### 9.16 Departments

**Screen:** `Departments`

- View and manage the fixed department list
- Map legacy department names to canonical names

### 9.17 Reconciliation

**Screen:** `Reconciliation`

- Cross-check stock consumed (issuance) vs stock produced (production)
- Identify discrepancies

### 9.18 Waste Analytics

**Screen:** `WasteAnalytics`

- Charts: waste by department, waste trend over time, top-wasted items
- Integrated with production and leftover data

---

## 10. Departments

The system uses a **fixed department list** — do not rename or add departments without a migration.

| Code | Display Name |
|---|---|
| TIFFINS | Tiffins |
| STAFF | Staff |
| SI-MEALS | SI Meals |
| NORTH INDIAN | North Indian |
| CHAT & SOFTY | Chat & Softy |
| CHINESE & DOSA | Chinese & Dosa |
| MOCKTAILS & CONTINENTAL | Mocktails & Continental |
| RESTAURANT | Restaurant |
| ROOM SERVICE | Room Service |

---

## 11. User Roles & Permissions

The system uses **RBAC (Role-Based Access Control)** with a `roles → role_permissions → permissions` table structure.

### Built-in Roles

| Role | Typical User | Key Capabilities |
|---|---|---|
| `admin` | IT / Owner | Full system access, user management |
| `store_manager` | Store Manager | Dashboard, approve indents, view all reports, manage stock |
| `store_keeper` | Store Keeper | Issuance, GRN, stock entry |
| `chef` | Kitchen Chef | Production logging, Chef Home, recipe view |
| `department_head` | HOD | Submit indents, view own department data |

### Permission Format

Permissions follow the pattern: `<resource>.<action>`

Examples: `stock.create`, `indents.approve`, `issuances.create`, `users.manage`, `reports.view`

### JWT Authentication

- Login returns an **access token** (short-lived) + **refresh token** (HTTP-only cookie)
- All protected routes require `Authorization: Bearer <access_token>`
- Rate limiting is applied to auth endpoints (429 if exceeded)

---

## 12. API Reference

All API routes are prefixed with `/api`. All authenticated routes require `Authorization: Bearer <token>`.

### Auth

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login — returns access token |
| POST | `/api/auth/refresh` | Refresh access token via cookie |
| POST | `/api/auth/logout` | Invalidate refresh token |

### Stock

| Method | Route | Description |
|---|---|---|
| GET | `/api/stock` | List all stock items (filter by category, search, low-stock) |
| POST | `/api/stock` | Add new stock entry |
| PUT | `/api/stock/:id` | Update stock item |
| DELETE | `/api/stock/:id` | Remove stock item |
| GET | `/api/stock/search` | Full-text + trigram search |

### Indents

| Method | Route | Description |
|---|---|---|
| GET | `/api/indents` | List indents (filter by status, dept, date) |
| POST | `/api/indents` | Submit new indent |
| PUT | `/api/indents/:id` | Update indent |
| POST | `/api/indents/:id/approve` | Approve indent |
| POST | `/api/indents/:id/reject` | Reject indent |

### Issuance

| Method | Route | Description |
|---|---|---|
| GET | `/api/issuances` | List issuance records |
| POST | `/api/issuances` | Create issuance from indent |
| POST | `/api/store-issuance/auto-issue` | Auto-issue all approved items |

### Other Key Routes

| Resource | Base Path |
|---|---|
| Suppliers | `/api/suppliers` |
| Purchase Orders | `/api/purchase-orders` |
| GRN | `/api/grn` |
| Production | `/api/production` |
| Leftovers | `/api/leftovers` |
| Recipes | `/api/recipes` |
| Transfers | `/api/transfers` |
| Reorder Points | `/api/reorder-points` |
| Reports | `/api/reports` |
| Dashboard | `/api/dashboard` |
| Users | `/api/users` |
| Roles | `/api/roles` |
| Departments | `/api/departments` |
| Audit | `/api/audits` |
| Notifications | `/api/notifications` |
| Shift Handoffs | `/api/handoffs` |
| Temperature Logs | `/api/temperature-logs` |
| Returns | `/api/returns` |
| Anomalies | `/api/anomalies` |
| AI / Scan | `/api/scan`, `/api/ai` |
| Analytics | `/api/analytics` |

### Response Format

All API responses use a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Errors:

```json
{
  "success": false,
  "data": null,
  "error": "Human-readable error message"
}
```

---

## 13. AI & OCR Services

All AI logic is centralised in `backend/services/localAI.js`.

### Multi-Tier Fallback Architecture

```
Request → Gemini (primary)
            ↓ (on quota/error)
         Claude (secondary)
            ↓ (on quota/error)
         Ollama (local, no API key)
            ↓ (on failure)
         Regex/mock (always works)
```

### Supported AI Operations

| Operation | Input | Output |
|---|---|---|
| OCR — receipt scan | Image (base64) | Structured item list with qty & price |
| Voice parse | Audio transcript text | Item name + quantity pairs |
| Smart reorder | 15-day stock history | Suggested reorder quantities |
| Substitute suggestion | Insufficient item + stock list | Alternative item from same category |
| Anomaly detection | Issue qty vs historical range | Anomaly flag + severity |
| Natural language search | Free-text query | Structured filter params |
| Auto-categorize | Item name | Suggested category |

### Supported Languages (Voice)

| Code | Language |
|---|---|
| `te-IN` | Telugu |
| `hi-IN` | Hindi |
| `en-IN` | English (Indian) |
| `ta-IN` | Tamil |
| `kn-IN` | Kannada |

### OCR Tesseract Trained Data

The backend ships with local Tesseract trained data files for offline OCR fallback:

- `eng.traineddata` — English
- `hin.traineddata` — Hindi
- `tel.traineddata` — Telugu

### API Key Security

> ⚠️ **Never expose API keys to the browser.** All Anthropic and Gemini calls are proxied through the backend. The frontend never holds an API key.

---

## 14. Scripts & Utilities

Located in `backend/scripts/`:

### Export Scripts

```bash
# Export all ingredients to Excel
node backend/scripts/export_all_ingredients.js

# Export all indents to Excel
node backend/scripts/export_indents.js

# Clean up expired auth tokens
npm run cleanup:tokens   # (from backend/)
```

### Database Inspection

```bash
# Check table row counts
node check_tables.js

# Check data in specific tables
node backend/check_data.js

# Inspect uploaded Excel data
cat inspect_excel.json
```

### Auto-PO Engine

`backend/services/reorderAutoPO.js` — runs as a cron job. When stock falls below `reorder_points.reorder_qty`, it:
1. Finds the cheapest active supplier for the item
2. Creates a draft Purchase Order
3. Sends a WhatsApp notification to the store manager

### Anomaly Detector

`backend/cron/anomalyDetector.js` — scheduled cron that:
1. Scans recent issuances for quantities 10× above the historical median
2. Creates `anomaly_alerts` records
3. Sends notifications to the store manager

---

## 15. Testing

### End-to-End Tests (Playwright)

```bash
cd frontend

# Run all E2E tests (headless)
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# View the HTML report from the last run
npm run test:e2e:report
```

Test files are in `frontend/tests/`.

### Backend Test Scripts

```bash
cd backend

# Test database connection
node test-db.js

# Test AI scan endpoint
node test_api_scan.js

# Test OCR pipeline
node test_ocr.js

# Test Gemini API key
node test_gemini_key.js

# Test anomaly detection
node test_anomaly.js
```

---

## 16. Monitoring & Observability

### Prometheus Metrics

The backend exposes a `/metrics` endpoint compatible with Prometheus scraping.

Default metrics include all standard Node.js process metrics (CPU, memory, event loop lag) plus:

| Metric | Type | Labels |
|---|---|---|
| `kapila_http_request_duration_seconds` | Histogram | `method`, `route`, `status` |

**To scrape with Prometheus**, add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'kapila-backend'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

### Logs

Server logs are written to `backend/server.log`. Boot logs are in `backend/fresh-boot*.log`.

---

## 17. Kafka Event Bus

Kafka is **optional** — the app runs without it. When configured, it provides a real-time event stream for cross-module integration.

### Topics

| Topic | Producer | Consumer |
|---|---|---|
| `stock-events` | Stock controller | Store Manager notifications |
| `indent-events` | Indent workflow | Approval notifications |
| `issuance-events` | Issuance controller | Anomaly detector |
| `production-events` | Production controller | Cross-check vs issuance qty |

### Configuration

```env
KAFKA_BROKER=localhost:9092
```

### Services

- **Producer:** `backend/services/kafkaProducer.js`
- **Consumer:** `backend/services/kafkaConsumer.js`

Events are also persisted to the `kafka_event_log` table in PostgreSQL for auditing and digest reports.

---

## 18. WhatsApp Notifications

Configured via Meta Graph API. Without credentials, alert calls `console.log` a mock message.

### Notification Types

| Trigger | Recipient |
|---|---|
| Stock falls below reorder point | Store Manager |
| Anomaly detected in issuance | Store Manager + Admin |
| Purchase Order auto-generated | Store Manager |
| Indent pending approval (stale) | Approver |
| Day-close digest | Admin |

### Quick WhatsApp PO Link

The Stock screen generates a `https://wa.me/?text=…` link for manual PO messaging — works without the Meta API credentials.

---

## 19. Project Structure

```
Kapila_Project/
├── Start Kapila.bat          # Windows one-click start
├── Stop Kapila.bat           # Windows one-click stop
├── AGENTS.md                 # AI agent roles & coding rules
├── AGENT.md                  # Agent role definitions
├── CLAUDE.md                 # Claude-specific instructions
├── .cursorrules              # Cursor IDE rules
│
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── App.jsx           # Root router & layout
│   │   ├── main.tsx          # Entry point
│   │   ├── api/              # HTTP client functions per resource
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Btn.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Select.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── Pagination.jsx
│   │   │   ├── NotificationPanel.jsx
│   │   │   ├── PermissionGate.jsx
│   │   │   └── ProtectedScreen.jsx
│   │   ├── context/          # React context (AppContext, AuthContext)
│   │   ├── hooks/            # Custom hooks (useStorage, useApi, useAuth…)
│   │   ├── screens/          # One folder per module
│   │   │   ├── StoreManagerHome.jsx
│   │   │   ├── StoreManagerStockPurchase.jsx
│   │   │   ├── ChefHome.jsx
│   │   │   ├── Stock/
│   │   │   ├── Indent/
│   │   │   ├── Issuance/
│   │   │   ├── Production/
│   │   │   ├── ProductionPlanner/
│   │   │   ├── Leftovers/
│   │   │   ├── GoodsReceipt/
│   │   │   ├── PurchaseOrders/
│   │   │   ├── Suppliers/
│   │   │   ├── Transfers/
│   │   │   ├── ReorderPoints/
│   │   │   ├── Reports/
│   │   │   ├── WasteAnalytics/
│   │   │   ├── Reconciliation/
│   │   │   ├── Dashboard/
│   │   │   ├── Approvals/
│   │   │   ├── AuditLogs/
│   │   │   ├── Departments/
│   │   │   ├── UserManagement/
│   │   │   ├── Login/
│   │   │   └── ChefStats/
│   │   ├── store/            # Zustand stores
│   │   ├── styles/           # CSS constants & color palette
│   │   ├── utils/            # Helper functions
│   │   └── workers/          # Web Workers (HuggingFace on-device AI)
│   ├── tests/                # Playwright E2E tests
│   ├── vite.config.js
│   └── package.json
│
├── backend/                  # Express + TypeScript API server
│   ├── server.ts             # Entry point, middleware setup
│   ├── routes/               # One file per resource (33 route files)
│   ├── controllers/          # Business logic handlers
│   ├── services/             # AI, auth, Kafka, WhatsApp services
│   │   ├── localAI.js        # Multi-tier AI fallback engine
│   │   ├── authService.ts    # JWT generation & verification
│   │   ├── permissionService.ts
│   │   ├── kafkaProducer.js
│   │   ├── kafkaConsumer.js
│   │   ├── reorderAutoPO.js  # Auto Purchase Order engine
│   │   ├── autoPoEngine.js
│   │   ├── forecastingService.js
│   │   ├── fuzzyMatch.js     # Duplicate item detection
│   │   └── whatsapp.js
│   ├── middleware/           # auth, errorHandler, rate limiting
│   ├── db/
│   │   ├── index.js          # Knex instance
│   │   ├── schema.sql        # Full schema reference
│   │   ├── migrations/       # 62 migration files
│   │   └── department_items.json
│   ├── cron/                 # Scheduled jobs
│   │   └── anomalyDetector.js
│   ├── config/               # App configuration files
│   ├── scripts/              # Utility/export scripts
│   ├── utils/                # Shared helpers
│   ├── exports/              # Generated Excel exports
│   ├── knexfile.js           # Knex database config
│   ├── nodemon.json          # Dev server watch config
│   ├── eng.traineddata       # Tesseract OCR — English
│   ├── hin.traineddata       # Tesseract OCR — Hindi
│   ├── tel.traineddata       # Tesseract OCR — Telugu
│   └── package.json
│
├── docs/                     # Module documentation
│   ├── ai_enhancements_roadmap.md
│   ├── architecture/
│   ├── database/
│   ├── menu/
│   ├── reports/
│   ├── security/
│   ├── store_manager_demo/
│   └── workflows/
│
├── environment/              # Example .env files
├── config/                   # Shared config
└── Documentation/            # Additional docs
```

---

## 20. Known Issues & Bugs

| # | Location | Description | Status |
|---|---|---|---|
| 1 | `IssuanceScreen` (line 292) | `handleScan` is missing `x-api-key` header → **401 error** when scanning paper forms | Open |

> To fix issue #1 manually, locate `handleScan` in `frontend/src/screens/Issuance/index.jsx` around line 292 and add the `x-api-key` header to the fetch call.

---

## 21. AI Enhancement Roadmap

The following enhancements are planned. All are grounded in existing infrastructure — no new database tables or infra required unless noted.

| # | Feature | Priority | Touch Points |
|---|---|---|---|
| 1 | Smart Reorder Suggestion — AI-adjusted PO qty from 15-day history | Medium | `stockController`, new `reorderAI.js` |
| 2 | Real-time Anomaly Gate on Issuance | Medium | `anomalyController`, Issuance screen |
| 3 | AI Substitute Suggestion on Bulk-Confirm Skip | Medium | Issuance screen, new `substituteAI.js` |
| 4 | Voice-to-Indent (speak items, Gemini parses) | Large | Indent screen, Web Speech API |
| 5 | FEFO Expiry-Risk Ranking on Issuance | Quick Win | `stockController`, `IssuanceItemRow` |
| 6 | Natural Language Stock Search | Large | Stock search bar, Gemini intent-parse |
| 7 | AI Shift Handoff Summary from Kafka log | Medium | `handoffController` |
| 8 | Predictive Stockout Alert (3-day lookahead) | Medium | `reorderController`, notifications |
| 9 | Duplicate/Near-Duplicate Item Merge (fuzzy match) | Quick Win | Admin screen, `idx_stock_name_trgm` |
| 10 | OCR Per-Field Confidence Score | Medium | `scanController`, `localAI.js` |
| 11 | Chef/Store Cross-Check via Kafka | Medium | `kafkaConsumer.js` |
| 12 | Supplier Reliability Score | Quick Win | `supplierController`, `grnController` |
| 13 | AI Auto-Categorize New Items | Quick Win | Stock Add Item drawer, `colors.js` |
| 14 | Waste-Reason NLP Clustering | Medium | `productionController`, Waste Analytics |
| 15 | Batch-Level FEFO Auto-Pick | Quick Win | `issuanceController` |
| 16 | Recipe Cost Drift Alert (cron) | Medium | `recipeController`, new cron |
| 17 | Smart Indent Template from History | Large | Indent screen, history query |
| 18 | Login Anomaly Guard (device/time-of-day) | Medium | auth middleware |
| 19 | GRN Paper Scan → Auto-Populate Form | Large | `scanController`, `grnController` |
| 20 | Daily Kafka Event Digest (WhatsApp/email) | Quick Win | new cron, `kafka_event_log` |

See [`docs/ai_enhancements_roadmap.md`](docs/ai_enhancements_roadmap.md) for full technical details.

---

## 22. Contributing & Development Rules

### Style Guide

- **No hardcoded hex colors** — use `COLORS` constants from `src/styles/colors.js`
- **No inline styles** for values that exist in the design system
- **No `any` TypeScript types**
- **No raw SQL string interpolation** — use parameterized Knex queries
- **No Anthropic/Gemini API calls from browser components** — all AI goes through backend proxy
- All monetary/quantity values are `float`; dates are `YYYY-MM-DD` strings
- `localStorage` keys must be namespaced as `kapila_*`

### Commit Style

- One concern per commit — no bundling of unrelated changes
- Mark TODOs with `// TODO(kapila):` so they're searchable

### File Conventions

- New screens → `src/screens/<ModuleName>/index.jsx`
- New reusable UI → `src/components/<ComponentName>.jsx`
- New API routes → `backend/routes/<resource>.js`
- New controllers → `backend/controllers/<resource>Controller.js`
- New DB migrations → `backend/db/migrations/<NNN>_<description>.js`

### Adding a New Module — Checklist

- [ ] Create migration file in `backend/db/migrations/`
- [ ] Run `npm run migrate`
- [ ] Add route file in `backend/routes/`
- [ ] Register route in `backend/server.ts`
- [ ] Add controller in `backend/controllers/`
- [ ] Create screen folder in `frontend/src/screens/`
- [ ] Add navigation link in `frontend/src/App.jsx`
- [ ] Add permissions to relevant roles in a new migration
- [ ] Update this README

### Environment Safety

- Never commit `.env` files (`.gitignore` already excludes them)
- Never hardcode server IPs or API keys in source code
- Always confirm before running destructive commands on production

---

## Quick Reference

| Task | Command |
|---|---|
| Start everything (Windows) | Double-click `Start Kapila.bat` |
| Stop everything (Windows) | Double-click `Stop Kapila.bat` |
| Start backend manually | `cd backend && npm run dev` |
| Start frontend manually | `cd frontend && npm run dev` |
| Run migrations | `cd backend && npm run migrate` |
| Rollback migration | `cd backend && npm run migrate:rollback` |
| Run seeds | `cd backend && npm run seed` |
| Run E2E tests | `cd frontend && npm run test:e2e` |
| Export ingredients | `node backend/scripts/export_all_ingredients.js` |
| Export indents | `node backend/scripts/export_indents.js` |
| Cleanup tokens | `cd backend && npm run cleanup:tokens` |

---

*Generated for Hotel Kapila Inventory System — Last updated July 2026*
