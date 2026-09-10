const maintenanceService = require("../services/maintenanceService");
const ExcelJS = require("exceljs");

/**
 * maintenanceController.js
 * Controller for Kitchen & Facility Asset CMMS
 */

async function listAssets(req, res, next) {
  try {
    const { q, department, category, status, criticality } = req.query;
    const pagination = req.pagination || { page: 1, limit: 50 };
    const result = await maintenanceService.listAssets({ q, department, category, status, criticality }, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getAssetDetails(req, res, next) {
  try {
    const assetId = parseInt(req.params.id, 10);
    const details = await maintenanceService.getAssetDetails(assetId);
    if (!details) {
      return res.status(404).json({ success: false, error: "Asset not found" });
    }
    res.json({ success: true, data: details });
  } catch (err) {
    next(err);
  }
}

async function createAsset(req, res, next) {
  try {
    const asset = await maintenanceService.createAsset(req.body);
    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
}

async function updateAsset(req, res, next) {
  try {
    const assetId = parseInt(req.params.id, 10);
    const updated = await maintenanceService.updateAsset(assetId, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Asset not found" });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function listWorkOrders(req, res, next) {
  try {
    const { status, priority, order_type, department, asset_id, q, date_from, date_to } = req.query;
    const pagination = req.pagination || { page: 1, limit: 50 };
    const result = await maintenanceService.listWorkOrders(
      { status, priority, order_type, department, asset_id, q, date_from, date_to },
      pagination
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createWorkOrder(req, res, next) {
  try {
    const wo = await maintenanceService.createWorkOrder(req.body, req.user);
    res.status(201).json({ success: true, data: wo });
  } catch (err) {
    next(err);
  }
}

async function updateWorkOrder(req, res, next) {
  try {
    const woId = parseInt(req.params.id, 10);
    const updated = await maintenanceService.updateWorkOrder(woId, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function consumeParts(req, res, next) {
  try {
    const woId = parseInt(req.params.id, 10);
    const partsList = Array.isArray(req.body.parts) ? req.body.parts : [req.body];
    const result = await maintenanceService.consumeParts(woId, partsList, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function completeWorkOrder(req, res, next) {
  try {
    const woId = parseInt(req.params.id, 10);
    const completed = await maintenanceService.completeWorkOrder(woId, req.body, req.user);
    res.json({ success: true, data: completed });
  } catch (err) {
    next(err);
  }
}

async function listSchedules(req, res, next) {
  try {
    const { asset_id, frequency } = req.query;
    const result = await maintenanceService.listSchedules({ asset_id, frequency });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function completeSchedule(req, res, next) {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    const result = await maintenanceService.completeSchedule(scheduleId, req.body, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const analytics = await maintenanceService.getAnalytics();
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Enterprise CMMS";
    workbook.created = new Date();

    // 1. Assets Sheet
    const assetsSheet = workbook.addWorksheet("Kitchen & Facility Assets");
    assetsSheet.columns = [
      { header: "Asset Code", key: "asset_code", width: 14 },
      { header: "Equipment Name", key: "name", width: 35 },
      { header: "Department", key: "department", width: 22 },
      { header: "Location", key: "location", width: 24 },
      { header: "Category", key: "category", width: 20 },
      { header: "Status", key: "status", width: 16 },
      { header: "Criticality", key: "criticality", width: 14 },
      { header: "Manufacturer", key: "manufacturer", width: 22 },
      { header: "AMC Vendor", key: "amc_vendor", width: 25 },
      { header: "Warranty Expiry", key: "warranty_expiry", width: 16 },
    ];
    assetsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    assetsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

    const assetsData = await maintenanceService.listAssets({}, { page: 1, limit: 1000 });
    assetsData.rows.forEach(a => {
      assetsSheet.addRow({
        asset_code: a.asset_code,
        name: a.name,
        department: a.department,
        location: a.location,
        category: a.category,
        status: a.status,
        criticality: a.criticality,
        manufacturer: a.manufacturer,
        amc_vendor: a.amc_vendor,
        warranty_expiry: a.warranty_expiry ? new Date(a.warranty_expiry).toISOString().slice(0, 10) : "-"
      });
    });

    // 2. Work Orders Sheet
    const woSheet = workbook.addWorksheet("Maintenance Work Orders");
    woSheet.columns = [
      { header: "WO Number", key: "wo_number", width: 16 },
      { header: "Date", key: "date", width: 16 },
      { header: "Equipment", key: "asset_name", width: 30 },
      { header: "Department", key: "department", width: 20 },
      { header: "Type", key: "order_type", width: 16 },
      { header: "Priority", key: "priority", width: 14 },
      { header: "Status", key: "status", width: 16 },
      { header: "Issue Description", key: "issue_description", width: 40 },
      { header: "Action Taken", key: "action_taken", width: 35 },
      { header: "Downtime (Mins)", key: "downtime_minutes", width: 16 },
      { header: "Parts Cost (₹)", key: "parts_cost", width: 16 },
      { header: "Labor Cost (₹)", key: "labor_cost", width: 16 },
      { header: "Total Cost (₹)", key: "total_cost", width: 16 },
      { header: "Assigned To", key: "assigned_to", width: 20 },
    ];
    woSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    woSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const woData = await maintenanceService.listWorkOrders({}, { page: 1, limit: 1000 });
    woData.rows.forEach(w => {
      woSheet.addRow({
        wo_number: w.wo_number,
        date: w.created_at ? new Date(w.created_at).toISOString().slice(0, 10) : "-",
        asset_name: w.asset_name,
        department: w.department,
        order_type: w.order_type,
        priority: w.priority,
        status: w.status,
        issue_description: w.issue_description,
        action_taken: w.action_taken || "-",
        downtime_minutes: w.downtime_minutes || 0,
        parts_cost: parseFloat(w.parts_cost || 0),
        labor_cost: parseFloat(w.labor_cost || 0),
        total_cost: parseFloat(w.total_cost || 0),
        assigned_to: w.assigned_to || "-"
      });
    });

    const filename = `Kapila_CMMS_Maintenance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
  exportExcel
};
