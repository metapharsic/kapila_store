const db = require("../db");
const ExcelJS = require("exceljs");
const engine = require("../services/reorderAgentEngine");

// GET /api/reorder-points
async function list(req, res, next) {
  try {
    const { is_active, q, risk_level } = req.query;
    const { offset, limit, sort, order } = req.pagination || { offset: 0, limit: 30, sort: "name", order: "asc" };

    const filter = (qb) => {
      if (is_active !== undefined) qb.where("reorder_points.is_active", is_active === "true");
      if (q) {
        qb.where((sub) => {
          sub.whereILike("reorder_points.name", `%${q}%`).orWhereILike("reorder_points.item_code", `%${q}%`);
        });
      }
    };

    const [{ count }] = await db("reorder_points").modify(filter).count("id as count");
    const rows = await db("reorder_points")
      .leftJoin("suppliers", "reorder_points.preferred_supplier_id", "suppliers.id")
      .modify(filter)
      .select("reorder_points.*", "suppliers.name as supplier_name", "suppliers.phone as supplier_phone")
      .orderBy(sort ? `reorder_points.${sort}` : "reorder_points.name", order || "asc")
      .orderBy("reorder_points.id", "desc")
      .offset(offset)
      .limit(limit);

    // Evaluate live velocity and safety buffers for current page
    const itemCodes = rows.map((r) => r.item_code);
    const evaluated = await engine.evaluateAll(itemCodes);
    const evalMap = Object.fromEntries(evaluated.map((e) => [e.item_code, e]));

    const enriched = rows.map((r) => {
      const ev = evalMap[r.item_code] || {};
      return {
        ...r,
        current_stock: ev.current_stock ?? null,
        unit: ev.unit || "kg",
        category: ev.category || "General",
        daily_velocity: ev.daily_velocity ?? 0,
        days_to_out: ev.days_to_out ?? 999,
        buffer_health_pct: ev.buffer_health_pct ?? 100,
        risk_level: ev.risk_level || "OPTIMAL",
        needs_reorder: ev.needs_reorder || false,
        unit_cost: ev.unit_cost || 0,
        projected_spend: ev.projected_spend || 0,
        suggested_min_qty: ev.suggested_min_qty,
        suggested_reorder_qty: ev.suggested_reorder_qty,
        wa_link: ev.wa_link || null
      };
    });

    const finalRows = risk_level
      ? enriched.filter((r) => r.risk_level.toLowerCase() === risk_level.toLowerCase())
      : enriched;

    res.json({
      success: true,
      data: finalRows,
      total: parseInt(count, 10),
      page: req.pagination?.page || 1,
      limit
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/reorder-points
async function create(req, res, next) {
  try {
    const { item_code, name, min_qty, reorder_qty, lead_time_days, preferred_supplier_id, notes } = req.body;

    const existing = await db("reorder_points").where("item_code", item_code).first();
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Reorder point for ${item_code} already exists. Use PATCH to update.`
      });
    }

    const [row] = await db("reorder_points")
      .insert({
        item_code,
        name,
        min_qty: parseFloat(min_qty),
        reorder_qty: parseFloat(reorder_qty),
        lead_time_days: parseInt(lead_time_days, 10) || 3,
        preferred_supplier_id: preferred_supplier_id ? parseInt(preferred_supplier_id, 10) : null,
        notes: notes || null,
        is_active: true
      })
      .returning("*");

    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/reorder-points/:id
async function update(req, res, next) {
  try {
    const existing = await db("reorder_points").where("id", req.params.id).first();
    if (!existing) return res.status(404).json({ success: false, error: "Reorder point not found." });

    const fields = ["min_qty", "reorder_qty", "lead_time_days", "preferred_supplier_id", "is_active", "notes", "name"];
    const updates = {};
    fields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    updates.updated_at = db.fn.now();

    const [row] = await db("reorder_points").where("id", req.params.id).update(updates).returning("*");
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/reorder-points/:id
async function remove(req, res, next) {
  try {
    const deleted = await db("reorder_points").where("id", req.params.id).del();
    if (!deleted) return res.status(404).json({ success: false, error: "Reorder point not found." });
    res.json({ success: true, message: "Reorder point deleted." });
  } catch (err) {
    next(err);
  }
}

// GET /api/reorder-points/alerts
async function alerts(req, res, next) {
  try {
    const evaluated = await engine.evaluateAll();
    const needReorder = evaluated.filter((e) => e.is_active && e.needs_reorder);
    res.json({ success: true, data: needReorder });
  } catch (err) {
    next(err);
  }
}

// GET /api/reorder-points/predictive
async function predictive(req, res, next) {
  try {
    const evaluated = await engine.evaluateAll();
    const sorted = evaluated.sort((a, b) => a.days_to_out - b.days_to_out);
    res.json({ success: true, data: sorted });
  } catch (err) {
    next(err);
  }
}

// GET /api/reorder-points/agent-telemetry
async function agentTelemetry(req, res, next) {
  try {
    const telemetry = await engine.getTelemetry();
    res.json({ success: true, data: telemetry });
  } catch (err) {
    next(err);
  }
}

// POST /api/reorder-points/batch-update (Concurrent Parallel Chunks)
async function batchUpdate(req, res, next) {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ success: false, error: "Rules array is required" });
    }

    const updated = await engine.batchUpdate(rules);
    res.json({
      success: true,
      message: `Successfully updated ${updated.length} reorder point rule(s) concurrently.`,
      updated_count: updated.length,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/reorder-points/batch-draft-pos
async function batchDraftPOs(req, res, next) {
  try {
    const { item_ids } = req.body;
    const result = await engine.batchDraftPOs(item_ids, req.user?.id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/reorder-points/recalibrate
async function recalibrate(req, res, next) {
  try {
    const { item_codes } = req.body;
    const updated = await engine.recalibrateAll(item_codes);
    res.json({
      success: true,
      message: `Recalibrated ${updated.length} rules based on 14-day velocity and lead time buffers.`,
      recalibrated_count: updated.length,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/reorder-points/export-excel
async function exportExcel(req, res, next) {
  try {
    const evaluated = await engine.evaluateAll();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Inventory System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Reorder Safety Stock Matrix", {
      pageSetup: { paperSize: 9, orientation: "landscape" }
    });

    // 1. Header
    sheet.mergeCells("A1:M1");
    const title = sheet.getCell("A1");
    title.value = "HOTEL KAPILA — REORDER SAFETY STOCK & DEPLETION INTELLIGENCE";
    title.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    title.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 32;

    sheet.getCell("A2").value = `Generated: ${new Date().toLocaleString("en-IN")}`;
    sheet.getCell("E2").value = `Total Active Rules: ${evaluated.filter((e) => e.is_active).length}`;
    sheet.getCell("I2").value = `Breached Items: ${evaluated.filter((e) => e.needs_reorder).length}`;
    sheet.getRow(2).font = { bold: true, size: 10 };
    sheet.getRow(2).height = 20;

    sheet.addRow([]);

    // 2. Headers
    const headers = [
      "Sl No", "Item Code", "Item Name", "Category", "Unit",
      "Current Stock", "Min Qty (Safety)", "Reorder Qty", "Daily Burn Rate",
      "Days to Stockout", "Risk Level", "Recommended Vendor", "Projected Spend (₹)"
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8A838" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    let totalSpend = 0;

    evaluated.forEach((it, idx) => {
      if (it.needs_reorder) totalSpend += it.projected_spend;

      const row = sheet.addRow([
        idx + 1,
        it.item_code,
        it.name,
        it.category,
        it.unit,
        it.current_stock,
        it.min_qty,
        it.reorder_qty,
        it.daily_velocity,
        it.days_to_out === 999 ? "Stable (>30d)" : it.days_to_out,
        it.risk_level,
        it.recommended_supplier || "—",
        it.projected_spend
      ]);

      if (it.risk_level === "CRITICAL" || it.risk_level === "STOCKOUT") {
        row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        row.getCell(11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      } else if (it.risk_level === "BREACHED") {
        row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
        row.getCell(11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      }
    });

    sheet.addRow([]);
    const summaryRow = sheet.addRow([
      "TOTAL CAPITAL REQUIRED FOR BREACHED SKUS", "", "", "", "", "", "", "", "", "", "", "", Math.round(totalSpend * 100) / 100
    ]);
    summaryRow.font = { bold: true };
    summaryRow.getCell(13).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };

    sheet.columns.forEach((col) => {
      col.width = Math.max(col.width || 12, 14);
    });
    sheet.getColumn(3).width = 28;
    sheet.getColumn(12).width = 24;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Hotel_Kapila_Reorder_Points_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// GET /api/reorder-points/export-csv
async function exportCsv(req, res, next) {
  try {
    const evaluated = await engine.evaluateAll();

    const headers = [
      "Item Code", "Item Name", "Category", "Unit", "Current Stock",
      "Min Qty", "Reorder Qty", "Lead Time Days", "Daily Velocity", "Days To Out",
      "Risk Level", "Recommended Supplier", "Unit Cost", "Projected Spend"
    ];

    const rows = evaluated.map((it) => [
      `"${it.item_code}"`,
      `"${(it.name || "").replace(/"/g, '""')}"`,
      `"${it.category}"`,
      `"${it.unit}"`,
      it.current_stock,
      it.min_qty,
      it.reorder_qty,
      it.lead_time_days,
      it.daily_velocity,
      it.days_to_out,
      `"${it.risk_level}"`,
      `"${(it.recommended_supplier || "").replace(/"/g, '""')}"`,
      it.unit_cost,
      it.projected_spend
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Hotel_Kapila_Reorder_Points_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  alerts,
  predictive,
  agentTelemetry,
  batchUpdate,
  batchDraftPOs,
  recalibrate,
  exportExcel,
  exportCsv
};

