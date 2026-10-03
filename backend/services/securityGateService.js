const db = require("../db");

/**
 * securityGateService.js
 * Security Gate Pass Register and Returnable Container Reconciler (RGP).
 * Adapted from MK Paper Mill ERP (security.js) for Hotel Kapila.
 */

// Generate sequential pass number: GP-YYYY-XXXX
async function generatePassNumber(trxOrDb = db) {
  const year = new Date().getFullYear();
  const prefix = `GP-${year}-`;
  const offset = prefix.length + 1;

  const lastPass = await trxOrDb("security_gate_passes")
    .whereILike("pass_number", `${prefix}%`)
    .orderByRaw(`CAST(SUBSTRING(pass_number, ${offset}) AS INTEGER) DESC`)
    .select("pass_number")
    .first();

  let nextSeq = 1;
  if (lastPass && lastPass.pass_number) {
    const parts = lastPass.pass_number.split("-");
    const parsed = parseInt(parts[2], 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

/**
 * List gate passes with comprehensive search and filtering
 */
async function listPasses(filters = {}, pagination = { page: 1, limit: 20 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 20));
  const offset = (page - 1) * limit;

  let query = trxOrDb("security_gate_passes");

  if (filters.pass_type) {
    query = query.where("pass_type", filters.pass_type);
  }

  if (filters.status) {
    query = query.where("status", filters.status);
  }

  if (filters.returnable_only === "true" || filters.returnable_only === true) {
    query = query.where("pass_type", "RGP_RETURNABLE");
  }

  if (filters.pending_return === "true" || filters.pending_return === true) {
    query = query.where("pass_type", "RGP_RETURNABLE").where("is_return_completed", false);
  }

  if (filters.date_from) {
    query = query.where("in_time", ">=", `${filters.date_from} 00:00:00`);
  }

  if (filters.date_to) {
    query = query.where("in_time", "<=", `${filters.date_to} 23:59:59`);
  }

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    query = query.where((builder) => {
      builder
        .whereILike("pass_number", term)
        .orWhereILike("vehicle_number", term)
        .orWhereILike("driver_name", term)
        .orWhereILike("vendor_name", term)
        .orWhereILike("purpose", term)
        .orWhereILike("material_description", term)
        .orWhereILike("challan_number", term)
        .orWhereILike("invoice_number", term)
        .orWhereILike("po_number", term);
    });
  }

  const countRow = await query.clone().clearSelect().clearOrder().count("id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await query
    .clone()
    .orderBy("in_time", "desc")
    .limit(limit)
    .offset(offset);

  // Eager load items for rows
  const passIds = rows.map((r) => r.id);
  let itemsByPass = {};
  if (passIds.length > 0) {
    const allItems = await trxOrDb("security_gate_pass_items")
      .whereIn("gate_pass_id", passIds)
      .orderBy("id", "asc");
    allItems.forEach((it) => {
      if (!itemsByPass[it.gate_pass_id]) itemsByPass[it.gate_pass_id] = [];
      itemsByPass[it.gate_pass_id].push(it);
    });
  }

  const enrichedRows = rows.map((r) => ({
    ...r,
    items: itemsByPass[r.id] || [],
    items_count: (itemsByPass[r.id] || []).length
  }));

  // Compute live overview counts
  const todayStr = new Date().toISOString().slice(0, 10);
  const [stats] = await trxOrDb("security_gate_passes")
    .select(
      trxOrDb.raw("COUNT(*) as total_all"),
      trxOrDb.raw("COUNT(CASE WHEN status = 'IN_PREMISES' THEN 1 END) as in_premises"),
      trxOrDb.raw("COUNT(CASE WHEN pass_type = 'RGP_RETURNABLE' AND is_return_completed = false THEN 1 END) as rgp_pending"),
      trxOrDb.raw("COUNT(CASE WHEN in_time >= ? THEN 1 END)", [`${todayStr} 00:00:00`])
    );

  return {
    rows: enrichedRows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    stats: {
      total_all: parseInt(stats.total_all, 10) || 0,
      in_premises: parseInt(stats.in_premises, 10) || 0,
      rgp_pending: parseInt(stats.rgp_pending, 10) || 0,
      today_entries: parseInt(stats.count, 10) || 0
    }
  };
}

/**
 * Get gate pass by ID with structured items
 */
async function getPassById(id, trxOrDb = db) {
  const pass = await trxOrDb("security_gate_passes").where("id", id).first();
  if (!pass) throw new Error(`Gate pass #${id} not found.`);

  const items = await trxOrDb("security_gate_pass_items")
    .where("gate_pass_id", id)
    .orderBy("id", "asc");

  return {
    ...pass,
    items: items || []
  };
}

/**
 * Create a new gate pass record with optional structured line items
 */
async function createPass(data, user = {}, trxOrDb = db) {
  if (!data.pass_type) throw new Error("Pass type is required");
  if (!data.vehicle_number) throw new Error("Vehicle number is required");
  if (!data.driver_name) throw new Error("Driver name is required");
  if (!data.purpose) throw new Error("Purpose of visit is required");

  return await db.transaction(async (trx) => {
    const pass_number = await generatePassNumber(trx);

    const isRgp = data.pass_type === "RGP_RETURNABLE";
    if (isRgp && !(data.returnable_item_type && String(data.returnable_item_type).trim())) {
      const err = new Error("returnable_item_type is required for returnable gate passes");
      err.status = 400;
      throw err;
    }
    const qtyOut = isRgp ? Math.max(0, parseInt(data.returnable_qty_out, 10) || 0) : 0;
    const qtyIn = 0;
    const balanceDue = qtyOut;
    const isCompleted = isRgp ? (balanceDue === 0) : false;

    // Process structured items
    let itemsToInsert = [];
    if (Array.isArray(data.items) && data.items.length > 0) {
      itemsToInsert = data.items
        .map((it) => ({
          item_name: (it.item_name || "").trim(),
          qty: parseFloat(it.qty) || 1,
          unit: (it.unit || "units").trim(),
          package_type: it.package_type ? it.package_type.trim() : null,
          remarks: it.remarks ? it.remarks.trim() : null,
          is_returnable: !!it.is_returnable
        }))
        .filter((it) => it.item_name.length > 0);
    }

    // Auto-sync material_description
    let matDesc = (data.material_description || "").trim();
    if (!matDesc && itemsToInsert.length > 0) {
      matDesc = itemsToInsert
        .map((it) => `${it.qty} ${it.unit} ${it.item_name}${it.package_type ? ` (${it.package_type})` : ""}`)
        .join(", ");
    }

    const [newPass] = await trx("security_gate_passes")
      .insert({
        pass_number,
        pass_type: data.pass_type,
        vehicle_type: data.vehicle_type || "OTHER",
        vehicle_number: (data.vehicle_number || "").toUpperCase().trim(),
        driver_name: data.driver_name.trim(),
        driver_phone: data.driver_phone ? data.driver_phone.trim() : null,
        vendor_name: data.vendor_name ? data.vendor_name.trim() : null,
        supplier_id: data.supplier_id || null,
        purpose: data.purpose.trim(),
        material_description: matDesc || null,
        challan_number: data.challan_number ? data.challan_number.trim() : null,
        invoice_number: data.invoice_number ? data.invoice_number.trim() : null,
        po_number: data.po_number ? data.po_number.trim() : null,
        in_time: data.in_time ? new Date(data.in_time) : new Date(),
        out_time: null,
        status: data.status || "IN_PREMISES",
        returnable_item_type: isRgp ? String(data.returnable_item_type).trim() : null,
        returnable_qty_out: qtyOut,
        returnable_qty_in: qtyIn,
        returnable_balance_due: balanceDue,
        return_due_date: isRgp && data.return_due_date ? data.return_due_date : null,
        is_return_completed: isCompleted,
        security_guard_name: data.security_guard_name || user.name || "Main Gate Security",
        remarks: data.remarks || null
      })
      .returning("*");

    let insertedItems = [];
    if (itemsToInsert.length > 0) {
      const itemsPayload = itemsToInsert.map((it) => ({
        ...it,
        gate_pass_id: newPass.id
      }));
      insertedItems = await trx("security_gate_pass_items").insert(itemsPayload).returning("*");
    }

    return {
      ...newPass,
      items: insertedItems
    };
  });
}

/**
 * Log outward vehicle departure
 */
async function recordExit(id, data = {}, user = {}, trxOrDb = db) {
  return await db.transaction(async (trx) => {
    const pass = await trx("security_gate_passes").where("id", id).first();
    if (!pass) throw new Error(`Gate pass #${id} not found.`);

    const outTime = data.out_time ? new Date(data.out_time) : new Date();
    const updatePayload = {
      out_time: outTime,
      status: "COMPLETED",
      updated_at: new Date()
    };

    if (data.remarks) {
      updatePayload.remarks = pass.remarks
        ? `${pass.remarks} | Exit Note: ${data.remarks}`
        : `Exit Note: ${data.remarks}`;
    }

    if (data.security_guard_name) {
      updatePayload.security_guard_name = data.security_guard_name;
    }

    const [updated] = await trx("security_gate_passes")
      .where("id", id)
      .update(updatePayload)
      .returning("*");

    return updated;
  });
}

/**
 * Reconcile Returnable Gate Pass (RGP)
 * When empty cylinders/crates/cans are returned by the vendor
 */
async function reconcileRgp(id, data = {}, user = {}, trxOrDb = db) {
  const qtyReturned = parseInt(data.qty_returned, 10);
  if (isNaN(qtyReturned) || qtyReturned <= 0) {
    throw new Error("Valid returned quantity (> 0) is required.");
  }

  return await db.transaction(async (trx) => {
    const pass = await trx("security_gate_passes").where("id", id).first();
    if (!pass) throw new Error(`Gate pass #${id} not found.`);
    if (pass.pass_type !== "RGP_RETURNABLE") {
      throw new Error(`Gate pass #${pass.pass_number} is not an RGP (Returnable Gate Pass).`);
    }

    const newQtyIn = parseInt(pass.returnable_qty_in, 10) + qtyReturned;
    const balanceDue = Math.max(0, parseInt(pass.returnable_qty_out, 10) - newQtyIn);
    const isCompleted = balanceDue === 0;

    const auditRemark = `[${new Date().toISOString().slice(0, 16)}] Reconciled +${qtyReturned} returnables (Balance due: ${balanceDue}). Recorded by: ${user.name || "Store/Security"}. ${data.notes || ""}`.trim();

    const [updated] = await trx("security_gate_passes")
      .where("id", id)
      .update({
        returnable_qty_in: newQtyIn,
        returnable_balance_due: balanceDue,
        is_return_completed: isCompleted,
        remarks: pass.remarks ? `${pass.remarks}\n${auditRemark}` : auditRemark,
        updated_at: new Date()
      })
      .returning("*");

    return updated;
  });
}

/**
 * Get Gate Telemetry summary
 */
async function getGateTelemetry(trxOrDb = db) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [counts] = await trxOrDb("security_gate_passes")
    .select(
      trxOrDb.raw("COUNT(*) as total_records"),
      trxOrDb.raw("COUNT(CASE WHEN status = 'IN_PREMISES' THEN 1 END) as in_premises"),
      trxOrDb.raw("COUNT(CASE WHEN in_time >= ? THEN 1 END) as today_inward", [`${todayStr} 00:00:00`]),
      trxOrDb.raw("COUNT(CASE WHEN out_time >= ? THEN 1 END) as today_outward", [`${todayStr} 00:00:00`]),
      trxOrDb.raw("COUNT(CASE WHEN pass_type = 'RGP_RETURNABLE' AND is_return_completed = false THEN 1 END) as open_rgp"),
      trxOrDb.raw("SUM(CASE WHEN pass_type = 'RGP_RETURNABLE' AND is_return_completed = false THEN returnable_balance_due ELSE 0 END) as total_containers_pending")
    );

  const activeVehicles = await trxOrDb("security_gate_passes")
    .where("status", "IN_PREMISES")
    .orderBy("in_time", "desc")
    .limit(10);

  return {
    in_premises: parseInt(counts.in_premises, 10) || 0,
    today_inward: parseInt(counts.today_inward, 10) || 0,
    today_outward: parseInt(counts.today_outward, 10) || 0,
    open_rgp: parseInt(counts.open_rgp, 10) || 0,
    total_containers_pending: parseInt(counts.total_containers_pending, 10) || 0,
    total_records: parseInt(counts.total_records, 10) || 0,
    active_vehicles: activeVehicles
  };
}

/**
 * Append a line item to an existing gate pass
 */
async function appendItem(passId, itemData, user = {}, trxOrDb = db) {
  if (!itemData.item_name || !itemData.item_name.trim()) {
    throw new Error("Item name is required.");
  }
  const qty = parseFloat(itemData.qty);
  if (isNaN(qty) || qty <= 0) {
    throw new Error("Quantity must be greater than 0.");
  }

  return await db.transaction(async (trx) => {
    const pass = await trx("security_gate_passes").where("id", passId).first();
    if (!pass) throw new Error(`Gate pass #${passId} not found.`);

    const [createdItem] = await trx("security_gate_pass_items")
      .insert({
        gate_pass_id: pass.id,
        item_name: itemData.item_name.trim(),
        qty: qty,
        unit: (itemData.unit || "units").trim(),
        package_type: itemData.package_type ? itemData.package_type.trim() : null,
        remarks: itemData.remarks ? itemData.remarks.trim() : null,
        is_returnable: !!itemData.is_returnable
      })
      .returning("*");

    // Refresh pass material description
    const allItems = await trx("security_gate_pass_items").where("gate_pass_id", pass.id).orderBy("id", "asc");
    const updatedDesc = allItems
      .map((it) => `${it.qty} ${it.unit} ${it.item_name}${it.package_type ? ` (${it.package_type})` : ""}`)
      .join(", ");

    await trx("security_gate_passes").where("id", pass.id).update({
      material_description: updatedDesc,
      updated_at: new Date()
    });

    return {
      success: true,
      item: createdItem,
      items: allItems
    };
  });
}

/**
 * Delete a line item from a gate pass
 */
async function deleteItem(passId, itemId, user = {}, trxOrDb = db) {
  return await db.transaction(async (trx) => {
    const pass = await trx("security_gate_passes").where("id", passId).first();
    if (!pass) throw new Error(`Gate pass #${passId} not found.`);

    const item = await trx("security_gate_pass_items").where({ id: itemId, gate_pass_id: passId }).first();
    if (!item) throw new Error(`Item #${itemId} not found on Gate pass #${pass.pass_number}.`);

    await trx("security_gate_pass_items").where({ id: itemId, gate_pass_id: passId }).del();

    const remainingItems = await trx("security_gate_pass_items").where("gate_pass_id", pass.id).orderBy("id", "asc");
    const updatedDesc = remainingItems.length > 0
      ? remainingItems
          .map((it) => `${it.qty} ${it.unit} ${it.item_name}${it.package_type ? ` (${it.package_type})` : ""}`)
          .join(", ")
      : null;

    await trx("security_gate_passes").where("id", pass.id).update({
      material_description: updatedDesc,
      updated_at: new Date()
    });

    return {
      success: true,
      deleted_item_id: itemId,
      items: remainingItems
    };
  });
}

/**
 * Delete a gate pass record and its items
 */
async function deletePass(passId, user = {}, trxOrDb = db) {
  return await db.transaction(async (trx) => {
    const pass = await trx("security_gate_passes").where("id", passId).first();
    if (!pass) throw new Error(`Gate pass #${passId} not found.`);

    // Cascade delete items and delete pass
    await trx("security_gate_pass_items").where("gate_pass_id", passId).del();
    await trx("security_gate_passes").where("id", passId).del();

    return {
      success: true,
      deleted_pass_id: passId,
      pass_number: pass.pass_number
    };
  });
}

/**
 * Update gate pass header details
 */
async function updatePass(passId, data, user = {}, trxOrDb = db) {
  return await db.transaction(async (trx) => {
    const pass = await trx("security_gate_passes").where("id", passId).first();
    if (!pass) throw new Error(`Gate pass #${passId} not found.`);

    const updatePayload = {
      updated_at: new Date()
    };
    if (data.vehicle_type) updatePayload.vehicle_type = data.vehicle_type;
    if (data.vehicle_number) updatePayload.vehicle_number = data.vehicle_number.toUpperCase().trim();
    if (data.driver_name) updatePayload.driver_name = data.driver_name.trim();
    if (data.driver_phone !== undefined) updatePayload.driver_phone = data.driver_phone ? data.driver_phone.trim() : null;
    if (data.vendor_name !== undefined) updatePayload.vendor_name = data.vendor_name ? data.vendor_name.trim() : null;
    if (data.purpose) updatePayload.purpose = data.purpose.trim();
    if (data.challan_number !== undefined) updatePayload.challan_number = data.challan_number ? data.challan_number.trim() : null;
    if (data.invoice_number !== undefined) updatePayload.invoice_number = data.invoice_number ? data.invoice_number.trim() : null;
    if (data.po_number !== undefined) updatePayload.po_number = data.po_number ? data.po_number.trim() : null;
    if (data.remarks !== undefined) updatePayload.remarks = data.remarks;

    const [updated] = await trx("security_gate_passes").where("id", passId).update(updatePayload).returning("*");
    const items = await trx("security_gate_pass_items").where("gate_pass_id", passId).orderBy("id", "asc");

    return {
      ...updated,
      items
    };
  });
}

module.exports = {
  generatePassNumber,
  listPasses,
  getPassById,
  createPass,
  recordExit,
  reconcileRgp,
  getGateTelemetry,
  appendItem,
  deleteItem,
  deletePass,
  updatePass
};
