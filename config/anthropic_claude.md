# Anthropic Claude API (fallback tier)

**Purpose:** paid fallback when Gemini hits quota/billing/auth errors. Optional — dormant if
`ANTHROPIC_API_KEY` is unset.
**Model:** `claude-sonnet-5`
**Access:** raw REST `fetch()` to `https://api.anthropic.com/v1/messages` — no `@anthropic-ai/sdk`
dependency, matches the Gemini integration's single-file-owns-it style.
**Config:** `ANTHROPIC_API_KEY` in `.env` (get one at console.anthropic.com — pay-as-you-go,
no free tier, billing required)
**Wired in:** `services/localAI.js`
- `callClaude(contents, systemInstruction)` — converts Gemini-style `contents` (role/parts,
  including `inlineData` images) into Claude's `messages` content-block format via
  `geminiContentsToClaude()`
- Triggered automatically inside `callGemini()`'s catch block when Gemini returns a
  quota/billing/key error AND `ANTHROPIC_API_KEY` is set

**Fallback position:** Gemini → **Claude** → Ollama vision → Tesseract+regex
**Known limits:** no audio input support — voice transcription (`transcribeAudio()`) stays
Gemini-only, Claude has no equivalent fallback for that path.
