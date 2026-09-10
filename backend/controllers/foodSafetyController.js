const foodSafetyService = require("../services/foodSafetyService");
const ExcelJS = require("exceljs");

/**
 * foodSafetyController.js
 * Controller for HACCP Receiving Inspections and Kitchen Hygiene Audits
 */

async function listInspections(req, res, next) {
  try {
    const { category, status, temp_compliant, date_from, date_to, search } = req.query;
    const pagination = req.pagination || { page: 1, limit: 30 };
    const result = await foodSafetyService.listInspections(
      { category, status, temp_compliant, date_from, date_to, search },
      pagination
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createInspection(req, res, next) {
  try {
    const inspection = await foodSafetyService.createInspection(req.body, req.user || {});
    res.status(201).json({ success: true, data: inspection });
  } catch (err) {
    next(err);
  }
}

async function getTelemetry(req, res, next) {
  try {
    const telemetry = await foodSafetyService.getQualityTelemetry();
    res.json({ success: true, data: telemetry });
  } catch (err) {
    next(err);
  }
}

async function listPestLogs(req, res, next) {
  try {
    const pagination = req.pagination || { page: 1, limit: 20 };
    const result = await foodSafetyService.listPestLogs(pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createPestLog(req, res, next) {
  try {
    const log = await foodSafetyService.createPestLog(req.body, req.user || {});
    res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Food Safety Quality System";
    workbook.created = new Date();

    // Sheet 1: HACCP Receiving Inspections
    const inspSheet = workbook.addWorksheet("HACCP Receiving Inspections");
    inspSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Item Name", key: "item_name", width: 28 },
      { header: "Category", key: "category", width: 18 },
      { header: "Supplier", key: "supplier_name", width: 26 },
      { header: "Challan #", key: "challan_number", width: 16 },
      { header: "Temp (°C)", key: "receiving_temp_c", width: 14 },
      { header: "Max Safe Temp", key: "temp_threshold_max_c", width: 16 },
      { header: "Temp Compliant", key: "temp_compliant", width: 16 },
      { header: "Packaging", key: "packaging_seal", width: 14 },
      { header: "Sensory", key: "sensory_rating", width: 14 },
      { header: "Status", key: "status", width: 16 },
      { header: "Inspector", key: "inspector_name", width: 18 },
      { header: "Rejection / Action Note", key: "rejection_reason", width: 35 }
    ];
    inspSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    inspSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

    const data = await foodSafetyService.listInspections({}, { page: 1, limit: 1000 });
    data.rows.forEach((r) => {
      inspSheet.addRow({
        date: r.inspection_date ? new Date(r.inspection_date).toISOString().slice(0, 10) : "-",
        item_name: r.item_name,
        category: r.category,
        supplier_name: r.supplier_name || "-",
        challan_number: r.challan_number || "-",
        receiving_temp_c: r.receiving_temp_c !== null ? `${r.receiving_temp_c}°C` : "N/A",
        temp_threshold_max_c: r.temp_threshold_max_c !== null ? `≤ ${r.temp_threshold_max_c}°C` : "-",
        temp_compliant: r.temp_compliant ? "COMPLIANT" : "FAIL",
        packaging_seal: r.packaging_seal,
        sensory_rating: r.sensory_rating,
        status: r.status,
        inspector_name: r.inspector_name,
        rejection_reason: r.rejection_reason || r.action_taken || "-"
      });
    });

    // Sheet 2: Pest Control & Hygiene Audits
    const pestSheet = workbook.addWorksheet("Pest Control & Hygiene Audits");
    pestSheet.columns = [
      { header: "Service Date", key: "date", width: 14 },
      { header: "Audit / Service Type", key: "service_type", width: 25 },
      { header: "Agency", key: "service_agency", width: 28 },
      { header: "Technician", key: "technician_name", width: 18 },
      { header: "Areas Covered", key: "areas", width: 35 },
      { header: "Chemicals Used", key: "chemicals_used", width: 30 },
      { header: "Traps Active", key: "trap_count_installed", width: 14 },
      { header: "Pest Activity", key: "pest_activity_detected", width: 16 },
      { header: "Score (100)", key: "hygiene_score", width: 14 },
      { header: "Chef Signoff", key: "supervisor_signoff", width: 20 }
    ];
    pestSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    pestSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const pestData = await foodSafetyService.listPestLogs({ page: 1, limit: 100 });
    pestData.rows.forEach((p) => {
      let areasStr = "-";
      try {
        const arr = typeof p.areas_covered === "string" ? JSON.parse(p.areas_covered) : p.areas_covered;
        areasStr = Array.isArray(arr) ? arr.join(", ") : String(arr);
      } catch (e) {
        areasStr = String(p.areas_covered || "-");
      }

      pestSheet.addRow({
        date: p.service_date ? new Date(p.service_date).toISOString().slice(0, 10) : "-",
        service_type: p.service_type,
        service_agency: p.service_agency,
        technician_name: p.technician_name || "-",
        areas: areasStr,
        chemicals_used: p.chemicals_used || "-",
        trap_count_installed: p.trap_count_installed,
        pest_activity_detected: p.pest_activity_detected,
        hygiene_score: p.hygiene_score,
        supervisor_signoff: p.supervisor_signoff || "-"
      });
    });

    const filename = `Kapila_Food_Safety_HACCP_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listInspections,
  createInspection,
  getTelemetry,
  listPestLogs,
  createPestLog,
  exportExcel
};
