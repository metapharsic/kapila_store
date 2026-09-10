const db = require("../db");

/**
 * nightAuditService.js
 * Midnight Food Cost Night Audit & Daily Store Rollover Engine
 */

const CANONICAL_DEPARTMENTS = [
  "TIFFINS",
  "STAFF",
  "SI-MEALS",
  "NORTH INDIAN",
  "CHAT & SOFTY",
  "CHINESE & DOSA",
  "MOCKTAILS & CONTINENTAL",
  "RESTAURANT",
  "ROOM SERVICE"
];

/**
 * Generate preview of daily food cost audit before freezing
 */
async function getDailyAuditPreview(targetDate = null, estimatedRevenue = null, trxOrDb = db) {
  const dateStr = targetDate || new Date().toISOString().slice(0, 10);

  // 1. Material Issued Cost from stock_ledger or issuances
  const ledgerIssues = await trxOrDb("stock_ledger")
    .where("transaction_type", "OUTWARD_ISSUE")
    .whereRaw("DATE(created_at) = ?", [dateStr])
    .groupBy("department")
    .select(
      "department",
      trxOrDb.raw("COALESCE(SUM(total_value), 0) as issued_cost"),
      trxOrDb.raw("COALESCE(SUM(qty), 0) as issued_qty")
    );

  const issuedMap = {};
  ledgerIssues.forEach((row) => {
    if (row.department) {
      issuedMap[row.department.toUpperCase()] = parseFloat(row.issued_cost) || 0;
    }
  });

  // If stock_ledger has 0 issues for this date, check issuances table
  if (Object.keys(issuedMap).length === 0) {
    const rawIssuances = await trxOrDb("issuances as i")
      .join("issuance_items as ii", "i.id", "ii.issuance_id")
      .where("i.date", dateStr)
      .groupBy("i.dept")
      .select(
        "i.dept as department",
        trxOrDb.raw("COALESCE(SUM(ii.issued * 85), 0) as estimated_cost"), // fallback average rate
        trxOrDb.raw("COALESCE(SUM(ii.issued), 0) as total_qty")
      );
    rawIssuances.forEach((row) => {
      if (row.department) {
        issuedMap[row.department.toUpperCase()] = parseFloat(row.estimated_cost) || 0;
      }
    });
  }

  // 2. Food Waste Cost from food_waste_logs
  const wasteLogs = await trxOrDb("food_waste_logs")
    .where("waste_date", dateStr)
    .groupBy("department")
    .select(
      "department",
      trxOrDb.raw("COALESCE(SUM(total_cost), 0) as waste_cost"),
      trxOrDb.raw("COALESCE(SUM(qty), 0) as waste_qty")
    );

  const wasteMap = {};
  wasteLogs.forEach((row) => {
    if (row.department) {
      wasteMap[row.department.toUpperCase()] = parseFloat(row.waste_cost) || 0;
    }
  });

  // 3. Synthesize department breakdown
  let totalMaterialCost = 0;
  let totalWasteCost = 0;
  const departmentBreakdown = CANONICAL_DEPARTMENTS.map((dept) => {
    const issuedCost = issuedMap[dept] || 0;
    const wasteCost = wasteMap[dept] || 0;
    const directCost = issuedCost + wasteCost;
    totalMaterialCost += issuedCost;
    totalWasteCost += wasteCost;

    return {
      department: dept,
      issued_cost: parseFloat(issuedCost.toFixed(2)),
      waste_cost: parseFloat(wasteCost.toFixed(2)),
      direct_cost: parseFloat(directCost.toFixed(2))
    };
  });

  const totalKitchenDirectCost = parseFloat((totalMaterialCost + totalWasteCost).toFixed(2));

  // 4. Food Sales Revenue (default baseline ₹1,20,000 to ₹1,45,000 if not provided)
  const revenue = estimatedRevenue && parseFloat(estimatedRevenue) > 0
    ? parseFloat(estimatedRevenue)
    : (totalKitchenDirectCost > 0 ? parseFloat((totalKitchenDirectCost / 0.30).toFixed(2)) : 125000.00);

  const targetFoodCostPct = 32.00;
  const actualFoodCostPct = revenue > 0
    ? parseFloat(((totalKitchenDirectCost / revenue) * 100).toFixed(2))
    : 0;
  const variancePct = parseFloat((actualFoodCostPct - targetFoodCostPct).toFixed(2));

  // 5. Flag Discrepancies
  const discrepancies = [];
  departmentBreakdown.forEach((dept) => {
    if (dept.waste_cost > 1000) {
      discrepancies.push({
        type: "HIGH_DEPARTMENT_WASTE",
        department: dept.department,
        message: `Waste cost in ${dept.department} (₹${dept.waste_cost}) exceeded daily threshold ₹1,000.`
      });
    }
  });

  if (actualFoodCostPct > 35.00) {
    discrepancies.push({
      type: "HIGH_OVERALL_FOOD_COST",
      message: `Overall Food Cost of ${actualFoodCostPct}% exceeded statutory target of 32.00% by +${variancePct}%.`
    });
  }

  // Check if audit was already closed for this date
  const existingAudit = await trxOrDb("daily_night_audit_logs")
    .where("audit_date", dateStr)
    .first();

  return {
    audit_date: dateStr,
    is_already_closed: !!existingAudit,
    existing_audit: existingAudit || null,
    total_material_issued_cost: parseFloat(totalMaterialCost.toFixed(2)),
    total_food_waste_cost: parseFloat(totalWasteCost.toFixed(2)),
    total_kitchen_direct_cost: totalKitchenDirectCost,
    total_food_revenue: revenue,
    food_cost_percentage: actualFoodCostPct,
    target_food_cost_pct: targetFoodCostPct,
    variance_pct: variancePct,
    department_breakdown: departmentBreakdown,
    discrepancies_flagged: discrepancies,
    suggested_status: discrepancies.length > 0 ? "FLAGGED_DISCREPANCY" : "COMPLETED"
  };
}

/**
 * Execute and lock the daily night audit
 */
async function executeNightAudit(data, user = {}, trxOrDb = db) {
  const auditDate = data.audit_date || new Date().toISOString().slice(0, 10);

  return await db.transaction(async (trx) => {
    const existing = await trx("daily_night_audit_logs").where("audit_date", auditDate).first();

    const issuedCost = parseFloat(data.total_material_issued_cost) || 0;
    const wasteCost = parseFloat(data.total_food_waste_cost) || 0;
    const directCost = parseFloat((issuedCost + wasteCost).toFixed(2));
    const revenue = parseFloat(data.total_food_revenue) || 120000.00;
    const targetPct = parseFloat(data.target_food_cost_pct) || 32.00;
    const actualPct = revenue > 0 ? parseFloat(((directCost / revenue) * 100).toFixed(2)) : 0;
    const variance = parseFloat((actualPct - targetPct).toFixed(2));

    const deptBreakdown = Array.isArray(data.department_breakdown)
      ? data.department_breakdown
      : [];
    const discrepancies = Array.isArray(data.discrepancies_flagged)
      ? data.discrepancies_flagged
      : [];

    const auditStatus = discrepancies.length > 0 ? "FLAGGED_DISCREPANCY" : (data.audit_status || "COMPLETED");

    const payload = {
      audit_date: auditDate,
      total_material_issued_cost: issuedCost,
      total_food_waste_cost: wasteCost,
      total_kitchen_direct_cost: directCost,
      total_food_revenue: revenue,
      food_cost_percentage: actualPct,
      target_food_cost_pct: targetPct,
      variance_pct: variance,
      department_breakdown: JSON.stringify(deptBreakdown),
      discrepancies_flagged: JSON.stringify(discrepancies),
      audit_status: auditStatus,
      auditor_name: data.auditor_name || user.name || "Store Manager",
      rollover_notes: data.rollover_notes ? data.rollover_notes.trim() : "Night audit closed. Material issuances and waste ledger balances frozen.",
      updated_at: new Date()
    };

    if (existing) {
      const [updated] = await trx("daily_night_audit_logs")
        .where("id", existing.id)
        .update(payload)
        .returning("*");

      await trx("audit_logs").insert({
        actor_user_id: user.id || null,
        actor_name: user.name || user.username || payload.auditor_name || null,
        action: "night_audit.update",
        resource: "night_audit",
        resource_id: updated.id,
        metadata: JSON.stringify({
          audit_date: auditDate,
          audit_status: auditStatus,
          food_cost_percentage: actualPct,
          variance_pct: variance,
        }),
        created_at: new Date(),
      });

      return updated;
    } else {
      payload.created_at = new Date();
      const [inserted] = await trx("daily_night_audit_logs")
        .insert(payload)
        .returning("*");

      await trx("audit_logs").insert({
        actor_user_id: user.id || null,
        actor_name: user.name || user.username || payload.auditor_name || null,
        action: existing ? "night_audit.update" : "night_audit.execute",
        resource: "night_audit",
        resource_id: inserted.id,
        metadata: JSON.stringify({
          audit_date: auditDate,
          audit_status: auditStatus,
          food_cost_percentage: actualPct,
          variance_pct: variance,
        }),
        created_at: new Date(),
      });

      return inserted;
    }
  });
}

/**
 * List historical night audit logs
 */
async function listNightAuditLogs(filters = {}, pagination = { page: 1, limit: 30 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 30));
  const offset = (page - 1) * limit;

  let query = trxOrDb("daily_night_audit_logs");

  if (filters.status && filters.status !== "ALL") {
    query = query.where("audit_status", filters.status);
  }
  if (filters.date_from) {
    query = query.where("audit_date", ">=", filters.date_from);
  }
  if (filters.date_to) {
    query = query.where("audit_date", "<=", filters.date_to);
  }

  const countRow = await query.clone().clearSelect().clearOrder().count("id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await query
    .clone()
    .orderBy("audit_date", "desc")
    .limit(limit)
    .offset(offset);

  return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Get Night Audit telemetry for top KPI ribbon
 */
async function getNightAuditTelemetry(trxOrDb = db) {
  const [stats] = await trxOrDb("daily_night_audit_logs").select(
    trxOrDb.raw("COUNT(*) as total_audits"),
    trxOrDb.raw("COUNT(CASE WHEN audit_status = 'COMPLETED' THEN 1 END) as compliant_audits"),
    trxOrDb.raw("COUNT(CASE WHEN audit_status = 'FLAGGED_DISCREPANCY' THEN 1 END) as flagged_audits"),
    trxOrDb.raw("COALESCE(AVG(food_cost_percentage), 0) as avg_food_cost_pct"),
    trxOrDb.raw("COALESCE(SUM(total_kitchen_direct_cost), 0) as cumulative_cost_total"),
    trxOrDb.raw("COALESCE(SUM(total_food_revenue), 0) as cumulative_revenue_total")
  );

  const latest = await trxOrDb("daily_night_audit_logs")
    .orderBy("audit_date", "desc")
    .first();

  return {
    total_audits: parseInt(stats ? stats.total_audits : 0, 10),
    compliant_audits: parseInt(stats ? stats.compliant_audits : 0, 10),
    flagged_audits: parseInt(stats ? stats.flagged_audits : 0, 10),
    avg_food_cost_pct: parseFloat(parseFloat(stats ? stats.avg_food_cost_pct : 0).toFixed(2)),
    cumulative_cost_total: parseFloat(stats ? stats.cumulative_cost_total : 0) || 0,
    cumulative_revenue_total: parseFloat(stats ? stats.cumulative_revenue_total : 0) || 0,
    latest_audit: latest || null
  };
}

module.exports = {
  getDailyAuditPreview,
  executeNightAudit,
  listNightAuditLogs,
  getNightAuditTelemetry
};
