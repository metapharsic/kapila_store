# Backend Documentation — Kapila Inventory

## Stack
- Node.js + Express
- SQLite (dev via `better-sqlite3`) / PostgreSQL (prod via `pg`)
- Zod for input validation
- JWT for auth (if multi-user)
- PM2 for process management on VPS

## File Structure
```
backend/
├── server.js             # Express app entry
├── db/
│   ├── index.js          # DB connection singleton
│   ├── migrations/       # numbered SQL files
│   └── seeds/            # sample data for dev
├── routes/
│   ├── stock.js
│   ├── indents.js
│   ├── issuances.js
│   ├── production.js
│   ├── leftovers.js
│   ├── scan.js           # AI scan endpoint
│   └── dashboard.js
├── controllers/
│   ├── stockController.js
│   ├── indentController.js
│   ├── issuanceController.js
│   ├── productionController.js
│   ├── leftoverController.js
│   ├── scanController.js
│   └── dashboardController.js
├── models/
│   ├── stock.js
│   ├── indent.js
│   ├── issuance.js
│   ├── production.js
│   └── leftover.js
├── middleware/
│   ├── auth.js
│   ├── validate.js       # Zod validation wrapper
│   └── errorHandler.js
├── services/
│   └── claude.js         # Anthropic API wrapper
├── prompts/
│   └── indentScan.js     # Claude prompt for OCR
└── .env                  # never committed
```

## REST API Reference

### Stock
| Method | Path                  | Body / Params                                        | Description                              |
|--------|----------------------|------------------------------------------------------|------------------------------------------|
| GET    | /api/stock            | `?name=&unit=&supplier=&expiry_status=&q=&page=`   | List stock with filters & full-text     |
| GET    | /api/stock/ledger     | —                                                    | Stock ledger (purchases, issues, leftovers) |
| GET    | /api/stock/insights   | —                                                    | Stock insights (spend, alerts, trends)  |
| POST   | /api/stock            | `{name,qty,unit,date,price,supplier,expiry_date,min_alert_qty}` | Add stock with details |
| PATCH  | /api/stock/:id        | `{remaining,min_alert_qty,reason,notes}`           | Update qty, alert threshold, log adjustment |
| DELETE | /api/stock/:id        | —                                                    | Remove item                               |

### Indents
| Method | Path              | Body / Params              | Description         |
|--------|-------------------|----------------------------|---------------------|
| GET    | /api/indents      | `?status=pending`          | List indents        |
| POST   | /api/indents      | `{dept,date,items[]}`      | Create indent       |
| PATCH  | /api/indents/:id  | `{status}`                 | Update status       |

### Issuances
| Method | Path              | Body / Params                    | Description       |
|--------|-------------------|----------------------------------|-------------------|
| GET    | /api/issuances    | `?date=YYYY-MM-DD&dept=`         | List issuances    |
| POST   | /api/issuances    | `{indentId?,dept,date,items[]}`  | Record issuance   |

### Production
| Method | Path              | Body / Params                 | Description        |
|--------|-------------------|-------------------------------|--------------------|
| GET    | /api/production   | `?dept=&date=`                | List entries       |
| POST   | /api/production   | `{dept,date,plates,notes?}`   | Log production     |

### Leftovers
| Method | Path              | Body / Params                       | Description       |
|--------|-------------------|-------------------------------------|-------------------|
| GET    | /api/leftovers    | `?dept=&date=`                      | List leftovers    |
| POST   | /api/leftovers    | `{dept,date,item,qty,unit}`         | Record leftover   |

### AI Scan
| Method | Path                | Body                        | Description                          |
|--------|---------------------|-----------------------------|--------------------------------------|
| POST   | /api/scan/indent    | `{image, mime_type}`        | OCR indent form → dept, items, date |
| POST   | /api/scan/purchase  | `{image, mime_type}`        | OCR purchase receipt → name, qty, price |
| POST   | /api/scan/text      | `{text}`                    | Extract data from freeform text      |

### Dashboard
| Method | Path              | Params       | Description              |
|--------|-------------------|--------------|--------------------------|
| GET    | /api/dashboard    | `?date=`     | Aggregated KPIs          |

## Response Format
All endpoints return:
```json
{ "success": true, "data": {...} }
{ "success": false, "error": "message" }
```

## Validation Rules
- `name`: non-empty string, max 100 chars
- `qty` / `remaining` / `issued` / `price` / `min_alert_qty`: positive float
- `unit`: one of `kg | g | L | ml | pcs | dozen | box | plates | portions`
- `dept`: one of the 6 defined departments
- `date` / `expiry_date`: `YYYY-MM-DD` format
- `status`: `pending | issued | cancelled`
- `item_code`: auto-generated `KPL-###` format (cannot be set manually)
- `supplier`: optional text, max 100 chars
- `reason` (on stock adjustment): `Audit Correction | Damage | Theft | Other`

## Claude Service (`services/claude.js`)
```js
// Usage
const result = await claude.scanIndent(base64Image, mimeType);
// Returns: { dept, date, items: [{name, qty}] }
```
- Model: `claude-sonnet-4-6` (update when newer model releases)
- Timeout: 30s
- Retry: 2x with exponential backoff on 429/529
- Prompt stored in `prompts/indentScan.js`

## Error Handling
- Validation errors → 400
- Not found → 404
- Auth errors → 401/403
- Claude API errors → 502 with `{ error: "AI scan unavailable" }`
- Unhandled → 500, log to console (never expose stack to client)
