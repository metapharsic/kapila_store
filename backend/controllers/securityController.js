const securityGateService = require("../services/securityGateService");
const ExcelJS = require("exceljs");

/**
 * securityController.js
 * Controller for Security Gate Passes and Returnable Container (RGP) Reconciler
 */

async function listPasses(req, res, next) {
  try {
    const { pass_type, status, returnable_only, pending_return, date_from, date_to, search } = req.query;
    const pagination = req.pagination || { page: 1, limit: 30 };
    const result = await securityGateService.listPasses(
      { pass_type, status, returnable_only, pending_return, date_from, date_to, search },
      pagination
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getPass(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const pass = await securityGateService.getPassById(id);
    res.json({ success: true, data: pass });
  } catch (err) {
    next(err);
  }
}

async function createPass(req, res, next) {
  try {
    const pass = await securityGateService.createPass(req.body, req.user || {});
    res.status(201).json({ success: true, data: pass });
  } catch (err) {
    next(err);
  }
}

async function recordExit(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await securityGateService.recordExit(id, req.body, req.user || {});
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function reconcileRgp(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await securityGateService.reconcileRgp(id, req.body, req.user || {});
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function getTelemetry(req, res, next) {
  try {
    const telemetry = await securityGateService.getGateTelemetry();
    res.json({ success: true, data: telemetry });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Security System";
    workbook.created = new Date();

    // Sheet 1: Gate Pass Vehicle Log
    const gateSheet = workbook.addWorksheet("Gate Passes Log");
    gateSheet.columns = [
      { header: "Pass Number", key: "pass_number", width: 18 },
      { header: "Pass Type", key: "pass_type", width: 18 },
      { header: "Vehicle Number", key: "vehicle_number", width: 16 },
      { header: "Vehicle Type", key: "vehicle_type", width: 14 },
      { header: "Driver Name", key: "driver_name", width: 22 },
      { header: "Driver Phone", key: "driver_phone", width: 16 },
      { header: "Vendor / Supplier", key: "vendor_name", width: 26 },
      { header: "Purpose", key: "purpose", width: 35 },
      { header: "Challan #", key: "challan_number", width: 16 },
      { header: "Invoice #", key: "invoice_number", width: 16 },
      { header: "In Time", key: "in_time", width: 20 },
      { header: "Out Time", key: "out_time", width: 20 },
      { header: "Status", key: "status", width: 16 },
      { header: "Security Officer", key: "security_guard_name", width: 20 }
    ];
    gateSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    gateSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

    const passesData = await securityGateService.listPasses({}, { page: 1, limit: 1000 });
    passesData.rows.forEach((p) => {
      gateSheet.addRow({
        pass_number: p.pass_number,
        pass_type: p.pass_type,
        vehicle_number: p.vehicle_number,
        vehicle_type: p.vehicle_type,
        driver_name: p.driver_name,
        driver_phone: p.driver_phone || "-",
        vendor_name: p.vendor_name || "-",
        purpose: p.purpose,
        challan_number: p.challan_number || "-",
        invoice_number: p.invoice_number || "-",
        in_time: p.in_time ? new Date(p.in_time).toLocaleString("en-IN") : "-",
        out_time: p.out_time ? new Date(p.out_time).toLocaleString("en-IN") : "-",
        status: p.status,
        security_guard_name: p.security_guard_name || "-"
      });
    });

    // Sheet 2: Returnable Container Reconciler (RGP)
    const rgpSheet = workbook.addWorksheet("Returnable Containers (RGP)");
    rgpSheet.columns = [
      { header: "Pass Number", key: "pass_number", width: 18 },
      { header: "Date Dispatched", key: "date", width: 16 },
      { header: "Vendor Name", key: "vendor_name", width: 26 },
      { header: "Container Type", key: "returnable_item_type", width: 26 },
      { header: "Qty Dispatched (Out)", key: "returnable_qty_out", width: 20 },
      { header: "Qty Returned (In)", key: "returnable_qty_in", width: 18 },
      { header: "Balance Due", key: "returnable_balance_due", width: 16 },
      { header: "Due Date", key: "return_due_date", width: 16 },
      { header: "Settlement Status", key: "is_return_completed", width: 18 },
      { header: "Challan #", key: "challan_number", width: 16 },
      { header: "Remarks", key: "remarks", width: 35 }
    ];
    rgpSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    rgpSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const rgpPasses = passesData.rows.filter((p) => p.pass_type === "RGP_RETURNABLE");
    rgpPasses.forEach((p) => {
      rgpSheet.addRow({
        pass_number: p.pass_number,
        date: p.in_time ? new Date(p.in_time).toISOString().slice(0, 10) : "-",
        vendor_name: p.vendor_name || "-",
        returnable_item_type: p.returnable_item_type || "-",
        returnable_qty_out: p.returnable_qty_out,
        returnable_qty_in: p.returnable_qty_in,
        returnable_balance_due: p.returnable_balance_due,
        return_due_date: p.return_due_date ? new Date(p.return_due_date).toISOString().slice(0, 10) : "-",
        is_return_completed: p.is_return_completed ? "SETTLED" : "PENDING DUE",
        challan_number: p.challan_number || "-",
        remarks: p.remarks || "-"
      });
    });

    const filename = `Kapila_Security_Gate_Pass_Log_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

async function appendItem(req, res, next) {
  try {
    const passId = parseInt(req.params.id, 10);
    const result = await securityGateService.appendItem(passId, req.body, req.user || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function deleteItem(req, res, next) {
  try {
    const passId = parseInt(req.params.id, 10);
    const itemId = parseInt(req.params.itemId, 10);
    const result = await securityGateService.deleteItem(passId, itemId, req.user || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function deletePass(req, res, next) {
  try {
    const passId = parseInt(req.params.id, 10);
    const result = await securityGateService.deletePass(passId, req.user || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updatePass(req, res, next) {
  try {
    const passId = parseInt(req.params.id, 10);
    const result = await securityGateService.updatePass(passId, req.body, req.user || {});
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPasses,
  getPass,
  createPass,
  recordExit,
  reconcileRgp,
  getTelemetry,
  exportExcel,
  appendItem,
  deleteItem,
  deletePass,
  updatePass
};
