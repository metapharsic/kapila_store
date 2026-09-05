const db = require("../db");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { structureWithOllama, scanImageStructured } = require("../services/localAI");
const { fuzzyMatchBatch } = require("../services/fuzzyMatch");

// ── Multer setup: accept PDF and images into memory ────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
  fileFilter(req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG, WEBP images and PDF files are accepted."));
  },
});

const DELIVERY_PROMPT_TASK = "delivery";

// ── POST /api/approved-delivery/scan ─────────────────────────────────────
// Accepts: multipart/form-data  { file: <PDF or image>, supplier_id: <number> }
// Returns: preview of extracted items (not saved yet)
async function scan(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded. Please attach a PDF or image." });
    }

    const supplier_id = req.body.supplier_id;
    if (!supplier_id) {
      return res.status(400).json({ success: false, error: "supplier_id is required." });
    }

    const supplier = await db("suppliers").where("id", supplier_id).first();
    if (!supplier) {
      return res.status(400).json({ success: false, error: "Supplier not found." });
    }

    // Fetch distinct stock names to help Gemini canonicalize during structuring
    const stockNameRows = await db("stock").distinct("name").orderBy("name");
    const knownStockNames = stockNameRows.map((r) => r.name);

    let extracted;

    if (req.file.mimetype === "application/pdf") {
      // PDF: extract embedded text via pdf-parse (no network needed), then structure
      const pdfData = await pdfParse(req.file.buffer);
      const rawText = pdfData.text;
      if (!rawText || rawText.trim().length < 10) {
        return res.status(422).json({
          success: false,
          error: "PDF appears to be image-based (scanned). Please upload a photo/image of the document instead.",
        });
      }
      extracted = await structureWithOllama(rawText, DELIVERY_PROMPT_TASK, knownStockNames);
    } else {
      // Image: single-pass OCR + structure in ONE Gemini call
      const base64 = req.file.buffer.toString("base64");
      extracted = await scanImageStructured(base64, req.file.mimetype, DELIVERY_PROMPT_TASK, knownStockNames);
    }

    if (!extracted.items || !Array.isArray(extracted.items)) {
      return res.status(422).json({ success: false, error: "AI could not extract items from this document. Please try a clearer image." });
    }

    // Fuzzy-match each item name (alias → exact → pg_trgm similarity)
    const scannedNames = extracted.items.map((it) => (it.name || "").trim()).filter(Boolean);
    const fuzzyResults = scannedNames.length ? await fuzzyMatchBatch(scannedNames) : {};

    const enrichedItems = extracted.items.map((it) => {
      const key = (it.name || "").trim();
      const match = fuzzyResults[key];
      return {
        name: match && match.via !== "fuzzy" ? match.name : it.name,
        qty: it.qty || 0,
        unit: it.unit || (match ? match.unit : null) || "kg",
        unit_price: it.unit_price || 0,
        landed_cost: ((it.qty || 0) * (it.unit_price || 0)).toFixed(2),
        item_code: match ? match.item_code : "",
        stock_match: !!match,
        match_score: match ? match.score : null,
        match_via: match ? match.via : null,
        original_name: match && match.name !== it.name ? it.name : undefined,
      };
    });

    res.json({
      success: true,
      data: {
        supplier: { id: supplier.id, name: supplier.name },
        date: extracted.date || new Date().toISOString().slice(0, 10),
        invoice_no: extracted.invoice_no || null,
        items: enrichedItems,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/approved-delivery/commit ────────────────────────────────────
// Accepts: JSON { supplier_id, date, invoice_no, received_by, items: [...] }
// Creates a GRN record + inserts stock entries — mirrors grnController.create
async function commit(req, res, next) {
  try {
    const { supplier_id, date, invoice_no, received_by, remarks, items } = req.body;

    if (!supplier_id) return res.status(400).json({ success: false, error: "supplier_id is required." });
    if (!items || items.length === 0) return res.status(400).json({ success: false, error: "No items to save." });

    const supplier = await db("suppliers").where("id", supplier_id).first();
    if (!supplier) return res.status(400).json({ success: false, error: "Supplier not found." });

    // Generate GRN number (same logic as grnController)
    const dateObj = new Date(date);
    const formattedDate = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
    const [{ count }] = await db("goods_receipt_notes").where("date", date).count("id as count");
    const seq = parseInt(count || 0) + 1;
    const grn_number = `GRN-${formattedDate}-${String(seq).padStart(4, "0")}`;

    const total_amount = items.reduce((s, it) => s + (parseFloat(it.landed_cost) || 0), 0);

    const result = await db.transaction(async (trx) => {
      // 1. Insert GRN header
      const [grn] = await trx("goods_receipt_notes")
        .insert({
          grn_number,
          po_id: null,
          supplier_id,
          date,
          invoice_no: invoice_no || null,
          received_by: received_by || null,
          remarks: remarks || "Created via AI document scan",
          total_amount,
        })
        .returning("*");

      // 2. Insert GRN items + stock batches
      const savedItems = [];
      for (const it of items) {
        const qty_received = parseFloat(it.qty) || 0;
        const qty_accepted = qty_received;
        const unit_price   = parseFloat(it.unit_price) || 0;
        const landed_cost  = parseFloat(it.landed_cost) || qty_accepted * unit_price;
        const item_code    = it.item_code || it.name.toUpperCase().replace(/\s+/g, "-").slice(0, 20);

        const [savedItem] = await trx("goods_receipt_items")
          .insert({
            grn_id: grn.id,
            item_code,
            name: it.name,
            qty_ordered: null,
            qty_received,
            qty_accepted,
            qty_rejected: 0,
            unit: it.unit,
            unit_price,
            landed_cost,
            batch_no: null,
            expiry_date: null,
          })
          .returning("*");

        savedItems.push(savedItem);

        if (qty_accepted > 0) {
          const batch = `BAT-${formattedDate}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          await trx("stock").insert({
            name: it.name,
            qty: qty_accepted,
            remaining: qty_accepted,
            unit: it.unit,
            date,
            price: unit_price || (landed_cost / qty_accepted),
            supplier: supplier.name,
            supplier_id: supplier.id,
            expiry_date: null,
            min_alert_qty: null,
            item_code,
            batch_no: batch,
            grn_item_id: savedItem.id,
          });
        }
      }

      return { ...grn, items: savedItems };
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, scan, commit };
