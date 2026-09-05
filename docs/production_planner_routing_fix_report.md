# Change Log: Production Planner 404 Routing Fix

**Date:** 14th August 2026
**Issue:** `Server returned non-JSON response. Status: 404` when accessing the Production Planner screen.
**Root Cause:** The backend Express server had mismatched URL route definitions for recipes and menus, causing it to listen on double-prefixed paths (e.g., `/api/recipes/recipes` instead of `/api/recipes`). This resulted in standard 404 HTML fallback responses which broke the frontend JSON parser.

## Summary of Changes

### 1. Created Dedicated Menu Router
**File:** `[NEW] backend/routes/menu.js`
- Separated the menu-related API endpoints from the `recipes.js` file to ensure proper structural decoupling.
- Defined the standard CRUD endpoints (`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`) mapping directly to the `recipeController` methods (`listMenu`, `createMenu`, `updateMenu`, `removeMenu`).

### 2. Fixed Recipe Route Prefixing
**File:** `[MODIFY] backend/routes/recipes.js`
- Removed all `menu` routes (transferred to `menu.js`).
- Stripped the redundant `/recipes` prefix from the HTTP method definitions.
- **Before:** `router.get("/recipes", ...)` -> Resulting URL: `/api/recipes/recipes`
- **After:** `router.get("/", ...)` -> Resulting URL: `/api/recipes`

### 3. Registered the New Router
**File:** `[MODIFY] backend/server.ts`
- Imported and mounted the newly created `menu.js` router to map specifically to `/api/menu`.
- **Code Added:** `app.use("/api/menu", require("./routes/menu"));`

## Verification & Status
- **Backend mapping:** Frontend `api.recipes.list()` and `api.menu.list()` now successfully hit `GET /api/recipes` and `GET /api/menu` directly.
- **Data Integrity:** No backend controller logic or database operations were altered. Only the HTTP routing paths were normalized.
- **Resolution:** The Production Planner screen loads the JSON data safely without triggering an HTML parse exception.
