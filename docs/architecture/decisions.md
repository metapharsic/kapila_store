# Architecture Decision Log — Kapila Inventory

Decisions are recorded here so future contributors (and AI agents) understand
the WHY behind choices. Never delete entries — append only.

---

## [2026-06-07] Single-file MVP → Modular architecture
**Decision:** Start with one `kapila_inventory.jsx` to prove the concept, then
split into modular structure as the feature set grows.
**Reason:** Fast to iterate, zero config, can be dropped into any React scaffold.
**Trade-off:** All state is in `localStorage` — no multi-device sync, no multi-user.
**Next step:** Extract components → add Vite project scaffold → add Express backend.

---

## [2026-06-07] localStorage as initial data store
**Decision:** Use `localStorage` with `kapila_*` keys for MVP persistence.
**Reason:** Zero infrastructure, instant setup, works offline.
**Trade-off:** Data lost on browser clear; no cross-device; no concurrent users.
**Migration path:** Replace `useStorage` hook internals with API calls once backend is ready.

---

## [2026-06-07] Claude API for indent form OCR
**Decision:** Use Claude's vision capability to parse scanned paper indent forms.
**Reason:** Hotel uses handwritten forms; manual re-entry is error-prone and slow.
**Trade-off:** Requires API key, adds latency, costs per scan.
**Constraint:** API key must never be exposed to browser — proxy through backend.

---

## [2026-06-07] Departments are a fixed list
**Decision:** The 6 departments (`South Indian`, `North Indian`, `Continental`,
`Juices`, `Bakery`, `Chinese`) are hardcoded constants, not a DB table.
**Reason:** Hotel structure is stable; dynamic departments add config complexity.
**Trade-off:** Adding a 7th department requires a code change.
**Override:** If departments need to be dynamic, add a `departments` table and
an admin screen — update this decision.

---

## [2026-06-07] No TypeScript in MVP
**Decision:** Plain JSX for now.
**Reason:** Single developer, speed of iteration matters more than type safety.
**Migration:** Add TypeScript when a second developer joins or modules exceed 20 files.

---

## [2026-06-07] SQLite for dev, PostgreSQL for prod
**Decision:** Use `better-sqlite3` locally, switch to `pg` in production.
**Reason:** SQLite needs zero setup; Postgres handles concurrent writes better.
**Implementation:** Abstract DB calls behind `db/index.js` so the swap is transparent.
