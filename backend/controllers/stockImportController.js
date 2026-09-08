const db = require("../db");
const multer = require("multer");
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");

// ── Multer setup: accept Excel and PDF into memory ────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
  fileFilter(req, file, cb) {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only .xlsx, .xls and .pdf files are accepted."));
  },
});

// ── Header fuzzy-matching ───────────────────────────────────────────────────
// Map many possible spreadsheet/PDF header spellings onto real `stock` columns.
// Matching is case-insensitive and ignores punctuation/whitespace so
// "Item Name", "item_name", "ITEM-NAME" all resolve the same way.
const HEADER_ALIASES = {
  name: ["item", "itemname", "item name", "product", "productname", "description", "particulars"],
  item_code: ["itemcode", "item code", "sku", "code", "productcode"],
  remaining: ["qty", "quantity", "stock", "currentstock", "current stock", "closingstock", "closing stock", "balance", "instock", "on hand", "onhand"],
  unit: ["unit", "uom", "u.o.m", "units"],
  price: ["price", "rate", "purchaseprice", "purchase price", "avgpurchaseprice", "average purchase price", "unitprice", "unit price", "cost"],
  category: ["category", "cat", "group"],
  supplier: ["supplier", "vendor", "supplier name"],
  expiry_date: ["expiry", "expirydate", "expiry date", "exp", "expdate", "bestbefore", "best before"],
  date: ["date", "purchasedate", "purchase date", "receiveddate", "received date"],
  min_alert_qty: ["minalert", "min alert", "reorderlevel", "reorder level", "minqty", "min qty", "minimumstock"],
  batch_no: ["batch", "batchno", "batch no", "batchnumber"],
};

function normalizeHeader(h) {
  return String(h || "").toLowerCase().trim().replace(/[_.]/g, " ").replace(/\s+/g, " ");
}

// Build a lookup once: normalized alias string -> stock column
const ALIAS_LOOKUP = {};
for (const [col, aliases] of Object.entries(HEADER_ALIASES)) {
  for (const a of aliases) ALIAS_LOOKUP[normalizeHeader(a)] = col;
}

function matchHeaderToColumn(header) {
  const norm = normalizeHeader(header);
  if (ALIAS_LOOKUP[norm]) return ALIAS_LOOKUP[norm];
  // loose contains-match fallback (e.g. "Item Name (KG)")
  for (const [aliasNorm, col] of Object.entries(ALIAS_LOOKUP)) {
    if (norm.includes(aliasNorm)) return col;
  }
  return null;
}

// Map a raw header row -> { columnIndex: stockColumn }, and report which
// headers could not be mapped to anything.
function mapHeaders(headerRow) {
  const colMap = {}; // index -> stock column
  const mappedColumns = [];
  const unmappedHeaders = [];
  headerRow.forEach((h, idx) => {
    if (h === undefined || h === null || String(h).trim() === "") return;
    const col = matchHeaderToColumn(h);
    if (col && !colMap.hasColumnFor) {
      // avoid clobbering an earlier mapped column of the same name
    }
    if (col) {
      colMap[idx] = col;
      mappedColumns.push({ header: h, column: col });
    } else {
      unmappedHeaders.push(h);
    }
  });
  return { colMap, mappedColumns, unmappedHeaders };
}

function toRowObject(rawRow, colMap) {
  const obj = {};
  Object.entries(colMap).forEach(([idx, col]) => {
    let val = rawRow[idx];
    if (val === undefined || val === null) return;
    if (typeof val === "string") val = val.trim();
    obj[col] = val;
  });
  return obj;
}

function isNumericLike(v) {
  if (v === null || v === undefined || v === "") return false;
  return !isNaN(parseFloat(v));
}

function excelSerialToDate(serial) {
  // Excel date serials are days since 1899-12-30
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const d = new Date(utcValue * 1000);
  return d.toISOString().slice(0, 10);
}

function normalizeParsedRow(obj, rowIndex) {
  const errors = [];
  const row = { ...obj, _row: rowIndex };

  if (!row.name || String(row.name).trim() === "") {
    errors.push("missing item name");
  } else {
    row.name = String(row.name).trim();
  }

  // remaining/qty: required, numeric, >= 0
  if (row.remaining !== undefined) {
    const n = parseFloat(row.remaining);
    if (isNaN(n) || n < 0) {
      errors.push("quantity is not a valid non-negative number");
    } else {
      row.remaining = n;
      row.qty = n; // qty mirrors remaining for a fresh import batch
    }
  } else {
    errors.push("missing quantity");
  }

  if (!row.unit || String(row.unit).trim() === "") {
    row.unit = "kg"; // matches stock table default
  } else {
    row.unit = String(row.unit).trim();
  }

  if (row.price !== undefined) {
    const p = parseFloat(row.price);
    row.price = isNaN(p) ? null : p;
  }

  if (row.expiry_date !== undefined && row.expiry_date !== "") {
    if (typeof row.expiry_date === "number") {
      row.expiry_date = excelSerialToDate(row.expiry_date);
    } else {
      const d = new Date(row.expiry_date);
      row.expiry_date = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
  }

  if (row.date !== undefined && row.date !== "") {
    if (typeof row.date === "number") {
      row.date = excelSerialToDate(row.date);
    } else {
      const d = new Date(row.date);
      row.date = isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
    }
  } else {
    row.date = new Date().toISOString().slice(0, 10);
  }

  if (row.item_code) row.item_code = String(row.item_code).trim();
  if (row.category) row.category = String(row.category).trim();
  if (row.supplier) row.supplier = String(row.supplier).trim();
  if (row.min_alert_qty !== undefined) {
    const m = parseFloat(row.min_alert_qty);
    row.min_alert_qty = isNaN(m) ? null : m;
  }
  if (row.batch_no) row.batch_no = String(row.batch_no).trim();

  row._valid = errors.length === 0;
  row._errors = errors;
  return row;
}

// ── Excel parsing ──────────────────────────────────────────────────────
function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false });

  if (!rows || rows.length === 0) {
    return { rows: [], mappedColumns: [], unmappedHeaders: [], invalidCount: 0 };
  }

  const headerRow = rows[0];
  const { colMap, mappedColumns, unmappedHeaders } = mapHeaders(headerRow);
  const dataRows = rows.slice(1);

  const parsedRows = dataRows
    .filter((r) => r.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ""))
    .map((r, i) => normalizeParsedRow(toRowObject(r, colMap), i + 2)); // +2 = 1-indexed + header row

  const invalidCount = parsedRows.filter((r) => !r._valid).length;

  return { rows: parsedRows.slice(0, 500), totalRows: parsedRows.length, mappedColumns, unmappedHeaders, invalidCount };
}

// ── PDF parsing (best-effort, lossy) ────────────────────────────────────────
// PDF text extraction has no reliable notion of "columns" — pdf-parse gives us
// a flat text stream, so we can only guess row boundaries from line breaks and
// guess column boundaries from whitespace runs / patterns like
// "<name> <qty> <unit> <price>". This is inherently approximate: merged
// columns, wrapped item names, and multi-line cells will not parse cleanly.
// Every PDF import is flagged lowConfidence so the manager reviews it before
// committing — never trust these rows the way you'd trust an Excel import.
function parsePdfText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Try to find a header line among the first few lines to reuse the same
  // fuzzy column mapping as Excel (split on 2+ spaces or tabs, which is how
  // most PDF table exporters space out columns).
  const splitLine = (l) => l.split(/\s{2,}|\t/).map((s) => s.trim()).filter(Boolean);

  let headerIdx = -1;
  let colMap = {};
  let mappedColumns = [];
  let unmappedHeaders = [];
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const cells = splitLine(lines[i]);
    const guess = mapHeaders(cells);
    if (guess.mappedColumns.length >= 2) {
      headerIdx = i;
      colMap = guess.colMap;
      mappedColumns = guess.mappedColumns;
      unmappedHeaders = guess.unmappedHeaders;
      break;
    }
  }

  const dataLines = headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines;

  // Fallback pattern when no header row was recognized: "<name words> <qty> <unit> [price]"
  const rowPattern = /^(.+?)\s+([\d,]+(?:\.\d+)?)\s*([a-zA-Z]+)?\s*([\d,]+(?:\.\d+)?)?$/;

  const parsedRows = [];
  dataLines.forEach((line, i) => {
    let obj = null;
    if (headerIdx >= 0) {
      const cells = splitLine(line);
      if (cells.length >= 2) obj = toRowObject(cells, colMap);
    }
    if (!obj || !obj.name) {
      const m = line.match(rowPattern);
      if (m) {
        obj = {
          name: m[1].trim(),
          remaining: m[2].replace(/,/g, ""),
          unit: m[3] || undefined,
          price: m[4] ? m[4].replace(/,/g, "") : undefined,
        };
      }
    }
    if (obj && obj.name) {
      parsedRows.push(normalizeParsedRow(obj, i + 1));
    }
  });

  const invalidCount = parsedRows.filter((r) => !r._valid).length;

  return {
    rows: parsedRows.slice(0, 500),
    totalRows: parsedRows.length,
    mappedColumns,
    unmappedHeaders,
    invalidCount,
  };
}

// ── POST /api/stock-import/preview ─────────────────────────────────────────
// multipart/form-data: { file: <.xlsx/.xls/.pdf> }
// Preview only — nothing is written to the database here.
async function preview(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded. Please attach a .xlsx, .xls or .pdf file." });
    }

    const isPdf = req.file.mimetype === "application/pdf";
    let result;
    let lowConfidence = false;
    let confidenceMessage = null;

    if (isPdf) {
      const pdfData = await pdfParse(req.file.buffer);
      const rawText = pdfData.text;
      if (!rawText || rawText.trim().length < 10) {
        return res.status(422).json({
          success: false,
          error: "PDF appears to be image-based (scanned) or empty — no extractable text found. Please export a text-based PDF or use an Excel file instead.",
        });
      }
      result = parsePdfText(rawText);
      lowConfidence = true;
      confidenceMessage =
        "PDF table extraction is approximate: rows are guessed from text layout, not a real table structure. " +
        "Item names, quantities, units and prices may be merged, split or misread — review every row carefully before committing.";
    } else {
      result = parseExcel(req.file.buffer);
    }

    res.json({
      success: true,
      data: {
        sourceType: isPdf ? "pdf" : "excel",
        lowConfidence,
        confidenceMessage,
        rows: result.rows,
        totalRowsParsed: result.totalRows,
        previewRowCount: result.rows.length,
        mappedColumns: result.mappedColumns,
        unmappedHeaders: result.unmappedHeaders,
        invalidRowCount: result.invalidCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/stock-import/commit ───────────────────────────────────────────
// JSON: { rows: [...reviewed/edited rows from preview...], mode: "insert_new_only" | "update_existing" }
async function commit(req, res, next) {
  try {
    const { rows, mode } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: "No rows to import." });
    }
    if (!["insert_new_only", "update_existing"].includes(mode)) {
      return res.status(400).json({ success: false, error: "mode must be 'insert_new_only' or 'update_existing'." });
    }

    const uploaderId = req.user && req.user.id ? req.user.id : null;
    const uploaderName = req.user && (req.user.name || req.user.username) ? (req.user.name || req.user.username) : "unknown";

    const summary = { inserted: 0, updated: 0, skipped: 0, skippedReasons: [] };

    await db.transaction(async (trx) => {
      for (const raw of rows) {
        const name = raw.name ? String(raw.name).trim() : "";
        const remaining = parseFloat(raw.remaining);
        const unit = raw.unit ? String(raw.unit).trim() : "";

        if (!name) {
          summary.skipped++;
          summary.skippedReasons.push({ row: raw._row, reason: "missing item name" });
          continue;
        }
        if (isNaN(remaining) || remaining < 0) {
          summary.skipped++;
          summary.skippedReasons.push({ row: raw._row, reason: "quantity is not a valid non-negative number" });
          continue;
        }
        if (!unit) {
          summary.skipped++;
          summary.skippedReasons.push({ row: raw._row, reason: "missing unit" });
          continue;
        }

        // Find an existing row: prefer item_code, else exact case-insensitive trimmed name.
        let existing = null;
        if (raw.item_code) {
          existing = await trx("stock").whereRaw("LOWER(TRIM(item_code)) = LOWER(TRIM(?))", [raw.item_code]).first();
        }
        if (!existing) {
          existing = await trx("stock").whereRaw("LOWER(TRIM(name)) = LOWER(TRIM(?))", [name]).first();
        }

        const payload = {
          name,
          qty: remaining,
          remaining,
          unit,
          date: raw.date || new Date().toISOString().slice(0, 10),
          price: raw.price !== undefined && raw.price !== null && raw.price !== "" ? parseFloat(raw.price) : null,
          supplier: raw.supplier || null,
          expiry_date: raw.expiry_date || null,
          min_alert_qty: raw.min_alert_qty !== undefined && raw.min_alert_qty !== null && raw.min_alert_qty !== "" ? parseFloat(raw.min_alert_qty) : null,
          item_code: raw.item_code || (existing ? existing.item_code : null),
          category: raw.category || null,
          batch_no: raw.batch_no || null,
        };
        if (uploaderId) payload.created_by = uploaderId;
        if (!payload.item_code) delete payload.item_code; // let DB/app defaults handle item_code assignment elsewhere if truly missing

        if (existing) {
          if (mode === "update_existing") {
            await trx("stock").where("id", existing.id).update(payload);
            summary.updated++;
          } else {
            // insert_new_only: existing rows are left untouched
            summary.skipped++;
            summary.skippedReasons.push({ row: raw._row, reason: `"${name}" already exists — skipped (mode is insert_new_only)` });
          }
        } else {
          await trx("stock").insert(payload);
          summary.inserted++;
        }
      }

      await trx("audit_logs").insert({
        actor_user_id: uploaderId,
        actor_name: uploaderName,
        action: "bulk_import",
        resource: "stock",
        metadata: JSON.stringify({
          mode,
          rows_submitted: rows.length,
          inserted: summary.inserted,
          updated: summary.updated,
          skipped: summary.skipped,
        }),
        created_at: new Date(),
      });
    });

    res.json({
      success: true,
      data: {
        message: `Import complete: ${summary.inserted} inserted, ${summary.updated} updated, ${summary.skipped} skipped.`,
        ...summary,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, preview, commit };
