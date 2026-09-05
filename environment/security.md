# Environment security checklist

## Rules
- Never commit `backend/.env` or `frontend/.env` — both already in root `.gitignore`. This
  `environment/` folder holds only `*.env.example` templates with placeholder values.
- Never put a real secret behind a Vite `VITE_*` var — it ships into the built JS bundle and is
  readable by anyone with devtools open. See finding below.
- Rotate `JWT_SECRET` if it ever leaks — invalidates every existing session/token, expected side effect.
- `WHATSAPP_TOKEN` / `GEMINI_API_KEY` are live external-API credentials — treat like passwords, don't
  paste into chat/tickets/screenshots.

## Findings from this pass

1. **Dead API-key header, but shaped like a real secret leak.**
   `frontend/src/api/client.js:53,85` sends `import.meta.env.VITE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY`
   as an `x-api-key` header on every request. Grepped the entire backend — **no route or middleware
   reads that header**. It's dead code today. The risk: if anyone ever sets `VITE_ANTHROPIC_API_KEY` in
   `frontend/.env` thinking it configures the AI features, that key gets compiled straight into the
   public JS bundle and is trivially stealable. AI/OCR features actually run server-side off
   `GEMINI_API_KEY` (backend-only, never exposed to the client) — the frontend var is unnecessary.
   Recommendation: don't set `VITE_ANTHROPIC_API_KEY`/`VITE_API_KEY` at all; consider deleting the dead
   header code in a follow-up (not done here — out of scope for an env-docs pass).

2. **Stale `.env.example` didn't match real code.**
   `backend/.env.example` listed `ANTHROPIC_API_KEY`, but `backend/services/localAI.js` reads
   `GEMINI_API_KEY`. Anyone following the old example would set the wrong var and OCR/voice-parse
   would silently stay disabled (`localAI.js` just throws/reports "not configured", doesn't crash).
   Fixed in `environment/backend.env.example`.

3. **`ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars** (migration `017_create_auth_rbac_audit.js`) seed the
   first admin account in plaintext from `.env`. Don't leave real prod credentials sitting in a `.env`
   file longer than the first migration run — rotate the password through the app after first login.

4. **Plaintext password storage** — see `environment/database.md`. Pre-existing, documented, not
   changed here per project constraint (no hashing without a full migration).

5. **Single hardcoded `ADMIN_WHATSAPP_NUMBER`** — one phone number for all shrinkage/high-value/
   day-close alerts, not role-driven. Fine for current single-admin setup; if Kapila ever needs
   multiple recipients, this becomes a list, not a bigger problem today.
