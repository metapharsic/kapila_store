const db = require("../db");

/**
 * foodSafetyService.js
 * Food Safety HACCP Receiving Inspections and Kitchen Hygiene Audits.
 * Adapted from MK Paper Mill ERP quality testing modules into Hotel Kapila.
 */

/**
 * List receiving inspections with filtering and compliance statistics
 */
async function listInspections(filters = {}, pagination = { page: 1, limit: 30 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 30));
  const offset = (page - 1) * limit;

  let query = trxOrDb("food_quality_inspections");

  if (filters.category) {
    query = query.where("category", filters.category);
  }

  if (filters.status) {
    query = query.where("status", filters.status);
  }

  if (filters.date_from) {
    query = query.where("inspection_date", ">=", filters.date_from);
  }

  if (filters.date_to) {
    query = query.where("inspection_date", "<=", filters.date_to);
  }

  if (filters.temp_compliant !== undefined && filters.temp_compliant !== "") {
    const isComp = filters.temp_compliant === "true" || filters.temp_compliant === true;
    query = query.where("temp_compliant", isComp);
  }

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    query = query.where((builder) => {
      builder
        .whereILike("item_name", term)
        .orWhereILike("item_code", term)
        .orWhereILike("supplier_name", term)
        .orWhereILike("challan_number", term)
        .orWhereILike("inspector_name", term)
        .orWhereILike("rejection_reason", term);
    });
  }

  const countRow = await query.clone().clearSelect().clearOrder().count("id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await query
    .clone()
    .orderBy("inspection_date", "desc")
    .orderBy("id", "desc")
    .limit(limit)
    .offset(offset);

  // High-level compliance stats
  const [stats] = await trxOrDb("food_quality_inspections").select(
    trxOrDb.raw("COUNT(*) as total_inspections"),
    trxOrDb.raw("COUNT(CASE WHEN status = 'PASSED' THEN 1 END) as passed_count"),
    trxOrDb.raw("COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_count"),
    trxOrDb.raw("COUNT(CASE WHEN temp_compliant = true THEN 1 END) as temp_compliant_count")
  );

  const totalAll = parseInt(stats.total_inspections, 10) || 1;
  const passedAll = parseInt(stats.passed_count, 10) || 0;
  const passRate = parseFloat(((passedAll / totalAll) * 100).toFixed(1));

  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    stats: {
      total_inspections: parseInt(stats.total_inspections, 10) || 0,
      passed_count: passedAll,
      rejected_count: parseInt(stats.rejected_count, 10) || 0,
      temp_compliant_count: parseInt(stats.temp_compliant_count, 10) || 0,
      pass_rate_pct: passRate
    }
  };
}

/**
 * Log a new HACCP food receiving quality inspection
 */
async function createInspection(data, user = {}, trxOrDb = db) {
  if (!data.item_name) throw new Error("Item name is required");
  if (!data.category) throw new Error("Food category is required");

  return await db.transaction(async (trx) => {
    let tempCompliant = true;
    const receivingTemp = data.receiving_temp_c !== undefined && data.receiving_temp_c !== null && data.receiving_temp_c !== "" 
      ? parseFloat(data.receiving_temp_c) 
      : null;
    const tempMax = data.temp_threshold_max_c !== undefined && data.temp_threshold_max_c !== null && data.temp_threshold_max_c !== ""
      ? parseFloat(data.temp_threshold_max_c)
      : null;

    if (receivingTemp !== null && tempMax !== null) {
      tempCompliant = receivingTemp <= tempMax;
    }

    let status = data.status || (tempCompliant ? "PASSED" : "REJECTED");
    if (!tempCompliant && !data.status) {
      status = "REJECTED";
    }

    const [inspection] = await trx("food_quality_inspections")
      .insert({
        inspection_date: data.inspection_date || new Date().toISOString().slice(0, 10),
        item_name: data.item_name.trim(),
        item_code: data.item_code ? data.item_code.trim() : null,
        category: data.category,
        supplier_name: data.supplier_name ? data.supplier_name.trim() : null,
        supplier_id: data.supplier_id || null,
        challan_number: data.challan_number ? data.challan_number.trim() : null,
        receiving_temp_c: receivingTemp,
        temp_threshold_min_c: data.temp_threshold_min_c ? parseFloat(data.temp_threshold_min_c) : null,
        temp_threshold_max_c: tempMax,
        temp_compliant: tempCompliant,
        packaging_seal: data.packaging_seal || "INTACT",
        sensory_rating: data.sensory_rating || "EXCELLENT",
        expiry_date_verified: data.expiry_date_verified !== undefined ? data.expiry_date_verified : true,
        status: status,
        rejection_reason: data.rejection_reason || null,
        action_taken: data.action_taken || (status === "PASSED" ? "Accepted into Cold Storage" : "Returned to Vendor"),
        inspector_name: data.inspector_name || user.name || "Receiving Chef",
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning("*");

    return inspection;
  });
}

/**
 * Get Quality Telemetry summary for top KPI ribbon
 */
async function getQualityTelemetry(trxOrDb = db) {
  const [stats] = await trxOrDb("food_quality_inspections").select(
    trxOrDb.raw("COUNT(*) as total_inspections"),
    trxOrDb.raw("COUNT(CASE WHEN status = 'PASSED' THEN 1 END) as passed_count"),
    trxOrDb.raw("COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_count"),
    trxOrDb.raw("COUNT(CASE WHEN temp_compliant = true THEN 1 END) as temp_compliant_count")
  );

  const recentRejections = await trxOrDb("food_quality_inspections")
    .where("status", "REJECTED")
    .orderBy("inspection_date", "desc")
    .limit(5);

  const total = parseInt(stats.total_inspections, 10) || 1;
  const passed = parseInt(stats.passed_count, 10) || 0;

  return {
    total_inspections: parseInt(stats.total_inspections, 10) || 0,
    passed_count: passed,
    rejected_count: parseInt(stats.rejected_count, 10) || 0,
    compliance_rate_pct: parseFloat(((passed / total) * 100).toFixed(1)),
    recent_rejections: recentRejections
  };
}

/**
 * List pest control & hygiene audit records
 */
async function listPestLogs(pagination = { page: 1, limit: 20 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const countRow = await trxOrDb("hygiene_pest_control_logs").count("id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await trxOrDb("hygiene_pest_control_logs")
    .orderBy("service_date", "desc")
    .limit(limit)
    .offset(offset);

  return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Log a pest control / hygiene audit service
 */
async function createPestLog(data, user = {}, trxOrDb = db) {
  if (!data.service_type) throw new Error("Service type is required");
  if (!data.service_agency) throw new Error("Service agency is required");

  return await db.transaction(async (trx) => {
    const areas = Array.isArray(data.areas_covered) 
      ? data.areas_covered 
      : (typeof data.areas_covered === "string" ? data.areas_covered.split(",").map(s => s.trim()) : ["Kitchen", "Storage"]);

    const [record] = await trx("hygiene_pest_control_logs")
      .insert({
        service_date: data.service_date || new Date().toISOString().slice(0, 10),
        service_type: data.service_type,
        service_agency: data.service_agency.trim(),
        technician_name: data.technician_name ? data.technician_name.trim() : null,
        areas_covered: JSON.stringify(areas),
        chemicals_used: data.chemicals_used || null,
        trap_count_installed: parseInt(data.trap_count_installed, 10) || 0,
        pest_activity_detected: data.pest_activity_detected || "NONE",
        hygiene_score: parseInt(data.hygiene_score, 10) || 95,
        supervisor_signoff: data.supervisor_signoff || user.name || "Executive Chef",
        remarks: data.remarks || null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning("*");

    return record;
  });
}

module.exports = {
  listInspections,
  createInspection,
  getQualityTelemetry,
  listPestLogs,
  createPestLog
};
