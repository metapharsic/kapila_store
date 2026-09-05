# Module Reference — Kapila Inventory

## 1. Stock (Purchase & Store)
**Owner screen:** `screens/Stock/index.jsx`
**API routes:** `routes/stock.js`

### Business Rules
- Each stock entry tracks `qty` (original) and `remaining` (decremented on issuance)
- `remaining` can never go below 0
- Low-stock alert threshold: `remaining ≤ min_alert_qty` (defaults to `qty * 0.25` if not set)
- `item_code` auto-generated as `KPL-###` (e.g., KPL-101, KPL-102) — unique per item name, reused if re-stocking
- Adjustments tracked in `stock_adjustments` table with `reason` (Audit, Damage, Theft, etc)
- Expiry dates: items marked as "Expired" or "Expiring Soon" (< 3 days) in filter
- Supplier tracking: can filter/search by supplier
- Deleting a stock item does not retroactively adjust issuance history

### Fields
```
id, name, item_code (KPL-###), qty, remaining, unit,
price, supplier, expiry_date, min_alert_qty, date (received),
created_at
```

### New Features
- **Ledger**: `/api/stock/ledger` — combined log of purchases, issues, leftovers
- **Insights**: `/api/stock/insights` — spend tracking, store value, low-stock values
- **Filters**: by name, supplier, expiry status (fresh/expiring/expired), low-stock, full-text search

---

## 2. Indent (Department Requisition)
**Owner screen:** `screens/Indent/index.jsx`
**API routes:** `routes/indents.js`

### Business Rules
- Indents are submitted by department heads nightly for next-day needs
- One indent per department per date (soft rule — not enforced in MVP)
- Status lifecycle: `pending → issued` (or `cancelled`)
- Indent items capture `unit` at time of request (not resolved later)
- `item_code` links to the stock item if known
- Indent items autocomplete from current stock names (via `AppContext.stockNames`)

### Fields
```
dept, date (needed), items[]{name, qty, unit, item_code}, status
```

---

## 3. Issuance (Store Issue)
**Owner screen:** `screens/Issuance/index.jsx`
**Owner component:** `screens/Issuance/ScanPanel.jsx`
**API routes:** `routes/issuances.js`, `routes/scan.js`

### Business Rules
- Storekeeper can issue from a pending indent (manual) or from a scanned form (AI)
- Issued quantities can differ from requested quantities
- On issue: stock `remaining` is decremented for each matched item (name match, case-insensitive)
- Indent status set to `issued` after manual issuance
- Scanned issuances have `scanned: true`, `indent_id: null`
- Items capture `unit` and `item_code` at time of issuance
- Items not found in stock still get recorded (no blocking constraint)

### AI Scan Rules (via `/api/scan/indent`)
- Storekeeper uploads image of paper indent form
- Backend sends to Claude API with vision capability
- Claude extracts `{dept, date, items[]{name, qty}}`
- If Claude cannot parse, error is surfaced to user — no silent failure
- Parsed result auto-populates form; user reviews and adjusts before submitting

### Fields
```
indentId (nullable), dept, date, scanned (bool),
items[]{name, qty, issued, unit, item_code}
```

---

## 4. Production Tracking
**Owner screen:** `screens/Production/index.jsx`
**API routes:** `routes/production.js`

### Business Rules
- One entry per department per date (soft rule)
- `plates` is the count of portions/plates prepared that day
- Cross-references issuances on same dept+date to show material-to-plate correlation
- No automatic calculation — manual entry only in MVP

### Fields
```
dept, date, plates (int), notes (optional text)
```

---

## 5. Leftover Tracking
**Owner screen:** `screens/Leftovers/index.jsx`
**API routes:** `routes/leftovers.js`

### Business Rules
- Records unsold prepared food at end of day
- `carried_forward` flag indicates it was counted and noted (not re-stocked to raw store)
- Summary cards show total plates produced vs total leftover per department
- Leftover rate = `leftover qty / production plates` (future metric)

### Fields
```
dept, date, item (dish name), qty (float), unit, carried_forward (bool)
```

---

## 6. Dashboard
**Owner screen:** `screens/Dashboard/index.jsx`
**API routes:** `routes/dashboard.js`

### KPI Cards
| Metric            | Calculation                                |
|-------------------|--------------------------------------------|
| Stock items       | COUNT(stock)                               |
| Low stock         | COUNT where remaining/qty < 0.25           |
| Pending indents   | COUNT(indents) where status = pending      |
| Today's issuances | COUNT(issuances) where date = today        |
| Plates today      | SUM(production.plates) where date = today  |
| Leftovers today   | COUNT(leftovers) where date = today        |

### Department Table
Per-department aggregates: total plates, issuance count, leftover count

### Stock Alerts
Items below 25% remaining — shown with mini progress bar

---

## Planned Future Modules
- **Reports** — Daily/weekly PDF export per department
- **Suppliers** — Supplier master, purchase order tracking
- **Users/Auth** — Role-based: Admin, Storekeeper, Department Head
- **Recipes** — Ingredient-to-plate mapping for auto material calculation
- **Billing** — Cost per plate based on material costs
