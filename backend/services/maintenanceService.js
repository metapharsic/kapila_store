const db = require("../db");
const stockLedgerService = require("./stockLedgerService");

/**
 * maintenanceService.js
 * Computerized Maintenance Management System (CMMS) Engine
 * Adapted from MK Paper Mill ERP for Hotel Kapila Kitchen & Facility Operations.
 */

// Generate sequential WO number: WO-YYYY-XXXX
async function generateWorkOrderNumber(trxOrDb = db) {
  const year = new Date().getFullYear();
  const prefix = `WO-${year}-`;
  const offset = prefix.length + 1;
  
  const lastWo = await trxOrDb("maintenance_work_orders")
    .whereILike("wo_number", `${prefix}%`)
    .orderByRaw(`CAST(SUBSTRING(wo_number, ${offset}) AS INTEGER) DESC`)
    .select("wo_number")
    .first();

  let nextSeq = 1;
  if (lastWo && lastWo.wo_number) {
    const parts = lastWo.wo_number.split("-");
    const parsed = parseInt(parts[2], 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

// Generate sequential Asset Code: KPL-EQ-XXX
async function generateAssetCode(trxOrDb = db) {
  const prefix = "KPL-EQ-";
  const offset = prefix.length + 1;
  const lastAsset = await trxOrDb("hotel_assets")
    .whereILike("asset_code", `${prefix}%`)
    .orderByRaw(`CAST(SUBSTRING(asset_code, ${offset}) AS INTEGER) DESC`)
    .select("asset_code")
    .first();

  let nextSeq = 1;
  if (lastAsset && lastAsset.asset_code) {
    const num = parseInt(lastAsset.asset_code.replace(prefix, ""), 10);
    if (!isNaN(num)) nextSeq = num + 1;
  }
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

// Calculate next due date given a frequency and base date
function calculateNextDueDate(frequency, fromDate = new Date()) {
  const base = new Date(fromDate);
  switch ((frequency || "").toUpperCase()) {
    case "DAILY":
      base.setDate(base.getDate() + 1);
      break;
    case "WEEKLY":
      base.setDate(base.getDate() + 7);
      break;
    case "BI_WEEKLY":
      base.setDate(base.getDate() + 14);
      break;
    case "MONTHLY":
      base.setMonth(base.getMonth() + 1);
      break;
    case "QUARTERLY":
      base.setMonth(base.getMonth() + 3);
      break;
    case "ANNUAL":
      base.setFullYear(base.getFullYear() + 1);
      break;
    default:
      base.setMonth(base.getMonth() + 1);
  }
  return base.toISOString().slice(0, 10);
}

/**
 * 1. ASSETS
 */
async function listAssets(filters = {}, pagination = {}) {
  const { q, department, category, status, criticality } = filters;
  const page = parseInt(pagination.page, 10) || 1;
  const limit = parseInt(pagination.limit, 10) || 50;
  const offset = (page - 1) * limit;

  const applyFilters = (qb) => {
    if (department) qb.where("department", department);
    if (category) qb.where("category", category);
    if (status) qb.where("status", status);
    if (criticality) qb.where("criticality", criticality);
    if (q) {
      qb.where((inner) => {
        inner.whereILike("name", `%${q}%`)
          .orWhereILike("asset_code", `%${q}%`)
          .orWhereILike("location", `%${q}%`)
          .orWhereILike("manufacturer", `%${q}%`)
          .orWhereILike("model_no", `%${q}%`)
          .orWhereILike("serial_no", `%${q}%`);
      });
    }
  };

  const [{ count }] = await db("hotel_assets").modify(applyFilters).count("id as count");

  const [stats] = await db("hotel_assets").select(
    db.raw("COUNT(id) as total_count"),
    db.raw("COUNT(id) FILTER (WHERE status = 'OPERATIONAL') as operational_count"),
    db.raw("COUNT(id) FILTER (WHERE status = 'BREAKDOWN') as breakdown_count"),
    db.raw("COUNT(id) FILTER (WHERE status = 'UNDER_MAINTENANCE') as maintenance_count")
  );

  const rows = await db("hotel_assets")
    .modify(applyFilters)
    .orderBy("criticality", "desc")
    .orderBy("id", "asc")
    .offset(offset)
    .limit(limit);

  return {
    rows,
    total: parseInt(count, 10),
    page,
    limit,
    stats: {
      total: parseInt(stats?.total_count || 0, 10),
      operational: parseInt(stats?.operational_count || 0, 10),
      breakdown: parseInt(stats?.breakdown_count || 0, 10),
      underMaintenance: parseInt(stats?.maintenance_count || 0, 10)
    }
  };
}

async function getAssetDetails(assetId) {
  const asset = await db("hotel_assets").where("id", assetId).first();
  if (!asset) return null;

  const schedules = await db("maintenance_schedules")
    .where("asset_id", assetId)
    .orderBy("next_due_date", "asc");

  const workOrders = await db("maintenance_work_orders")
    .where("asset_id", assetId)
    .orderBy("created_at", "desc")
    .limit(10);

  const partsConsumed = await db("maintenance_parts_consumed")
    .join("maintenance_work_orders as wo", "wo.id", "maintenance_parts_consumed.work_order_id")
    .where("wo.asset_id", assetId)
    .select("maintenance_parts_consumed.*", "wo.wo_number", "wo.created_at as wo_date");

  const [costTotals] = await db("maintenance_work_orders")
    .where("asset_id", assetId)
    .select(
      db.raw("COALESCE(SUM(labor_cost), 0) as total_labor"),
      db.raw("COALESCE(SUM(parts_cost), 0) as total_parts"),
      db.raw("COALESCE(SUM(total_cost), 0) as total_spent"),
      db.raw("COALESCE(SUM(downtime_minutes), 0) as total_downtime")
    );

  return {
    asset,
    schedules,
    workOrders,
    partsConsumed,
    costSummary: {
      totalLabor: parseFloat(costTotals?.total_labor || 0),
      totalParts: parseFloat(costTotals?.total_parts || 0),
      totalSpent: parseFloat(costTotals?.total_spent || 0),
      totalDowntimeMinutes: parseInt(costTotals?.total_downtime || 0, 10)
    }
  };
}

async function createAsset(data) {
  const asset_code = data.asset_code || (await generateAssetCode());
  const qr_code = `kapila://asset/${asset_code}`;

  const [asset] = await db("hotel_assets")
    .insert({
      asset_code,
      name: data.name,
      department: data.department,
      location: data.location || null,
      category: data.category || "COOKING_RANGE",
      manufacturer: data.manufacturer || null,
      model_no: data.model_no || null,
      serial_no: data.serial_no || null,
      purchase_date: data.purchase_date || null,
      warranty_expiry: data.warranty_expiry || null,
      amc_vendor: data.amc_vendor || null,
      status: data.status || "OPERATIONAL",
      criticality: data.criticality || "MEDIUM",
      qr_code,
      specifications: data.specifications ? JSON.stringify(data.specifications) : null,
      notes: data.notes || null
    })
    .returning("*");

  return asset;
}

async function updateAsset(assetId, data) {
  const updates = { ...data, updated_at: db.fn.now() };
  if (updates.specifications && typeof updates.specifications === "object") {
    updates.specifications = JSON.stringify(updates.specifications);
  }
  delete updates.id;
  delete updates.created_at;

  const [updated] = await db("hotel_assets")
    .where("id", assetId)
    .update(updates)
    .returning("*");

  return updated;
}

/**
 * 2. WORK ORDERS
 */
async function listWorkOrders(filters = {}, pagination = {}) {
  const { status, priority, order_type, department, asset_id, q, date_from, date_to } = filters;
  const page = parseInt(pagination.page, 10) || 1;
  const limit = parseInt(pagination.limit, 10) || 50;
  const offset = (page - 1) * limit;

  const applyFilters = (qb) => {
    if (status) qb.where("wo.status", status);
    if (priority) qb.where("wo.priority", priority);
    if (order_type) qb.where("wo.order_type", order_type);
    if (asset_id) qb.where("wo.asset_id", asset_id);
    if (department) qb.where("a.department", department);
    if (date_from) qb.where("wo.created_at", ">=", date_from);
    if (date_to) qb.where("wo.created_at", "<=", `${date_to} 23:59:59`);
    if (q) {
      qb.where((inner) => {
        inner.whereILike("wo.wo_number", `%${q}%`)
          .orWhereILike("wo.issue_description", `%${q}%`)
          .orWhereILike("a.name", `%${q}%`)
          .orWhereILike("a.asset_code", `%${q}%`);
      });
    }
  };

  const [{ count }] = await db("maintenance_work_orders as wo")
    .join("hotel_assets as a", "a.id", "wo.asset_id")
    .modify(applyFilters)
    .count("wo.id as count");

  const [summary] = await db("maintenance_work_orders as wo")
    .join("hotel_assets as a", "a.id", "wo.asset_id")
    .modify(applyFilters)
    .select(
      db.raw("COUNT(wo.id) FILTER (WHERE wo.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PARTS_AWAITING')) as active_count"),
      db.raw("COUNT(wo.id) FILTER (WHERE wo.status = 'COMPLETED') as completed_count"),
      db.raw("COUNT(wo.id) FILTER (WHERE wo.priority = 'CRITICAL' AND wo.status != 'COMPLETED') as critical_active_count"),
      db.raw("COALESCE(SUM(wo.parts_cost), 0) as total_parts_cost"),
      db.raw("COALESCE(SUM(wo.labor_cost), 0) as total_labor_cost"),
      db.raw("COALESCE(SUM(wo.total_cost), 0) as total_spent"),
      db.raw("COALESCE(SUM(wo.downtime_minutes), 0) as total_downtime_minutes")
    );

  const rows = await db("maintenance_work_orders as wo")
    .join("hotel_assets as a", "a.id", "wo.asset_id")
    .modify(applyFilters)
    .select(
      "wo.*",
      "a.name as asset_name",
      "a.asset_code",
      "a.department",
      "a.location",
      "a.category as asset_category"
    )
    .orderByRaw("CASE WHEN wo.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PARTS_AWAITING') THEN 0 ELSE 1 END")
    .orderByRaw("CASE WHEN wo.priority = 'CRITICAL' THEN 0 WHEN wo.priority = 'HIGH' THEN 1 WHEN wo.priority = 'MEDIUM' THEN 2 ELSE 3 END")
    .orderBy("wo.created_at", "desc")
    .offset(offset)
    .limit(limit);

  return {
    rows,
    total: parseInt(count, 10),
    page,
    limit,
    summary: {
      activeCount: parseInt(summary?.active_count || 0, 10),
      completedCount: parseInt(summary?.completed_count || 0, 10),
      criticalActiveCount: parseInt(summary?.critical_active_count || 0, 10),
      totalPartsCost: parseFloat(summary?.total_parts_cost || 0),
      totalLaborCost: parseFloat(summary?.total_labor_cost || 0),
      totalSpent: parseFloat(summary?.total_spent || 0),
      totalDowntimeMinutes: parseInt(summary?.total_downtime_minutes || 0, 10)
    }
  };
}

async function createWorkOrder(data, user) {
  return await db.transaction(async (trx) => {
    const wo_number = await generateWorkOrderNumber(trx);
    const asset = await trx("hotel_assets").where("id", data.asset_id).first();
    if (!asset) throw new Error(`Asset #${data.asset_id} not found.`);

    const [wo] = await trx("maintenance_work_orders")
      .insert({
        wo_number,
        asset_id: data.asset_id,
        schedule_id: data.schedule_id || null,
        order_type: data.order_type || "BREAKDOWN",
        priority: data.priority || "MEDIUM",
        status: data.status || "OPEN",
        issue_description: data.issue_description,
        action_taken: data.action_taken || null,
        root_cause: data.root_cause || null,
        reported_by: user?.name || data.reported_by || "Kitchen Team",
        assigned_to: data.assigned_to || null,
        start_time: data.status === "IN_PROGRESS" ? trx.fn.now() : null,
        downtime_minutes: 0,
        labor_cost: parseFloat(data.labor_cost) || 0,
        parts_cost: 0,
        total_cost: parseFloat(data.labor_cost) || 0
      })
      .returning("*");

    // If this is a breakdown, mark machine as BREAKDOWN
    if (["BREAKDOWN", "EMERGENCY"].includes(wo.order_type)) {
      await trx("hotel_assets")
        .where("id", asset.id)
        .update({ status: "BREAKDOWN", updated_at: trx.fn.now() });
    } else if (wo.status === "IN_PROGRESS") {
      await trx("hotel_assets")
        .where("id", asset.id)
        .update({ status: "UNDER_MAINTENANCE", updated_at: trx.fn.now() });
    }

    return { ...wo, asset_name: asset.name, asset_code: asset.asset_code, department: asset.department };
  });
}

async function updateWorkOrder(workOrderId, data) {
  return await db.transaction(async (trx) => {
    const current = await trx("maintenance_work_orders").where("id", workOrderId).first();
    if (!current) throw new Error("Work order not found");

    const updates = {};
    if (data.status) updates.status = data.status;
    if (data.priority) updates.priority = data.priority;
    if (data.assigned_to !== undefined) updates.assigned_to = data.assigned_to;
    if (data.action_taken !== undefined) updates.action_taken = data.action_taken;
    if (data.root_cause !== undefined) updates.root_cause = data.root_cause;
    if (data.labor_cost !== undefined) {
      updates.labor_cost = parseFloat(data.labor_cost) || 0;
      updates.total_cost = updates.labor_cost + parseFloat(current.parts_cost);
    }

    if (data.status === "IN_PROGRESS" && !current.start_time) {
      updates.start_time = trx.fn.now();
      await trx("hotel_assets").where("id", current.asset_id).update({ status: "UNDER_MAINTENANCE" });
    }

    const [updated] = await trx("maintenance_work_orders")
      .where("id", workOrderId)
      .update(updates)
      .returning("*");

    return updated;
  });
}

/**
 * 3. SPARE PARTS CONSUMPTION LINKED TO STORE STOCK & LEDGER
 */
async function consumeParts(workOrderId, partsList = [], user) {
  return await db.transaction(async (trx) => {
    const wo = await trx("maintenance_work_orders").where("id", workOrderId).first();
    if (!wo) throw new Error("Work order not found");

    const asset = await trx("hotel_assets").where("id", wo.asset_id).first();
    let totalAddedCost = 0;
    const insertedParts = [];

    for (const part of partsList) {
      const requestedQty = parseFloat(part.qty);
      if (requestedQty <= 0) continue;

      // Find stock item batches with remaining > 0 (FEFO / oldest date first)
      const batches = await trx("stock")
        .where((qb) => {
          if (part.stock_id) qb.where("id", part.stock_id);
          else if (part.item_code) qb.where("item_code", part.item_code);
          else qb.whereRaw("LOWER(name) = LOWER(?)", [(part.name || "").trim()]);
        })
        .andWhere("remaining", ">", 0)
        .orderBy("date", "asc")
        .orderBy("id", "asc")
        .forUpdate();

      if (batches.length === 0) {
        throw new Error(`Insufficient stock for spare part '${part.name || part.item_code}'. No available batches.`);
      }

      let toDeduct = requestedQty;
      const totalAvailable = batches.reduce((sum, b) => sum + parseFloat(b.remaining), 0);
      if (totalAvailable < toDeduct) {
        throw new Error(`Insufficient stock for '${batches[0].name}'. Requested: ${requestedQty}, Available: ${totalAvailable}`);
      }

      for (const batch of batches) {
        if (toDeduct <= 0) break;
        const rem = parseFloat(batch.remaining);
        const deductFromBatch = rem >= toDeduct ? toDeduct : rem;

        // Deduct from batch
        await trx("stock")
          .where("id", batch.id)
          .update({ remaining: rem - deductFromBatch });

        toDeduct -= deductFromBatch;

        const unitPrice = parseFloat(batch.price) || 0;
        const lineTotal = Math.round(deductFromBatch * unitPrice * 100) / 100;
        totalAddedCost += lineTotal;

        // Record atomic double-entry stock ledger deduction
        await stockLedgerService.recordEntry(trx, {
          stock_id: batch.id,
          item_code: batch.item_code,
          item_name: batch.name,
          category: batch.category || "MAINTENANCE_SPARES",
          transaction_type: "OUTWARD_ISSUE",
          qty: deductFromBatch,
          unit: batch.unit,
          unit_price: unitPrice,
          total_value: lineTotal,
          batch_no: batch.batch_no,
          department: asset?.department || "FACILITY & MAINTENANCE",
          reference_doc_type: "MAINTENANCE",
          reference_doc_id: wo.id,
          reference_doc_no: wo.wo_number,
          reason: `Spare part consumed for ${asset?.name || "Equipment"} (${wo.wo_number})`,
          created_by: user?.name || "Maintenance Tech"
        });

        const [consumedRow] = await trx("maintenance_parts_consumed")
          .insert({
            work_order_id: wo.id,
            stock_id: batch.id,
            item_code: batch.item_code,
            item_name: batch.name,
            qty: deductFromBatch,
            unit: batch.unit,
            unit_price: unitPrice,
            total_cost: lineTotal
          })
          .returning("*");

        insertedParts.push(consumedRow);
      }
    }

    const newPartsCost = parseFloat(wo.parts_cost) + totalAddedCost;
    const newTotalCost = parseFloat(wo.labor_cost) + newPartsCost;

    const [updatedWo] = await trx("maintenance_work_orders")
      .where("id", wo.id)
      .update({
        parts_cost: newPartsCost,
        total_cost: newTotalCost,
        status: wo.status === "OPEN" ? "PARTS_AWAITING" : wo.status
      })
      .returning("*");

    return { workOrder: updatedWo, parts: insertedParts };
  });
}

/**
 * 4. COMPLETE WORK ORDER
 */
async function completeWorkOrder(workOrderId, data = {}, user) {
  return await db.transaction(async (trx) => {
    const wo = await trx("maintenance_work_orders").where("id", workOrderId).first();
    if (!wo) throw new Error("Work order not found");

    const completedAt = new Date();
    let downtimeMinutes = wo.downtime_minutes || 0;
    
    if (wo.start_time || wo.created_at) {
      const startMs = new Date(wo.start_time || wo.created_at).getTime();
      downtimeMinutes = Math.max(1, Math.round((completedAt.getTime() - startMs) / 60000));
    }

    const laborCost = data.labor_cost !== undefined ? parseFloat(data.labor_cost) : parseFloat(wo.labor_cost);
    const totalCost = laborCost + parseFloat(wo.parts_cost);

    const [completed] = await trx("maintenance_work_orders")
      .where("id", workOrderId)
      .update({
        status: "COMPLETED",
        completed_at: completedAt,
        action_taken: data.action_taken || wo.action_taken || "Maintenance service completed successfully.",
        root_cause: data.root_cause || wo.root_cause || null,
        assigned_to: data.assigned_to || wo.assigned_to || user?.name || "Technician",
        downtime_minutes: downtimeMinutes,
        labor_cost: laborCost,
        total_cost: totalCost
      })
      .returning("*");

    // Check if other active work orders exist for this machine; if none, mark OPERATIONAL
    const otherActive = await trx("maintenance_work_orders")
      .where("asset_id", wo.asset_id)
      .whereIn("status", ["OPEN", "ASSIGNED", "IN_PROGRESS", "PARTS_AWAITING"])
      .count("id as count")
      .first();

    if (parseInt(otherActive.count, 10) === 0) {
      await trx("hotel_assets")
        .where("id", wo.asset_id)
        .update({ status: "OPERATIONAL", updated_at: trx.fn.now() });
    }

    // If this WO was linked to a schedule, advance next_due_date
    if (wo.schedule_id) {
      const schedule = await trx("maintenance_schedules").where("id", wo.schedule_id).first();
      if (schedule) {
        const nextDue = calculateNextDueDate(schedule.frequency, completedAt);
        await trx("maintenance_schedules")
          .where("id", schedule.id)
          .update({
            last_performed_at: completedAt.toISOString().slice(0, 10),
            next_due_date: nextDue
          });
      }
    }

    return completed;
  });
}

/**
 * 5. PREVENTIVE SCHEDULES
 */
async function listSchedules(filters = {}) {
  const { asset_id, frequency } = filters;
  const today = new Date().toISOString().slice(0, 10);

  const query = db("maintenance_schedules as ms")
    .join("hotel_assets as a", "a.id", "ms.asset_id")
    .select(
      "ms.*",
      "a.name as asset_name",
      "a.asset_code",
      "a.department",
      "a.location",
      db.raw("CASE WHEN ms.next_due_date < ? THEN true ELSE false END as is_overdue", [today])
    )
    .where("ms.is_active", true);

  if (asset_id) query.where("ms.asset_id", asset_id);
  if (frequency) query.where("ms.frequency", frequency);

  const rows = await query.orderBy("is_overdue", "desc").orderBy("ms.next_due_date", "asc");

  const overdueCount = rows.filter(r => r.is_overdue).length;
  const dueThisWeekCount = rows.filter(r => {
    const diff = (new Date(r.next_due_date) - new Date(today)) / (1000 * 3600 * 24);
    return diff >= 0 && diff <= 7;
  }).length;

  return {
    rows,
    summary: {
      totalSchedules: rows.length,
      overdueCount,
      dueThisWeekCount
    }
  };
}

async function completeSchedule(scheduleId, data = {}, user) {
  return await db.transaction(async (trx) => {
    const schedule = await trx("maintenance_schedules").where("id", scheduleId).first();
    if (!schedule) throw new Error("Schedule not found");

    const asset = await trx("hotel_assets").where("id", schedule.asset_id).first();
    const wo_number = await generateWorkOrderNumber(trx);
    const today = new Date();

    const [wo] = await trx("maintenance_work_orders")
      .insert({
        wo_number,
        asset_id: schedule.asset_id,
        schedule_id: schedule.id,
        order_type: "PREVENTIVE",
        priority: "MEDIUM",
        status: "COMPLETED",
        issue_description: `Preventive Maintenance: ${schedule.title}`,
        action_taken: data.action_taken || "Routine inspection and preventive maintenance executed.",
        reported_by: "System Schedule",
        assigned_to: user?.name || schedule.assigned_to || "Maintenance Tech",
        start_time: today,
        completed_at: today,
        downtime_minutes: parseInt(data.downtime_minutes, 10) || 30,
        labor_cost: parseFloat(data.labor_cost) || 0,
        parts_cost: 0,
        total_cost: parseFloat(data.labor_cost) || 0
      })
      .returning("*");

    const nextDue = calculateNextDueDate(schedule.frequency, today);
    await trx("maintenance_schedules")
      .where("id", schedule.id)
      .update({
        last_performed_at: today.toISOString().slice(0, 10),
        next_due_date: nextDue
      });

    return { workOrder: wo, nextDueDate: nextDue };
  });
}

/**
 * 6. CMMS ANALYTICS & TELEMETRY
 */
async function getAnalytics() {
  const [assetStats] = await db("hotel_assets").select(
    db.raw("COUNT(id) as total_assets"),
    db.raw("COUNT(id) FILTER (WHERE status = 'OPERATIONAL') as operational"),
    db.raw("COUNT(id) FILTER (WHERE status = 'BREAKDOWN') as breakdown"),
    db.raw("COUNT(id) FILTER (WHERE status = 'UNDER_MAINTENANCE') as maintenance")
  );

  const costByDept = await db("maintenance_work_orders as wo")
    .join("hotel_assets as a", "a.id", "wo.asset_id")
    .groupBy("a.department")
    .select(
      "a.department",
      db.raw("COUNT(wo.id) as total_work_orders"),
      db.raw("COALESCE(SUM(wo.parts_cost), 0) as parts_cost"),
      db.raw("COALESCE(SUM(wo.labor_cost), 0) as labor_cost"),
      db.raw("COALESCE(SUM(wo.total_cost), 0) as total_cost")
    )
    .orderBy("total_cost", "desc");

  const topCostingMachines = await db("maintenance_work_orders as wo")
    .join("hotel_assets as a", "a.id", "wo.asset_id")
    .groupBy("a.id", "a.asset_code", "a.name", "a.department")
    .select(
      "a.id",
      "a.asset_code",
      "a.name",
      "a.department",
      db.raw("COUNT(wo.id) as wo_count"),
      db.raw("COALESCE(SUM(wo.total_cost), 0) as total_spend"),
      db.raw("COALESCE(SUM(wo.downtime_minutes), 0) as downtime_minutes")
    )
    .orderBy("total_spend", "desc")
    .limit(5);

  const [kpis] = await db("maintenance_work_orders").select(
    db.raw("COALESCE(AVG(downtime_minutes) FILTER (WHERE downtime_minutes > 0), 0) as mttr_minutes"),
    db.raw("COALESCE(SUM(total_cost), 0) as grand_total_spend")
  );

  return {
    equipmentSummary: {
      total: parseInt(assetStats?.total_assets || 0, 10),
      operational: parseInt(assetStats?.operational || 0, 10),
      breakdown: parseInt(assetStats?.breakdown || 0, 10),
      underMaintenance: parseInt(assetStats?.maintenance || 0, 10),
      operationalRate: assetStats?.total_assets > 0
        ? Math.round((assetStats.operational / assetStats.total_assets) * 100)
        : 100
    },
    mttrMinutes: Math.round(parseFloat(kpis?.mttr_minutes || 0)),
    grandTotalSpend: parseFloat(kpis?.grand_total_spend || 0),
    costByDepartment: costByDept.map(d => ({
      department: d.department,
      workOrdersCount: parseInt(d.total_work_orders, 10),
      partsCost: parseFloat(d.parts_cost),
      laborCost: parseFloat(d.labor_cost),
      totalCost: parseFloat(d.total_cost)
    })),
    topCostingMachines: topCostingMachines.map(m => ({
      id: m.id,
      asset_code: m.asset_code,
      name: m.name,
      department: m.department,
      woCount: parseInt(m.wo_count, 10),
      totalSpend: parseFloat(m.total_spend),
      downtimeMinutes: parseInt(m.downtime_minutes, 10)
    }))
  };
}

module.exports = {
  listAssets,
  getAssetDetails,
  createAsset,
  updateAsset,
  listWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  consumeParts,
  completeWorkOrder,
  listSchedules,
  completeSchedule,
  getAnalytics,
  generateWorkOrderNumber,
  generateAssetCode
};
