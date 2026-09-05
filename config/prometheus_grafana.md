# Prometheus + Grafana

**Prometheus:** `C:\infra\prometheus`, localhost:9090, scrape interval 15s
**Grafana:** Windows service (auto-started, installed via winget MSI — the one infra piece
that didn't need the no-admin watchdog workaround), localhost:3000, default admin/admin
**Backend metrics endpoint:** `GET /metrics` in `backend/server.js` (line 41), fed by
`prom-client` ^15.1.3 — a histogram per route

**Scrape targets configured (`C:\infra\prometheus\prometheus.yml`):**
| Job | Target | Notes |
|---|---|---|
| `prometheus` | localhost:9090 | self-scrape |
| `kapila-backend` | localhost:3001 | this project |
| `mk_paper_mill_backend` | localhost:5000 | a **different, unrelated project** sharing the same Prometheus instance on this machine |

**What it does:** Metrics scrape + dashboards for request latency/count per route.

**What's been done:** Nothing touched this session — confirmed still running (direct port
check on 9090/3000), no config or code changes made. Local observability infra, not in scope
of this session's AI-enhancement work (Phase 1/2 focused on stock/issuance/recipe/kafka
features, not metrics/dashboards).
