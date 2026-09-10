const db = require("../db");

/**
 * utilityService.js
 * Commercial Kitchen & Facility Utility Telemetry Engine.
 * Adapted from MK Paper Mill ERP (utility.js) for Hotel Kapila.
 * 
 * Tracks:
 * - Commercial LPG cylinder manifold bank consumption (kg) and inventory (active, empty, full)
 * - Electricity EB kWh meter readings and daily burn rate
 * - DG Generator runtime (hours), power generated, and diesel fuel tank levels
 * - Water supply (municipal KL, water tankers delivered, and RO drinking water plant yield)
 */

/**
 * List utility readings with filtering and aggregate summary
 */
async function listReadings(filters = {}, pagination = { page: 1, limit: 30 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 30));
  const offset = (page - 1) * limit;

  let query = trxOrDb("hotel_utility_readings");

  if (filters.date_from) {
    query = query.where("reading_date", ">=", filters.date_from);
  }

  if (filters.date_to) {
    query = query.where("reading_date", "<=", filters.date_to);
  }

  if (filters.shift) {
    query = query.where("shift", filters.shift);
  }

  const countRow = await query.clone().clearSelect().clearOrder().count("id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await query
    .clone()
    .orderBy("reading_date", "desc")
    .orderBy("id", "desc")
    .limit(limit)
    .offset(offset);

  // Compute aggregate totals across selected filter range
  const [aggregates] = await query
    .clone()
    .clearSelect()
    .clearOrder()
    .select(
      trxOrDb.raw("COALESCE(SUM(lpg_consumed_kg), 0) as total_lpg_consumed_kg"),
      trxOrDb.raw("COALESCE(SUM(eb_units_consumed), 0) as total_eb_units"),
      trxOrDb.raw("COALESCE(SUM(dg_run_hours), 0) as total_dg_run_hours"),
      trxOrDb.raw("COALESCE(SUM(dg_diesel_consumed_litres), 0) as total_dg_diesel_litres"),
      trxOrDb.raw("COALESCE(SUM(water_tanker_litres), 0) as total_water_tanker_litres"),
      trxOrDb.raw("COALESCE(SUM(water_tanker_count), 0) as total_water_tankers"),
      trxOrDb.raw("COALESCE(SUM(ro_plant_output_litres), 0) as total_ro_output_litres")
    );

  // Get most recent reading for gauge display
  const latest = await trxOrDb("hotel_utility_readings")
    .orderBy("reading_date", "desc")
    .orderBy("id", "desc")
    .first();

  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      total_lpg_consumed_kg: parseFloat(aggregates.total_lpg_consumed_kg) || 0,
      total_eb_units: parseFloat(aggregates.total_eb_units) || 0,
      total_dg_run_hours: parseFloat(aggregates.total_dg_run_hours) || 0,
      total_dg_diesel_litres: parseFloat(aggregates.total_dg_diesel_litres) || 0,
      total_water_tanker_litres: parseFloat(aggregates.total_water_tanker_litres) || 0,
      total_water_tankers: parseInt(aggregates.total_water_tankers, 10) || 0,
      total_ro_output_litres: parseFloat(aggregates.total_ro_output_litres) || 0
    },
    latest: latest || null
  };
}

/**
 * Record a shift utility reading
 */
async function recordReading(data, user = {}, trxOrDb = db) {
  if (!data.reading_date) throw new Error("Reading date is required");

  return await db.transaction(async (trx) => {
    const lpgStart = parseFloat(data.lpg_start_kg) || 0;
    const lpgEnd = parseFloat(data.lpg_end_kg) || 0;
    let lpgConsumed = parseFloat(data.lpg_consumed_kg);
    if (isNaN(lpgConsumed) || lpgConsumed === null) {
      lpgConsumed = Math.max(0, lpgStart - lpgEnd);
    }

    const ebStart = parseFloat(data.eb_meter_start) || 0;
    const ebEnd = parseFloat(data.eb_meter_end) || 0;
    let ebConsumed = parseFloat(data.eb_units_consumed);
    if (isNaN(ebConsumed) || ebConsumed === null) {
      ebConsumed = Math.max(0, ebEnd - ebStart);
    }

    const [record] = await trx("hotel_utility_readings")
      .insert({
        reading_date: data.reading_date,
        shift: data.shift || "FULL_DAY",
        lpg_start_kg: lpgStart,
        lpg_end_kg: lpgEnd,
        lpg_consumed_kg: lpgConsumed,
        lpg_active_cylinders: parseInt(data.lpg_active_cylinders, 10) || 8,
        lpg_empty_cylinders: parseInt(data.lpg_empty_cylinders, 10) || 0,
        lpg_full_cylinders: parseInt(data.lpg_full_cylinders, 10) || 0,
        lpg_pressure_bar: parseFloat(data.lpg_pressure_bar) || 1.50,
        eb_meter_start: ebStart,
        eb_meter_end: ebEnd,
        eb_units_consumed: ebConsumed,
        dg_run_hours: parseFloat(data.dg_run_hours) || 0,
        dg_units_kwh: parseFloat(data.dg_units_kwh) || 0,
        dg_diesel_consumed_litres: parseFloat(data.dg_diesel_consumed_litres) || 0,
        dg_diesel_stock_litres: parseFloat(data.dg_diesel_stock_litres) || 0,
        water_tanker_count: parseInt(data.water_tanker_count, 10) || 0,
        water_tanker_litres: parseFloat(data.water_tanker_litres) || 0,
        municipal_water_kl: parseFloat(data.municipal_water_kl) || 0,
        ro_plant_output_litres: parseFloat(data.ro_plant_output_litres) || 0,
        recorded_by: data.recorded_by || user.name || "Duty Supervisor",
        notes: data.notes || null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning("*");

    return record;
  });
}

/**
 * Get utility analytics & historical daily trends
 */
async function getUtilityAnalytics(timeframeDays = 30, trxOrDb = db) {
  const days = Math.min(365, Math.max(7, parseInt(timeframeDays, 10) || 30));
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // Group by date
  const dailyTrends = await trxOrDb("hotel_utility_readings")
    .where("reading_date", ">=", sinceDate)
    .groupBy("reading_date")
    .orderBy("reading_date", "asc")
    .select(
      "reading_date",
      trxOrDb.raw("SUM(lpg_consumed_kg) as daily_lpg_kg"),
      trxOrDb.raw("SUM(eb_units_consumed) as daily_eb_units"),
      trxOrDb.raw("SUM(dg_diesel_consumed_litres) as daily_diesel_litres"),
      trxOrDb.raw("SUM(water_tanker_litres) as daily_tanker_litres"),
      trxOrDb.raw("SUM(ro_plant_output_litres) as daily_ro_litres")
    );

  // High-level averages
  const [overall] = await trxOrDb("hotel_utility_readings")
    .where("reading_date", ">=", sinceDate)
    .select(
      trxOrDb.raw("COUNT(DISTINCT reading_date) as active_days"),
      trxOrDb.raw("COALESCE(SUM(lpg_consumed_kg), 0) as total_lpg"),
      trxOrDb.raw("COALESCE(SUM(eb_units_consumed), 0) as total_eb"),
      trxOrDb.raw("COALESCE(SUM(dg_diesel_consumed_litres), 0) as total_diesel"),
      trxOrDb.raw("COALESCE(SUM(water_tanker_litres), 0) as total_tanker_water")
    );

  const activeDays = parseInt(overall.active_days, 10) || 1;
  const avgDailyLpg = parseFloat((parseFloat(overall.total_lpg) / activeDays).toFixed(2));
  const avgDailyEb = parseFloat((parseFloat(overall.total_eb) / activeDays).toFixed(2));

  // Current Live Inventory state from the latest reading
  const latest = await trxOrDb("hotel_utility_readings")
    .orderBy("reading_date", "desc")
    .orderBy("id", "desc")
    .first();

  return {
    timeframe_days: days,
    active_days: activeDays,
    averages: {
      avg_daily_lpg_kg: avgDailyLpg,
      avg_daily_eb_units: avgDailyEb,
      avg_daily_diesel_litres: parseFloat((parseFloat(overall.total_diesel) / activeDays).toFixed(2)),
      avg_daily_tanker_litres: parseFloat((parseFloat(overall.total_tanker_water) / activeDays).toFixed(2))
    },
    live_state: latest ? {
      lpg_active_cylinders: latest.lpg_active_cylinders,
      lpg_empty_cylinders: latest.lpg_empty_cylinders,
      lpg_full_cylinders: latest.lpg_full_cylinders,
      lpg_pressure_bar: latest.lpg_pressure_bar,
      dg_diesel_stock_litres: latest.dg_diesel_stock_litres,
      last_reading_date: latest.reading_date,
      last_shift: latest.shift
    } : null,
    daily_trends: dailyTrends
  };
}

module.exports = {
  listReadings,
  recordReading,
  getUtilityAnalytics
};
