const db = require("../db");
const stockLedgerService = require("./stockLedgerService");

/**
 * inboundDcService.js
 * Multi-Agent Inbound Delivery Challan & 3-Way Invoice Match Engine.
 *
 * Implements:
 * 1. Agent Gatekeeper: Fast early-morning intake of produce/milk/bread/gas with Delivery Challans.
 * 2. Provisional Stock Bumping: Stock immediately available for kitchen indents (INWARD_DC_PROVISIONAL).
 * 3. Agent Reconciler: 3-Way Invoice Match engine converting DCs to verified GRNs with zero double-counting.
 * 4. Audit & Cancellation: Compensating ledger reversal if delivery is rejected before invoice match.
 */

const generateDCNumber = async (trx, dateStr) => {
  const stamp = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const runner = trx || db;
  const countRow = await runner("inbound_dcs")
    .whereRaw("dc_number LIKE ?", [`IDC-${stamp}-%`])
    .count("id as count")
    .first();
  const nextSeq = String(parseInt(countRow?.count || 0) + 1).padStart(4, "0");
  return `IDC-${stamp}-${nextSeq}`;
};

const generateGRNNumber = async (trx, dateStr) => {
  const stamp = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const runner = trx || db;
  const countRow = await runner("goods_receipt_notes")
    .whereRaw("grn_number LIKE ?", [`GRN-${stamp}-%`])
    .count("id as count")
    .first();
  const nextSeq = String(parseInt(countRow?.count || 0) + 1).padStart(4, "0");
  return `GRN-${stamp}-${nextSeq}`;
};

/**
 * 1. Receive goods via Delivery Challan with provisional stock bump
 */
async function createInboundDC(data, user) {
  let {
    supplier_id,
    supplier_name,
    dc_date = new Date().toISOString().slice(0, 10),
    delivery_date,
    challan_no,
    vehicle_number,
    vehicle_no,
    driver_name,
    driver_phone,
    received_by,
    remarks,
    items
  } = data;

  dc_date = delivery_date || dc_date;
  vehicle_number = vehicle_number || vehicle_no;

  if (!supplier_name && supplier_id) {
    const sup = await db("suppliers").where("id", supplier_id).first();
    if (sup) supplier_name = sup.name;
  }

  if (!supplier_name || !supplier_name.trim()) {
    throw new Error("Supplier Name is required for Inbound Delivery Challan.");
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("At least one line item is required to receive goods.");
  }

  return await db.transaction(async (trx) => {
    const dc_number = await generateDCNumber(trx, dc_date);
    let provisionalTotal = 0;

    items.forEach((it) => {
      const q = parseFloat(it.qty !== undefined ? it.qty : it.dc_qty) || 0;
      const rate = parseFloat(it.estimated_unit_price !== undefined ? it.estimated_unit_price : (it.est_unit_price !== undefined ? it.est_unit_price : it.price)) || 0;
      provisionalTotal += q * rate;
    });

    const [dc] = await trx("inbound_dcs")
      .insert({
        dc_number,
        supplier_id: supplier_id ? parseInt(supplier_id, 10) : null,
        supplier_name: supplier_name.trim(),
        dc_date,
        challan_no: challan_no ? challan_no.trim() : null,
        vehicle_number: vehicle_number ? vehicle_number.trim().toUpperCase() : null,
        driver_name: driver_name ? driver_name.trim() : null,
        driver_phone: driver_phone ? driver_phone.trim() : null,
        status: "PENDING_INVOICE",
        provisional_total_value: Math.round(provisionalTotal * 100) / 100,
        remarks: remarks || null,
        received_by: received_by || user?.name || "Storekeeper"
      })
      .returning("*");

    const savedItems = [];

    for (const it of items) {
      const numericQty = parseFloat(it.qty !== undefined ? it.qty : it.dc_qty) || 0;
      if (numericQty <= 0) continue;
      const unitRate = parseFloat(it.estimated_unit_price !== undefined ? it.estimated_unit_price : (it.est_unit_price !== undefined ? it.est_unit_price : it.price)) || 0;
      const itemVal = Math.round(numericQty * unitRate * 100) / 100;
      const generatedBatch = it.batch_no && it.batch_no.trim()
        ? it.batch_no.trim()
        : `BAT-DC-${dc_date.replace(/-/g, "")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // A. Create provisional stock batch
      const [stockBatch] = await trx("stock")
        .insert({
          name: it.item_name.trim(),
          qty: numericQty,
          remaining: numericQty,
          unit: it.unit || "kg",
          date: dc_date,
          price: unitRate,
          supplier: supplier_name.trim(),
          supplier_id: supplier_id ? parseInt(supplier_id, 10) : null,
          expiry_date: it.expiry_date || null,
          item_code: it.item_code ? it.item_code.trim().toUpperCase() : "KPL-GEN",
          batch_no: generatedBatch,
          invoice_no: challan_no ? `DC-${challan_no.trim()}` : dc_number,
          storage_zone: it.storage_zone || it.storage_location || "Central Store",
          rack_location: it.rack_location || "Receiving Bay",
          created_by: user?.id || null
        })
        .returning("*");

      // B. Insert DC line item linking to created stock batch
      const [dcItem] = await trx("inbound_dc_items")
        .insert({
          inbound_dc_id: dc.id,
          stock_id: stockBatch.id,
          item_code: stockBatch.item_code,
          item_name: stockBatch.name,
          category: it.category || null,
          qty: numericQty,
          unit: stockBatch.unit,
          estimated_unit_price: unitRate,
          estimated_total_value: itemVal,
          batch_no: generatedBatch,
          expiry_date: it.expiry_date || null,
          storage_zone: stockBatch.storage_zone,
          match_status: "PENDING"
        })
        .returning("*");

      savedItems.push({
        ...dcItem,
        dc_qty: dcItem.qty,
        est_unit_price: dcItem.estimated_unit_price
      });

      // C. Atomic double-entry stock ledger entry: INWARD_DC_PROVISIONAL
      await stockLedgerService.recordEntry(trx, {
        stock_id: stockBatch.id,
        item_code: stockBatch.item_code,
        item_name: stockBatch.name,
        category: it.category || null,
        transaction_type: "INWARD_DC_PROVISIONAL",
        qty: numericQty,
        unit: stockBatch.unit,
        unit_price: unitRate,
        total_value: itemVal,
        batch_no: generatedBatch,
        department: "CENTRAL STORE",
        supplier: supplier_name.trim(),
        invoice_no: challan_no ? `DC-${challan_no.trim()}` : null,
        reference_doc_type: "DC",
        reference_doc_id: dc.id,
        reference_doc_no: dc_number,
        reason: `Inbound Delivery Challan #${challan_no || dc_number}`,
        notes: `Provisional stock bump for immediate kitchen availability`,
        created_by: user?.name || "Storekeeper"
      });
    }

    return {
      ...dc,
      sequence_no: dc.dc_number,
      total_est_value: dc.provisional_total_value,
      delivery_date: dc.dc_date,
      vehicle_no: dc.vehicle_number,
      items: savedItems
    };
  });
}

/**
 * 2. 3-Way Invoice Match Engine & GRN Conversion
 */
async function matchInvoiceAndGenerateGRN(dcId, matchPayload, user) {
  const invoice_no = matchPayload.invoice_no || matchPayload.vendor_invoice_no;
  const invoice_date = matchPayload.invoice_date || new Date().toISOString().slice(0, 10);
  const invoice_total = matchPayload.invoice_total;
  const remarks = matchPayload.remarks;
  const matched_lines = matchPayload.matched_lines || matchPayload.items || [];

  if (!invoice_no || !invoice_no.trim()) {
    throw new Error("Tax Invoice Number is mandatory for 3-way match reconciliation.");
  }

  return await db.transaction(async (trx) => {
    const dc = await trx("inbound_dcs").where("id", dcId).forUpdate().first();
    if (!dc) throw new Error(`Inbound DC #${dcId} does not exist.`);
    if (dc.status === "GRN_COMPLETED") {
      throw new Error(`Inbound DC #${dc.dc_number} has already been reconciled and converted to GRN.`);
    }
    if (dc.status === "CANCELLED") {
      throw new Error(`Inbound DC #${dc.dc_number} was cancelled and cannot be matched.`);
    }

    const dcItems = await trx("inbound_dc_items").where("inbound_dc_id", dcId);
    let calculatedLineTotal = 0;

    // Build map of user-submitted match line overrides
    const lineMap = {};
    matched_lines.forEach((ml) => {
      lineMap[ml.item_id || ml.id] = ml;
    });

    // 1. Generate confirmed GRN header
    const grn_number = await generateGRNNumber(trx, invoice_date);
    const numericInvoiceTotal = parseFloat(invoice_total) !== undefined && !isNaN(parseFloat(invoice_total))
      ? parseFloat(invoice_total)
      : parseFloat(dc.provisional_total_value);

    const [grn] = await trx("goods_receipt_notes")
      .insert({
        grn_number,
        supplier_id: dc.supplier_id,
        date: invoice_date,
        invoice_no: invoice_no.trim(),
        received_by: user?.name || "Storekeeper",
        remarks: remarks ? `Converted from DC #${dc.dc_number}: ${remarks}` : `Converted from Inbound Delivery Challan #${dc.dc_number}`,
        total_amount: numericInvoiceTotal
      })
      .returning("*");

    // 2. Reconcile each line item
    for (const item of dcItems) {
      const matchLine = lineMap[item.id] || {};
      const finalQty = matchLine.matched_qty !== undefined
        ? parseFloat(matchLine.matched_qty)
        : (matchLine.invoice_qty !== undefined ? parseFloat(matchLine.invoice_qty) : parseFloat(item.qty));
      const finalPrice = matchLine.matched_price !== undefined
        ? parseFloat(matchLine.matched_price)
        : (matchLine.invoice_unit_price !== undefined ? parseFloat(matchLine.invoice_unit_price) : parseFloat(item.estimated_unit_price));
      const finalLineTotal = Math.round(finalQty * finalPrice * 100) / 100;
      calculatedLineTotal += finalLineTotal;

      const hasDiscrepancy = Math.abs(finalQty - parseFloat(item.qty)) > 0.001 || Math.abs(finalPrice - parseFloat(item.estimated_unit_price)) > 0.01;

      // Update inbound_dc_items with verified invoice data
      await trx("inbound_dc_items")
        .where("id", item.id)
        .update({
          matched_invoice_qty: finalQty,
          matched_invoice_price: finalPrice,
          matched_invoice_total: finalLineTotal,
          match_status: hasDiscrepancy ? "DISCREPANCY" : "MATCHED",
          updated_at: trx.fn.now()
        });

      // Insert into goods_receipt_items
      await trx("goods_receipt_items").insert({
        grn_id: grn.id,
        item_code: item.item_code,
        name: item.item_name,
        qty_ordered: item.qty,
        qty_received: finalQty,
        qty_accepted: finalQty,
        qty_rejected: 0,
        unit: item.unit,
        unit_price: finalPrice,
        landed_cost: finalLineTotal,
        batch_no: item.batch_no,
        expiry_date: item.expiry_date
      });

      // Update existing stock batch price and invoice details (no quantity duplication!)
      if (item.stock_id) {
        await trx("stock")
          .where("id", item.stock_id)
          .update({
            price: finalPrice,
            invoice_no: invoice_no.trim(),
            date: invoice_date
          });

        await trx("stock_ledger")
          .where("reference_doc_type", "DC")
          .where("reference_doc_id", dc.id)
          .where("stock_id", item.stock_id)
          .update({
            unit_price: finalPrice,
            total_value: finalLineTotal
          });
      }
    }

    // 3. Atomically re-tag double-entry stock ledger entries from INWARD_DC_PROVISIONAL to INWARD_GRN
    await stockLedgerService.retagEntry(trx, {
      reference_doc_type: "DC",
      reference_doc_id: dc.id,
      new_transaction_type: "INWARD_GRN",
      new_reference_doc_type: "GRN",
      new_reference_doc_id: grn.id,
      new_reference_doc_no: grn.grn_number,
      invoice_no: invoice_no.trim(),
      notes: `3-Way Invoice Match Verified (DC #${dc.dc_number} -> GRN #${grn.grn_number})`
    });

    // 4. Update inbound_dcs header
    const [updatedDC] = await trx("inbound_dcs")
      .where("id", dcId)
      .update({
        status: "GRN_COMPLETED",
        matched_invoice_no: invoice_no.trim(),
        matched_invoice_date: invoice_date,
        matched_invoice_total: numericInvoiceTotal,
        converted_grn_id: grn.id,
        converted_grn_no: grn.grn_number,
        updated_at: trx.fn.now()
      })
      .returning("*");

    return {
      dc: updatedDC,
      grn,
      grn_id: grn.id,
      grn_number: grn.grn_number,
      status: updatedDC.status,
      variance: Math.round((numericInvoiceTotal - calculatedLineTotal) * 100) / 100
    };
  });
}

/**
 * 3. List Inbound DCs with filter & pagination
 */
async function listInboundDCs(filters = {}, pagination = {}) {
  const { status, supplier, search, date_from, date_to } = filters;
  const page = Math.max(1, parseInt(pagination.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(pagination.limit) || 20));
  const offset = pagination.offset !== undefined ? pagination.offset : (page - 1) * limit;

  const applyFilters = (qb) => {
    if (status && status !== "ALL") {
      qb.where("status", status);
    }
    if (supplier) {
      qb.whereILike("supplier_name", `%${supplier.trim()}%`);
    }
    if (date_from) {
      qb.where("dc_date", ">=", date_from);
    }
    if (date_to) {
      qb.where("dc_date", "<=", date_to);
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      qb.where((inner) => {
        inner.whereILike("dc_number", term)
          .orWhereILike("challan_no", term)
          .orWhereILike("supplier_name", term)
          .orWhereILike("vehicle_number", term)
          .orWhereILike("matched_invoice_no", term)
          .orWhereILike("converted_grn_no", term);
      });
    }
  };

  const [{ count }] = await db("inbound_dcs").modify(applyFilters).count("id as count");

  const rows = await db("inbound_dcs")
    .modify(applyFilters)
    .orderBy("created_at", "desc")
    .offset(offset)
    .limit(limit);

  // Load items count and summary
  const dcIds = rows.map((r) => r.id);
  const items = dcIds.length
    ? await db("inbound_dc_items").whereIn("inbound_dc_id", dcIds)
    : [];

  const rawData = rows.map((r) => ({
    ...r,
    items: items.filter((it) => it.inbound_dc_id === r.id)
  }));

  const data = rawData.map((r) => ({
    ...r,
    sequence_no: r.dc_number,
    total_est_value: r.provisional_total_value,
    delivery_date: r.dc_date,
    vehicle_no: r.vehicle_number,
    linked_grn_id: r.converted_grn_id,
    items: (r.items || []).map((si) => ({
      ...si,
      dc_qty: si.qty,
      est_unit_price: si.estimated_unit_price
    }))
  }));

  // KPI telemetry
  const [kpi] = await db("inbound_dcs").select(
    db.raw("COUNT(*) as total_dcs"),
    db.raw("COALESCE(SUM(CASE WHEN status IN ('RECEIVED', 'PENDING_INVOICE') THEN 1 ELSE 0 END), 0) as pending_match_count"),
    db.raw("COALESCE(SUM(CASE WHEN status IN ('RECEIVED', 'PENDING_INVOICE') THEN provisional_total_value ELSE 0 END), 0) as pending_provisional_value"),
    db.raw("COALESCE(SUM(CASE WHEN status = 'GRN_COMPLETED' THEN 1 ELSE 0 END), 0) as converted_grn_count"),
    db.raw("COALESCE(SUM(CASE WHEN status = 'GRN_COMPLETED' THEN matched_invoice_total ELSE 0 END), 0) as matched_grn_value")
  );

  return {
    data,
    rows: data,
    total: parseInt(count || 0),
    page,
    limit,
    kpi: {
      totalDcs: parseInt(kpi?.total_dcs || 0),
      pendingMatchCount: parseInt(kpi?.pending_match_count || 0),
      pendingProvisionalValue: parseFloat(kpi?.pending_provisional_value || 0),
      convertedGrnCount: parseInt(kpi?.converted_grn_count || 0),
      matchedGrnValue: parseFloat(kpi?.matched_grn_value || 0)
    }
  };
}

/**
 * 4. Get full Inbound DC details
 */
async function getInboundDCDetails(id) {
  const dc = await db("inbound_dcs").where("id", id).first();
  if (!dc) return null;
  const items = await db("inbound_dc_items").where("inbound_dc_id", id).orderBy("id", "asc");
  return {
    ...dc,
    sequence_no: dc.dc_number,
    total_est_value: dc.provisional_total_value,
    delivery_date: dc.dc_date,
    vehicle_no: dc.vehicle_number,
    linked_grn_id: dc.converted_grn_id,
    items: items.map((si) => ({
      ...si,
      dc_qty: si.qty,
      est_unit_price: si.estimated_unit_price
    }))
  };
}

/**
 * 5. Cancel Inbound DC and reverse provisional stock
 */
async function cancelInboundDC(id, reason, user) {
  return await db.transaction(async (trx) => {
    const dc = await trx("inbound_dcs").where("id", id).forUpdate().first();
    if (!dc) throw new Error(`Inbound DC #${id} not found.`);
    if (dc.status !== "RECEIVED") {
      throw new Error(`Only Inbound DCs in 'RECEIVED' status can be cancelled. Current status: '${dc.status}'.`);
    }

    const items = await trx("inbound_dc_items").where("inbound_dc_id", id);

    for (const it of items) {
      if (it.stock_id) {
        const batch = await trx("stock").where("id", it.stock_id).first();
        if (batch) {
          const rem = parseFloat(batch.remaining || 0);
          if (rem > 0) {
            await trx("stock").where("id", batch.id).update({ remaining: 0 });

            await stockLedgerService.recordEntry(trx, {
              stock_id: batch.id,
              item_code: batch.item_code,
              item_name: batch.name,
              category: it.category,
              transaction_type: "ADJUSTMENT_DEDUCT",
              qty: rem,
              unit: batch.unit,
              unit_price: parseFloat(batch.price) || 0,
              batch_no: batch.batch_no,
              department: "CENTRAL STORE",
              supplier: dc.supplier_name,
              reference_doc_type: "DC",
              reference_doc_id: dc.id,
              reference_doc_no: dc.dc_number,
              reason: `Inbound DC Cancelled: ${reason || "Delivery rejected"}`,
              notes: `Provisional stock deduction reversal`,
              created_by: user?.name || "Storekeeper"
            });
          }
        }
      }
    }

    const [cancelled] = await trx("inbound_dcs")
      .where("id", id)
      .update({
        status: "CANCELLED",
        remarks: reason ? `Cancelled: ${reason}` : "Cancelled by store manager",
        updated_at: trx.fn.now()
      })
      .returning("*");

    return cancelled;
  });
}

module.exports = {
  createInboundDC,
  matchInvoiceAndGenerateGRN,
  listInboundDCs,
  getInboundDCDetails,
  cancelInboundDC
};
