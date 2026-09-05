# Kapila Inventory System — Claude Instructions

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
└── CLAUDE.md          # ← you are here
```

## Modules
1. **Stock** — Incoming purchases from suppliers
   - *Voice Capturing & OCR*: Multi-language speech recognition (Telugu `te-IN`, Hindi `hi-IN`, English `en-IN`, Tamil, Kannada, etc.) & receipt scans (Claude 3.5 Sonnet).
   - *Alerts & POs*: WhatsApp PO generation (`https://wa.me/?text=...`) and clipboard copying for low stock items.
   - *Supplier Comparisons*: Auto-ranking active supplier rates under item input to recommend the cheapest.
   - *Expiry tracking*: Spoilage warning widget displaying items expiring in under 3 days.
2. **Indent** — Department nightly material requests
3. **Issuance** — Storekeeper issues goods, AI scan of paper forms
4. **Production** — Plates/portions logged per department
5. **Leftovers** — Unsold food carried forward
6. **Dashboard** — Cross-module KPIs and alerts

## Departments (fixed list)
`South Indian | North Indian | Continental | Juices | Bakery | Chinese`

## Coding Rules
- Never add features beyond what the current task requires
- No comments unless the WHY is non-obvious
- No backwards-compat shims — just change the code
- All monetary/qty values are `float`, dates are `YYYY-MM-DD` strings
- `localStorage` keys are namespaced: `kapila_*`
- API calls must include `x-api-key` header for Anthropic endpoints
- Prefer editing existing files over creating new ones

## Known Bugs
- `handleScan` in IssuanceScreen (line 292) is missing `x-api-key` header → 401

## Store Manager Rule
Never block store-manager speed with extra confirmations/permissions. Instead, log every
mutation to `audit_logs` (via `services/auditService.js`) and alert Admin role on large
adjustments (`stockController.js:alertAdminIfLarge`). See
`docs/architecture/project-design.md` §14 for full flow + backlog.

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
