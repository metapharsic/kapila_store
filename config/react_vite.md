# React + Vite

**React:** ^19.2.6 | **Vite:** ^8.0.12 | **Location:** `frontend/src/`
**Dev server:** port 8008, `npm run dev` (nodemon-equivalent HMR via Vite's own file watcher)
**Role screens:** Admin, Manager, Chef, Employee, Store Manager (5 role-based dashboards, all
routed from one `App.jsx`)

**Files touched this session:**

**`styles/colors.js`** — `STOCK_CATEGORIES` constant patched: added 6 real categories (Bakery,
Chemicals, Dals, Fuel, Ice Cream, Linen) that already existed as live `stock.category` values
in Postgres but weren't in the fixed dropdown list, so they were unselectable in the Add/Edit
Item drawer once assigned. Verified live via Playwright — all 6 now render as `<option>`.

**`screens/Issuance/components/IssuanceItemsGrid.jsx`** — real "ALL checkbox does nothing" bug,
root cause: the local `TH` wrapper component (line 6) destructured only `{ children, style }`
and rendered a plain `<th>`, silently dropping every other prop — including the
`onClick={onToggleAll}` passed at the "ALL" header cell. Zero console errors, zero React
warnings, click just went nowhere. Fixed by spreading `{...rest}` onto the underlying `<th>`.
Found via a debug ladder: screenshot → DOM `elementFromPoint` inspection → console.log inside
the handler itself → confirmed zero calls → traced to the prop drop.

**`screens/Issuance/index.jsx`** — `handleToggleAll` bulk-confirm logic gap: only checked
`avail > 0` (some stock exists at all), not `avail >= requested qty` for that specific line.
Real consequence: bulk-confirming a 35-item indent silently included an insufficient item
(BLACK GRAPES: needed 2kg, had 0.51kg), and the *entire* issuance transaction died at submit
on that one line (backend correctly re-validates and rejects atomically) — costing all 34 good
items too. Fixed by adding an `isSufficient(item, idx)` check matching the row's own existing
red "insufficient" flag logic, so bulk-confirm now silently skips only the genuinely-short
items instead of gambling the whole batch.

**Also discovered along the way (infra, not code):** the frontend dev server on port 8008 was
a zombie process from an earlier, unrelated session — it was serving a stale bundle that never
picked up live edits via HMR, which is why the ALL-checkbox fix initially appeared to "not
work" in manual testing even after the source fix landed. Killed the PID, fresh `npm run dev`
picked up the real code immediately.
