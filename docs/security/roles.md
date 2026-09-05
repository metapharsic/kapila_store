# RBAC and User Management Implementation

## Purpose

Implement a complete Role-Based Access Control (RBAC) and User Management System across Kapila Inventory. The system must control access at the frontend navigation layer, frontend action layer, backend route layer, service/controller layer, and data-scope layer.

This document is based on the current repository structure:

- Frontend: `frontend/src/App.jsx`, static screen-state navigation, React 19, Vite.
- Frontend API client: `frontend/src/api/client.js` and `frontend/src/api/index.js`.
- Backend: `backend/server.js`, Express routes under `backend/routes`, controllers under `backend/controllers`, Knex migrations under `backend/db/migrations`.
- Current auth state: no authentication middleware, no user context, no session handling, no backend authorization.
- Current identity display: hardcoded `Kapila Admin` in `frontend/src/App.jsx`.

The implementation must be permission-driven. Do not scatter role-name checks like `if (role === "Admin")` across screens and controllers. Roles should only map to permissions in seed/config data. Application logic should check permissions.

## Existing Application Surface

### Frontend Screens

The current navigation in `frontend/src/App.jsx` exposes these screens:

| Screen id | Screen file | Current nav group | Module |
|---|---|---|---|
| `dashboard` | `frontend/src/screens/Dashboard/index.jsx` | General | Dashboard |
| `stock` | `frontend/src/screens/Stock/index.jsx` | Master Data | Stock Master / Inventory |
| `suppliers` | `frontend/src/screens/Suppliers/index.jsx` | Master Data | Supplier Master |
| `departments` | `frontend/src/screens/Departments/index.jsx` | Master Data | Department Master |
| `pos` | `frontend/src/screens/PurchaseOrders/index.jsx` | Procurement | Purchase Orders |
| `grn` | `frontend/src/screens/GoodsReceipt/index.jsx` | Procurement | Goods Receipt Notes |
| `reorder` | `frontend/src/screens/ReorderPoints/index.jsx` | Procurement | Reorder Points |
| `reconcile` | `frontend/src/screens/Reconciliation/index.jsx` | Store Management | Reconciliation |
| `transfers` | `frontend/src/screens/Transfers/index.jsx` | Store Management | Stock Transfers |
| `menu_planner` | `frontend/src/screens/MenuPlanner/index.jsx` | Kitchen & Depts | Menu Planner |
| `indent` | `frontend/src/screens/Indent/index.jsx` | Kitchen & Depts | Indent Requests |
| `issuance` | `frontend/src/screens/Issuance/index.jsx` | Kitchen & Depts | Store Issuance |
| `production` | `frontend/src/screens/Production/index.jsx` | Kitchen & Depts | Production Logs |
| `leftover` | `frontend/src/screens/Leftovers/index.jsx` | Kitchen & Depts | Leftover Logs |
| `waste_analytics` | `frontend/src/screens/WasteAnalytics/index.jsx` | Kitchen & Depts | Waste Analytics |

Add:

| Screen id | Screen file | Nav group | Module |
|---|---|---|---|
| `users` | `frontend/src/screens/UserManagement/index.jsx` | Administration | User Management |
| `audit_logs` | `frontend/src/screens/AuditLogs/index.jsx` | Administration | Audit Logs |
| `settings` | future | Administration | System Settings |

### Backend Routes

Current backend routes from `backend/server.js`:

| Route prefix | Route file | Main resource |
|---|---|---|
| `/api/stock` | `backend/routes/stock.js` | stock, ledger, insights, reconciliation |
| `/api/indents` | `backend/routes/indents.js` | indents |
| `/api/issuances` | `backend/routes/issuances.js` | issuances |
| `/api/production` | `backend/routes/production.js` | production |
| `/api/leftovers` | `backend/routes/leftovers.js` | leftovers |
| `/api/dashboard` | `backend/routes/dashboard.js` | dashboards, analytics, procurement summary |
| `/api/search` | `backend/routes/search.js` | global search |
| `/api/scan` | `backend/routes/scan.js` | OCR and text scan |
| `/api/suppliers` | `backend/routes/suppliers.js` | supplier master and performance |
| `/api/departments` | `backend/routes/departments.js` | departments and department item list |
| `/api/purchase-orders` | `backend/routes/purchaseOrders.js` | purchase orders |
| `/api/grn` | `backend/routes/grn.js` | goods receipt notes |
| `/api/transfers` | `backend/routes/transfers.js` | stock transfers |
| `/api/reorder-points` | `backend/routes/reorderPoints.js` | reorder point rules and alerts |
| `/api/approved-delivery` | `backend/routes/approvedDelivery.js` | supplier document scan and commit |
| `/api/recipes`, `/api/menu` | `backend/routes/recipes.js` | recipes and menu plans |
| `/api/health` | `backend/server.js` | health check |
| `/api/ai-health` | `backend/server.js` | local AI health |

Add:

| Route prefix | Route file | Main resource |
|---|---|---|
| `/api/auth` | `backend/routes/auth.js` | login, logout, session, refresh, password change |
| `/api/users` | `backend/routes/users.js` | user management |
| `/api/roles` | `backend/routes/roles.js` | role and permission management |
| `/api/permissions` | `backend/routes/permissions.js` | permission catalog |
| `/api/audit-logs` | `backend/routes/auditLogs.js` | audit trail |

### Current Data Model

Current migrations define these business tables:

- `stock`
- `stock_adjustments`
- `indents`
- `indent_items`
- `issuances`
- `issuance_items`
- `production`
- `leftovers`
- `suppliers`
- `purchase_orders`
- `purchase_order_items`
- `goods_receipt_notes`
- `goods_receipt_items`
- `stock_transfers`
- `stock_transfer_items`
- `reorder_points`
- `departments`
- `recipes`
- `recipe_items`
- `menu_plans`

No existing table records `created_by`, `updated_by`, `approved_by`, `deactivated_by`, or `department_id` ownership consistently. RBAC must be introduced with new identity tables first, then user attribution can be added to business tables incrementally.

## Role Model

### Primary Roles

| Role | Intent | Default data scope |
|---|---|---|
| Admin | Full unrestricted system ownership | All departments, all records |
| Manager | Operational oversight, approvals, reporting, procurement monitoring | Assigned departments and assigned responsibilities |
| Chef | Kitchen workflows, recipes, stock consumption, indents, production, leftovers | Assigned departments |
| Employee | Daily task execution only | Assigned departments and assigned tasks |

### Additional System Concepts

The primary roles above are enough for launch, but the architecture must allow future roles without code changes. Likely future roles:

- Storekeeper
- Auditor
- Purchaser
- Department Head
- Viewer

Do not encode these future roles yet. Ensure the DB and permission checks support them.

## Permission Naming Convention

Use resource/action permission keys:

```text
resource.action
```

Examples:

- `stock.view`
- `stock.create`
- `stock.edit`
- `stock.delete`
- `stock.export`
- `purchase_orders.approve`
- `users.manage`
- `audit_logs.view`

Actions:

| Action | Meaning |
|---|---|
| `view` | Read list/detail/dashboard data |
| `create` | Create a new record |
| `edit` | Update an existing record |
| `delete` | Delete or hard remove a record |
| `approve` | Approve, accept, issue, receive, cancel, reject, or status-change controlled workflow records |
| `export` | Export data to CSV/PDF/printable report |
| `manage` | Full administrative control for that resource |
| `scan` | Execute OCR/AI extraction |
| `reset_password` | Reset another user's password |
| `activate` | Activate/deactivate users or settings |

## Permission Matrix

Legend:

- `All`: all records.
- `Dept`: only assigned departments.
- `Own`: records created by the user or assigned to the user.
- `No`: no permission.
- `Yes`: allowed without extra scope restriction.

### Module-Level Matrix

| Module | Permission | Admin | Manager | Chef | Employee |
|---|---|---:|---:|---:|---:|
| Dashboard | `dashboard.view` | All | Dept | Dept | Own |
| Dashboard | `dashboard.export` | Yes | Yes | No | No |
| User Management | `users.view` | All | No | No | No |
| User Management | `users.create` | Yes | No | No | No |
| User Management | `users.edit` | Yes | No | No | No |
| User Management | `users.activate` | Yes | No | No | No |
| User Management | `users.reset_password` | Yes | No | No | No |
| User Management | `users.manage_roles` | Yes | No | No | No |
| Roles | `roles.view` | Yes | No | No | No |
| Roles | `roles.manage` | Yes | No | No | No |
| Permissions | `permissions.view` | Yes | No | No | No |
| Permissions | `permissions.manage` | Yes | No | No | No |
| Audit Logs | `audit_logs.view` | All | Dept | No | No |
| Audit Logs | `audit_logs.export` | Yes | Yes | No | No |
| Stock Master | `stock.view` | All | All | Dept | Limited |
| Stock Master | `stock.create` | Yes | Yes | No | No |
| Stock Master | `stock.edit` | Yes | Yes | No | No |
| Stock Master | `stock.delete` | Yes | No | No | No |
| Stock Master | `stock.export` | Yes | Yes | No | No |
| Stock Master | `stock.reconcile` | Yes | Yes | No | No |
| Stock Master | `stock.scan` | Yes | Yes | No | No |
| Suppliers | `suppliers.view` | All | Yes | No | No |
| Suppliers | `suppliers.create` | Yes | Yes | No | No |
| Suppliers | `suppliers.edit` | Yes | Yes | No | No |
| Suppliers | `suppliers.delete` | Yes | No | No | No |
| Suppliers | `suppliers.export` | Yes | Yes | No | No |
| Departments | `departments.view` | All | Dept | Dept | Dept |
| Departments | `departments.create` | Yes | No | No | No |
| Departments | `departments.edit` | Yes | No | No | No |
| Departments | `departments.delete` | Yes | No | No | No |
| Purchase Orders | `purchase_orders.view` | All | Yes | No | No |
| Purchase Orders | `purchase_orders.create` | Yes | Yes | No | No |
| Purchase Orders | `purchase_orders.edit` | Yes | Yes | No | No |
| Purchase Orders | `purchase_orders.delete` | Yes | No | No | No |
| Purchase Orders | `purchase_orders.approve` | Yes | Yes | No | No |
| Purchase Orders | `purchase_orders.export` | Yes | Yes | No | No |
| Goods Receipt | `grn.view` | All | Yes | No | No |
| Goods Receipt | `grn.create` | Yes | Yes | No | No |
| Goods Receipt | `grn.delete` | Yes | No | No | No |
| Goods Receipt | `grn.scan` | Yes | Yes | No | No |
| Reorder Points | `reorder_points.view` | All | Yes | No | No |
| Reorder Points | `reorder_points.create` | Yes | Yes | No | No |
| Reorder Points | `reorder_points.edit` | Yes | Yes | No | No |
| Reorder Points | `reorder_points.delete` | Yes | No | No | No |
| Reorder Points | `reorder_points.approve` | Yes | Yes | No | No |
| Reconciliation | `reconciliation.view` | All | Yes | No | No |
| Reconciliation | `reconciliation.create` | Yes | Yes | No | No |
| Reconciliation | `reconciliation.approve` | Yes | Yes | No | No |
| Transfers | `transfers.view` | All | Dept | Dept | Own |
| Transfers | `transfers.create` | Yes | Yes | Yes | Own |
| Transfers | `transfers.approve` | Yes | Yes | No | No |
| Transfers | `transfers.delete` | Yes | No | No | No |
| Menu Planner | `menu.view` | All | Dept | Dept | Dept |
| Menu Planner | `menu.create` | Yes | Yes | Yes | No |
| Menu Planner | `menu.edit` | Yes | Yes | Yes | No |
| Menu Planner | `menu.delete` | Yes | No | No | No |
| Recipes | `recipes.view` | All | Yes | Yes | Limited |
| Recipes | `recipes.create` | Yes | Yes | Yes | No |
| Recipes | `recipes.edit` | Yes | Yes | Yes | No |
| Recipes | `recipes.delete` | Yes | No | No | No |
| Indents | `indents.view` | All | Dept | Dept | Own |
| Indents | `indents.create` | Yes | Yes | Yes | Yes |
| Indents | `indents.edit` | Yes | Yes | Dept | Own pending only |
| Indents | `indents.approve` | Yes | Yes | No | No |
| Indents | `indents.export` | Yes | Yes | No | No |
| Issuance | `issuances.view` | All | Dept | Dept | Own |
| Issuance | `issuances.create` | Yes | Yes | No | No |
| Issuance | `issuances.scan` | Yes | Yes | No | No |
| Issuance | `issuances.export` | Yes | Yes | No | No |
| Production | `production.view` | All | Dept | Dept | Own |
| Production | `production.create` | Yes | Yes | Yes | Yes |
| Production | `production.edit` | Yes | Yes | Dept | Own same day |
| Production | `production.delete` | Yes | No | No | No |
| Leftovers | `leftovers.view` | All | Dept | Dept | Own |
| Leftovers | `leftovers.create` | Yes | Yes | Yes | Yes |
| Leftovers | `leftovers.edit` | Yes | Yes | Dept | Own same day |
| Leftovers | `leftovers.delete` | Yes | No | No | No |
| Waste Analytics | `waste_analytics.view` | All | Dept | Dept | No |
| Waste Analytics | `waste_analytics.export` | Yes | Yes | No | No |
| Global Search | `search.view` | All | Allowed modules | Allowed modules | Allowed modules |
| AI Scan | `scan.indent` | Yes | Yes | No | No |
| AI Scan | `scan.purchase` | Yes | Yes | No | No |
| AI Scan | `scan.text` | Yes | Yes | Limited | No |
| Approved Delivery | `approved_delivery.scan` | Yes | Yes | No | No |
| Approved Delivery | `approved_delivery.commit` | Yes | Yes | No | No |
| Settings | `settings.view` | Yes | No | No | No |
| Settings | `settings.manage` | Yes | No | No | No |

### Navigation Mapping

Each nav item must include `permission` and optional `scope` metadata:

| Screen id | Required permission |
|---|---|
| `dashboard` | `dashboard.view` |
| `stock` | `stock.view` |
| `suppliers` | `suppliers.view` |
| `departments` | `departments.view` |
| `pos` | `purchase_orders.view` |
| `grn` | `grn.view` |
| `reorder` | `reorder_points.view` |
| `reconcile` | `reconciliation.view` |
| `transfers` | `transfers.view` |
| `menu_planner` | `menu.view` |
| `indent` | `indents.view` |
| `issuance` | `issuances.view` |
| `production` | `production.view` |
| `leftover` | `leftovers.view` |
| `waste_analytics` | `waste_analytics.view` |
| `users` | `users.view` |
| `audit_logs` | `audit_logs.view` |

## Database Design

Create a new migration after `016_create_recipes_and_menu.js`, for example:

```text
backend/db/migrations/017_create_auth_rbac_audit.js
```

### Tables

#### users

```js
await knex.schema.createTable("users", (t) => {
  t.increments("id").primary();
  t.string("employee_code", 50).unique().nullable();
  t.string("name", 120).notNullable();
  t.string("email", 160).unique().notNullable();
  t.string("phone", 30).nullable();
  t.string("password_hash", 255).notNullable();
  t.boolean("is_active").notNullable().defaultTo(true);
  t.boolean("must_change_password").notNullable().defaultTo(true);
  t.timestamp("last_login_at").nullable();
  t.timestamp("password_changed_at").nullable();
  t.integer("created_by").references("id").inTable("users").onDelete("SET NULL").nullable();
  t.integer("updated_by").references("id").inTable("users").onDelete("SET NULL").nullable();
  t.timestamps(true, true);
  t.index(["email"], "idx_users_email");
  t.index(["is_active"], "idx_users_active");
});
```

#### roles

```js
await knex.schema.createTable("roles", (t) => {
  t.increments("id").primary();
  t.string("key", 60).unique().notNullable();
  t.string("name", 100).notNullable();
  t.text("description").nullable();
  t.boolean("is_system").notNullable().defaultTo(false);
  t.boolean("is_active").notNullable().defaultTo(true);
  t.timestamps(true, true);
});
```

Seed system roles:

- `admin`
- `manager`
- `chef`
- `employee`

#### permissions

```js
await knex.schema.createTable("permissions", (t) => {
  t.increments("id").primary();
  t.string("key", 100).unique().notNullable();
  t.string("resource", 80).notNullable();
  t.string("action", 40).notNullable();
  t.string("label", 120).notNullable();
  t.text("description").nullable();
  t.timestamps(true, true);
  t.index(["resource", "action"], "idx_permissions_resource_action");
});
```

#### role_permissions

```js
await knex.schema.createTable("role_permissions", (t) => {
  t.increments("id").primary();
  t.integer("role_id").references("id").inTable("roles").onDelete("CASCADE").notNullable();
  t.integer("permission_id").references("id").inTable("permissions").onDelete("CASCADE").notNullable();
  t.unique(["role_id", "permission_id"]);
});
```

#### user_roles

Users can have multiple roles. A multi-role user receives the union of all active role permissions.

```js
await knex.schema.createTable("user_roles", (t) => {
  t.increments("id").primary();
  t.integer("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
  t.integer("role_id").references("id").inTable("roles").onDelete("RESTRICT").notNullable();
  t.unique(["user_id", "role_id"]);
});
```

#### user_departments

Department scope is controlled separately from permissions.

```js
await knex.schema.createTable("user_departments", (t) => {
  t.increments("id").primary();
  t.integer("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
  t.integer("department_id").references("id").inTable("departments").onDelete("CASCADE").notNullable();
  t.unique(["user_id", "department_id"]);
});
```

#### refresh_tokens

Use short-lived access tokens and rotating refresh tokens. Store only token hashes.

```js
await knex.schema.createTable("refresh_tokens", (t) => {
  t.increments("id").primary();
  t.integer("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
  t.string("token_hash", 255).unique().notNullable();
  t.timestamp("expires_at").notNullable();
  t.timestamp("revoked_at").nullable();
  t.string("created_ip", 80).nullable();
  t.string("user_agent", 500).nullable();
  t.timestamps(true, true);
  t.index(["user_id"], "idx_refresh_tokens_user");
  t.index(["expires_at"], "idx_refresh_tokens_expiry");
});
```

#### password_reset_tokens

```js
await knex.schema.createTable("password_reset_tokens", (t) => {
  t.increments("id").primary();
  t.integer("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
  t.string("token_hash", 255).unique().notNullable();
  t.timestamp("expires_at").notNullable();
  t.timestamp("used_at").nullable();
  t.integer("created_by").references("id").inTable("users").onDelete("SET NULL").nullable();
  t.timestamps(true, true);
});
```

#### audit_logs

```js
await knex.schema.createTable("audit_logs", (t) => {
  t.increments("id").primary();
  t.integer("actor_user_id").references("id").inTable("users").onDelete("SET NULL").nullable();
  t.string("actor_name", 120).nullable();
  t.string("action", 80).notNullable();
  t.string("resource", 80).notNullable();
  t.string("resource_id", 80).nullable();
  t.integer("department_id").references("id").inTable("departments").onDelete("SET NULL").nullable();
  t.string("department_name", 120).nullable();
  t.jsonb("before").nullable();
  t.jsonb("after").nullable();
  t.jsonb("metadata").nullable();
  t.string("ip_address", 80).nullable();
  t.string("user_agent", 500).nullable();
  t.timestamp("created_at").defaultTo(knex.fn.now());
  t.index(["actor_user_id"], "idx_audit_actor");
  t.index(["resource", "resource_id"], "idx_audit_resource");
  t.index(["action"], "idx_audit_action");
  t.index(["created_at"], "idx_audit_created");
});
```

Use `json` instead of `jsonb` if SQLite support is reintroduced.

### Business Table Attribution

Add a follow-up migration after RBAC is stable:

- `created_by`
- `updated_by`
- `deleted_by` only if soft delete is introduced.
- `approved_by` and `approved_at` for workflow tables.

High-priority tables:

- `stock`
- `stock_adjustments`
- `indents`
- `issuances`
- `production`
- `leftovers`
- `purchase_orders`
- `goods_receipt_notes`
- `stock_transfers`
- `reorder_points`
- `menu_plans`

## Backend Architecture

### New Backend Files

Add these files:

```text
backend/config/permissions.js
backend/middleware/auth.js
backend/middleware/authorize.js
backend/middleware/audit.js
backend/routes/auth.js
backend/routes/users.js
backend/routes/roles.js
backend/routes/permissions.js
backend/routes/auditLogs.js
backend/controllers/authController.js
backend/controllers/userController.js
backend/controllers/roleController.js
backend/controllers/permissionController.js
backend/controllers/auditLogController.js
backend/services/authService.js
backend/services/passwordService.js
backend/services/permissionService.js
backend/services/auditService.js
```

Install backend dependencies:

```bash
cd backend
npm install bcryptjs jsonwebtoken cookie-parser helmet express-rate-limit
```

Recommended security dependencies:

- `bcryptjs`: password hashing.
- `jsonwebtoken`: JWT access tokens.
- `cookie-parser`: refresh token cookie parsing.
- `helmet`: secure HTTP headers.
- `express-rate-limit`: throttle auth endpoints.

### Permission Catalog

Create `backend/config/permissions.js` as the single source for seedable permission keys.

The file should export:

```js
const PERMISSIONS = [
  { key: "dashboard.view", resource: "dashboard", action: "view", label: "View dashboard" },
  { key: "stock.view", resource: "stock", action: "view", label: "View stock" },
  { key: "stock.create", resource: "stock", action: "create", label: "Create stock" },
];

const ROLE_PERMISSION_KEYS = {
  admin: PERMISSIONS.map((p) => p.key),
  manager: [
    "dashboard.view",
    "stock.view",
    "stock.create",
    "stock.edit",
  ],
  chef: [
    "dashboard.view",
    "indents.view",
    "indents.create",
  ],
  employee: [
    "dashboard.view",
    "indents.create",
  ],
};

module.exports = { PERMISSIONS, ROLE_PERMISSION_KEYS };
```

Seed from this config to avoid drift between DB and code.

### Authentication Flow

Use JWT access tokens plus rotating refresh tokens:

1. `POST /api/auth/login`
   - Body: `{ email, password }`
   - Validate active user.
   - Compare password with `bcrypt`.
   - Load roles, permissions, department ids.
   - Issue short-lived access token, for example 15 minutes.
   - Issue refresh token as `httpOnly`, `secure` in production, `sameSite: "strict"` cookie.
   - Write `login` audit event.
   - Update `users.last_login_at`.

2. `POST /api/auth/refresh`
   - Read refresh cookie.
   - Hash token and validate not expired/revoked.
   - Rotate refresh token.
   - Return new access token and user payload.

3. `GET /api/auth/me`
   - Requires valid access token.
   - Return user profile, roles, permissions, departments.

4. `POST /api/auth/logout`
   - Revoke current refresh token.
   - Clear cookie.
   - Write `logout` audit event.

5. `POST /api/auth/change-password`
   - Requires current password unless `must_change_password` flow is active.
   - Hash new password.
   - Revoke all refresh tokens for user.
   - Write audit event.

### Access Token Payload

Keep token compact:

```json
{
  "sub": "12",
  "email": "admin@kapila.local",
  "roles": ["admin"],
  "iat": 1710000000,
  "exp": 1710000900
}
```

Do not store the complete permission list in long-lived tokens. Load permissions in middleware or cache them briefly per request lifecycle. If performance requires it, include a permission version claim and invalidate tokens when role mappings change.

### Auth Middleware

`backend/middleware/auth.js`:

- Parse `Authorization: Bearer <token>`.
- Verify JWT with `JWT_SECRET`.
- Load user from DB.
- Reject inactive users.
- Attach:

```js
req.user = {
  id,
  name,
  email,
  roles,
  permissions: Set,
  departmentIds,
  isAdmin
};
```

Responses:

- `401` for missing/invalid/expired token.
- `403` for authenticated but unauthorized users.

### Authorization Middleware

`backend/middleware/authorize.js`:

```js
function requirePermission(permissionKey, options = {}) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: "Authentication required" });
    if (!req.user.permissions.has(permissionKey)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    req.requiredPermission = permissionKey;
    req.permissionScope = options.scope || null;
    next();
  };
}
```

Add helpers:

- `requireAnyPermission([...keys])`
- `requireAllPermissions([...keys])`
- `filterByDepartmentScope(query, columnName = "dept")`
- `assertDepartmentScope(req, deptNameOrId)`

### Department Scope Enforcement

Permissions say what a user can do. Department scope says which records they can do it to.

Rules:

- Admin bypasses scope.
- Manager, Chef, and Employee must be restricted to `user_departments`.
- For list APIs, apply query filters server-side. Do not trust frontend filters.
- For create/update APIs, validate the submitted department is within `req.user.departmentIds`, unless Admin.
- For resources without department columns, use explicit module-level rules:
  - Suppliers and purchase orders are Manager/Admin only.
  - Stock is all-store by default for Admin/Manager, limited read-only summaries for Chef.
  - Employee stock read should be limited to stock availability endpoints needed for assigned work.

Department name mismatch must be resolved. `AGENTS.md` lists six fixed departments, while migration `015_create_departments.js` seeds nine operational departments. Before production RBAC, normalize departments to database-driven records and update validation to read department names from `departments`.

### Route Protection Map

Apply `authenticate` globally before protected `/api` routes, except health and login endpoints.

In `backend/server.js`:

```js
app.use("/api/auth", require("./routes/auth"));
app.get("/api/health", ...);

app.use("/api", authenticate);

app.use("/api/stock", require("./routes/stock"));
```

Route-level permissions:

| Method | Path | Permission |
|---|---|---|
| GET | `/api/stock` | `stock.view` |
| GET | `/api/stock/ledger` | `stock.view` |
| GET | `/api/stock/insights` | `stock.view` |
| GET | `/api/stock/available` | `stock.view` or `indents.create` or `issuances.create` |
| POST | `/api/stock` | `stock.create` |
| POST | `/api/stock/reconcile` | `stock.reconcile` |
| PATCH | `/api/stock/:id` | `stock.edit` |
| DELETE | `/api/stock/:id` | `stock.delete` |
| GET | `/api/indents` | `indents.view` |
| POST | `/api/indents` | `indents.create` |
| PATCH | `/api/indents/:id` | `indents.approve` or `indents.edit` based on status/body |
| GET | `/api/issuances` | `issuances.view` |
| POST | `/api/issuances` | `issuances.create` |
| GET | `/api/production` | `production.view` |
| POST | `/api/production` | `production.create` |
| GET | `/api/leftovers` | `leftovers.view` |
| POST | `/api/leftovers` | `leftovers.create` |
| GET | `/api/dashboard` | `dashboard.view` |
| GET | `/api/dashboard/analytics` | `dashboard.view` |
| GET | `/api/dashboard/procurement` | `purchase_orders.view` |
| GET | `/api/search` | `search.view` |
| POST | `/api/scan/indent` | `scan.indent` |
| POST | `/api/scan/purchase` | `scan.purchase` |
| POST | `/api/scan/text` | `scan.text` |
| GET | `/api/suppliers` | `suppliers.view` |
| GET | `/api/suppliers/:id/performance` | `suppliers.view` |
| POST | `/api/suppliers` | `suppliers.create` |
| PATCH | `/api/suppliers/:id` | `suppliers.edit` |
| DELETE | `/api/suppliers/:id` | `suppliers.delete` |
| GET | `/api/departments` | `departments.view` |
| GET | `/api/departments/items` | `departments.view` or `indents.create` |
| POST | `/api/departments` | `departments.create` |
| PATCH | `/api/departments/:id` | `departments.edit` |
| DELETE | `/api/departments/:id` | `departments.delete` |
| GET | `/api/purchase-orders` | `purchase_orders.view` |
| GET | `/api/purchase-orders/:id` | `purchase_orders.view` |
| POST | `/api/purchase-orders` | `purchase_orders.create` |
| POST | `/api/purchase-orders/auto-draft` | `purchase_orders.create` |
| PATCH | `/api/purchase-orders/:id` | `purchase_orders.edit` or `purchase_orders.approve` for status changes |
| DELETE | `/api/purchase-orders/:id` | `purchase_orders.delete` |
| GET | `/api/grn` | `grn.view` |
| GET | `/api/grn/:id` | `grn.view` |
| POST | `/api/grn` | `grn.create` |
| DELETE | `/api/grn/:id` | `grn.delete` |
| GET | `/api/transfers` | `transfers.view` |
| GET | `/api/transfers/:id` | `transfers.view` |
| POST | `/api/transfers` | `transfers.create` |
| PATCH | `/api/transfers/:id/accept` | `transfers.approve` |
| PATCH | `/api/transfers/:id/reject` | `transfers.approve` |
| DELETE | `/api/transfers/:id` | `transfers.delete` |
| GET | `/api/reorder-points/alerts` | `reorder_points.view` |
| GET | `/api/reorder-points` | `reorder_points.view` |
| POST | `/api/reorder-points` | `reorder_points.create` |
| PATCH | `/api/reorder-points/:id` | `reorder_points.edit` |
| DELETE | `/api/reorder-points/:id` | `reorder_points.delete` |
| POST | `/api/approved-delivery/scan` | `approved_delivery.scan` |
| POST | `/api/approved-delivery/commit` | `approved_delivery.commit` |
| GET | `/api/recipes` | `recipes.view` |
| GET | `/api/menu` | `menu.view` |
| POST | `/api/menu` | `menu.create` |
| PATCH | `/api/menu/:id` | `menu.edit` |
| DELETE | `/api/menu/:id` | `menu.delete` |
| GET | `/api/users` | `users.view` |
| POST | `/api/users` | `users.create` |
| PATCH | `/api/users/:id` | `users.edit` |
| PATCH | `/api/users/:id/activate` | `users.activate` |
| POST | `/api/users/:id/reset-password` | `users.reset_password` |
| GET | `/api/users/:id/activity` | `users.view` |
| GET | `/api/roles` | `roles.view` |
| POST | `/api/roles` | `roles.manage` |
| PATCH | `/api/roles/:id` | `roles.manage` |
| DELETE | `/api/roles/:id` | `roles.manage` |
| GET | `/api/permissions` | `permissions.view` |
| GET | `/api/audit-logs` | `audit_logs.view` |
| GET | `/api/audit-logs/export` | `audit_logs.export` |

### User Management API

#### `GET /api/users`

Permission: `users.view`

Query params:

- `q`
- `role`
- `department_id`
- `is_active`
- `page`
- `limit`
- `sort`
- `order`

Response fields:

```json
{
  "id": 1,
  "employee_code": "KPL-001",
  "name": "Admin",
  "email": "admin@kapila.local",
  "phone": null,
  "is_active": true,
  "roles": ["admin"],
  "departments": [],
  "last_login_at": "2026-06-11T10:00:00.000Z",
  "created_at": "2026-06-11T09:00:00.000Z"
}
```

Never return `password_hash`.

#### `POST /api/users`

Permission: `users.create`

Body:

```json
{
  "employee_code": "KPL-009",
  "name": "Chef Name",
  "email": "chef@kapila.local",
  "phone": "9999999999",
  "temporary_password": "ChangeMe123!",
  "role_ids": [3],
  "department_ids": [1, 2],
  "is_active": true
}
```

Rules:

- Hash password.
- Set `must_change_password = true`.
- Validate role ids and department ids exist.
- Write `user.create` audit event.

#### `PATCH /api/users/:id`

Permission: `users.edit`

Editable:

- `name`
- `phone`
- `role_ids`
- `department_ids`
- `is_active`

Not editable here:

- Password. Use reset password route.
- Email unless product explicitly permits it.

Write `user.update`, `role.assign`, and `department.assign` audit events as appropriate.

#### `PATCH /api/users/:id/activate`

Permission: `users.activate`

Body:

```json
{ "is_active": false }
```

Rules:

- Prevent an Admin from deactivating their own last active admin account.
- Revoke refresh tokens when deactivating.
- Write audit event.

#### `POST /api/users/:id/reset-password`

Permission: `users.reset_password`

Body:

```json
{ "temporary_password": "NewTemp123!" }
```

Rules:

- Set `must_change_password = true`.
- Revoke all existing refresh tokens.
- Write audit event.

#### `GET /api/users/:id/activity`

Permission: `users.view`

Returns audit logs for that user.

## Audit Tracking

Track these events:

| Event | Action key |
|---|---|
| Login | `auth.login` |
| Logout | `auth.logout` |
| Failed login | `auth.login_failed` |
| Password changed | `auth.password_changed` |
| Password reset by admin | `users.password_reset` |
| User created | `users.create` |
| User updated | `users.update` |
| User activated/deactivated | `users.activate` / `users.deactivate` |
| Role assigned/removed | `users.roles_update` |
| Permission changed | `roles.permissions_update` |
| Stock created/updated/deleted | `stock.create` / `stock.edit` / `stock.delete` |
| Stock reconciled | `stock.reconcile` |
| Indent created/status changed | `indents.create` / `indents.status_change` |
| Issuance created | `issuances.create` |
| Production logged | `production.create` |
| Leftover logged | `leftovers.create` |
| Supplier created/updated/deleted | `suppliers.create` / `suppliers.edit` / `suppliers.delete` |
| Purchase order created/updated/cancelled | `purchase_orders.create` / `purchase_orders.edit` / `purchase_orders.status_change` |
| GRN created/deleted | `grn.create` / `grn.delete` |
| Transfer created/accepted/rejected/deleted | `transfers.create` / `transfers.accept` / `transfers.reject` / `transfers.delete` |
| Reorder point created/updated/deleted | `reorder_points.create` / `reorder_points.edit` / `reorder_points.delete` |
| AI scan executed | `scan.indent` / `scan.purchase` / `scan.text` |
| Export generated | `*.export` |

Audit service contract:

```js
await auditLog(req, {
  action: "stock.create",
  resource: "stock",
  resourceId: stock.id,
  departmentId: null,
  before: null,
  after: stock,
  metadata: { source: "manual" }
});
```

Do not block critical business operations solely because audit logging fails. Log audit errors server-side and return success for the business transaction if the transaction committed. For user/role/permission changes, prefer wrapping the business update and audit write in one transaction.

## Frontend Architecture

### New Frontend Files

Add:

```text
frontend/src/auth/permissions.js
frontend/src/context/AuthContext.jsx
frontend/src/components/PermissionGate.jsx
frontend/src/components/ProtectedScreen.jsx
frontend/src/screens/Login/index.jsx
frontend/src/screens/UserManagement/index.jsx
frontend/src/screens/AuditLogs/index.jsx
```

Optional later:

```text
frontend/src/screens/Profile/index.jsx
frontend/src/screens/ChangePassword/index.jsx
frontend/src/hooks/usePermission.js
```

### API Client Changes

Update `frontend/src/api/client.js`:

- Store access token in memory, not localStorage, if possible.
- Attach `Authorization: Bearer <accessToken>` to all API requests.
- Send credentials for refresh-cookie flow:

```js
credentials: "include"
```

- On `401`, try `/api/auth/refresh` once, then retry the original request.
- On refresh failure, clear auth state and show login.
- Keep localStorage keys namespaced if any persistent auth metadata is stored, for example `kapila_auth_user`.

Do not store refresh tokens in localStorage.

### Auth Context

`AuthContext` should expose:

```js
{
  user,
  roles,
  permissions,
  departments,
  isAuthenticated,
  loading,
  login,
  logout,
  refreshSession,
  hasPermission,
  hasAnyPermission,
  canAccessDepartment
}
```

`hasPermission("stock.create")` should return a boolean based on permissions from `/api/auth/me`.

### Permission Gate

Use a reusable gate around UI actions:

```jsx
<PermissionGate permission="stock.create">
  <Btn onClick={add}>Add to Store</Btn>
</PermissionGate>
```

For fallback:

```jsx
<PermissionGate permission="stock.create" fallback={null}>
  ...
</PermissionGate>
```

The gate controls visibility only. Backend still enforces permission.

### Protected Screen

Before rendering a screen:

```jsx
<ProtectedScreen permission="stock.view">
  <StockScreen />
</ProtectedScreen>
```

If denied:

- Do not render the screen.
- Show a compact forbidden page with no sensitive data.
- Redirect to the first authorized dashboard/screen if the user navigated through stale state.

### Dynamic Navigation

Refactor `NAV_CATEGORIES` in `frontend/src/App.jsx`:

```js
const NAV_CATEGORIES = [
  {
    title: "General",
    items: [
      { id: "dashboard", label: "Dashboard", permission: "dashboard.view", icon: <LayoutDashboard size={16} /> },
    ],
  },
];
```

Filter at render:

```js
const visibleNavCategories = NAV_CATEGORIES
  .map((cat) => ({ ...cat, items: cat.items.filter((item) => hasPermission(item.permission)) }))
  .filter((cat) => cat.items.length > 0);
```

If `currentScreen` becomes unauthorized after login/role change, set it to the first visible screen.

### Action-Level Gates By Screen

Implement these gates:

| Screen | UI action | Permission |
|---|---|---|
| Stock | Add to Store | `stock.create` |
| Stock | Scan bill / quick import | `stock.scan` |
| Stock | Adjust quantity | `stock.edit` |
| Stock | Delete item | `stock.delete` |
| Stock | Export CSV | `stock.export` |
| Stock | Copy/WhatsApp PO | `purchase_orders.create` |
| Suppliers | Add supplier | `suppliers.create` |
| Suppliers | Edit supplier | `suppliers.edit` |
| Suppliers | Delete supplier | `suppliers.delete` |
| Suppliers | Generate auto draft PO | `purchase_orders.create` |
| Departments | Add department | `departments.create` |
| Departments | Edit department | `departments.edit` |
| Departments | Delete department | `departments.delete` |
| Purchase Orders | New PO | `purchase_orders.create` |
| Purchase Orders | Edit PO | `purchase_orders.edit` |
| Purchase Orders | Status change | `purchase_orders.approve` |
| Purchase Orders | Delete PO | `purchase_orders.delete` |
| Goods Receipt | Upload supplier doc | `grn.scan` |
| Goods Receipt | New GRN | `grn.create` |
| Goods Receipt | Delete GRN | `grn.delete` |
| Reorder Points | Add rule | `reorder_points.create` |
| Reorder Points | Edit/toggle active | `reorder_points.edit` |
| Reorder Points | Draft PO | `purchase_orders.create` |
| Reorder Points | Delete rule | `reorder_points.delete` |
| Transfers | New transfer | `transfers.create` |
| Transfers | Accept/reject | `transfers.approve` |
| Transfers | Delete transfer | `transfers.delete` |
| Menu Planner | Create plan | `menu.create` |
| Menu Planner | Edit plan | `menu.edit` |
| Menu Planner | Delete plan | `menu.delete` |
| Indent | Submit indent | `indents.create` |
| Indent | Edit status | `indents.approve` |
| Indent | Smart autofill / stock availability | `indents.create` |
| Issuance | Scan form | `issuances.scan` |
| Issuance | Issue and update stock | `issuances.create` |
| Production | Log production | `production.create` |
| Leftovers | Log leftovers | `leftovers.create` |
| Waste Analytics | Export | `waste_analytics.export` |
| Dashboard | Export/report buttons | `dashboard.export` |

### Role-Specific Dashboards

Keep one `Dashboard` screen, but compute cards/widgets from permissions and data scope.

#### Admin Dashboard

Show:

- System totals: stock items, low stock, pending indents, open POs, GRNs, transfers.
- User activity summary.
- Audit alerts.
- Procurement intelligence.
- Department overview for all departments.
- Quick links: User Management, Audit Logs, Stock, Suppliers, Purchase Orders, Reports.

Required permissions:

- `dashboard.view`
- `users.view`
- `audit_logs.view`
- module-specific view permissions.

#### Manager Dashboard

Show:

- Assigned department KPIs.
- Pending indents awaiting action.
- Low stock and reorder alerts.
- Purchase orders and GRNs relevant to responsibilities.
- Staff activity in assigned departments.
- Waste and production trends for assigned departments.

Hide:

- User management.
- Role management.
- System settings.

#### Chef Dashboard

Show:

- Today's menu plan.
- Assigned department stock availability.
- Ingredient requests.
- Production plan vs actual plates.
- Leftover summary.
- Recipe needs and consumption.

Hide:

- Supplier financials.
- User management.
- Department master mutation.
- Purchase order approvals.

#### Employee Dashboard

Show:

- Assigned daily tasks.
- Submit indent shortcut, if permitted.
- Log production or leftovers, if permitted.
- Own recent submissions.

Hide:

- Management KPIs.
- Financial data.
- Approval queues.
- Masters and settings.

## Data Filtering Rules

### Frontend

Frontend should pass the user's selected department filter when applicable, but this is only a convenience. Do not rely on it for security.

### Backend

Every list endpoint must scope data:

- If Admin: no forced department filter.
- If scoped user: add `whereIn(dept, assignedDepartmentNames)` or join through department ids.
- If endpoint has no department field, enforce module-level permission restrictions.

Examples:

- `GET /api/indents`: scoped by `indents.dept`.
- `GET /api/issuances`: scoped by `issuances.dept`.
- `GET /api/production`: scoped by `production.dept`.
- `GET /api/leftovers`: scoped by `leftovers.dept`.
- `GET /api/menu`: scoped by `menu_plans.dept`.
- `GET /api/transfers`: scoped by `from_location` or `to_location` if either matches assigned departments. Managers may see store-to-department transfers for their departments.
- `GET /api/dashboard`: aggregate only authorized department data.
- `GET /api/search`: search only authorized modules and authorized department data.

## Security Requirements

### Passwords

- Hash using `bcrypt` with cost 12.
- Minimum password length: 10.
- Require at least one letter and one number for generated temporary passwords.
- Force password change after admin reset or first login.
- Never log passwords.

### Sessions

- Access token: short-lived JWT.
- Refresh token: random opaque token, stored as hash in DB, returned in `httpOnly` cookie.
- Rotate refresh tokens on refresh.
- Revoke all refresh tokens on password reset and user deactivation.
- Add rate limiting on login and password reset routes.

### API Protection

- All protected APIs require authentication.
- All protected APIs require specific permissions.
- Status-changing endpoints require `approve` or equivalent workflow permission.
- Mutation endpoints write audit logs.
- Frontend hidden buttons are not security controls.

### Privilege Escalation Prevention

- Only `users.manage_roles` can assign roles to users.
- Only `roles.manage` can edit role permissions.
- Prevent removing the last active Admin role from the last active Admin user.
- Prevent deactivating the last active Admin user.
- Prevent users from editing their own roles.
- Prevent assigning permissions that the acting user does not have, unless acting user has `roles.manage`.

### CORS and Cookies

Update backend CORS:

```js
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true,
}));
```

Set cookie options:

```js
{
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth"
}
```

### Anthropic and AI Endpoints

The existing project instruction says Anthropic endpoints must include `x-api-key`. Browser code should not call Anthropic directly. Backend AI service should own the API key and set `x-api-key` server-side. RBAC must protect `/api/scan/*` and `/api/approved-delivery/*` before any AI or OCR call is executed.

## Implementation Phases

### Phase 1: Auth Foundation

1. Add dependencies.
2. Add RBAC/auth/audit migration.
3. Add permission catalog and seed script for roles, permissions, and first Admin user.
4. Add password hashing service.
5. Add `/api/auth/login`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/logout`.
6. Add `authenticate` middleware.
7. Update CORS and cookies.
8. Add frontend `AuthContext`.
9. Add login screen.
10. Attach Authorization header in API client.

Acceptance:

- App starts at login if unauthenticated.
- Admin can login.
- `/api/auth/me` returns roles, permissions, departments.
- Protected APIs return `401` without token.

### Phase 2: Backend Authorization

1. Add `requirePermission`.
2. Protect every route using the route protection map.
3. Add department scope utilities.
4. Apply scope to list/detail/create/update routes.
5. Add audit logging for login, logout, users, roles, and high-value mutations.

Acceptance:

- Direct URL/API access is blocked.
- Users cannot access unassigned department records.
- Mutation attempts without permission return `403`.

### Phase 3: Frontend Permission Gating

1. Add permission metadata to navigation.
2. Add `ProtectedScreen`.
3. Add `PermissionGate`.
4. Gate all action buttons listed above.
5. Replace hardcoded sidebar user with authenticated user.
6. Add logout.

Acceptance:

- Menus adapt per role.
- Hidden actions match permission matrix.
- Forbidden screens do not render sensitive content.

### Phase 4: User Management

1. Add User Management screen.
2. Add user list with filters: search, role, department, status.
3. Add create/edit user modal or form.
4. Add activate/deactivate control.
5. Add reset password action.
6. Add role assignment and department assignment.
7. Add activity history drawer from audit logs.

Acceptance:

- Admin can manage users.
- Non-admin users cannot view user management routes or APIs.
- Deactivated users cannot login.

### Phase 5: Role and Permission Management

1. Add roles API.
2. Add permissions API.
3. Keep system roles protected from deletion.
4. Allow Admin to create future custom roles.
5. Add role permission editing UI only if needed for launch; otherwise seed only.

Acceptance:

- New roles can be added without code changes.
- Permission catalog remains the only key source.

### Phase 6: Role-Specific Dashboards and Reports

1. Refactor Dashboard widgets to permission-aware sections.
2. Scope dashboard APIs.
3. Add admin audit/user activity widgets.
4. Add manager department operations widgets.
5. Add chef kitchen widgets.
6. Add employee task widgets.

Acceptance:

- Each role sees only relevant KPIs and actions.
- Dashboard API does not leak full-system aggregate data to scoped users.

### Phase 7: Production Hardening

1. Add tests for auth and permission middleware.
2. Add route authorization tests for every route.
3. Add audit tests for key mutations.
4. Add security headers and rate limits.
5. Add seed instructions for first admin.
6. Add deployment env docs.

Acceptance:

- `npm run build` passes for frontend.
- Backend tests cover `401`, `403`, and scoped data behavior.
- No password hashes or refresh tokens are exposed in responses.

## Testing Plan

### Backend Tests

Add tests for:

- Login success.
- Login failure.
- Inactive user cannot login.
- Missing token returns `401`.
- Invalid permission returns `403`.
- Admin can access all modules.
- Manager can access assigned department data only.
- Chef cannot access supplier, PO, GRN mutation APIs.
- Employee cannot access management APIs.
- Last active admin cannot be deactivated.
- Password reset revokes refresh tokens.
- Audit log writes for user creation and stock mutation.

### Frontend Verification

For each role:

- Login.
- Verify visible navigation.
- Verify hidden actions.
- Try direct screen state access to unauthorized screens.
- Confirm API `403` is surfaced cleanly.
- Confirm dashboards show role-appropriate widgets.

### Manual Permission Smoke Matrix

| Scenario | Expected |
|---|---|
| Employee opens User Management | Hidden nav; direct access forbidden |
| Chef opens Purchase Orders | Hidden nav; API returns `403` |
| Manager views production | Only assigned departments |
| Manager creates supplier | Allowed |
| Manager deletes supplier | `403` |
| Admin resets user password | Allowed and audited |
| Deactivated user logs in | `401` |
| Direct `/api/stock` without token | `401` |
| Direct `/api/stock/:id` delete as Manager | `403` |

## Seed Strategy

Create:

```text
backend/db/seeds/001_rbac_seed.js
```

Seed order:

1. Permissions from `backend/config/permissions.js`.
2. Roles.
3. Role-permission mappings.
4. First Admin user.

First admin credentials should come from environment variables:

```text
ADMIN_EMAIL=admin@kapila.local
ADMIN_PASSWORD=ChangeMe123!
```

If no admin env password exists in development, generate one and print it once during seed. Do not print generated passwords in production.

## Environment Variables

Add to backend `.env`:

```text
JWT_SECRET=replace-with-long-random-secret
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_DAYS=7
FRONTEND_ORIGIN=http://localhost:5173
ADMIN_EMAIL=admin@kapila.local
ADMIN_PASSWORD=ChangeMe123!
```

Production:

- Use a unique high-entropy `JWT_SECRET`.
- Set `NODE_ENV=production`.
- Use HTTPS so secure cookies work.
- Never commit `.env`.

## Implementation Notes For Current Code

### `frontend/src/App.jsx`

Required changes:

- Wrap app with `AuthProvider` outside `AppProvider`.
- Show `<Login />` when unauthenticated.
- Filter `NAV_CATEGORIES` by permission.
- Replace hardcoded profile with `user.name` and primary role.
- Add Administration category with `users` and `audit_logs`.
- Wrap screen map entries in `ProtectedScreen`.

### `frontend/src/api/client.js`

Required changes:

- Add token injection.
- Add refresh retry.
- Add `credentials: "include"`.
- Normalize `401` and `403` errors for UI.

### `backend/server.js`

Required changes:

- Add `helmet`.
- Add `cookieParser`.
- Configure CORS credentials.
- Mount `/api/auth` before global auth.
- Apply `authenticate` before protected routes.
- Leave `/api/health` public.
- Consider protecting `/api/ai-health` with Admin/Manager only, because it exposes system state.

### Existing Routes

Every route file must be updated to compose middleware:

```js
router.get("/", requirePermission("stock.view"), paginate(sorts), ctrl.list);
router.post("/", requirePermission("stock.create"), validate("stock"), ctrl.create);
```

For routes with status changes:

```js
router.patch("/:id", requirePermissionForPurchaseOrderUpdate, validate("purchase_order"), ctrl.update);
```

The helper should inspect the body. If `status` changes, require `purchase_orders.approve`; otherwise require `purchase_orders.edit`.

### Existing Controllers

Controllers must stop trusting client-provided scope. Add department assertions:

- `indentController.create`: submitted `dept` must be assigned to user unless Admin.
- `issuanceController.create`: submitted `dept` must be assigned to user unless Admin/Manager with store permission.
- `productionController.create`: submitted `dept` must be assigned to user unless Admin.
- `leftoverController.create`: submitted `dept` must be assigned to user unless Admin.
- `transferController.create`: `to_location`/`from_location` must be permitted.

## Done Criteria

RBAC is complete when:

- All users authenticate through `/api/auth`.
- All protected APIs require authentication.
- Every route has explicit permission middleware.
- Every list/detail API applies department or responsibility scope.
- Frontend navigation is generated from permissions.
- Frontend action buttons are gated by permissions.
- User Management supports create, edit, activate/deactivate, reset password, roles, departments, and activity history.
- Admin can view audit logs.
- Role dashboards show only authorized widgets and scoped data.
- Unauthorized direct API calls return `401` or `403`.
- The system can add a new role by seeding DB role-permission mappings without modifying screen/controller logic.
