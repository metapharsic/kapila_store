# environment/

Central home for env config for this repo. Real `.env` files stay where the tools expect them
(`backend/.env`, `frontend/.env`) and are gitignored — this folder holds documented, safe-to-commit
templates + notes only.

| File | What |
|---|---|
| `backend.env.example` | Every env var the backend reads, with comments. Copy to `backend/.env`. |
| `frontend.env.example` | Every env var the frontend (Vite) reads, with comments. Copy to `frontend/.env`. |
| `database.md` | Postgres/Knex setup, migration/seed rules, data-safety notes. |
| `security.md` | Checklist + findings from auditing current env usage (dead API-key header, stale example file, plaintext passwords, etc). Read this before touching env config. |

Setup:
1. `cp environment/backend.env.example backend/.env` → fill real values.
2. `cp environment/frontend.env.example frontend/.env` → fill real values (usually just `VITE_API_URL`).
3. Read `security.md` before setting anything `VITE_`-prefixed.
