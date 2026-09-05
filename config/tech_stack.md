# Tech Stack Inventory — Kapila Inventory System

Pulled straight from `backend/package.json`, `frontend/package.json`, `.env.example`, and the
live infra install (`C:\infra`). Regenerate by re-reading those files if deps change — this is a
snapshot, not a lockfile.

## Backend — 19 packages (18 runtime + 1 dev)

**Runtime (18):**
| Package | Version | Role |
|---|---|---|
| express | ^4.19.2 | HTTP server / routing |
| pg | ^8.12.0 | PostgreSQL driver |
| knex | ^3.1.0 | Query builder + migrations |
| kafkajs | ^2.2.4 | Kafka producer/consumer |
| jsonwebtoken | ^9.0.3 | Auth tokens |
| bcryptjs | ^3.0.3 | Password hashing |
| zod | ^3.23.8 | Request validation |
| cors | ^2.8.5 | Cross-origin requests |
| helmet | ^8.2.0 | HTTP security headers |
| express-rate-limit | ^8.5.2 | Login/API rate limiting |
| cookie-parser | ^1.4.7 | Cookie parsing |
| compression | ^1.8.1 | Response gzip |
| dotenv | ^16.4.5 | Env var loading |
| multer | ^2.1.1 | File upload (OCR scans) |
| tesseract.js | ^7.0.0 | Local OCR fallback |
| pdf-parse | ^2.4.5 | PDF text extraction |
| xlsx | ^0.18.5 | Excel import/export |
| node-cron | ^4.4.1 | Scheduled jobs (anomaly/digest/drift/escalation crons) |
| prom-client | ^15.1.3 | Prometheus metrics export |

**Dev (1):** nodemon ^3.1.4 — auto-restart on file change.

## Frontend — 15 packages (6 runtime + 9 dev)

**Runtime (6):**
| Package | Version | Role |
|---|---|---|
| react | ^19.2.6 | UI framework |
| react-dom | ^19.2.6 | React DOM renderer |
| recharts | ^3.8.1 | Charts (dashboards, waste analytics) |
| lucide-react | ^1.17.0 | Icon set |
| qrcode | ^1.5.4 | QR generation (item codes) |
| @huggingface/transformers | ^4.2.0 | Client-side ML (browser inference) |

**Dev (9):** vite ^8.0.12, @vitejs/plugin-react ^6.0.1, eslint ^10.3.0, @eslint/js ^10.0.1,
eslint-plugin-react-hooks ^7.1.1, eslint-plugin-react-refresh ^0.5.2, globals ^17.6.0,
@playwright/test ^1.60.0, @types/react + @types/react-dom ^19.2.x.

## External Infra (not npm packages — separate installs/services)

| Software | Where | Role |
|---|---|---|
| PostgreSQL | localhost:5432, db `kapila` | Primary datastore |
| Apache Kafka (KRaft mode) | `C:\infra\kafka`, localhost:9092 | Event bus (stock/indent/issuance/production/recipe/etc events) |
| Prometheus | `C:\infra\prometheus`, localhost:9090 | Metrics scrape (fed by prom-client) |
| Grafana | Windows service, localhost:3000 | Metrics dashboards |
| Google Gemini API | via `GEMINI_API_KEY` in `.env`, called by `services/localAI.js` | OCR, morning briefing, handoff summary, smart indent, expiry-menu suggestions, recipe cost drift context |
| WhatsApp Business API | `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID` (optional, unset in this env) | Anomaly alert delivery — falls back to console-log mock when unset |

## Grand total

- **npm packages: 34** (19 backend + 15 frontend)
- **External services: 6** (Postgres, Kafka, Prometheus, Grafana, Gemini, WhatsApp[optional])
