const wasteService = require("../services/wasteService");
const ExcelJS = require("exceljs");

/**
 * wasteController.js
 * Controller for Kitchen Food Waste Accounting, Cost Rollup & FSSAI RUCO Compliance
 */

async function listWaste(req, res, next) {
  try {
    const { department, waste_type, date_from, date_to, search } = req.query;
    const pagination = req.pagination || { page: 1, limit: 30 };
    const result = await wasteService.listWasteLogs(
      { department, waste_type, date_from, date_to, search },
      pagination
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function logWaste(req, res, next) {
  try {
    const record = await wasteService.logWaste(req.body, req.user || {});
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const analytics = await wasteService.getWasteAnalytics(days);
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
}

async function listRuco(req, res, next) {
  try {
    const { department } = req.query;
    const pagination = req.pagination || { page: 1, limit: 30 };
    const result = await wasteService.listRucoLogs({ department }, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function logRuco(req, res, next) {
  try {
    const record = await wasteService.logRucoReading(req.body, req.user || {});
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

async function recordDisposal(req, res, next) {
  try {
    const record = await wasteService.recordRucoDisposal(req.body, req.user || {});
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Waste Management & RUCO";
    workbook.created = new Date();

    // Sheet 1: Kitchen Food Waste Log
    const wasteSheet = workbook.addWorksheet("Kitchen Food Waste Log");
    wasteSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Department", key: "department", width: 22 },
      { header: "Waste Type", key: "waste_type", width: 24 },
      { header: "Item Description", key: "item_name", width: 30 },
      { header: "Quantity", key: "qty", width: 14 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Unit Cost (₹)", key: "unit_cost", width: 14 },
      { header: "Total Cost (₹)", key: "total_cost", width: 16 },
      { header: "Reason", key: "reason", width: 35 },
      { header: "Disposal Method", key: "disposal_method", width: 22 },
      { header: "Logged By", key: "logged_by", width: 18 },
      { header: "Authorized By", key: "authorized_by", width: 18 }
    ];
    wasteSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    wasteSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

    const wasteData = await wasteService.listWasteLogs({}, { page: 1, limit: 1000 });
    wasteData.rows.forEach((w) => {
      wasteSheet.addRow({
        date: w.waste_date ? new Date(w.waste_date).toISOString().slice(0, 10) : "-",
        department: w.department,
        waste_type: w.waste_type,
        item_name: w.item_name,
        qty: parseFloat(w.qty || 0),
        unit: w.unit,
        unit_cost: parseFloat(w.unit_cost || 0),
        total_cost: parseFloat(w.total_cost || 0),
        reason: w.reason,
        disposal_method: w.disposal_method,
        logged_by: w.logged_by,
        authorized_by: w.authorized_by || "-"
      });
    });

    // Sheet 2: FSSAI RUCO Used Cooking Oil
    const rucoSheet = workbook.addWorksheet("RUCO Used Cooking Oil");
    rucoSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Department", key: "department", width: 22 },
      { header: "Fryer / Drum", key: "fryer_name", width: 26 },
      { header: "Oil Type", key: "oil_type", width: 18 },
      { header: "TPC (%)", key: "tpc_percentage", width: 12 },
      { header: "Status", key: "status", width: 22 },
      { header: "Discarded (L)", key: "discarded_litres", width: 16 },
      { header: "Drum Stock (L)", key: "current_drum_stock_litres", width: 16 },
      { header: "Collected (L)", key: "collected_litres", width: 16 },
      { header: "Biodiesel Aggregator", key: "collection_vendor", width: 28 },
      { header: "Certificate #", key: "collection_certificate_no", width: 20 },
      { header: "Revenue (₹)", key: "revenue_recovered", width: 14 },
      { header: "Recorded By", key: "recorded_by", width: 18 }
    ];
    rucoSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    rucoSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const rucoData = await wasteService.listRucoLogs({}, { page: 1, limit: 1000 });
    rucoData.rows.forEach((r) => {
      rucoSheet.addRow({
        date: r.log_date ? new Date(r.log_date).toISOString().slice(0, 10) : "-",
        department: r.department,
        fryer_name: r.fryer_name,
        oil_type: r.oil_type,
        tpc_percentage: `${r.tpc_percentage}%`,
        status: r.status,
        discarded_litres: parseFloat(r.discarded_litres || 0),
        current_drum_stock_litres: parseFloat(r.current_drum_stock_litres || 0),
        collected_litres: parseFloat(r.collected_litres || 0),
        collection_vendor: r.collection_vendor || "-",
        collection_certificate_no: r.collection_certificate_no || "-",
        revenue_recovered: parseFloat(r.revenue_recovered || 0),
        recorded_by: r.recorded_by
      });
    });

    const filename = `Kapila_Kitchen_Waste_and_RUCO_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
  listWaste,
  logWaste,
  getAnalytics,
  listRuco,
  logRuco,
  recordDisposal,
  exportExcel
};
