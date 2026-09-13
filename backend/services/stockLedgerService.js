const db = require("../db");

/**
 * stockLedgerService.js
 * Central double-entry inventory and financial ledger engine.
 * Records immutable debit/credit entries for all stock movements across
 * GRN, Indent Issuance, Batch Append, Stock Adjustments, and Returns.
 */

/**
 * Record an atomic stock ledger entry within an active database transaction.
 * @param {import('knex').Knex.Transaction} trx - Active Knex transaction
 * @param {Object} entry - Ledger entry details
 */
async function recordEntry(trx, {
  stock_id = null,
  item_code,
  item_name,
  category = null,
  transaction_type,
  qty,
  unit,
  unit_price = 0,
  total_value = null,
  balance_qty_before = null,
  balance_qty_after = null,
  batch_no = null,
  department = null,
  supplier = null,
  invoice_no = null,
  reference_doc_type,
  reference_doc_id = null,
  reference_doc_no = null,
  reason = null,
  notes = null,
  created_by = "Storekeeper",
  created_at = null
}) {
  if (!item_code || !item_name || !transaction_type || qty === undefined || !unit || !reference_doc_type) {
    throw new Error(`[stockLedgerService] Missing required ledger fields: item_code, item_name, transaction_type, qty, unit, and reference_doc_type are mandatory.`);
  }

  const ALLOWED_TYPES = [
    "INWARD_GRN",
    "INWARD_PURCHASE",
    "INWARD_DC_PROVISIONAL",
    "OUTWARD_ISSUE",
    "ADJUSTMENT_ADD",
    "ADJUSTMENT_DEDUCT",
    "RETURN_TO_VENDOR",
    "OPENING_BALANCE",
    "TRANSFER_OUT",
    "TRANSFER_IN",
    "TRANSFER_LOSS"
  ];
  if (!ALLOWED_TYPES.includes(transaction_type)) {
    throw new Error(`[stockLedgerService] Invalid transaction_type '${transaction_type}'. Allowed types: ${ALLOWED_TYPES.join(", ")}`);
  }

  const numericQty = parseFloat(qty) || 0;
  const numericPrice = parseFloat(unit_price) || 0;
  const calculatedTotalValue = total_value !== null ? parseFloat(total_value) : Math.round(numericQty * numericPrice * 100) / 100;

  // Auto-resolve balance before and balance after if not explicitly supplied
  let before = balance_qty_before !== null ? parseFloat(balance_qty_before) : null;
  let after = balance_qty_after !== null ? parseFloat(balance_qty_after) : null;

  const runner = trx || db;

  if (before === null) {
    // Check latest ledger balance for this item
    const latestLedgerRow = await runner("stock_ledger")
      .where("item_code", item_code)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .select("balance_qty_after")
      .first();

    if (latestLedgerRow) {
      before = parseFloat(latestLedgerRow.balance_qty_after);
    } else {
      // If no prior ledger entry exists for this SKU:
      if (["INWARD_GRN", "INWARD_PURCHASE", "INWARD_DC_PROVISIONAL", "OPENING_BALANCE", "TRANSFER_IN"].includes(transaction_type)) {
        before = 0;
      } else {
        const stockAggregate = await runner("stock")
          .where("item_code", item_code)
          .sum("remaining as total")
          .first();
        const currentRemaining = parseFloat(stockAggregate?.total || 0);
        before = currentRemaining + numericQty;
      }
    }
  }

  if (after === null) {
    const isInflow = [
      "INWARD_GRN",
      "INWARD_PURCHASE",
      "INWARD_DC_PROVISIONAL",
      "ADJUSTMENT_ADD",
      "OPENING_BALANCE",
      "TRANSFER_IN"
    ].includes(transaction_type);

    if (isInflow) {
      after = Math.round((before + numericQty) * 1000) / 1000;
    } else {
      after = Math.max(0, Math.round((before - numericQty) * 1000) / 1000);
    }
  }

  const [row] = await runner("stock_ledger")
    .insert({
      stock_id,
      item_code,
      item_name,
      category,
      transaction_type,
      qty: numericQty,
      unit,
      unit_price: numericPrice,
      total_value: calculatedTotalValue,
      balance_qty_before: before,
      balance_qty_after: after,
      batch_no,
      department,
      supplier,
      invoice_no,
      reference_doc_type,
      reference_doc_id,
      reference_doc_no,
      reason,
      notes,
      created_by,
      created_at: created_at || runner.fn.now()
    })
    .returning("*");

  return row;
}

/**
 * Query ledger entries with rich filtering, aggregation, and pagination.
 */
async function queryLedger(filters = {}, pagination = {}) {
  const {
    q,
    type,
    department,
    supplier,
    item_code,
    date_from,
    date_to
  } = filters || {};

  const page = Math.max(1, parseInt(pagination.page) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(pagination.limit) || 20));
  const offset = pagination.offset !== undefined ? pagination.offset : (page - 1) * limit;
  
  const ALLOWED_SORTS = [
    "created_at",
    "id",
    "qty",
    "unit_price",
    "total_value",
    "item_name",
    "item_code",
    "transaction_type",
    "department"
  ];
  let sort = pagination.sort === "date" ? "created_at" : (pagination.sort || "created_at");
  if (!ALLOWED_SORTS.includes(sort)) {
    sort = "created_at";
  }
  const order = pagination.order === "asc" ? "asc" : "desc";

  const applyFilters = (qb) => {
    if (type && typeof type === "string" && type.trim() !== "" && type.trim() !== "ALL") {
      qb.where("transaction_type", type.trim());
    }
    if (department && typeof department === "string" && department.trim() !== "" && department.trim() !== "ALL") {
      qb.whereILike("department", `%${department.trim()}%`);
    }
    if (supplier && typeof supplier === "string" && supplier.trim() !== "") {
      qb.whereILike("supplier", `%${supplier.trim()}%`);
    }
    if (item_code && typeof item_code === "string" && item_code.trim() !== "") {
      qb.where("item_code", item_code.trim());
    }
    if (date_from && typeof date_from === "string" && date_from.trim() !== "") {
      qb.where("created_at", ">=", `${date_from.trim()} 00:00:00`);
    }
    if (date_to && typeof date_to === "string" && date_to.trim() !== "") {
      qb.where("created_at", "<=", `${date_to.trim()} 23:59:59`);
    }
    if (q && typeof q === "string" && q.trim() !== "") {
      const term = `%${q.trim()}%`;
      qb.where((inner) => {
        inner.whereILike("item_name", term)
          .orWhereILike("item_code", term)
          .orWhereILike("department", term)
          .orWhereILike("supplier", term)
          .orWhereILike("batch_no", term)
          .orWhereILike("invoice_no", term)
          .orWhereILike("reference_doc_no", term);
      });
    }
  };

  const [{ count }] = await db("stock_ledger").modify(applyFilters).count("id as count");

  const [aggregates] = await db("stock_ledger").modify(applyFilters).select(
    db.raw("COALESCE(SUM(CASE WHEN transaction_type IN ('INWARD_GRN', 'INWARD_PURCHASE', 'INWARD_DC_PROVISIONAL', 'ADJUSTMENT_ADD', 'OPENING_BALANCE', 'TRANSFER_IN') THEN qty ELSE 0 END), 0) as total_inflow_qty"),
    db.raw("COALESCE(SUM(CASE WHEN transaction_type IN ('INWARD_GRN', 'INWARD_PURCHASE', 'INWARD_DC_PROVISIONAL', 'ADJUSTMENT_ADD', 'OPENING_BALANCE', 'TRANSFER_IN') THEN total_value ELSE 0 END), 0) as total_inflow_value"),
    db.raw("COALESCE(SUM(CASE WHEN transaction_type IN ('OUTWARD_ISSUE', 'ADJUSTMENT_DEDUCT', 'RETURN_TO_VENDOR', 'TRANSFER_OUT', 'TRANSFER_LOSS') THEN qty ELSE 0 END), 0) as total_outflow_qty"),
    db.raw("COALESCE(SUM(CASE WHEN transaction_type IN ('OUTWARD_ISSUE', 'ADJUSTMENT_DEDUCT', 'RETURN_TO_VENDOR', 'TRANSFER_OUT', 'TRANSFER_LOSS') THEN total_value ELSE 0 END), 0) as total_outflow_value")
  );

  const rawRows = await db("stock_ledger")
    .modify(applyFilters)
    .orderBy(sort, order)
    .orderBy("id", "desc")
    .offset(offset)
    .limit(limit);

  const rows = rawRows.map((r) => ({
    ...r,
    date: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : null
  }));

  return {
    rows,
    total: parseInt(count || 0),
    page,
    limit,
    summary: {
      totalInflowQty: parseFloat(aggregates?.total_inflow_qty || 0),
      totalInflowValue: parseFloat(aggregates?.total_inflow_value || 0),
      totalOutflowQty: parseFloat(aggregates?.total_outflow_qty || 0),
      totalOutflowValue: parseFloat(aggregates?.total_outflow_value || 0)
    }
  };
}

/**
 * Atomically re-tag existing provisional ledger entries to confirmed GRN upon 3-way invoice match.
 * Prevents double-counting while updating valuation and final document references.
 */
async function retagEntry(trx, {
  reference_doc_type = "DC",
  reference_doc_id,
  new_transaction_type = "INWARD_GRN",
  new_reference_doc_type = "GRN",
  new_reference_doc_id = null,
  new_reference_doc_no = null,
  invoice_no = null,
  unit_price = null,
  total_value = null,
  notes = null
}) {
  const runner = trx || db;
  const updatePayload = {
    transaction_type: new_transaction_type,
    reference_doc_type: new_reference_doc_type,
  };
  if (new_reference_doc_id) updatePayload.reference_doc_id = new_reference_doc_id;
  if (new_reference_doc_no) updatePayload.reference_doc_no = new_reference_doc_no;
  if (invoice_no) updatePayload.invoice_no = invoice_no;
  if (unit_price !== null && unit_price !== undefined) updatePayload.unit_price = parseFloat(unit_price);
  if (total_value !== null && total_value !== undefined) updatePayload.total_value = parseFloat(total_value);
  if (notes) updatePayload.notes = notes;

  const count = await runner("stock_ledger")
    .where("reference_doc_type", reference_doc_type)
    .where("reference_doc_id", reference_doc_id)
    .update(updatePayload);

  return count;
}

module.exports = {
  recordEntry,
  queryLedger,
  retagEntry
};
