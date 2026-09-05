# Database environment

- **Engine**: PostgreSQL
- **Connection**: single `DATABASE_URL` env var, read in `backend/knexfile.js` and `backend/db/index.js`.
  Format: `postgresql://<user>:<password>@<host>:<port>/<database>`
- **Migrations**: Knex, `backend/db/migrations/`. Run with `npm run migrate` (backend). Never hand-edit
  applied migrations — add a new one.
- **Seeds**: `backend/scripts/seed_*.js` — dummy data, stock, user accounts. Do not run against a
  database with real Kapila data; these insert/overwrite rows.
- **Local dev default**: `postgres` superuser, password `postgres` (per prior session notes) — change
  this for anything beyond a laptop dev box.
- **Data safety** (per project CLAUDE.md): never destroy DB data — local DB holds real task/indent data.
  Don't run `migrate:rollback` or seed scripts against it without checking first.

## Known schema-level risk

- `users.password_hash` — project CLAUDE.md states passwords are stored **plain text**, not hashed.
  Do not add hashing without a full migration plan (existing plaintext rows need a one-time re-hash
  path, and login code needs updating in lockstep). Flagging here, not fixing — out of scope unless asked.
