const db = require("../db");
const { structureWithOllama, scanImageStructured, transcribeAudio } = require("../services/localAI");
const { fuzzyMatchBatch } = require("../services/fuzzyMatch");
const { normalizeUnit, convertQty } = require("../utils/units");

// Attach stock linkage (item_code + suggested canonical name) to each scanned
// item WITHOUT altering what the paper said. The scanned name, quantity and unit
// are preserved EXACTLY so the digital indent mirrors the raised slip. We only:
//   - clean the unit token (grm→g, no→pcs) — same value, tidier label
//   - attach item_code so availability/issuance can resolve stock reliably
//   - expose a `suggested_name` the UI can offer, without overwriting the scan
// Unit conversion (grm→kg etc.) happens later at ISSUANCE deduction, not here —
// pre-converting was making the indent show "weird" numbers vs the paper.
async function canonicalizeToStock(parsedItems, fuzzyResults) {
  // A blank / unreadable qty must stay null so the UI flags "needs quantity"
  // instead of silently becoming 0 (which then fails positive() validation).
  const qtyMissing = (q) => q == null || q === "" || isNaN(parseFloat(q));

  return parsedItems.map((it) => {
    const match = fuzzyResults[(it.name || "").trim()];
    const unit = normalizeUnit(it.unit);          // token cleanup only — value unchanged
    const qty = qtyMissing(it.qty) ? null : parseFloat(it.qty);

    const scannedPrice = parseFloat(it.price) > 0 ? parseFloat(it.price) : null;

    if (!match) {
      return { ...it, name: it.name, qty, unit, item_code: "KPL-NEW", match_via: null, scanned_price: scannedPrice };
    }

    return {
      ...it,
      name: it.name,                              // keep EXACTLY what was scanned
      qty,                                         // keep EXACTLY what was scanned
      unit,                                        // keep scanned unit (tidied token)
      item_code: match.item_code,                  // link to stock for availability
      match_via: match.via,
      suggested_name: match.name && match.name !== it.name ? match.name : undefined,
      scanned_price: scannedPrice,                 // fallback rate when no/stale stock price exists
    };
  });
}

// ── POST /api/scan/indent ──────────────────────────────────────────────────
// Accepts: { image: base64string, mime_type: string }
// Runs:    Tesseract OCR → Ollama Gemma structuring → DB insert
async function scanIndent(req, res, next) {
  try {
    const { image, mime_type } = req.body;
    const apiKeyOverride = req.headers["x-api-key"] || null;
    if (!image || !mime_type) {
      return res.status(400).json({ success: false, error: "image and mime_type are required." });
    }

    // Pure-OCR pipeline: preprocess → Tesseract → regex parse → item-master
    // fuzzy match → per-row confidence/status. Matching happens inside the service
    // (fuzzyMatchBatch passed in to avoid a circular require).
    const parsed = await scanImageStructured(image, mime_type, "indent", [], fuzzyMatchBatch, apiKeyOverride);

    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return res.status(422).json({ success: false, error: "No items could be extracted. Please check the image quality." });
    }

    // Validate department against the real departments table.
    let finalDept = "SI-MEALS"; // Default safe fallback
    if (parsed.dept) {
      const deptExists = await db("departments").whereRaw("LOWER(name) = LOWER(?)", [parsed.dept.trim()]).first();
      if (deptExists) {
        finalDept = deptExists.name;
      }
    }

    res.json({
      success: true,
      data: {
        dept: finalDept,
        ocr_confidence: parsed.ocr_confidence,
        items: parsed.items.map((it) => ({
          name: it.name,
          qty: it.qty,
          unit: it.unit || "pcs",
          item_code: it.item_code || "KPL-NEW",
          scanned_name: it.scanned_name || it.name, // raw OCR text — teach an alias on correction
          match_via: it.match_via || null,          // "alias" | "exact" | "fuzzy" | null (unmatched)
          suggested_name: it.suggested_name || null,
          confidence: it.confidence !== undefined ? it.confidence : 1.0,
          status: it.status || "ok",                // "ok" | "verify" | "manual_review"
          unit_mismatch: it.unit_mismatch || false,  // OCR line's unit disagreed with expected/template unit
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/scan/purchase ────────────────────────────────────────────────
// Accepts: { image: base64string, mime_type: string }
async function scanPurchase(req, res, next) {
  try {
    const { image, mime_type, po_id } = req.body;
    const apiKeyOverride = req.headers["x-api-key"] || null;
    if (!image || !mime_type) {
      return res.status(400).json({ success: false, error: "image and mime_type are required." });
    }

    // 1+2. Single-pass: OCR + structure in ONE Gemini call (pass known names for canonicalization)
    const stockNameRows = await db("stock").distinct("name").orderBy("name");
    const knownStockNames = stockNameRows.map((r) => r.name);
    const parsed = await scanImageStructured(image, mime_type, "purchase", knownStockNames, null, apiKeyOverride);

    if (!parsed.items || !Array.isArray(parsed.items)) {
      return res.status(422).json({ success: false, error: "No items could be extracted from the receipt." });
    }

    // Fetch PO details and items if po_id is provided
    let poItems = [];
    let poDetails = null;
    if (po_id) {
      poDetails = await db("purchase_orders").where("id", po_id).first();
      if (poDetails) {
        poItems = await db("purchase_order_items").where("po_id", po_id).select("*");
      }
    }

    // 3. Enrich items (match against PO items if available, or fall back to general stock)
    const enrichedItems = parsed.items.map((it) => {
      let matchedPoItem = null;
      const cleanItName = it.name.trim().toLowerCase();

      if (poItems.length > 0) {
        // Try exact match
        matchedPoItem = poItems.find(poIt => poIt.name.trim().toLowerCase() === cleanItName);
        if (!matchedPoItem) {
          // Try fuzzy / substring match
          matchedPoItem = poItems.find(poIt => {
            const cleanPoItName = poIt.name.trim().toLowerCase();
            return cleanPoItName.includes(cleanItName) || cleanItName.includes(cleanPoItName);
          });
        }
      }

      if (matchedPoItem) {
        return {
          ...it,
          item_code: matchedPoItem.item_code,
          price: it.price || matchedPoItem.unit_price, // Use invoice price if parsed, else PO unit price
          po_matched: true,
          po_qty: matchedPoItem.qty,
          po_price: matchedPoItem.unit_price
        };
      } else {
        return {
          ...it,
          item_code: "",
          po_matched: false
        };
      }
    });

    // Fuzzy-match unresolved items against stock
    const unmatchedItems = enrichedItems.filter(it => !it.item_code);
    if (unmatchedItems.length > 0) {
      const unmatchedNames = unmatchedItems.map(it => it.name.trim());
      const fuzzyResults = await fuzzyMatchBatch(unmatchedNames);
      enrichedItems.forEach(it => {
        if (!it.item_code) {
          const match = fuzzyResults[it.name.trim()];
          if (match) {
            it.item_code = match.item_code;
            it.match_via = match.via;
            it.match_score = match.score;
            if (match.via !== "fuzzy") it.name = match.name;
          }
        }
      });
    }

    res.json({
      success: true,
      data: {
        supplier: parsed.supplier || (poDetails ? poDetails.supplier_name : null),
        items: enrichedItems,
        po_number: poDetails ? poDetails.po_number : null
      }
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/scan/text ────────────────────────────────────────────────────
// Accepts: { text: string }  (voice transcript or pasted text)
async function scanText(req, res, next) {
  try {
    const { text } = req.body;
    const apiKeyOverride = req.headers["x-api-key"] || null;
    if (!text) {
      return res.status(400).json({ success: false, error: "text is required." });
    }

    // No OCR step needed — go straight to LLM structuring
    const parsed = await structureWithOllama(text, "text", [], apiKeyOverride);

    if (!parsed.items || !Array.isArray(parsed.items)) {
      return res.status(422).json({ success: false, error: "Could not parse the text. Please try again with clearer formatting." });
    }

    // Enrich with item codes + canonicalize units to store availability
    const names = (parsed.items || []).map((it) => it.name.trim());
    const fuzzyResults = names.length ? await fuzzyMatchBatch(names) : {};
    const enrichedItems = await canonicalizeToStock(parsed.items, fuzzyResults);

    res.json({
      success: true,
      data: {
        supplier: parsed.supplier || null,
        items: enrichedItems.map((it) => ({
          name: it.name,
          qty: it.qty,
          unit: it.unit || "pcs",
          item_code: it.item_code || "",
          original_unit: it.original_unit,
          unit_mismatch: it.unit_mismatch,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/scan/voice ───────────────────────────────────────────────────
// Accepts: { audio: base64string, mime_type: string }
async function scanVoice(req, res, next) {
  try {
    const { audio, mime_type } = req.body;
    const apiKeyOverride = req.headers["x-api-key"] || null;
    if (!audio || !mime_type) {
      return res.status(400).json({ success: false, error: "audio and mime_type are required." });
    }

    const text = await transcribeAudio(audio, mime_type, apiKeyOverride);
    res.json({ success: true, text });
  } catch (err) {
    next(err);
  }
}

module.exports = { scanIndent, scanPurchase, scanText, scanVoice };
