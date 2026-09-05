# Ollama (local LLM — no API key)

**Purpose:** free, local, no-quota fallback tier for scan/OCR when Gemini/Claude are
down/quota-exhausted. Runs on the dev machine, no cloud dependency.
**Server:** `http://localhost:11434` (default, override via `OLLAMA_URL` in `.env`)

**Models installed:**
| Model | Type | Used for | Size |
|---|---|---|---|
| `qwen:latest` (4B) | text-only | structuring raw OCR text → JSON (`callOllama()`) | 2.3GB |
| `llava:latest` | vision | reading scanned image directly → JSON (`callOllamaVision()`) | 4.7GB |

Override model names via `OLLAMA_MODEL` / `OLLAMA_VISION_MODEL` in `.env`.

**Wired in:** `services/localAI.js`
- `callOllama(systemInstruction, prompt)` — text structuring, hits `/api/generate`
- `callOllamaVision(systemInstruction, prompt, base64Data)` — image + prompt, hits `/api/generate`
  with `images: [base64Data]`

**Fallback position:** Gemini → Claude → **Ollama vision** → Tesseract+regex (image scans)
**Known limits:**
- `qwen:latest` is text-only — cannot read images directly, only used post-OCR
- Local CPU inference is slow — `llava` can take 30–90s on a table-heavy image. If frontend has
  a short request timeout, scans may appear to silently fail even though the backend eventually
  succeeds. Check/raise frontend axios timeout if scans look "stuck."
**Setup:** `ollama pull qwen`, `ollama pull llava` — verify with `ollama list`
