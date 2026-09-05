# Kapila Inventory — Agent Roles & Responsibilities

## Overview
This document defines how AI agents (Claude) should behave in different contexts
within this project. Each agent role has a scope, a set of allowed actions, and
constraints it must not violate.

---

## Agent Roles

### 1. `architect`
**Trigger:** Planning new modules, file structure decisions, DB schema design
**Responsibilities:**
- Design module boundaries and data flow
- Define API contracts before implementation
- Evaluate trade-offs (localStorage vs backend, REST vs tRPC)
- Update `CLAUDE.md` and `docs/ARCHITECTURE.md` when structure changes

**Constraints:**
- Must not write implementation code
- Must not delete existing files without user confirmation
- Propose, don't decide — present options with trade-offs

---

### 2. `frontend-dev`
**Trigger:** Adding/editing React components, screens, hooks, or styles
**Responsibilities:**
- Follow the component hierarchy in `docs/FRONTEND.md`
- Use `COLORS` constants from `src/styles/colors.js` — never hardcode hex values
- All new screens go in `src/screens/<ModuleName>/`
- All reusable UI goes in `src/components/`
- State that needs to persist uses `useStorage` hook
- State that needs server sync uses `useApi` hook

**Constraints:**
- No inline styles for values defined in `COLORS` or `css` constants
- No `any` types if TypeScript is adopted
- Never call Anthropic API directly from a component — route through `src/api/claude.js`

---

### 3. `backend-dev`
**Trigger:** Adding routes, controllers, DB queries, middleware
**Responsibilities:**
- Follow REST conventions: `GET /api/stock`, `POST /api/indents`, etc.
- All routes must have input validation (Zod or express-validator)
- DB queries go in `models/`, business logic in `controllers/`
- Auth middleware applied to all non-public routes
- Return consistent JSON: `{ success, data, error }`

**Constraints:**
- Never store Anthropic API key in code — read from `process.env.ANTHROPIC_API_KEY`
- No raw SQL string interpolation — use parameterized queries
- Never expose internal error stacks to client responses

---

### 4. `ai-integrator`
**Trigger:** Any task involving the Claude API (scan, OCR, suggestions)
**Responsibilities:**
- All Anthropic API calls go through `src/api/claude.js` (frontend) or `backend/services/claude.js` (backend)
- Always include `x-api-key` header from env variable
- Use `claude-sonnet-4-6` as default model (latest as of Aug 2025)
- Include prompt caching headers where applicable
- Handle 429 (rate limit) and 529 (overload) with exponential backoff

**Constraints:**
- Never expose API key to browser — proxy through backend
- Never send patient/sensitive data to Claude API without user consent notice
- Keep prompts in `backend/prompts/` as named constants, not inline strings

---

### 5. `data-agent`
**Trigger:** Reports, exports, analytics, dashboard queries
**Responsibilities:**
- Aggregate across stock/indent/issuance/production/leftover tables
- Generate daily/weekly reports per department
- Identify waste (leftover rate vs production) and low-stock alerts

**Constraints:**
- Read-only — never mutate data
- All aggregation done server-side, not in browser

---

### 6. `devops`
**Trigger:** Deployment, environment config, CI/CD, VPS setup
**Responsibilities:**
- Maintain `ecosystem.config.js` for PM2
- Keep `.env.example` updated with all required vars
- nginx config for frontend static + backend proxy
- Database backup cron

**Constraints:**
- Never commit `.env` files
- Never hardcode server IPs in source code
- Always confirm before running destructive commands on VPS

---

## Shared Rules (All Agents)
1. Read `CLAUDE.md` before starting any task
2. Check the relevant `docs/<MODULE>.md` before editing that module
3. One concern per commit — don't bundle unrelated changes
4. If a task touches >3 files, outline the plan first and ask for confirmation
5. Mark TODOs with `// TODO(kapila):` so they're searchable

---

## Escalation
If a task spans multiple agent roles (e.g. new screen + new API route + AI call),
break it into sequential sub-tasks and handle one role at a time.
