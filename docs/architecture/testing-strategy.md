# Comprehensive Testing Strategy

To ensure Kapila maintains flawless connectivity and stability, we mandate strict testing across all layers: Frontend (UI, Forms, Sidebar), Backend (APIs), and Database (Sync & Triggers).

## 1. Frontend: Playwright End-to-End Tests
All UI tests reside in `frontend/tests/e2e/`.

### Sidebar Navigation (`sidebar.spec.js`)
- Every new module must have a corresponding sidebar entry.
- The Sidebar test must verify that clicking the sidebar item successfully mounts the component, fetches the requisite data without throwing 500/404s, and that the layout doesn't break.

### Form Verification (`forms.spec.js`)
- Critical data entry (e.g., Stock Entry, Indent creation, Production logging) must be tested.
- Tests must input data into the form, submit it, and wait for the success notification/toast, verifying that the table on the screen updates.

## 2. Backend API & Connectivity (Jest + Supertest)
All backend tests reside in `backend/tests/`.

### API Integration Tests
- Every new route created in `backend/routes/` must have a corresponding test file (e.g., `stock.test.js`).
- Tests must verify:
  1. **Connectivity**: The route returns a `200 OK` or appropriate HTTP status.
  2. **Validation**: Submitting bad payloads returns a Zod error `400`.
  3. **Response Schema**: The returned JSON must exactly match the expected schema `{ success: true, data: [...] }`.

## 3. Database Integrity & Object Sync
- Database operations must be tested against a dedicated `kapila_test` database.
- **Trigger Verification**: If a table has an `updated_at` trigger, the test must update a row and assert that the timestamp changed.
- **Transaction/Cascade Verification**: When testing an insertion (e.g., Goods Receipt Note), the test must verify that the `goods_receipt_items` were also correctly inserted and that the total stock in the `stock` table updated in sync.
