const db = require("../db");

/**
 * wasteService.js
 * Kitchen Food Waste Accounting, Cost Valuation, and FSSAI RUCO Compliance.
 * Adapted from MK Paper Mill ERP scrap & waste tracking modules into Hotel Kapila.
 */

/**
 * List kitchen food waste records with departmental filtering and financial aggregates
 */
async function listWasteLogs(filters = {}, pagination = { page: 1, limit: 30 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 30));
  const offset = (page - 1) * limit;

  let query = trxOrDb("food_waste_logs");

  if (filters.department) {
    query = query.where("department", filters.department);
  }

  if (filters.waste_type) {
    query = query.where("waste_type", filters.waste_type);
  }

  if (filters.date_from) {
    query = query.where("waste_date", ">=", filters.date_from);
  }

  if (filters.date_to) {
    query = query.where("waste_date", "<=", filters.date_to);
  }

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    query = query.where((builder) => {
      builder
        .whereILike("item_name", term)
        .orWhereILike("reason", term)
        .orWhereILike("logged_by", term)
        .orWhereILike("authorized_by", term);
    });
  }

  const countRow = await query.clone().clearSelect().clearOrder().count("id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await query
    .clone()
    .orderBy("waste_date", "desc")
    .orderBy("id", "desc")
    .limit(limit)
    .offset(offset);

  // Financial aggregates
  const [aggregates] = await query
    .clone()
    .clearSelect()
    .clearOrder()
    .select(
      trxOrDb.raw("COALESCE(SUM(total_cost), 0) as total_waste_cost"),
      trxOrDb.raw("COALESCE(SUM(qty), 0) as total_waste_qty")
    );

  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      total_waste_cost: parseFloat(aggregates.total_waste_cost) || 0,
      total_waste_qty: parseFloat(aggregates.total_waste_qty) || 0
    }
  };
}

/**
 * Log daily kitchen food waste with automatic unit cost derivation from store stock
 */
async function logWaste(data, user = {}, trxOrDb = db) {
  if (!data.department) throw new Error("Department is required");
  if (!data.waste_type) throw new Error("Waste type is required");
  if (!data.item_name) throw new Error("Item name is required");
  if (data.qty === undefined || data.qty === null || parseFloat(data.qty) <= 0) {
    throw new Error("Valid waste quantity (> 0) is required");
  }

  return await db.transaction(async (trx) => {
    let unitCost = parseFloat(data.unit_cost) || 0;

    // Auto-derive unit cost from stock inventory if not provided
    if (unitCost === 0 && data.stock_id) {
      const stockItem = await trx("stock").where("id", data.stock_id).first();
      if (stockItem && stockItem.price) {
        unitCost = parseFloat(stockItem.price) || 0;
      }
    }

    const qty = parseFloat(data.qty);
    const totalCost = parseFloat((qty * unitCost).toFixed(2));

    const [record] = await trx("food_waste_logs")
      .insert({
        waste_date: data.waste_date || new Date().toISOString().slice(0, 10),
        department: data.department,
        waste_type: data.waste_type,
        item_name: data.item_name.trim(),
        stock_id: data.stock_id || null,
        qty,
        unit: data.unit || "kg",
        unit_cost: unitCost,
        total_cost: totalCost,
        reason: data.reason ? data.reason.trim() : "Daily prep / discard log",
        disposal_method: data.disposal_method || "Organic Composting Bin",
        logged_by: data.logged_by || user.name || "Kitchen Commis",
        authorized_by: data.authorized_by || null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning("*");

    return record;
  });
}

/**
 * Aggregate food waste analytics by department & waste channel
 */
async function getWasteAnalytics(timeframeDays = 30, trxOrDb = db) {
  const days = Math.min(365, Math.max(7, parseInt(timeframeDays, 10) || 30));
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // By Department
  const byDepartment = await trxOrDb("food_waste_logs")
    .where("waste_date", ">=", sinceDate)
    .groupBy("department")
    .select(
      "department",
      trxOrDb.raw("COALESCE(SUM(total_cost), 0) as waste_cost"),
      trxOrDb.raw("COALESCE(SUM(qty), 0) as total_qty"),
      trxOrDb.raw("COUNT(*) as log_count")
    )
    .orderBy("waste_cost", "desc");

  // By Waste Type
  const byWasteType = await trxOrDb("food_waste_logs")
    .where("waste_date", ">=", sinceDate)
    .groupBy("waste_type")
    .select(
      "waste_type",
      trxOrDb.raw("COALESCE(SUM(total_cost), 0) as waste_cost"),
      trxOrDb.raw("COUNT(*) as log_count")
    )
    .orderBy("waste_cost", "desc");

  // Overall summary
  const [totals] = await trxOrDb("food_waste_logs")
    .where("waste_date", ">=", sinceDate)
    .select(
      trxOrDb.raw("COALESCE(SUM(total_cost), 0) as total_waste_cost"),
      trxOrDb.raw("COALESCE(SUM(qty), 0) as total_waste_qty"),
      trxOrDb.raw("COUNT(*) as total_logs")
    );

  return {
    timeframe_days: days,
    total_waste_cost: parseFloat(totals.total_waste_cost) || 0,
    total_waste_qty: parseFloat(totals.total_waste_qty) || 0,
    total_logs: parseInt(totals.total_logs, 10) || 0,
    by_department: byDepartment,
    by_waste_type: byWasteType
  };
}

/**
 * List RUCO (Used Cooking Oil) logs and live collection balance
 */
async function listRucoLogs(filters = {}, pagination = { page: 1, limit: 30 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 30));
  const offset = (page - 1) * limit;

  let query = trxOrDb("used_cooking_oil_logs");

  if (filters.department) {
    query = query.where("department", filters.department);
  }

  const countRow = await query.clone().clearSelect().clearOrder().count("id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await query
    .clone()
    .orderBy("log_date", "desc")
    .orderBy("id", "desc")
    .limit(limit)
    .offset(offset);

  // Latest stock
  const latest = await trxOrDb("used_cooking_oil_logs")
    .orderBy("id", "desc")
    .first();

  const [aggregates] = await trxOrDb("used_cooking_oil_logs").select(
    trxOrDb.raw("COALESCE(SUM(discarded_litres), 0) as total_discarded"),
    trxOrDb.raw("COALESCE(SUM(collected_litres), 0) as total_collected"),
    trxOrDb.raw("COALESCE(SUM(revenue_recovered), 0) as total_revenue")
  );

  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      current_drum_stock_litres: latest ? parseFloat(latest.current_drum_stock_litres) : 0,
      total_oil_discarded_litres: parseFloat(aggregates.total_discarded) || 0,
      total_oil_collected_litres: parseFloat(aggregates.total_collected) || 0,
      total_revenue_recovered: parseFloat(aggregates.total_revenue) || 0
    }
  };
}

/**
 * Record a digital TPC % reading of kitchen frying oil
 */
async function logRucoReading(data, user = {}, trxOrDb = db) {
  if (!data.department) throw new Error("Department is required");
  if (!data.fryer_name) throw new Error("Fryer name is required");
  const tpc = parseFloat(data.tpc_percentage);
  if (isNaN(tpc)) throw new Error("Valid TPC percentage is required");

  return await db.transaction(async (trx) => {
    // Latest drum stock
    const latest = await trx("used_cooking_oil_logs").orderBy("id", "desc").first();
    const currentStock = latest ? parseFloat(latest.current_drum_stock_litres) || 0 : 0;

    let status = data.status || "SAFE_FOR_FRYING";
    let discardedLitres = parseFloat(data.discarded_litres) || 0;

    // FSSAI Statutory threshold: TPC >= 25% MUST be discarded into RUCO drum
    if (tpc >= 25.0) {
      status = "DISCARDED_TO_RUCO_DRUM";
      if (discardedLitres === 0) discardedLitres = 20.00; // default standard fryer capacity
    } else if (tpc >= 21.0 && status === "SAFE_FOR_FRYING") {
      status = "TOP_UP_REQUIRED";
    }

    const newStock = currentStock + discardedLitres;

    const [record] = await trx("used_cooking_oil_logs")
      .insert({
        log_date: data.log_date || new Date().toISOString().slice(0, 10),
        department: data.department,
        fryer_name: data.fryer_name.trim(),
        oil_type: data.oil_type || "Sunflower Oil",
        tpc_percentage: tpc,
        status,
        discarded_litres: discardedLitres,
        current_drum_stock_litres: newStock,
        collected_litres: 0,
        revenue_recovered: 0,
        recorded_by: data.recorded_by || user.name || "Station Chef",
        notes: data.notes ? data.notes.trim() : null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning("*");

    return record;
  });
}

/**
 * Handover accumulated used cooking oil to certified biodiesel collector
 */
async function recordRucoDisposal(data, user = {}, trxOrDb = db) {
  const collectedLitres = parseFloat(data.collected_litres);
  if (isNaN(collectedLitres) || collectedLitres <= 0) {
    throw new Error("Valid collected volume (> 0 litres) is required");
  }
  if (!data.collection_vendor) throw new Error("Authorized Biodiesel Collector vendor name is required");
  if (!data.collection_certificate_no) throw new Error("FSSAI RUCO Collection Certificate # is required");

  return await db.transaction(async (trx) => {
    const latest = await trx("used_cooking_oil_logs").orderBy("id", "desc").first();
    const currentStock = latest ? parseFloat(latest.current_drum_stock_litres) || 0 : 0;
    const newStock = Math.max(0, currentStock - collectedLitres);

    const revenue = parseFloat(data.revenue_recovered) || 0;

    const [record] = await trx("used_cooking_oil_logs")
      .insert({
        log_date: data.log_date || new Date().toISOString().slice(0, 10),
        department: data.department || "CENTRAL_STORE",
        fryer_name: "RUCO Central Collection Drum Yard",
        oil_type: "Mixed Degraded Cooking Oil",
        tpc_percentage: 27.0,
        status: "DISCARDED_TO_RUCO_DRUM",
        discarded_litres: 0,
        current_drum_stock_litres: newStock,
        collected_litres: collectedLitres,
        collection_vendor: data.collection_vendor.trim(),
        collection_certificate_no: data.collection_certificate_no.trim(),
        revenue_recovered: revenue,
        recorded_by: data.recorded_by || user.name || "Store Manager",
        notes: data.notes ? data.notes.trim() : "Handed over to authorized FSSAI RUCO aggregator for biodiesel production.",
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning("*");

    return record;
  });
}

module.exports = {
  listWasteLogs,
  logWaste,
  getWasteAnalytics,
  listRucoLogs,
  logRucoReading,
  recordRucoDisposal
};
