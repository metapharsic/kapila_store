const nightAuditService = require("../services/nightAuditService");
const ExcelJS = require("exceljs");

/**
 * nightAuditController.js
 * Controller for Daily Food Cost Night Audit, Midnight Rollover & Financial Freezes
 */

async function getAuditPreview(req, res, next) {
  try {
    const { date, revenue } = req.query;
    const preview = await nightAuditService.getDailyAuditPreview(date, revenue);
    res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
}

async function executeAudit(req, res, next) {
  try {
    const auditRecord = await nightAuditService.executeNightAudit(req.body, req.user || {});
    res.status(201).json({ success: true, data: auditRecord });
  } catch (err) {
    next(err);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const { status, date_from, date_to } = req.query;
    const pagination = req.pagination || { page: 1, limit: 30 };
    const result = await nightAuditService.listNightAuditLogs(
      { status, date_from, date_to },
      pagination
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getTelemetry(req, res, next) {
  try {
    const telemetry = await nightAuditService.getNightAuditTelemetry();
    res.json({ success: true, data: telemetry });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const auditsRes = await nightAuditService.listNightAuditLogs({}, { page: 1, limit: 365 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Night Audit Engine";
    workbook.created = new Date();

    // Sheet 1: Night Audit Ledger
    const sheet1 = workbook.addWorksheet("Night Audit Ledger", {
      views: [{ showGridLines: true }]
    });

    sheet1.columns = [
      { header: "Audit Date", key: "audit_date", width: 15 },
      { header: "Material Issued (₹)", key: "issued_cost", width: 20 },
      { header: "Food Waste (₹)", key: "waste_cost", width: 16 },
      { header: "Kitchen Direct Cost (₹)", key: "direct_cost", width: 22 },
      { header: "Food Sales Revenue (₹)", key: "food_revenue", width: 22 },
      { header: "Food Cost %", key: "food_cost_pct", width: 15 },
      { header: "Target %", key: "target_pct", width: 12 },
      { header: "Variance %", key: "variance_pct", width: 14 },
      { header: "Status", key: "status", width: 18 },
      { header: "Auditor", key: "auditor_name", width: 18 },
      { header: "Rollover Notes", key: "notes", width: 35 }
    ];

    sheet1.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet1.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF854D0E" } }; // Gold/Brown accent

    auditsRes.rows.forEach((row) => {
      sheet1.addRow({
        audit_date: row.audit_date ? String(row.audit_date).slice(0, 10) : "-",
        issued_cost: parseFloat(row.total_material_issued_cost) || 0,
        waste_cost: parseFloat(row.total_food_waste_cost) || 0,
        direct_cost: parseFloat(row.total_kitchen_direct_cost) || 0,
        food_revenue: parseFloat(row.total_food_revenue) || 0,
        food_cost_pct: `${parseFloat(row.food_cost_percentage).toFixed(2)}%`,
        target_pct: `${parseFloat(row.target_food_cost_pct).toFixed(2)}%`,
        variance_pct: `${parseFloat(row.variance_pct) > 0 ? "+" : ""}${parseFloat(row.variance_pct).toFixed(2)}%`,
        status: row.audit_status,
        auditor_name: row.auditor_name,
        notes: row.rollover_notes || "-"
      });
    });

    // Sheet 2: Department Breakdown (from most recent audits)
    const sheet2 = workbook.addWorksheet("Department Cost Breakdown", {
      views: [{ showGridLines: true }]
    });

    sheet2.columns = [
      { header: "Audit Date", key: "audit_date", width: 15 },
      { header: "Kitchen Department", key: "department", width: 24 },
      { header: "Material Issued (₹)", key: "dept_issued", width: 20 },
      { header: "Food Waste (₹)", key: "dept_waste", width: 16 },
      { header: "Total Department Cost (₹)", key: "dept_total", width: 24 }
    ];

    sheet2.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    auditsRes.rows.forEach((row) => {
      const dateStr = row.audit_date ? String(row.audit_date).slice(0, 10) : "-";
      let depts = [];
      try {
        depts = typeof row.department_breakdown === "string"
          ? JSON.parse(row.department_breakdown)
          : (row.department_breakdown || []);
      } catch {
        depts = [];
      }

      depts.forEach((d) => {
        sheet2.addRow({
          audit_date: dateStr,
          department: d.department,
          dept_issued: d.issued_cost || 0,
          dept_waste: d.waste_cost || 0,
          dept_total: d.direct_cost || ((d.issued_cost || 0) + (d.waste_cost || 0))
        });
      });
    });

    const filename = `Kapila_Food_Cost_Night_Audit_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAuditPreview,
  executeAudit,
  listAuditLogs,
  getTelemetry,
  exportExcel
};
