# WhatsApp Business API (optional, unset in this environment)

**API:** Meta Graph API v17.0 (`https://graph.facebook.com/v17.0/{PHONE_ID}/messages`)
**Config:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `ADMIN_WHATSAPP_NUMBER` — all unset in this
`.env`
**Wired in:** `cron/anomalyDetector.js` lines 111-134, inside the nightly anomaly scan only —
not used by the new real-time anomaly hook in `issuanceController.js` (that one only writes
`anomaly_alerts` + kafka, no WhatsApp send, since it fires per-request rather than once nightly
and a WhatsApp ping per flagged issuance would be noisy).

**Fallback when unset:** `console.log("[SMS SERVICE] (Mock) Triggering Alert to Admin:...")` —
the code comment literally calls this "Phase 1 Fallback," implying WhatsApp delivery was always
meant to be a later-phase upgrade over a console mock, not a hard dependency.

**What's been done:** Nothing — token unset, falls back to console-log mock as designed. Not
touched, not needed for any of this session's Phase 1/2 work (kept the same non-blocking,
fail-safe philosophy as Kafka's `publish()` — a missing external channel never breaks the
underlying detection logic).
