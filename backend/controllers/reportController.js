const inventoryReportService = require("../services/inventoryReportService");
const { auditLog } = require("../services/auditService");

/**
 * Report Controller — Enterprise Excel & Operational Reporting
 */
async function exportInventoryExcel(req, res, next) {
  try {
    const isAuthorized =
      req.user?.isAdmin ||
      req.user?.permissions?.has("stock.export") ||
      req.user?.permissions?.has("dashboard.export") ||
      req.user?.roles?.some((r) => ["admin", "manager", "store_manager"].includes(r.key || r));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: You do not have permission to export inventory reports.",
      });
    }

    const filters = {
      category: req.query.category || undefined,
      department: req.query.department || undefined,
    };

    const metadata = {
      userName: req.user?.name || "Storekeeper",
      userId: req.user?.id,
    };

    const workbook = await inventoryReportService.generateWorkbook(filters, metadata);
    const todayStr = new Date().toISOString().slice(0, 10);
    const filename = `Kapila_Inventory_Report_${todayStr}.xlsx`;

    // Audit the export action
    await auditLog(req, {
      action: "report.export_excel",
      resource: "inventory_report",
      metadata: { filename, filters },
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Failed to generate Excel inventory report:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Failed to generate Excel inventory report: " + err.message,
      });
    } else {
      next(err);
    }
  }
}

/**
 * Quick JSON metadata preview for UI dialogs and agent status
 */
async function previewInventoryMetadata(req, res, next) {
  try {
    const data = await inventoryReportService.fetchReportData(req.query);

    let totalValuation = 0;
    let lowStockCount = 0;
    data.masterStock.forEach((s) => {
      const rem = parseFloat(s.total_remaining) || 0;
      const rate = parseFloat(s.avg_price) || 0;
      const min = parseFloat(s.min_alert_qty) || 0;
      totalValuation += rem * rate;
      if (min > 0 && rem <= min) lowStockCount++;
    });

    res.json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        total_skus: data.masterStock.length,
        total_batches: data.batches.length,
        total_issuances: data.issuances.length,
        total_grn: data.grnRecords.length,
        total_reorder_points: data.reorderPoints.length,
        total_audit_items: data.auditItems.length,
        total_valuation: Math.round(totalValuation * 100) / 100,
        low_stock_count: lowStockCount,
        sheets: [
          "Executive Summary",
          "Master Stock Valuation",
          "Batch & FEFO Expiry",
          "Department Consumption",
          "Procurement & GRN",
          "Reorder & Replenishment",
          "Audit & Variances",
        ],
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportInventoryExcel,
  previewInventoryMetadata,
};
