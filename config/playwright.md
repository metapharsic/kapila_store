# Playwright

**Version:** @playwright/test ^1.60.0
**Config:** `frontend/playwright.config.js` — `baseURL: http://localhost:8008`, chromium only,
`testDir: ./tests/e2e`
**Run:** `npm run test:e2e` / `test:e2e:ui` / `test:e2e:report` (scripts added this session —
previously no way to run the suite except `npx playwright test` directly)
**Suite: 4 real specs, 6 tests total, all green**

| Spec | Tests | Status |
|---|---|---|
| `auth.spec.js` | valid login, invalid password blocked | **new this session** |
| `e2e.spec.js` | indent→issuance flow, production→EOD flow | rewritten this session |
| `forms.spec.js` | New Stock entry form | pre-existing, already correct |
| `sidebar.spec.js` | nav across all core modules | rewritten this session |

**What's been done:**
- `e2e.spec.js` + (originally) `forms.spec.js` hardcoded login `manager@kapila.local /
  ChangeMe123!` — that account **never existed** in the DB (real accounts:
  `admin@kapila.local`, `store@kapila.com`, `Chef@kapila.com`). These specs likely never passed
  since written. Rewrote against real accounts and real seeded data — had to seed a
  `STF Plain Rice` recipe live via the real `/api/recipes` endpoint specifically so the
  production-planner test had something real to select (confirmed no kafka event fires for
  recipe creation — correct, by design).
- `sidebar.spec.js` was plain CommonJS (`require(...)`) inside an ESM project
  (`"type": "module"` in `package.json`) — crashed immediately with `ReferenceError: require is
  not defined`. Rewrote as ESM import, added real login (previously had none — "Assume login
  happens here" comment, never implemented), fixed nav labels to the real ones (Home/Available
  Stock/Store Issuance/Indent Request — the old spec used generic "Dashboard"/"Stock"/"Indents"
  that don't exist in this app's sidebar).
- New `auth.spec.js` — the one gap with zero coverage before: no dedicated login test existed,
  only embedded logins inside other flows.
- Used disposable, single-purpose debug specs throughout the session (created, run, deleted
  immediately after) to isolate two real bugs down to root cause — never guessed:
  - ALL-checkbox: `page.evaluate(() => document.elementFromPoint(x,y))` to confirm the click
    target was correct, then a temporary `console.log` inside the actual handler to prove it
    was never being called at all, before finding the dropped `onClick` prop.
  - Sufficiency gap: captured the real `POST /api/issuances` response body via
    `page.on('response', ...)`, which surfaced the exact backend rejection message
    ("Insufficient stock for 'BLACK GRAPES'...") that explained why "Issue & Update Stock"
    silently failed after a bulk ALL-confirm.
- 4 leftover `.cjs` debug scripts (`debug-api.cjs`, `debug-console.cjs`, `debug-ui-spa.cjs`,
  `debug-ui.cjs`) exist in the same folder from before this session — not touched, not part of
  the real suite (no `.spec.js` suffix, Playwright doesn't pick them up as tests).
