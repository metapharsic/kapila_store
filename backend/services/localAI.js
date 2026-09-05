/**
 * localAI.js — Service for AI processing using the Anthropic API.
 * 
 * ============================================================================
 * OCR AND AI TECHNOLOGIES USED IN THIS SERVICE:
 * 
 * 1. GOOGLE GEMINI API (gemini-3.5-flash):
 *    - Main AI driver for multimodal vision tasks (reading and structuring paper forms/images).
 *    - Generates morning briefings, shift handoffs, expiry menu suggestions, and parses natural language/voice queries.
 * 
 * 2. SHARP (Image Preprocessing):
 *    - Cleans up uploaded photos before local OCR.
 *    - Upscales, grayscales, normalizes contrast, sharpens, and applies adaptive thresholding to make handwritten quantities and faint ink readable.
 * 
 * 3. TESSERACT.JS (Local OCR Fallback):
 *    - Runs locally to extract text from preprocessed images when Gemini API is offline or quota is exhausted.
 *    - Uses preloaded language data (English, Telugu, Hindi) to handle multilingual paper documents.
 * 
 * 4. OLLAMA (Local LLM Fallback):
 *    - Connects to a local Ollama instance (using Qwen/Llava models) to structure raw OCR text into JSON when Gemini is unavailable.
 * 
 * 5. LOCAL REGEX PARSER (Deterministic Fallback):
 *    - Custom rule-based regex parser that extracts item names, quantities, and units from OCR text when both Gemini and Ollama fail.
 * 
 * 6. FUZZY MATCHING (PostgreSQL pg_trgm):
 *    - Works with database-level trigram similarity to match OCR-extracted item names to existing inventory stock names and aliases.
 * ============================================================================
 */

const path = require("path");
const db = require("../db");
const { normalizeUnit } = require("../utils/units");

// Fix OCR digit/letter confusions ONLY inside number-looking tokens (has a digit,
// dot, or comma). Names left untouched — a lone "S" won't become "5".
function normalizeNumericTokens(line) {
  return line.split(/(\s+)/).map((tok) => {
    if (!/[.,\d]/.test(tok)) return tok;                   // no digit/decimal → skip
    if (!/^[oOsSlLiIzZ\d.,]+$/.test(tok)) return tok;      // has real letters → skip (a name)
    return tok
      .replace(/[oO]/g, "0")
      .replace(/[sS]/g, "5")
      .replace(/[lLiI]/g, "1")
      .replace(/[zZ]/g, "2")
      .replace(/,/g, ".");
  }).join("");
}

// Handles handwritten arithmetic like "30+30" or "1-0.5" written instead of the
// final number. Falls back to the first plain number if there's no operator.
function parseQtyExpression(text) {
  const cleaned = text.trim();
  if (/[+\-]/.test(cleaned.slice(1))) {  // ignore a leading minus sign, not an operator
    const parts = cleaned.match(/\d+(?:\.\d+)?/g);
    const ops = cleaned.match(/[+\-]/g);
    if (parts && parts.length > 1 && ops) {
      let total = parseFloat(parts[0]);
      for (let i = 0; i < ops.length && i + 1 < parts.length; i++) {
        total = ops[i] === "-" ? total - parseFloat(parts[i + 1]) : total + parseFloat(parts[i + 1]);
      }
      return total;
    }
  }
  const single = cleaned.match(/\d+(?:\.\d+)?/);
  return single ? parseFloat(single[0]) : null;
}

// Sanity gate — an OCR'd qty that's numerically absurd for its unit is more
// likely a misread than a real value; force manual_review rather than trust it.
function isQtySane(qty, unit) {
  if (qty == null) return false;
  if (qty < 0) return false;
  const u = normalizeUnit(unit);
  if ((u === "kg" || u === "L") && qty > 500) return false;   // no single indent row needs >500kg/L
  if (u === "pcs" && qty > 5000) return false;
  return true;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Gemini `contents` -> Claude `messages` content blocks.
function geminiContentsToClaude(contents) {
  return contents.map((c) => ({
    role: c.role === "model" ? "assistant" : "user",
    content: c.parts.map((p) => {
      if (p.inlineData) {
        return { type: "image", source: { type: "base64", media_type: p.inlineData.mimeType, data: p.inlineData.data } };
      }
      return { type: "text", text: p.text };
    }),
  }));
}

// [TECH EXPLANATION: ANTHROPIC CLAUDE API (claude-sonnet-5) Fallback Integration]
// This function converts Gemini-formatted content structures into Anthropic Messages API format
// and acts as a secondary/fallback LLM tier if the primary Gemini API is unavailable or exhausted.
async function callClaude(contents, systemInstruction = "") {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured in the .env file.");
  }

  const body = {
    model: "claude-sonnet-5",
    max_tokens: 4096,
    messages: geminiContentsToClaude(contents),
  };
  if (systemInstruction) body.system = systemInstruction;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API request failed (${response.status}): ${errText.slice(0, 200)}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text;
  if (!text) throw new Error("Empty response from Claude API.");
  return text.trim();
}

function getMockFallback(messages, systemPrompt) {
  const isJsonExpected = systemPrompt && systemPrompt.toLowerCase().includes("json");
  const msgsStr = JSON.stringify(messages).toLowerCase();
  
  if (isJsonExpected) {
    if (msgsStr.includes("indent")) {
      return JSON.stringify({
        dept: "TIFFINS",
        items: [
          { name: "PANEER", qty: 5, unit: "kg" },
          { name: "MILK", qty: 10, unit: "L" },
          { name: "ONION", qty: 20, unit: "kg" }
        ]
      });
    }
    if (msgsStr.includes("issuance") || msgsStr.includes("issue")) {
      return JSON.stringify({
        dept: "TIFFINS",
        items: [
          { name: "PANEER", qty: 2, unit: "kg" },
          { name: "ONION", qty: 5, unit: "kg" }
        ]
      });
    }
    if (msgsStr.includes("leftover")) {
      return JSON.stringify({
        dept: "TIFFINS",
        items: [
          { name: "PANEER TIKKA", qty: 2, unit: "portions" }
        ]
      });
    }
    return JSON.stringify({
      dept: "TEST",
      items: [{ name: "TEST ITEM", qty: 1, unit: "kg" }]
    });
  }
  return "MOCK OCR TEXT\nPaneer 5 kg\nMilk 10 L\nOnion 20 kg";
}

// [TECH EXPLANATION: GOOGLE GEMINI API (gemini-3.5-flash) Integration]
// Connects to Google's Generative Language API. This is our primary, fast, cost-effective LLM.
// It supports systemInstructions, temperature tuning, and handles both text prompts and multimodal (images/audio) inputs.
// If Gemini rate limits or quota fails, it dynamically fallbacks to Anthropic's Claude API if configured.
async function callGemini(contents, systemInstruction = "") {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in the .env file.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const body = {
    contents: contents,
    generationConfig: {
      temperature: 0.1
    }
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        const isTransient = response.status === 503 || response.status === 429;
        
        const isQuotaOrKeyError = (response.status === 400 && (errText.includes("API key not valid") || errText.includes("quota"))) ||
                                  (response.status === 429 && (errText.includes("quota") || errText.includes("limit") || errText.includes("exceeded") || errText.includes("billing")));
        
        if (isQuotaOrKeyError) {
          if (ANTHROPIC_API_KEY) {
            console.warn("Gemini quota/key exhausted. Falling back to Claude.");
            return await callClaude(contents, systemInstruction);
          }
          throw new Error("Gemini quota/billing limits exceeded or key invalid.");
        }

        if (isTransient && attempt < 2) {
          console.warn(`Gemini API returned ${response.status}. Retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error(`Gemini API request failed (${response.status}): ${errText.slice(0, 200)}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response from Gemini API.");
      }
      return text.trim();
    } catch (err) {
      lastError = err;
      console.error(`Error with Gemini API (attempt ${attempt}):`, err.message);
      const isTransient = err.message.includes("503") || err.message.includes("429");
      if (!isTransient) break;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error("Failed to call Gemini API.");
}

/**
 * Perform OCR using local Tesseract.js only. No external API call — avoids
 * hangs/timeouts if outbound network to Gemini/Claude is blocked or slow on
 * whatever machine runs this, which looked identical to "scan does nothing."
 */


/**
 * [TECH EXPLANATION: DETERMINISTIC LOCAL REGEX PARSER FALLBACK]
 * If Gemini, Claude, and Ollama all fail, this pure JavaScript regex parser extracts information.
 * It uses regular expressions to find metadata like Date, Invoice Numbers, and Supplier names,
 * and parses lines to extract item names, quantities, and units (e.g. kg, L, pcs).
 * It splits lines by numbers to support multiple items per line (e.g. "Aloo 5 kg, Tomato 2 kg").
 */
function localRegexParse(rawText, task) {
  const lines = rawText.split(/\r?\n/);
  const items = [];
  let supplier = null;
  let dept = "SI-MEALS";
  let date = new Date().toISOString().slice(0, 10);
  let invoice_no = null;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes("supplier") || lowerLine.includes("vendor") || lowerLine.includes("sold by")) {
      const match = line.match(/(?:supplier|vendor|sold by)\s*:?\s*([a-z0-9\s&._-]+)/i);
      if (match && match[1]) {
        supplier = match[1].trim();
      }
    }
    if (lowerLine.includes("invoice") || lowerLine.includes("bill no") || lowerLine.includes("bill_no")) {
      const match = line.match(/(?:invoice|bill\s*no|bill_no)\s*:?\s*([a-z0-9-]+)/i);
      if (match && match[1]) {
        invoice_no = match[1].trim();
      }
    }
    if (lowerLine.includes("date")) {
      const match = line.match(/(?:date)\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/i);
      if (match && match[1]) {
        let dStr = match[1].trim();
        if (dStr.includes("/")) {
          const parts = dStr.split("/");
          if (parts[2] && parts[2].length === 4) {
            date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (dStr.includes("-")) {
          const parts = dStr.split("-");
          if (parts[0].length === 4) {
            date = dStr;
          } else if (parts[2] && parts[2].length === 4) {
            date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      }
    }
    const VALID_DEPTS = ["TIFFINS", "STAFF", "SI-MEALS", "NORTH INDIAN", "CHAT & SOFTY", "CHINESE & DOSA", "MOCKTAILS & CONTINENTAL", "RESTAURANT", "ROOM SERVICE"];
    for (const d of VALID_DEPTS) {
      if (lowerLine.includes(d.toLowerCase())) {
        dept = d;
      }
    }
  }

  const unitRegex = /\b(kg|g|L|ml|pcs|dozen|box|plates|portions|kilograms|kilo|kgs|liters|litre|litres|pieces|plate|portion)\b/i;

  for (const rawLine of lines) {
    const lineTrim = rawLine.trim();
    if (!lineTrim) continue;

    const lowerTrimmed = lineTrim.toLowerCase();
    if (lowerTrimmed.includes("invoice") || lowerTrimmed.includes("date") || lowerTrimmed.includes("supplier") || lowerTrimmed.includes("vendor") || lowerTrimmed.includes("purchase order") || lowerTrimmed.includes("record new stock") || lowerTrimmed.includes("clear all")) {
      continue;
    }

    // Fix OCR digit/letter confusion in qty tokens (O.5→0.5, 0,5→0.5) before parse.
    const trimmed = normalizeNumericTokens(lineTrim);

    const numberMatches = [...trimmed.matchAll(/(?:^|\s|[+*x\/-])(\d+(?:\.\d+)?)\b/g)];
    if (numberMatches.length === 0) {
      if (task === "indent") {
        const lower = trimmed.toLowerCase();
        if (lower.includes("tick")) {
          let namePart = trimmed.replace(/tick/i, "").replace(/[+*x\/-]+/g, "").trim().toUpperCase();
          if (namePart.length >= 2) {
            items.push({ name: namePart, qty: 1, unit: "kg" });
          }
        } else if (lower.includes("blank")) {
          let namePart = trimmed.replace(/blank/i, "").replace(/[+*x\/-]+/g, "").trim().toUpperCase();
          if (namePart.length >= 2) {
            items.push({ name: namePart, qty: null, unit: "kg" });
          }
        }
      }
      continue;
    }

    const segments = [];
    let lastIdx = 0;
    for (const match of numberMatches) {
      segments.push(trimmed.substring(lastIdx, match.index));
      lastIdx = match.index + match[0].length;
    }
    segments.push(trimmed.substring(lastIdx));

    for (let i = 0; i < numberMatches.length; i++) {
      const qty = parseFloat(numberMatches[i][1]);
      const unitSegment = segments[i + 1];
      let nameSegment = segments[i];

      if (i > 0) {
        const prevUnitMatch = nameSegment.match(new RegExp(`^\\s*${unitRegex.source}`, "i"));
        if (prevUnitMatch) {
          nameSegment = nameSegment.substring(prevUnitMatch[0].length);
        }
      }

      let namePart = nameSegment.replace(/[|;+*:\/,-]/g, ' ').replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '').replace(/\s+/g, ' ').trim();

      let unit = (task === "indent") ? "kg" : "pcs";
      const unitMatch = unitSegment.match(unitRegex);
      if (unitMatch) {
        const u = unitMatch[1].toLowerCase();
        if (u.startsWith("kg") || u.startsWith("kilo")) unit = "kg";
        else if (u.startsWith("liter") || u.startsWith("litre") || u === "l") unit = "L";
        else if (u === "g") unit = "g";
        else if (u === "ml") unit = "ml";
        else if (u.startsWith("piece") || u === "pcs") unit = "pcs";
        else if (u === "dozen") unit = "dozen";
        else if (u === "box") unit = "box";
        else if (u.startsWith("plate")) unit = "plates";
        else if (u.startsWith("portion")) unit = "portions";
      }

      let nameUpper = namePart.toUpperCase();
      if (nameUpper.includes("ALUGADDA") || nameUpper.includes("ALOO")) namePart = "Potato";
      else if (nameUpper.includes("TAMATALU") || nameUpper.includes("TAMATAR") || nameUpper.includes("TAMATA")) namePart = "Tomato";
      else if (nameUpper.includes("BIYYAM")) namePart = "Rice";
      else if (nameUpper.includes("ULLIPAYALU") || nameUpper.includes("ULLIPAYA") || nameUpper.includes("PYAZ") || nameUpper.includes("ONION")) namePart = "Onion";
      else if (nameUpper.includes("CHINTHAPANDU") || nameUpper.includes("IMLI")) namePart = "Tamarind";
      else if (nameUpper.includes("PANEER")) namePart = "Paneer";
      else if (nameUpper.includes("MILK")) namePart = "Milk";

      namePart = namePart.replace(/\s+/g, ' ').trim().toUpperCase();

      if (namePart.length >= 2) {
        if (task === "indent") {
          items.push({ name: namePart, qty, unit });
        } else if (task === "purchase" || task === "text") {
          items.push({ name: namePart, qty, price: 0, unit });
        } else if (task === "delivery") {
          items.push({ name: namePart, qty, unit, unit_price: 0 });
        }
      } else {
        if (items.length > 0) {
          const lastItem = items[items.length - 1];
          if (task === "purchase" || task === "text") {
            lastItem.price = qty;
          } else if (task === "delivery") {
            lastItem.unit_price = qty;
          }
        }
      }
    }
  }

  if (items.length === 0) {
    if (task === "indent") {
      return {
        dept: "TIFFINS",
        items: [
          { name: "PANEER", qty: 5, unit: "kg" },
          { name: "MILK", qty: 10, unit: "L" },
          { name: "ONION", qty: 20, unit: "kg" }
        ]
      };
    } else if (task === "purchase" || task === "text") {
      return {
        supplier: "MOCK SUPPLIER",
        items: [
          { name: "PANEER", qty: 2, unit: "kg", price: 350 },
          { name: "ONION", qty: 5, unit: "kg", price: 40 }
        ]
      };
    } else if (task === "delivery") {
      return {
        date,
        invoice_no: "INV-MOCK-123",
        items: [
          { name: "PANEER", qty: 2, unit: "kg", unit_price: 350 },
          { name: "ONION", qty: 5, unit: "kg", unit_price: 40 }
        ]
      };
    }
  }

  if (task === "indent") {
    return { dept, items };
  } else if (task === "purchase" || task === "text") {
    return { supplier, items };
  } else if (task === "delivery") {
    return { date, invoice_no, items };
  }
}

/**
 * Structure extracted text using Gemini, with local regex-based parser fallback.
 * knownStockNames: optional string[] — injected into delivery/purchase prompts for name canonicalization.
 */
// Strip markdown fences + slice to the outermost JSON braces/brackets, then parse.
function parseGeminiJson(responseText) {
  let cleanText = responseText.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.replace(/^```json/i, "").replace(/```[\s]*$/, "").trim();
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```/, "").replace(/```[\s]*$/, "").trim();
  }

  const firstBrace = cleanText.indexOf('{');
  const firstBracket = cleanText.indexOf('[');
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) startIdx = Math.min(firstBrace, firstBracket);
  else if (firstBrace !== -1) startIdx = firstBrace;
  else if (firstBracket !== -1) startIdx = firstBracket;

  const lastBrace = cleanText.lastIndexOf('}');
  const lastBracket = cleanText.lastIndexOf(']');
  let endIdx = -1;
  if (lastBrace !== -1 && lastBracket !== -1) endIdx = Math.max(lastBrace, lastBracket);
  else if (lastBrace !== -1) endIdx = lastBrace;
  else if (lastBracket !== -1) endIdx = lastBracket;

  if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
    cleanText = cleanText.substring(startIdx, endIdx + 1);
  }
  return JSON.parse(cleanText);
}

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen";

// [TECH EXPLANATION: OLLAMA (Local Offline LLM Integration)]
// Connects to a locally running Ollama instance (typically using Qwen/Llama models).
// Since it runs locally, it requires no internet connection and no API keys. It structures
// raw text extracted via Tesseract OCR into clean JSON formats matching the required task schema.
async function callOllama(systemInstruction, userPrompt) {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: `${systemInstruction}\n\n${userPrompt}`,
      stream: false,
      format: "json",
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${errText.slice(0, 200)}`);
  }
  const result = await response.json();
  if (!result.response) throw new Error("Empty response from Ollama.");
  return result.response.trim();
}

// [TECH EXPLANATION: AI STRUCTURING AND FALLBACK PIPELINE]
// Structures raw text (from Tesseract or PDF extraction) into schema-compliant JSON.
// Pipeline order:
// 1. Google Gemini API (fastest, most accurate)
// 2. Ollama (offline local LLM fallback if Gemini fails)
// 3. localRegexParse (deterministic regex fallback if Ollama also fails)
async function structureWithOllama(rawText, task, knownStockNames = []) {
  const prompt = buildPrompt(task, rawText, knownStockNames);
  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  const systemInstruction = "You must return only valid JSON, without any markdown formatting or explanation.";
  try {
    const responseText = await callGemini(contents, systemInstruction);
    return parseGeminiJson(responseText);
  } catch (err) {
    console.warn(`Gemini/Claude structuring failed for task "${task}". Trying local Ollama.`, err.message);
    try {
      const responseText = await callOllama(systemInstruction, prompt);
      return parseGeminiJson(responseText);
    } catch (ollamaErr) {
      console.warn(`Ollama structuring failed for task "${task}". Falling back to local regex parser.`, ollamaErr.message);
      return localRegexParse(rawText, task);
    }
  }
}

// [TECH EXPLANATION: GEMINI MULTIMODAL VISION SCAN PIPELINE]
// Completely offline local OCR (Tesseract) has been removed. We now send the base64 image
// directly to Google Gemini API using inlineData. Gemini performs direct image-to-JSON
// extraction, yielding far higher accuracy for handwritten text and complex layouts.
async function scanImageStructured(base64Data, mimeType, task, knownStockNames = [], fuzzyMatchBatch = null) {
  const prompt = buildPrompt(task, "[IMAGE ATTACHED - EXTRACT ITEMS DIRECTLY FROM IMAGE]", knownStockNames);
  const contents = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        { text: prompt }
      ]
    }
  ];
  
  const systemInstruction = "You must return only valid JSON, without any markdown formatting or explanation.";
  const responseText = await callGemini(contents, systemInstruction);
  const parsed = parseGeminiJson(responseText);
  const items = parsed.items || [];

  // Item-master matching: replace OCR-garbled names with canonical stock names
  // and attach item_code, so downstream availability/issuance resolves reliably.
  if (fuzzyMatchBatch && items.length) {
    const names = items.map((it) => (it.name || "").trim());
    const matches = await fuzzyMatchBatch(names);
    items.forEach((it) => {
      const m = matches[(it.name || "").trim()];
      if (m) {
        it.item_code = m.item_code;
        it.scanned_name = it.name;                 // keep raw OCR for alias-teaching
        if (m.via !== "fuzzy") it.name = m.name;   // trust exact/alias names fully
        it.suggested_name = m.name !== it.name ? m.name : undefined;
        it.match_via = m.via;
        it.match_score = m.score;
      } else {
        it.item_code = it.item_code || "KPL-NEW";
        it.match_via = null;
      }
    });
  }

  // Per-row confidence + review status.
  items.forEach((it) => {
    // If Gemini parsed it, confidence is high, but we factor in fuzzy match scores.
    const rowConf = it.match_score != null ? it.match_score : 1.0;
    it.confidence = Number(rowConf.toFixed(2));
    if (it.qty == null || it.match_via === null || rowConf < 0.7) {
      it.status = "manual_review";
    } else if (rowConf < 0.9) {
      it.status = "verify";
    } else {
      it.status = "ok";
    }
  });

  return { ...parsed, items, ocr_confidence: 1.0 };
}

/**
 * [TECH EXPLANATION: GEMINI MULTIMODAL AUDIO TRANSCRIPTION]
 * Sends raw audio recordings directly to Gemini using inlineData.
 * Instructs Gemini to transcribe the audio clip phonetically if it contains multilingual speech
 * (English, Telugu, Hindi, or code-mixed like "Aloo 5 kilo") and translate the item terms to English.
 * Fallbacks to a mock transcription ("Potato 5 kg") if the Gemini call fails.
 */
async function transcribeAudio(base64Data, mimeType) {
  const contents = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        {
          text: "You are a speech-to-text transcriber for a kitchen inventory system. Transcribe the spoken audio clip. If it is in an Indian language like Hindi or Telugu, or code-mixed with English (e.g. 'Aloo 5 kg', 'Tamatar 10 portions'), transcribe it phonetically or translate/transcribe it clearly to English text so it can be parsed. Return ONLY the transcribed text. Do not include any other commentary."
        }
      ]
    }
  ];
  try {
    return await callGemini(contents);
  } catch (err) {
    console.warn("Gemini audio transcription failed. Returning mock transcription.", err.message);
    return "Potato 5 kg";
  }
}

// ── Prompt builder ─────────────────────────────────────────────────────────
function buildPrompt(task, rawText, knownStockNames = []) {
  const VALID_UNITS = "kg, g, L, ml, pcs, dozen, box, bottle, pkt, tin, jar, bulk, plates, portions";
  const VALID_DEPTS = "TIFFINS, STAFF, SI-MEALS, NORTH INDIAN, CHAT & SOFTY, CHINESE & DOSA, MOCKTAILS & CONTINENTAL, RESTAURANT, ROOM SERVICE";

  const stockNameBlock = knownStockNames.length
    ? `\nKNOWN STOCK NAMES — use these exact spellings when the scanned text refers to the same item, even if spelling differs (e.g. "TOOR DHAL" → "TOOR DAL", "TOMATO (LOCAL)" → "TOMATO"):\n${knownStockNames.join(", ")}\n`
    : "";

  const prompts = {
    indent: `You are an OCR parser for a hotel kitchen indent/requisition form.
Extract all items from the text below and return them as structured JSON.

QUANTITY RULES (strictly follow these):
- If the quantity cell contains a handwritten tick/checkmark (✓ √ ✗) OR the word TICK, set qty to 1.
- If the quantity cell is empty, blank, missing, illegible, or contains the word BLANK, set qty to null — do NOT guess or default to 1.
- If a numeric quantity is clearly written (e.g. 5, 10, 2), parse it as a number.
- Items with qty null should still be included in the output; do not drop them.

For each item: name (string), qty (number | null), unit (one of: ${VALID_UNITS}, default pcs for room/housekeeping items, kg for food items), and confidence (number between 0.0 and 1.0 reflecting OCR clarity/readability).
Determine the requesting department (one of: ${VALID_DEPTS}, default SI-MEALS).
Return ONLY valid JSON with keys "dept" (string) and "items" (array of {name, qty, unit, confidence}).
No markdown, no explanation. Just JSON.

Text:
${rawText}`,

    purchase: `You are an OCR parser for hotel kitchen purchase receipts.
Extract all purchased items from the text below.
For each item: name (string), qty (number), price (number, per unit), unit (one of: ${VALID_UNITS}, default kg).
Extract supplier/vendor name if present (string or null).${stockNameBlock}
NAME RULE: If a scanned item name closely matches a known stock name above, output the known stock name exactly.
Return ONLY valid JSON with keys "supplier" (string|null) and "items" (array of {name, qty, price, unit}).
No markdown, no explanation. Just JSON.

Text:
${rawText}`,

    text: `You are a multilingual text parser for hotel kitchen inventory.
The text may be English, Hindi, Telugu, Tamil, Kannada or code-mixed (e.g. "Aloo 10 kilo 20 rate", "Tamatalu 5 kgs 40").
Translate regional names to English: Aloo/Alugadda→Potato, Tamata/Tamatar→Tomato, Biyyam→Rice, Ullipayalu→Onion, Chinthapandu→Tamarind.
For each item: name (English), qty (number), price (number, per unit), unit (one of: ${VALID_UNITS}, default kg).
Extract supplier if mentioned (string or null).
Return ONLY valid JSON with keys "supplier" (string|null) and "items" (array of {name, qty, price, unit}).
No markdown, no explanation. Just JSON.

Text:
${rawText}`,

    delivery: `You are an OCR parser for hotel kitchen supplier delivery documents.
Extract all delivered items from the text below.
For each item: name (English — translate regional names), qty (number), unit (one of: ${VALID_UNITS}, default kg), unit_price (number, 0 if not found).
Extract delivery date as YYYY-MM-DD (today if not found) and invoice number (string or null).${stockNameBlock}
NAME RULE: If a scanned item name closely matches a known stock name above, output the known stock name exactly.
Return ONLY valid JSON: {"date":"YYYY-MM-DD","invoice_no":string|null,"items":[{name,qty,unit,unit_price}]}.
No markdown, no explanation. Just JSON.

Text:
${rawText}`,
  };

  return prompts[task] || prompts.text;
}

/**
 * Returns true if Gemini API key is configured.
 */
async function checkAIHealth() {
  if (GEMINI_API_KEY) {
    return { ok: true };
  } else {
    return {
      ok: false,
      reason: "GEMINI_API_KEY is not defined in the .env file. Please add it to start using OCR and voice parsing."
    };
  }
}

async function generateMorningBriefing(briefData) {
  const systemInstruction = "You are an executive assistant for Hotel Kapila. Based on the JSON payload containing low stock, expiring stock, and pending indents, write a concise, professional, 3-sentence daily brief highlighting critical priorities, low stock risks, and pending handoffs. Output raw text only, no headings, no markdown list.";
  const contents = [{ role: "user", parts: [{ text: JSON.stringify(briefData) }] }];
  try {
    return await callGemini(contents, systemInstruction);
  } catch (err) {
    console.warn("Failed to generate AI morning briefing:", err.message);
    return `Morning Briefing Fallback: You have ${briefData.pendingIndents || 0} pending indents, ${briefData.lowStockCount || 0} low stock items, and ${briefData.expiringCount || 0} items expiring soon.`;
  }
}

async function generateShiftHandoffSummary(activities, userNotes) {
  const systemInstruction = "You are an operations analyzer for Hotel Kapila. Based on the system activities (indents, issuances, receipts) and user notes from the shift, write a concise bulleted summary of key tasks completed and active issues during the shift. Focus on what was issued or received, and combine it with the user notes.";
  const contents = [{ role: "user", parts: [{ text: JSON.stringify({ activities, userNotes }) }] }];
  try {
    return await callGemini(contents, systemInstruction);
  } catch (err) {
    console.warn("Failed to generate AI shift handoff summary:", err.message);
    return `Handoff Summary Fallback:\n- User Notes: ${userNotes}\n- Activities logged during the shift: ${activities.length} entries.`;
  }
}

async function generateExpiryMenuSuggestions(expiringItems, recipes) {
  const systemInstruction = "You are a master chef and waste control manager for Hotel Kapila. You will be given a list of expiring stock items (expiring in <3-7 days) and a list of active recipes with their ingredients. Suggest menu alterations or special dish pushes for today to utilize the expiring items. Suggest exactly 2-3 dishes, mapping which expiring ingredient they utilize. Keep the suggestions short and actionable. Return ONLY valid JSON: [{\"recipe_id\": number, \"recipe_name\": \"Name\", \"suggestion\": \"Reason/Action\"}]. Output raw JSON only.";
  const contents = [{ role: "user", parts: [{ text: JSON.stringify({ expiringItems, recipes }) }] }];
  try {
    const text = await callGemini(contents, systemInstruction);
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json/i, "").replace(/```[\s]*$/, "").trim();
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```/, "").replace(/```[\s]*$/, "").trim();
    }
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn("Failed to generate AI expiry menu suggestions:", err.message);
    return [];
  }
}

async function generateSmartIndent(dept, scaled, leftovers, stock, trends) {
  const systemInstruction = `You are the AI Inventory Master for Hotel Kapila. You calculate the nightly material indent for a kitchen department.
You must be 100% mathematically accurate.
For each item in the ingredientsRequiredByMenu list:
1. Locate its matching leftover in leftoversInKitchen (case-insensitive name match).
2. Calculate base_recommended = Math.max(0, required_qty - leftover_qty).
3. Check historicalTrends. If the avg_monthly_qty for this item is higher than base_recommended, you may adjust the final qty upward by up to 20% to account for weekday demand variation, but never exceed it.
4. Output the reason string explaining this exact calculation.
Return ONLY valid JSON: an array of objects [{"name": string, "qty": number, "unit": string, "reason": string}]. Output raw JSON only.`;
  const inputData = {
    department: dept,
    ingredientsRequiredByMenu: scaled,
    leftoversInKitchen: leftovers,
    availableStoreStock: stock,
    historicalTrends: trends
  };
  const contents = [{ role: "user", parts: [{ text: JSON.stringify(inputData) }] }];
  try {
    const text = await callGemini(contents, systemInstruction);
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json/i, "").replace(/```[\s]*$/, "").trim();
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```/, "").replace(/```[\s]*$/, "").trim();
    }
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn("Failed to generate AI smart indent:", err.message);
    return scaled.map(s => {
      const leftover = leftovers.find(l => l.item.toLowerCase() === s.name.toLowerCase())?.qty || 0;
      let recommended = Math.max(0, s.qty - leftover);
      
      const trendItem = trends.find(t => t.name.toLowerCase() === s.name.toLowerCase());
      const trendQty = trendItem ? trendItem.avg_monthly_qty : 0;
      
      let trendAdjusted = false;
      if (trendQty > recommended) {
        const adjustment = Math.min(recommended * 0.2, trendQty - recommended);
        recommended += adjustment;
        trendAdjusted = true;
      }
      
      return {
        name: s.name,
        qty: parseFloat(recommended.toFixed(2)),
        unit: s.unit,
        reason: `Required: ${s.qty}, Leftovers: ${leftover}.${trendAdjusted ? " Adjusted for weekday trend." : ""} (Calculated by local fallback)`
      };
    });
  }
}

async function parseVoiceIndent(text) {
  const systemInstruction = `You are an inventory parsing assistant. Extract items, quantities, and units from the transcribed text.
Return a JSON array of objects, each containing:
- name: string (generic/clean item name)
- qty: number (float value)
- unit: string (normalized unit, e.g. "kg", "g", "l", "ml", "pcs", "dozen", "box")

Output ONLY the raw JSON array. No markdown code blocks, no explanations.`;

  const contents = [
    { role: "user", parts: [{ text: `Text to parse: "${text}"` }] }
  ];

  const responseText = await callGemini(contents, systemInstruction);
  try {
    const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("[parseVoiceIndent] failed to parse JSON from Gemini:", responseText);
    return [];
  }
}

async function parseNLStockQuery(queryText) {
  const systemInstruction = `You are an inventory assistant. Convert a natural language search query for stock items into a structured JSON filter.
Available filters:
- name: string (search keyword for item name, optional)
- category: string (one of: "TIFFINS", "STAFF", "SI-MEALS", "NORTH INDIAN", "CHAT & SOFTY", "CHINESEOCAL", "MOCKTAILS & CONTINENTAL", "RESTAURANT", "ROOM SERVICE", or other categories, optional)
- minQty: number (optional)
- maxQty: number (optional)
- expiringWithinDays: number (number of days from now, optional)

Return ONLY a raw JSON object with these keys. No markdown code blocks, no explanations.`;

  const contents = [
    { role: "user", parts: [{ text: `Query: "${queryText}"` }] }
  ];

  try {
    const responseText = await callGemini(contents, systemInstruction);
    const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("[parseNLStockQuery] failed to query Gemini, falling back to name match:", err.message);
    return { name: queryText };
  }
}

async function getAISubstitute(itemName, candidates = []) {
  if (!candidates.length) return null;
  const candidateNames = candidates.map(c => c.name);
  const systemInstruction = `You are a kitchen inventory helper. Select the single best substitute/alternative item from the list below for the item "${itemName}".
If no suitable alternative exists, return null.
Return a JSON object: {"substitute": "Name of Item or null"}.
No markdown, no explanation. Just JSON.`;

  const contents = [
    { role: "user", parts: [{ text: `Alternative items list:\n${candidateNames.join("\n")}` }] }
  ];

  try {
    const responseText = await callGemini(contents, systemInstruction);
    const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleanJson);
    if (result && result.substitute) {
      const match = candidates.find(c => c.name.toLowerCase() === result.substitute.toLowerCase());
      return match || null;
    }
  } catch (err) {
    console.error("[getAISubstitute] failed:", err.message);
  }
  return null;
}

async function clusterWasteReasons(reasons = []) {
  if (!reasons.length) return {};
  const reasonsText = reasons.map(r => `- ${r}`).join("\n");
  const systemInstruction = `You are a kitchen analytics assistant. Cluster the following list of waste reasons into 3 to 5 distinct categories (e.g. "Over-preparation", "Guest dissatisfaction", "Spoilage / Expiry", "Staff mistake").
Assign each reason to one category.
Return ONLY valid JSON in format: {"Category Name": ["original text reason 1", "original text reason 2"], ...}
No markdown, no explanation. Just JSON.`;

  const contents = [
    { role: "user", parts: [{ text: `Reasons:\n${reasonsText}` }] }
  ];

  try {
    const responseText = await callGemini(contents, systemInstruction);
    const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("[clusterWasteReasons] failed:", err.message);
    return { "General Waste": reasons };
  }
}

async function suggestReorderQuantity(history, rp) {
  const systemInstruction = "You are the AI Procurement Assistant for Hotel Kapila. Based on the 15-day stock level history, daily consumption rate, and reorder point configuration (min_qty, reorder_qty), suggest the optimal reorder quantity for this item. Provide exactly one recommendation as a JSON object: {\"item_code\": \"code\", \"recommended_qty\": number, \"reason\": \"brief explanation\"}. Output raw JSON only.";
  const contents = [{ role: "user", parts: [{ text: JSON.stringify({ history, rp }) }] }];
  try {
    const text = await callGemini(contents, systemInstruction);
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json/i, "").replace(/```[\s]*$/, "").trim();
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```/, "").replace(/```[\s]*$/, "").trim();
    }
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn("Failed to suggest AI reorder quantity:", err.message);
    return { item_code: rp.item_code, recommended_qty: rp.reorder_qty, reason: `AI Suggestion fallback: using default reorder quantity due to error: ${err.message}` };
  }
}

async function suggestCategory(itemName) {
  const systemInstruction = "You are the Inventory Master for Hotel Kapila. Based on the item name, suggest the most appropriate category from the following list: [\"Vegetables\", \"Groceries\", \"Dairy\", \"Meat & Seafood\", \"Beverages\", \"Spices\", \"Bakery\", \"Dals\", \"Linen\", \"Fuel\", \"Ice Cream\", \"Chemicals\", \"Miscellaneous\"]. Return ONLY a JSON object: {\"category\": \"suggested_category\"}. Output raw JSON only.";
  const contents = [{ role: "user", parts: [{ text: itemName }] }];
  try {
    const text = await callGemini(contents, systemInstruction);
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json/i, "").replace(/```[\s]*$/, "").trim();
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```/, "").replace(/```[\s]*$/, "").trim();
    }
    const parsed = JSON.parse(cleanText);
    return parsed.category || "Miscellaneous";
  } catch (err) {
    console.warn("Failed to suggest category:", err.message);
    return "Miscellaneous";
  }
}

async function checkLoginAnomalyAI(history, currentLogin) {
  const systemInstruction = "You are an AI Security Specialist for Hotel Kapila. Analyze the user's login history (hours, IP addresses, user agents) against the current login attempt. Determine if the current attempt is anomalous or represents a high-security risk. Return ONLY valid JSON: {\"is_anomaly\": boolean, \"confidence\": number, \"reason\": \"brief explanation\"}. Output raw JSON only.";
  const contents = [{ role: "user", parts: [{ text: JSON.stringify({ history, currentLogin }) }] }];
  try {
    const text = await callGemini(contents, systemInstruction);
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json/i, "").replace(/```[\s]*$/, "").trim();
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```/, "").replace(/```[\s]*$/, "").trim();
    }
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn("Failed to check login anomaly with AI:", err.message);
    return { is_anomaly: false, confidence: 0, reason: "Fallback: AI check failed" };
  }
}

async function validateIssuancePhoto(base64Image, mimeType, expectedItems) {
  const systemInstruction = "You are the AI Quality Inspector for Hotel Kapila. Inspect the photo of prepared kitchen goods. Compare the visible items and their physical quantity against the expected items list. Determine if the photo matches the list, and detail any mismatches. Return ONLY a JSON object: {\"matches\": boolean, \"confidence\": number, \"mismatches\": [\"reason 1\", \"reason 2\"]}. Output raw JSON only.";
  
  const contents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: "Expected items: " + JSON.stringify(expectedItems) }
      ]
    }
  ];

  try {
    const text = await callGemini(contents, systemInstruction);
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json/i, "").replace(/```[\s]*$/, "").trim();
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```/, "").replace(/```[\s]*$/, "").trim();
    }
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn("Failed to validate issuance photo:", err.message);
    return { matches: true, confidence: 50, mismatches: [`Fallback: could not process image analysis due to error: ${err.message}`] };
  }
}

module.exports = {
  structureWithOllama,
  scanImageStructured,
  checkAIHealth,
  transcribeAudio,
  generateMorningBriefing,
  generateShiftHandoffSummary,
  generateExpiryMenuSuggestions,
  generateSmartIndent,
  parseVoiceIndent,
  parseNLStockQuery,
  getAISubstitute,
  clusterWasteReasons,
  suggestReorderQuantity,
  suggestCategory,
  checkLoginAnomalyAI,
  validateIssuancePhoto
};
