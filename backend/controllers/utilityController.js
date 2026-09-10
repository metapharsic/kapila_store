const utilityService = require("../services/utilityService");
const ExcelJS = require("exceljs");

/**
 * utilityController.js
 * Controller for Kitchen Energy, Commercial LPG Manifold, and Facility Utilities
 */

async function listReadings(req, res, next) {
  try {
    const { date_from, date_to, shift } = req.query;
    const pagination = req.pagination || { page: 1, limit: 30 };
    const result = await utilityService.listReadings({ date_from, date_to, shift }, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createReading(req, res, next) {
  try {
    const record = await utilityService.recordReading(req.body, req.user || {});
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const timeframeDays = parseInt(req.query.days, 10) || 30;
    const analytics = await utilityService.getUtilityAnalytics(timeframeDays);
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Facility Utilities";
    workbook.created = new Date();

    // Sheet 1: LPG Cylinder Bank & Kitchen Fuel
    const lpgSheet = workbook.addWorksheet("LPG Kitchen Fuel Telemetry");
    lpgSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Shift", key: "shift", width: 14 },
      { header: "LPG Start (Kg)", key: "lpg_start_kg", width: 16 },
      { header: "LPG End (Kg)", key: "lpg_end_kg", width: 16 },
      { header: "Net Consumed (Kg)", key: "lpg_consumed_kg", width: 18 },
      { header: "Active on Manifold", key: "lpg_active_cylinders", width: 18 },
      { header: "Empty in Yard", key: "lpg_empty_cylinders", width: 16 },
      { header: "Full in Stock", key: "lpg_full_cylinders", width: 16 },
      { header: "Manifold Pressure (Bar)", key: "lpg_pressure_bar", width: 22 },
      { header: "Supervisor", key: "recorded_by", width: 20 },
      { header: "Notes", key: "notes", width: 35 }
    ];
    lpgSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    lpgSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

    const readings = await utilityService.listReadings({}, { page: 1, limit: 1000 });
    readings.rows.forEach((r) => {
      lpgSheet.addRow({
        date: r.reading_date ? new Date(r.reading_date).toISOString().slice(0, 10) : "-",
        shift: r.shift,
        lpg_start_kg: parseFloat(r.lpg_start_kg || 0),
        lpg_end_kg: parseFloat(r.lpg_end_kg || 0),
        lpg_consumed_kg: parseFloat(r.lpg_consumed_kg || 0),
        lpg_active_cylinders: r.lpg_active_cylinders,
        lpg_empty_cylinders: r.lpg_empty_cylinders,
        lpg_full_cylinders: r.lpg_full_cylinders,
        lpg_pressure_bar: parseFloat(r.lpg_pressure_bar || 0),
        recorded_by: r.recorded_by || "-",
        notes: r.notes || "-"
      });
    });

    // Sheet 2: Electricity, DG & Water Management
    const powerSheet = workbook.addWorksheet("Power & Water Telemetry");
    powerSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Shift", key: "shift", width: 14 },
      { header: "EB Start (kWh)", key: "eb_meter_start", width: 16 },
      { header: "EB End (kWh)", key: "eb_meter_end", width: 16 },
      { header: "EB Units (kWh)", key: "eb_units_consumed", width: 16 },
      { header: "DG Runtime (Hrs)", key: "dg_run_hours", width: 16 },
      { header: "DG Power (kWh)", key: "dg_units_kwh", width: 16 },
      { header: "DG Diesel Consumed (L)", key: "dg_diesel_consumed_litres", width: 22 },
      { header: "DG Diesel Stock (L)", key: "dg_diesel_stock_litres", width: 20 },
      { header: "Water Tankers (Count)", key: "water_tanker_count", width: 20 },
      { header: "Tanker Water (Litres)", key: "water_tanker_litres", width: 20 },
      { header: "RO Output (Litres)", key: "ro_plant_output_litres", width: 18 }
    ];
    powerSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    powerSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    readings.rows.forEach((r) => {
      powerSheet.addRow({
        date: r.reading_date ? new Date(r.reading_date).toISOString().slice(0, 10) : "-",
        shift: r.shift,
        eb_meter_start: parseFloat(r.eb_meter_start || 0),
        eb_meter_end: parseFloat(r.eb_meter_end || 0),
        eb_units_consumed: parseFloat(r.eb_units_consumed || 0),
        dg_run_hours: parseFloat(r.dg_run_hours || 0),
        dg_units_kwh: parseFloat(r.dg_units_kwh || 0),
        dg_diesel_consumed_litres: parseFloat(r.dg_diesel_consumed_litres || 0),
        dg_diesel_stock_litres: parseFloat(r.dg_diesel_stock_litres || 0),
        water_tanker_count: r.water_tanker_count,
        water_tanker_litres: parseFloat(r.water_tanker_litres || 0),
        ro_plant_output_litres: parseFloat(r.ro_plant_output_litres || 0)
      });
    });

    const filename = `Kapila_Utility_Consumption_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
  listReadings,
  createReading,
  getAnalytics,
  exportExcel
};
