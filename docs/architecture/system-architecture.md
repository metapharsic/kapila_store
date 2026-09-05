# Architecture Overview — Kapila Inventory

## System Diagram
```
Browser (React SPA)
      │
      │ HTTPS
      ▼
   nginx
   ├── /          → frontend/dist (static)
   └── /api/*     → backend:3001 (Express)
                        │
                        ├── SQLite (dev) / PostgreSQL (prod)
                        └── Anthropic API (Claude — OCR/AI features)
```

## Data Flow per Module

### Stock Entry
```
User fills form
  → POST /api/stock
  → validate (name, qty, unit, date)
  → INSERT into stock table
  → return updated stock list
```

### Indent → Issuance
```
Dept submits indent
  → POST /api/indents { dept, date, items[] }
  → status: "pending"

Storekeeper issues:
  → POST /api/issuances { indentId, items[]{name, issued} }
  → PATCH /api/stock/:id  (deduct remaining for each item)
  → PATCH /api/indents/:id { status: "issued" }
```

### AI Scan (Issuance)
```
User uploads image
  → POST /api/scan/indent  (multipart)
  → backend: send to Claude API with base64 image
  → Claude returns { dept, date, items[] }
  → backend validates + saves as issuance
  → return parsed result
```

## Database Schema (target)

### stock
| column         | type    | notes                      |
|----------------|---------|----------------------------|
| id             | integer | PK autoincrement           |
| name           | text    | item name                  |
| item_code      | text    | unique code (KPL-101+)     |
| qty            | real    | original quantity          |
| remaining      | real    | decremented on issuance    |
| unit           | text    | kg/g/L/ml/pcs/dozen/box    |
| price          | real    | cost per unit              |
| supplier       | text    | supplier name              |
| expiry_date    | date    | expiry/use-by date         |
| min_alert_qty  | real    | low-stock alert threshold  |
| date           | date    | YYYY-MM-DD (received)      |
| created_at     | text    | ISO timestamp              |

### indents
| column     | type    | notes                        |
|------------|---------|------------------------------|
| id         | integer | PK                           |
| dept       | text    | one of 6 departments         |
| date       | text    | YYYY-MM-DD                   |
| status     | text    | pending / issued / cancelled |
| created_at | text    |                              |

### indent_items
| column    | type    | notes          |
|-----------|---------|----------------|
| id        | integer | PK             |
| indent_id | integer | FK → indents   |
| name      | text    | item name      |
| qty       | real    | requested qty  |
| unit      | text    | measurement    |
| item_code | text    | ref to stock   |

### issuances
| column     | type    | notes               |
|------------|---------|---------------------|
| id         | integer | PK                  |
| indent_id  | integer | FK nullable (scan)  |
| dept       | text    |                     |
| date       | text    |                     |
| scanned    | integer | 0/1 boolean         |
| created_at | text    |                     |

### issuance_items
| column       | type    | notes              |
|--------------|---------|-------------------|
| id           | integer | PK                 |
| issuance_id  | integer | FK → issuances     |
| name         | text    | item name          |
| qty          | real    | requested qty      |
| issued       | real    | actually issued    |
| unit         | text    | measurement unit   |
| item_code    | text    | ref to stock item  |

### production
| column     | type    | notes                |
|------------|---------|----------------------|
| id         | integer | PK                   |
| dept       | text    |                      |
| date       | text    |                      |
| plates     | integer |                      |
| notes      | text    | nullable             |
| created_at | text    |                      |

### leftovers
| column          | type    | notes           |
|-----------------|---------|-----------------|
| id              | integer | PK              |
| dept            | text    |                 |
| date            | text    |                 |
| item            | text    |                 |
| qty             | real    |                 |
| unit            | text    |                 |
| carried_forward | integer | 0/1             |
| created_at      | text    |                 |

### stock_adjustments
| column    | type    | notes                   |
|-----------|---------|-------------------------|
| id        | integer | PK autoincrement        |
| stock_id  | integer | FK → stock              |
| qty       | real    | quantity change (delta) |
| reason    | text    | why adjusted (audit, correction, etc) |
| date      | date    | adjustment date         |
| notes     | text    | additional details      |
| created_at| text    | ISO timestamp           |

## Environment Variables
```
# backend/.env
PORT=3001
DB_PATH=./db/kapila.sqlite         # dev
DATABASE_URL=postgres://...        # prod
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=...
NODE_ENV=development
```

## API Base URL
- Dev: `http://localhost:3001/api`
- Prod: `https://<domain>/api`
