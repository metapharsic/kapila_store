const ExcelJS = require("exceljs");
const db = require("../db");
const { embedLogoInWorksheet } = require("../assets/logoBase64");

/**
 * Enterprise Color Palette
 */
const PALETTE = {
  headerBg: "1E293B",        // Dark Slate
  headerText: "FFFFFF",      // White
  subHeaderBg: "334155",     // Lighter Slate
  accentGold: "D97706",      // Amber / Gold #d97706
  accentGoldLight: "FEF3C7", // Soft Gold
  borderLight: "CBD5E1",     // Slate 300
  borderDark: "64748B",      // Slate 500
  zebraBg: "F8FAFC",         // Slate 50
  
  // Status Colors
  greenFill: "D1FAE5",       // Emerald 100
  greenText: "065F46",       // Emerald 800
  amberFill: "FEF3C7",       // Amber 100
  amberText: "92400E",       // Amber 800
  redFill: "FEE2E2",         // Rose 100
  redText: "991B1B",         // Rose 800
  blueFill: "E0F2FE",        // Sky 100
  blueText: "075985",        // Sky 800
};

const BORDER_BOX = {
  top: { style: "thin", color: { argb: PALETTE.borderLight } },
  left: { style: "thin", color: { argb: PALETTE.borderLight } },
  bottom: { style: "thin", color: { argb: PALETTE.borderLight } },
  right: { style: "thin", color: { argb: PALETTE.borderLight } },
};

/**
 * Auto-fit column widths based on longest content with padding
 */
function autoFitColumns(worksheet, minWidth = 14, maxWidth = 52) {
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: false }, (cell) => {
      let cellLen = 0;
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === "object" && cell.value.result !== undefined) {
          cellLen = String(cell.value.result).length;
        } else if (typeof cell.value === "object" && cell.value.richText) {
          cellLen = cell.value.richText.map((t) => t.text).join("").length;
        } else {
          cellLen = String(cell.value).length;
        }
      }
      if (cellLen > maxLength) maxLength = cellLen;
    });
    column.width = Math.min(Math.max(maxLength + 4, minWidth), maxWidth);
  });
}

/**
 * Merge a cell range, but never crash the whole report over it: ExcelJS
 * throws "Cannot merge already merged cells" if any cell in the range is
 * already part of a previous merge (e.g. a group-name collision or an
 * unexpected data shape). We only swallow that specific error and log a
 * warning - any other error from mergeCells still propagates.
 */
function safeMergeCells(worksheet, range) {
  try {
    worksheet.mergeCells(range);
  } catch (err) {
    if (err && /already merged/i.test(err.message || "")) {
      console.warn(`[excel] Skipped duplicate mergeCells("${range}") on sheet "${worksheet.name}": ${err.message}`);
    } else {
      throw err;
    }
  }
}

/**
 * Style a title banner row
 */
function formatTitleBanner(worksheet, title, subtitle, dateStr) {
  safeMergeCells(worksheet, "A1:G1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `HOTEL KAPILA INVENTORY MANAGEMENT SYSTEM`;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: PALETTE.headerText } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  worksheet.getRow(1).height = 36;

  safeMergeCells(worksheet, "A2:G2");
  const subCell = worksheet.getCell("A2");
  subCell.value = `${title.toUpperCase()} • Generated on: ${dateStr} • Status: OFFICIAL STORE AUDIT`;
  subCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "94A3B8" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  worksheet.getRow(2).height = 20;

  worksheet.getRow(3).height = 10; // spacer
}

/**
 * Apply styling to table headers
 */
function styleHeaderRow(row, cols) {
  row.height = 28;
  cols.forEach((_, idx) => {
    const cell = row.getCell(idx + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.headerText } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: PALETTE.borderDark } },
      bottom: { style: "medium", color: { argb: PALETTE.accentGold } },
      left: { style: "thin", color: { argb: PALETTE.borderDark } },
      right: { style: "thin", color: { argb: PALETTE.borderDark } },
    };
  });
}

/**
 * Apply cell formatting according to column data type
 */
function applyCellFormat(cell, type, value, rowIndex) {
  cell.border = BORDER_BOX;
  cell.font = { name: "Calibri", size: 10 };

  // Zebra striping
  if (rowIndex % 2 === 0) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraBg } };
  }

  if (type === "currency") {
    cell.numFmt = '₹#,##0.00';
    cell.alignment = { vertical: "middle", horizontal: "right" };
  } else if (type === "qty") {
    cell.numFmt = '#,##0.00';
    cell.alignment = { vertical: "middle", horizontal: "right" };
  } else if (type === "int") {
    cell.numFmt = '#,##0';
    cell.alignment = { vertical: "middle", horizontal: "right" };
  } else if (type === "percent") {
    cell.numFmt = '0.0%';
    cell.alignment = { vertical: "middle", horizontal: "right" };
  } else if (type === "center" || type === "code" || type === "date") {
    cell.alignment = { vertical: "middle", horizontal: "center" };
  } else {
    cell.alignment = { vertical: "middle", horizontal: "left" };
  }

  // Status highlights
  if (type === "status") {
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.font = { name: "Calibri", size: 10, bold: true };
    const strVal = String(value || "").toLowerCase();
    if (strVal.includes("in stock") || strVal.includes("fresh") || strVal.includes("matched") || strVal.includes("normal") || strVal.includes("accepted")) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.greenFill } };
      cell.font = { ...cell.font, color: { argb: PALETTE.greenText } };
    } else if (strVal.includes("low stock") || strVal.includes("warning") || strVal.includes("high") || strVal.includes("partial")) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.amberFill } };
      cell.font = { ...cell.font, color: { argb: PALETTE.amberText } };
    } else if (strVal.includes("out of stock") || strVal.includes("expired") || strVal.includes("critical") || strVal.includes("shortage") || strVal.includes("rejected")) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.redFill } };
      cell.font = { ...cell.font, color: { argb: PALETTE.redText } };
    }
  }
}

/**
 * Main Inventory Report Generator Service
 */
class InventoryReportService {
  /**
   * Fetch all domain data from database
   */
  async fetchReportData(filters = {}) {
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Master Stock Aggregated
    const masterStockQuery = db("stock")
      .select(
        db.raw("COALESCE(MAX(item_code), 'KPL-' || MIN(id)) AS item_code"),
        "name",
        db.raw("COALESCE(category, 'General') AS category"),
        db.raw("COALESCE(unit, 'kg') AS unit"),
        db.raw("SUM(COALESCE(remaining, 0)) AS total_remaining"),
        db.raw("ROUND(AVG(COALESCE(price, 0))::numeric, 2) AS avg_price"),
        db.raw("ROUND(MAX(COALESCE(price, 0))::numeric, 2) AS latest_price"),
        db.raw("MAX(COALESCE(min_alert_qty, 0)) AS min_alert_qty"),
        db.raw("MAX(supplier) AS preferred_supplier"),
        db.raw("MAX(date) AS last_purchase_date")
      )
      .groupBy("name", "category", "unit")
      .orderBy("name", "asc");

    if (filters.category) {
      masterStockQuery.where("category", filters.category);
    }

    const masterStock = await masterStockQuery;

    // 2. Active Batches & FEFO Expiry
    const batches = await db("stock")
      .select(
        db.raw("COALESCE(item_code, 'KPL-' || id) AS item_code"),
        "name",
        db.raw("COALESCE(batch_no, 'BAT-' || id) AS batch_no"),
        "date AS received_date",
        "expiry_date",
        db.raw("COALESCE(remaining, 0) AS remaining"),
        db.raw("COALESCE(unit, 'kg') AS unit"),
        db.raw("COALESCE(price, 0) AS price"),
        db.raw("COALESCE(supplier, 'Local Vendor') AS supplier")
      )
      .where("remaining", ">", 0)
      .orderByRaw("CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC, date ASC");

    // 3. Department Consumption & Issuances (Recent 1500 items)
    const issuances = await db("issuances as i")
      .join("issuance_items as it", "it.issuance_id", "i.id")
      .select(
        "i.id as issuance_id",
        "i.date",
        "i.dept",
        "i.indent_id",
        "i.scanned",
        db.raw("COALESCE(it.item_code, 'N/A') as item_code"),
        "it.name as item_name",
        db.raw("COALESCE(it.issued, it.qty, 0) as issued_qty"),
        "it.unit",
        db.raw("COALESCE(it.unit_price, 0) as unit_price")
      )
      .orderBy("i.date", "desc")
      .orderBy("i.id", "desc")
      .limit(1500);

    // 4. Procurement & Inward GRN
    let grnRecords = [];
    try {
      grnRecords = await db("goods_receipt_notes as grn")
        .leftJoin("suppliers as s", "s.id", "grn.supplier_id")
        .join("goods_receipt_items as gi", "gi.grn_id", "grn.id")
        .select(
          "grn.id as grn_id",
          "grn.grn_number",
          "grn.date as grn_date",
          "grn.po_id",
          db.raw("COALESCE(s.name, 'Direct Vendor') as supplier_name"),
          db.raw("COALESCE(grn.invoice_no, 'N/A') as invoice_no"),
          "grn.received_by",
          db.raw("COALESCE(gi.item_code, 'N/A') as item_code"),
          "gi.name as item_name",
          db.raw("COALESCE(gi.qty_ordered, 0) as qty_ordered"),
          db.raw("COALESCE(gi.qty_received, 0) as qty_received"),
          db.raw("COALESCE(gi.qty_accepted, 0) as qty_accepted"),
          db.raw("COALESCE(gi.qty_rejected, 0) as qty_rejected"),
          "gi.unit",
          db.raw("COALESCE(gi.unit_price, 0) as unit_price"),
          db.raw("COALESCE(gi.landed_cost, gi.unit_price, 0) as landed_cost"),
          "gi.batch_no",
          "gi.expiry_date"
        )
        .orderBy("grn.date", "desc")
        .orderBy("grn.id", "desc")
        .limit(1000);
    } catch (e) {
      console.warn("GRN query note:", e.message);
    }

    // 5. Reorder & Replenishment Schedule
    const reorderPoints = await db("reorder_points as rp")
      .leftJoin("suppliers as s", "s.id", "rp.preferred_supplier_id")
      .select(
        "rp.item_code",
        "rp.name",
        db.raw("COALESCE(rp.min_qty, 0) as min_qty"),
        db.raw("COALESCE(rp.reorder_qty, 0) as reorder_qty"),
        db.raw("COALESCE(rp.lead_time_days, 1) as lead_time_days"),
        db.raw("COALESCE(s.name, 'Primary Vendor') as preferred_supplier"),
        "rp.notes"
      );

    // 6. Physical Audits & Variances
    let auditItems = [];
    try {
      auditItems = await db("audit_sessions as ase")
        .leftJoin("departments as d", "d.id", "ase.department_id")
        .join("audit_items as ai", "ai.audit_session_id", "ase.id")
        .leftJoin("stock as st", "st.id", "ai.stock_item_id")
        .select(
          "ase.id as session_id",
          "ase.reference",
          db.raw("ase.created_at::date as audit_date"),
          db.raw("COALESCE(d.name, 'Central Store') as department"),
          db.raw("COALESCE(ase.auditor_name, 'Store Auditor') as auditor_name"),
          db.raw("COALESCE(ai.item_code, 'N/A') as item_code"),
          "ai.item_name",
          db.raw("COALESCE(ai.unit, 'kg') as unit"),
          db.raw("COALESCE(ai.db_qty, 0) as db_qty"),
          db.raw("COALESCE(ai.physical_qty, 0) as physical_qty"),
          db.raw("COALESCE(ai.difference, 0) as difference"),
          "ai.discrepancy_reason",
          "ai.action",
          db.raw("COALESCE(st.price, 0) as unit_price")
        )
        .orderBy("ase.created_at", "desc")
        .limit(1000);
    } catch (e) {
      console.warn("Audit items query note:", e.message);
    }

    return {
      masterStock,
      batches,
      issuances,
      grnRecords,
      reorderPoints,
      auditItems,
      todayStr,
    };
  }

  /**
   * Build complete multi-tab workbook with professional formatting
   */
  async generateWorkbook(filters = {}, metadata = {}) {
    const data = await this.fetchReportData(filters);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Enterprise Inventory System";
    workbook.lastModifiedBy = metadata.userName || "Store Manager";
    workbook.created = new Date();
    workbook.modified = new Date();

    // 1. Executive Summary & Store KPIs
    this.buildSummarySheet(workbook, data, metadata);

    // 2. Master Stock Valuation
    this.buildMasterStockSheet(workbook, data);

    // 3. Batch & FEFO Expiry Ledger
    this.buildBatchFefoSheet(workbook, data);

    // 4. Department Consumption & Issuances
    this.buildDepartmentConsumptionSheet(workbook, data);

    // 5. Procurement & Inward GRN
    this.buildProcurementSheet(workbook, data);

    // 6. Reorder & Replenishment Schedule
    this.buildReorderScheduleSheet(workbook, data);

    // 7. Physical Audits & Variances
    this.buildAuditVarianceSheet(workbook, data);

    return workbook;
  }

  /**
   * Sheet 1: Executive Summary & Store KPIs
   */
  buildSummarySheet(workbook, data, metadata) {
    const ws = workbook.addWorksheet("Executive Summary", {
      properties: { tabColor: { argb: PALETTE.accentGold } },
      views: [{ showGridLines: true }],
    });
    embedLogoInWorksheet(workbook, ws, { col: 5.5, row: 0.1, width: 120, height: 34 });

    formatTitleBanner(ws, "Executive Inventory Health & KPI Dashboard", "", data.todayStr);

    // Calculate High-level KPIs
    let totalValuation = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const categoryBreakdown = {};

    data.masterStock.forEach((item) => {
      const rem = parseFloat(item.total_remaining) || 0;
      const rate = parseFloat(item.avg_price) || 0;
      const minAlert = parseFloat(item.min_alert_qty) || 0;
      const val = rem * rate;
      totalValuation += val;

      if (rem <= 0) outOfStockCount++;
      else if (minAlert > 0 && rem <= minAlert) lowStockCount++;
      else inStockCount++;

      const cat = item.category || "General";
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { count: 0, qty: 0, val: 0 };
      }
      categoryBreakdown[cat].count++;
      categoryBreakdown[cat].qty += rem;
      categoryBreakdown[cat].val += val;
    });

    // Expiry risk count
    const now = new Date();
    let expiringIn7Days = 0;
    data.batches.forEach((b) => {
      if (b.expiry_date) {
        const diffDays = Math.ceil((new Date(b.expiry_date) - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) expiringIn7Days++;
      }
    });

    // KPI Summary Cards Block (Rows 4 to 8)
    const kpiCards = [
      { title: "TOTAL INVENTORY VALUE", val: totalValuation, fmt: "currency", fill: "0F172A", text: "F8FAFC", sub: "Landed Inventory Cost" },
      { title: "TOTAL ACTIVE SKUs", val: data.masterStock.length, fmt: "int", fill: "1E293B", text: "F8FAFC", sub: "Catalog Items" },
      { title: "HEALTHY STOCK SKUs", val: inStockCount, fmt: "int", fill: PALETTE.greenFill, text: PALETTE.greenText, sub: "Sufficient Cover" },
      { title: "LOW STOCK ALERTS", val: lowStockCount, fmt: "int", fill: PALETTE.amberFill, text: PALETTE.amberText, sub: "Below Safety Buffer" },
      { title: "OUT OF STOCK", val: outOfStockCount, fmt: "int", fill: PALETTE.redFill, text: PALETTE.redText, sub: "Immediate Stockout" },
      { title: "EXPIRING IN <7 DAYS", val: expiringIn7Days, fmt: "int", fill: PALETTE.redFill, text: PALETTE.redText, sub: "FEFO Spoilage Risk" },
    ];

    ws.getRow(4).height = 16;
    ws.getRow(5).height = 28;
    ws.getRow(6).height = 16;

    kpiCards.forEach((kpi, idx) => {
      const col = idx + 1;
      const c1 = ws.getCell(4, col);
      const c2 = ws.getCell(5, col);
      const c3 = ws.getCell(6, col);

      c1.value = kpi.title;
      c1.font = { name: "Calibri", size: 9, bold: true, color: { argb: kpi.text } };
      c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.fill } };
      c1.alignment = { vertical: "middle", horizontal: "center" };
      c1.border = BORDER_BOX;

      c2.value = kpi.val;
      c2.font = { name: "Calibri", size: 16, bold: true, color: { argb: kpi.text } };
      c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.fill } };
      c2.alignment = { vertical: "middle", horizontal: "center" };
      if (kpi.fmt === "currency") c2.numFmt = '₹#,##0.00';
      else c2.numFmt = '#,##0';
      c2.border = BORDER_BOX;

      c3.value = kpi.sub;
      c3.font = { name: "Calibri", size: 8, italic: true, color: { argb: kpi.text } };
      c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.fill } };
      c3.alignment = { vertical: "middle", horizontal: "center" };
      c3.border = BORDER_BOX;
    });

    // Spacing
    ws.getRow(7).height = 14;

    // AI Store Advisor Section
    safeMergeCells(ws, "A8:G8");
    const aiTitle = ws.getCell("A8");
    aiTitle.value = "🤖 AI STORE ADVISOR & OPERATIONAL BRIEFING";
    aiTitle.font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.headerText } };
    aiTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.subHeaderBg } };
    aiTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(8).height = 24;

    const healthScore = Math.max(0, Math.round(100 - (outOfStockCount * 2.5) - (lowStockCount * 1.2) - (expiringIn7Days * 3)));
    const aiNotes = [
      `1. Overall Store Health Index: ${healthScore} / 100 (${healthScore > 85 ? "Optimal" : healthScore > 65 ? "Requires Replenishment Attention" : "Critical Stock Disruption Risk"}).`,
      `2. Capital Allocation: Total locked capital in current store stock stands at ₹${totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })} across ${data.masterStock.length} items.`,
      `3. Urgent Action Needed: ${lowStockCount + outOfStockCount} items have breached safety reorder thresholds. Automated PO drafting recommended for fast-moving items.`,
      `4. Spoilage Protection: ${expiringIn7Days} active batches expire within 7 days. Immediate push to kitchen production (TIFFINS / SI-MEALS) prioritized under FEFO dispatch rules.`,
    ];

    aiNotes.forEach((note, i) => {
      const rNum = 9 + i;
      safeMergeCells(ws, `A${rNum}:G${rNum}`);
      const c = ws.getCell(`A${rNum}`);
      c.value = note;
      c.font = { name: "Calibri", size: 10, italic: false, color: { argb: "1E293B" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "F1F5F9" : "FFFFFF" } };
      c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      c.border = BORDER_BOX;
      ws.getRow(rNum).height = 20;
    });

    // Spacing
    ws.getRow(13).height = 14;

    // Category Breakdown Header
    const catStartRow = 14;
    safeMergeCells(ws, `A${catStartRow}:G${catStartRow}`);
    const catHeader = ws.getCell(`A${catStartRow}`);
    catHeader.value = "📊 INVENTORY VALUATION BREAKDOWN BY CATEGORY";
    catHeader.font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.headerText } };
    catHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
    catHeader.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(catStartRow).height = 24;

    // Table Columns
    const catTableHeaders = ["Category Name", "SKU Count", "Total On-Hand Quantity", "Valuation (₹)", "Portfolio Share (%)", "Stock Health", "Primary Recommendation"];
    const catHeaderRow = ws.getRow(catStartRow + 1);
    catHeaderRow.height = 24;
    catTableHeaders.forEach((h, idx) => {
      const cell = catHeaderRow.getCell(idx + 1);
      cell.value = h;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.subHeaderBg } };
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: PALETTE.headerText } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = BORDER_BOX;
    });

    let currRow = catStartRow + 2;
    const catList = Object.entries(categoryBreakdown).sort((a, b) => b[1].val - a[1].val);

    catList.forEach(([catName, stats], idx) => {
      const row = ws.getRow(currRow);
      row.height = 20;
      const share = totalValuation > 0 ? stats.val / totalValuation : 0;

      row.getCell(1).value = catName;
      applyCellFormat(row.getCell(1), "text", catName, idx);

      row.getCell(2).value = stats.count;
      applyCellFormat(row.getCell(2), "int", stats.count, idx);

      row.getCell(3).value = stats.qty;
      applyCellFormat(row.getCell(3), "qty", stats.qty, idx);

      row.getCell(4).value = stats.val;
      applyCellFormat(row.getCell(4), "currency", stats.val, idx);

      row.getCell(5).value = share;
      applyCellFormat(row.getCell(5), "percent", share, idx);

      const health = share > 0.3 ? "Heavy Allocation" : "Balanced";
      row.getCell(6).value = health;
      applyCellFormat(row.getCell(6), "status", health, idx);

      const rec = share > 0.35 ? "Audit usage & limit bulk orders" : "Standard FEFO replenishments";
      row.getCell(7).value = rec;
      applyCellFormat(row.getCell(7), "text", rec, idx);

      currRow++;
    });

    // Summary Total Row for Categories
    const sumRow = ws.getRow(currRow);
    sumRow.height = 24;
    sumRow.getCell(1).value = "TOTAL STORE VALUATION";
    sumRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
    sumRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    sumRow.getCell(1).border = { top: { style: "thin" }, bottom: { style: "double" } };

    sumRow.getCell(2).value = { formula: `=SUM(B${catStartRow + 2}:B${currRow - 1})` };
    sumRow.getCell(2).numFmt = '#,##0';
    sumRow.getCell(2).font = { name: "Calibri", size: 10, bold: true };
    sumRow.getCell(2).alignment = { vertical: "middle", horizontal: "right" };
    sumRow.getCell(2).border = { top: { style: "thin" }, bottom: { style: "double" } };

    sumRow.getCell(3).value = { formula: `=SUM(C${catStartRow + 2}:C${currRow - 1})` };
    sumRow.getCell(3).numFmt = '#,##0.00';
    sumRow.getCell(3).font = { name: "Calibri", size: 10, bold: true };
    sumRow.getCell(3).alignment = { vertical: "middle", horizontal: "right" };
    sumRow.getCell(3).border = { top: { style: "thin" }, bottom: { style: "double" } };

    sumRow.getCell(4).value = { formula: `=SUM(D${catStartRow + 2}:D${currRow - 1})` };
    sumRow.getCell(4).numFmt = '₹#,##0.00';
    sumRow.getCell(4).font = { name: "Calibri", size: 10, bold: true, color: { argb: PALETTE.accentGold } };
    sumRow.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
    sumRow.getCell(4).border = { top: { style: "thin" }, bottom: { style: "double" } };

    sumRow.getCell(5).value = { formula: `=SUM(E${catStartRow + 2}:E${currRow - 1})` };
    sumRow.getCell(5).numFmt = '0.0%';
    sumRow.getCell(5).font = { name: "Calibri", size: 10, bold: true };
    sumRow.getCell(5).alignment = { vertical: "middle", horizontal: "right" };
    sumRow.getCell(5).border = { top: { style: "thin" }, bottom: { style: "double" } };

    sumRow.getCell(6).value = "100% AUDITED";
    sumRow.getCell(6).font = { name: "Calibri", size: 9, bold: true };
    sumRow.getCell(6).alignment = { vertical: "middle", horizontal: "center" };
    sumRow.getCell(6).border = { top: { style: "thin" }, bottom: { style: "double" } };

    sumRow.getCell(7).value = "";
    sumRow.getCell(7).border = { top: { style: "thin" }, bottom: { style: "double" } };

    autoFitColumns(ws);
  }

  /**
   * Sheet 2: Master Stock Valuation
   */
  buildMasterStockSheet(workbook, data) {
    const ws = workbook.addWorksheet("Master Stock Valuation", {
      properties: { tabColor: { argb: "0284C7" } },
      views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
    });

    formatTitleBanner(ws, "Master Stock Inventory Valuation & Stock Status", "", data.todayStr);

    const headers = [
      "Item Code", "Item Description", "Category", "On-Hand Qty", "Unit",
      "Avg Cost (₹)", "Latest Cost (₹)", "Total Valuation (₹)", "Min Alert Level",
      "Stock Status", "Preferred Supplier", "Last Received Date"
    ];

    const headerRow = ws.getRow(4);
    headers.forEach((h, idx) => {
      headerRow.getCell(idx + 1).value = h;
    });
    styleHeaderRow(headerRow, headers);

    const startRow = 5;
    data.masterStock.forEach((item, idx) => {
      const rNum = startRow + idx;
      const row = ws.getRow(rNum);
      row.height = 20;

      const rem = parseFloat(item.total_remaining) || 0;
      const minAlert = parseFloat(item.min_alert_qty) || 0;
      let status = "In Stock";
      if (rem <= 0) status = "Out of Stock";
      else if (minAlert > 0 && rem <= minAlert) status = "Low Stock";

      // Item Code
      row.getCell(1).value = item.item_code;
      applyCellFormat(row.getCell(1), "code", item.item_code, idx);

      // Description
      row.getCell(2).value = item.name;
      applyCellFormat(row.getCell(2), "text", item.name, idx);

      // Category
      row.getCell(3).value = item.category;
      applyCellFormat(row.getCell(3), "text", item.category, idx);

      // Qty
      row.getCell(4).value = rem;
      applyCellFormat(row.getCell(4), "qty", rem, idx);

      // Unit
      row.getCell(5).value = item.unit;
      applyCellFormat(row.getCell(5), "center", item.unit, idx);

      // Avg Cost
      row.getCell(6).value = parseFloat(item.avg_price) || 0;
      applyCellFormat(row.getCell(6), "currency", item.avg_price, idx);

      // Latest Cost
      row.getCell(7).value = parseFloat(item.latest_price) || 0;
      applyCellFormat(row.getCell(7), "currency", item.latest_price, idx);

      // Valuation (Formula: Qty * Avg Price = D*F)
      row.getCell(8).value = { formula: `=D${rNum}*F${rNum}` };
      applyCellFormat(row.getCell(8), "currency", rem * (parseFloat(item.avg_price) || 0), idx);
      row.getCell(8).font = { name: "Calibri", size: 10, bold: true };

      // Min Alert
      row.getCell(9).value = minAlert;
      applyCellFormat(row.getCell(9), "qty", minAlert, idx);

      // Status
      row.getCell(10).value = status;
      applyCellFormat(row.getCell(10), "status", status, idx);

      // Preferred Supplier
      row.getCell(11).value = item.preferred_supplier || "Standard Vendor";
      applyCellFormat(row.getCell(11), "text", item.preferred_supplier, idx);

      // Last Received Date
      row.getCell(12).value = item.last_purchase_date || "Prior History";
      applyCellFormat(row.getCell(12), "date", item.last_purchase_date, idx);
    });

    const endRow = startRow + data.masterStock.length - 1;
    const totalRow = ws.getRow(endRow + 1);
    totalRow.height = 24;

    totalRow.getCell(1).value = "TOTAL STORE SUMMARY";
    totalRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
    totalRow.getCell(1).border = { top: { style: "thin" }, bottom: { style: "double" } };

    totalRow.getCell(4).value = { formula: `=SUM(D${startRow}:D${endRow})` };
    totalRow.getCell(4).numFmt = '#,##0.00';
    totalRow.getCell(4).font = { name: "Calibri", size: 10, bold: true };
    totalRow.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
    totalRow.getCell(4).border = { top: { style: "thin" }, bottom: { style: "double" } };

    totalRow.getCell(8).value = { formula: `=SUM(H${startRow}:H${endRow})` };
    totalRow.getCell(8).numFmt = '₹#,##0.00';
    totalRow.getCell(8).font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.accentGold } };
    totalRow.getCell(8).alignment = { vertical: "middle", horizontal: "right" };
    totalRow.getCell(8).border = { top: { style: "thin" }, bottom: { style: "double" } };

    // Format empty total row cells
    [2, 3, 5, 6, 7, 9, 10, 11, 12].forEach((colIdx) => {
      totalRow.getCell(colIdx).border = { top: { style: "thin" }, bottom: { style: "double" } };
    });

    autoFitColumns(ws);
  }

  /**
   * Sheet 3: Batch & FEFO Expiry Ledger
   */
  buildBatchFefoSheet(workbook, data) {
    const ws = workbook.addWorksheet("Batch & FEFO Expiry", {
      properties: { tabColor: { argb: "E11D48" } },
      views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
    });

    formatTitleBanner(ws, "Batch Inventory & FEFO Expiry Tracking Ledger", "", data.todayStr);

    const headers = [
      "Item Code", "Item Name", "Batch Number", "Receipt Date", "Expiry Date",
      "Days Remaining", "Batch Qty", "Unit", "Unit Cost (₹)", "Batch Valuation (₹)",
      "Supplier Name", "Expiry Risk Status"
    ];

    const headerRow = ws.getRow(4);
    headers.forEach((h, idx) => headerRow.getCell(idx + 1).value = h);
    styleHeaderRow(headerRow, headers);

    const startRow = 5;
    const now = new Date();

    data.batches.forEach((b, idx) => {
      const rNum = startRow + idx;
      const row = ws.getRow(rNum);
      row.height = 20;

      let daysRemaining = "N/A";
      let riskStatus = "Normal";

      if (b.expiry_date) {
        const exp = new Date(b.expiry_date);
        const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        daysRemaining = diff;
        if (diff < 0) riskStatus = "Expired";
        else if (diff <= 3) riskStatus = "Critical (<3d)";
        else if (diff <= 7) riskStatus = "Warning (<7d)";
        else riskStatus = "Fresh";
      }

      row.getCell(1).value = b.item_code;
      applyCellFormat(row.getCell(1), "code", b.item_code, idx);

      row.getCell(2).value = b.name;
      applyCellFormat(row.getCell(2), "text", b.name, idx);

      row.getCell(3).value = b.batch_no;
      applyCellFormat(row.getCell(3), "code", b.batch_no, idx);

      row.getCell(4).value = b.received_date || "-";
      applyCellFormat(row.getCell(4), "date", b.received_date, idx);

      row.getCell(5).value = b.expiry_date || "Perishable-Free";
      applyCellFormat(row.getCell(5), "date", b.expiry_date, idx);

      row.getCell(6).value = daysRemaining;
      applyCellFormat(row.getCell(6), typeof daysRemaining === "number" ? "int" : "center", daysRemaining, idx);

      const rem = parseFloat(b.remaining) || 0;
      row.getCell(7).value = rem;
      applyCellFormat(row.getCell(7), "qty", rem, idx);

      row.getCell(8).value = b.unit;
      applyCellFormat(row.getCell(8), "center", b.unit, idx);

      const price = parseFloat(b.price) || 0;
      row.getCell(9).value = price;
      applyCellFormat(row.getCell(9), "currency", price, idx);

      // Formula: Batch Valuation = G * I
      row.getCell(10).value = { formula: `=G${rNum}*I${rNum}` };
      applyCellFormat(row.getCell(10), "currency", rem * price, idx);

      row.getCell(11).value = b.supplier;
      applyCellFormat(row.getCell(11), "text", b.supplier, idx);

      row.getCell(12).value = riskStatus;
      applyCellFormat(row.getCell(12), "status", riskStatus, idx);
    });

    const endRow = startRow + data.batches.length - 1;
    if (data.batches.length > 0) {
      const totalRow = ws.getRow(endRow + 1);
      totalRow.height = 24;
      totalRow.getCell(1).value = "TOTAL BATCH STOCK";
      totalRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(1).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(7).value = { formula: `=SUM(G${startRow}:G${endRow})` };
      totalRow.getCell(7).numFmt = '#,##0.00';
      totalRow.getCell(7).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(7).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(10).value = { formula: `=SUM(J${startRow}:J${endRow})` };
      totalRow.getCell(10).numFmt = '₹#,##0.00';
      totalRow.getCell(10).font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.accentGold } };
      totalRow.getCell(10).border = { top: { style: "thin" }, bottom: { style: "double" } };

      [2, 3, 4, 5, 6, 8, 9, 11, 12].forEach((c) => {
        totalRow.getCell(c).border = { top: { style: "thin" }, bottom: { style: "double" } };
      });
    }

    autoFitColumns(ws);
  }

  /**
   * Sheet 4: Department Consumption & Issuances
   */
  buildDepartmentConsumptionSheet(workbook, data) {
    const ws = workbook.addWorksheet("Department Consumption", {
      properties: { tabColor: { argb: "16A34A" } },
      views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
    });

    formatTitleBanner(ws, "Department Material Issuance & Cost Allocation", "", data.todayStr);

    const headers = [
      "Issuance #", "Date", "Department", "Indent Ref", "Item Code",
      "Item Description", "Issued Qty", "Unit", "Landed Rate (₹)", "Cost Total (₹)", "Dispatch Type"
    ];

    const headerRow = ws.getRow(4);
    headers.forEach((h, idx) => headerRow.getCell(idx + 1).value = h);
    styleHeaderRow(headerRow, headers);

    const startRow = 5;
    data.issuances.forEach((iss, idx) => {
      const rNum = startRow + idx;
      const row = ws.getRow(rNum);
      row.height = 20;

      const issuedQty = parseFloat(iss.issued_qty) || 0;
      const unitPrice = parseFloat(iss.unit_price) || 0;

      row.getCell(1).value = `ISS-${iss.issuance_id}`;
      applyCellFormat(row.getCell(1), "code", iss.issuance_id, idx);

      row.getCell(2).value = iss.date;
      applyCellFormat(row.getCell(2), "date", iss.date, idx);

      row.getCell(3).value = iss.dept;
      applyCellFormat(row.getCell(3), "text", iss.dept, idx);

      row.getCell(4).value = iss.indent_id ? `IND-${iss.indent_id}` : "Ad-hoc Pick";
      applyCellFormat(row.getCell(4), "center", iss.indent_id, idx);

      row.getCell(5).value = iss.item_code;
      applyCellFormat(row.getCell(5), "code", iss.item_code, idx);

      row.getCell(6).value = iss.item_name;
      applyCellFormat(row.getCell(6), "text", iss.item_name, idx);

      row.getCell(7).value = issuedQty;
      applyCellFormat(row.getCell(7), "qty", issuedQty, idx);

      row.getCell(8).value = iss.unit || "kg";
      applyCellFormat(row.getCell(8), "center", iss.unit, idx);

      row.getCell(9).value = unitPrice;
      applyCellFormat(row.getCell(9), "currency", unitPrice, idx);

      // Cost Total = G * I
      row.getCell(10).value = { formula: `=G${rNum}*I${rNum}` };
      applyCellFormat(row.getCell(10), "currency", issuedQty * unitPrice, idx);

      const dispatch = iss.scanned ? "OCR Digital Scan" : "Physical Issue";
      row.getCell(11).value = dispatch;
      applyCellFormat(row.getCell(11), "center", dispatch, idx);
    });

    const endRow = startRow + data.issuances.length - 1;
    if (data.issuances.length > 0) {
      const totalRow = ws.getRow(endRow + 1);
      totalRow.height = 24;
      totalRow.getCell(1).value = "TOTAL ISSUANCES RECORDED";
      totalRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(1).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(7).value = { formula: `=SUM(G${startRow}:G${endRow})` };
      totalRow.getCell(7).numFmt = '#,##0.00';
      totalRow.getCell(7).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(7).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(10).value = { formula: `=SUM(J${startRow}:J${endRow})` };
      totalRow.getCell(10).numFmt = '₹#,##0.00';
      totalRow.getCell(10).font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.accentGold } };
      totalRow.getCell(10).border = { top: { style: "thin" }, bottom: { style: "double" } };

      [2, 3, 4, 5, 6, 8, 9, 11].forEach((c) => {
        totalRow.getCell(c).border = { top: { style: "thin" }, bottom: { style: "double" } };
      });
    }

    autoFitColumns(ws);
  }

  /**
   * Sheet 5: Procurement & Inward GRN Ledger
   */
  buildProcurementSheet(workbook, data) {
    const ws = workbook.addWorksheet("Procurement & GRN", {
      properties: { tabColor: { argb: "9333EA" } },
      views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
    });

    formatTitleBanner(ws, "Procurement Inward Goods Receipt (GRN) History", "", data.todayStr);

    const headers = [
      "GRN #", "GRN Date", "PO Ref", "Supplier Name", "Invoice No",
      "Item Code", "Item Description", "Qty Ordered", "Qty Received", "Qty Accepted",
      "Unit", "Unit Rate (₹)", "Landed Cost (₹)", "Total Inward (₹)", "Received By"
    ];

    const headerRow = ws.getRow(4);
    headers.forEach((h, idx) => headerRow.getCell(idx + 1).value = h);
    styleHeaderRow(headerRow, headers);

    const startRow = 5;
    data.grnRecords.forEach((grn, idx) => {
      const rNum = startRow + idx;
      const row = ws.getRow(rNum);
      row.height = 20;

      const accQty = parseFloat(grn.qty_accepted) || parseFloat(grn.qty_received) || 0;
      const landed = parseFloat(grn.landed_cost) || parseFloat(grn.unit_price) || 0;

      row.getCell(1).value = grn.grn_number || `GRN-${grn.grn_id}`;
      applyCellFormat(row.getCell(1), "code", grn.grn_number, idx);

      row.getCell(2).value = grn.grn_date;
      applyCellFormat(row.getCell(2), "date", grn.grn_date, idx);

      row.getCell(3).value = grn.po_id ? `PO-${grn.po_id}` : "Direct Inward";
      applyCellFormat(row.getCell(3), "center", grn.po_id, idx);

      row.getCell(4).value = grn.supplier_name;
      applyCellFormat(row.getCell(4), "text", grn.supplier_name, idx);

      row.getCell(5).value = grn.invoice_no;
      applyCellFormat(row.getCell(5), "center", grn.invoice_no, idx);

      row.getCell(6).value = grn.item_code;
      applyCellFormat(row.getCell(6), "code", grn.item_code, idx);

      row.getCell(7).value = grn.item_name;
      applyCellFormat(row.getCell(7), "text", grn.item_name, idx);

      row.getCell(8).value = parseFloat(grn.qty_ordered) || 0;
      applyCellFormat(row.getCell(8), "qty", grn.qty_ordered, idx);

      row.getCell(9).value = parseFloat(grn.qty_received) || 0;
      applyCellFormat(row.getCell(9), "qty", grn.qty_received, idx);

      row.getCell(10).value = accQty;
      applyCellFormat(row.getCell(10), "qty", accQty, idx);

      row.getCell(11).value = grn.unit || "kg";
      applyCellFormat(row.getCell(11), "center", grn.unit, idx);

      row.getCell(12).value = parseFloat(grn.unit_price) || 0;
      applyCellFormat(row.getCell(12), "currency", grn.unit_price, idx);

      row.getCell(13).value = landed;
      applyCellFormat(row.getCell(13), "currency", landed, idx);

      // Total Inward = J * M
      row.getCell(14).value = { formula: `=J${rNum}*M${rNum}` };
      applyCellFormat(row.getCell(14), "currency", accQty * landed, idx);

      row.getCell(15).value = grn.received_by || "Storekeeper";
      applyCellFormat(row.getCell(15), "text", grn.received_by, idx);
    });

    const endRow = startRow + data.grnRecords.length - 1;
    if (data.grnRecords.length > 0) {
      const totalRow = ws.getRow(endRow + 1);
      totalRow.height = 24;
      totalRow.getCell(1).value = "TOTAL INWARD SPEND";
      totalRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(1).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(10).value = { formula: `=SUM(J${startRow}:J${endRow})` };
      totalRow.getCell(10).numFmt = '#,##0.00';
      totalRow.getCell(10).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(10).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(14).value = { formula: `=SUM(N${startRow}:N${endRow})` };
      totalRow.getCell(14).numFmt = '₹#,##0.00';
      totalRow.getCell(14).font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.accentGold } };
      totalRow.getCell(14).border = { top: { style: "thin" }, bottom: { style: "double" } };

      [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15].forEach((c) => {
        totalRow.getCell(c).border = { top: { style: "thin" }, bottom: { style: "double" } };
      });
    }

    autoFitColumns(ws);
  }

  /**
   * Sheet 6: Reorder Schedule & Stockout Risk
   */
  buildReorderScheduleSheet(workbook, data) {
    const ws = workbook.addWorksheet("Reorder & Replenishment", {
      properties: { tabColor: { argb: "EA580C" } },
      views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
    });

    formatTitleBanner(ws, "Predictive Reorder Schedule & Stockout Prevention", "", data.todayStr);

    const headers = [
      "Item Code", "Item Name", "Current Stock", "Min Safety Level", "Reorder Qty",
      "Lead Time (Days)", "Stockout Risk", "Recommended Order", "Preferred Vendor",
      "Est. Order Cost (₹)", "Replenishment Urgency"
    ];

    const headerRow = ws.getRow(4);
    headers.forEach((h, idx) => headerRow.getCell(idx + 1).value = h);
    styleHeaderRow(headerRow, headers);

    // Build map of stock on hand
    const stockMap = {};
    data.masterStock.forEach((s) => {
      stockMap[s.item_code] = {
        qty: parseFloat(s.total_remaining) || 0,
        rate: parseFloat(s.avg_price) || 0,
        supplier: s.preferred_supplier,
        min: parseFloat(s.min_alert_qty) || 0,
      };
    });

    // Combine formal reorder points with items breaching min_alert_qty
    const reorderRows = [];
    const seenCodes = new Set();

    data.reorderPoints.forEach((rp) => {
      seenCodes.add(rp.item_code);
      const st = stockMap[rp.item_code] || { qty: 0, rate: 0, supplier: rp.preferred_supplier, min: rp.min_qty };
      const curStock = st.qty;
      const minQty = parseFloat(rp.min_qty) || 0;
      const recOrder = curStock < minQty ? Math.max(parseFloat(rp.reorder_qty) || 0, minQty - curStock) : 0;
      let urgency = "Normal";
      if (curStock <= 0) urgency = "Critical";
      else if (curStock < minQty) urgency = "High";

      reorderRows.push({
        item_code: rp.item_code,
        name: rp.name,
        current_stock: curStock,
        min_qty: minQty,
        reorder_qty: parseFloat(rp.reorder_qty) || 0,
        lead_time: rp.lead_time_days || 1,
        risk: curStock <= 0 ? "Stocked Out" : curStock < minQty ? "Below Minimum" : "Adequate",
        rec_order: recOrder,
        supplier: rp.preferred_supplier || st.supplier || "Primary Vendor",
        rate: st.rate,
        urgency,
      });
    });

    // Add any stock items below min_alert not in reorderPoints
    data.masterStock.forEach((st) => {
      if (!seenCodes.has(st.item_code)) {
        const rem = parseFloat(st.total_remaining) || 0;
        const min = parseFloat(st.min_alert_qty) || 0;
        if (min > 0 && rem <= min) {
          const recOrder = Math.max(min * 2, min - rem);
          reorderRows.push({
            item_code: st.item_code,
            name: st.name,
            current_stock: rem,
            min_qty: min,
            reorder_qty: min * 2,
            lead_time: 2,
            risk: rem <= 0 ? "Stocked Out" : "Below Minimum",
            rec_order: recOrder,
            supplier: st.preferred_supplier || "Local Vendor",
            rate: parseFloat(st.avg_price) || 0,
            urgency: rem <= 0 ? "Critical" : "High",
          });
        }
      }
    });

    // Sort by urgency: Critical, High, Normal
    const urgencyOrder = { Critical: 0, High: 1, Normal: 2 };
    reorderRows.sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3));

    const startRow = 5;
    reorderRows.forEach((r, idx) => {
      const rNum = startRow + idx;
      const row = ws.getRow(rNum);
      row.height = 20;

      row.getCell(1).value = r.item_code;
      applyCellFormat(row.getCell(1), "code", r.item_code, idx);

      row.getCell(2).value = r.name;
      applyCellFormat(row.getCell(2), "text", r.name, idx);

      row.getCell(3).value = r.current_stock;
      applyCellFormat(row.getCell(3), "qty", r.current_stock, idx);

      row.getCell(4).value = r.min_qty;
      applyCellFormat(row.getCell(4), "qty", r.min_qty, idx);

      row.getCell(5).value = r.reorder_qty;
      applyCellFormat(row.getCell(5), "qty", r.reorder_qty, idx);

      row.getCell(6).value = r.lead_time;
      applyCellFormat(row.getCell(6), "int", r.lead_time, idx);

      row.getCell(7).value = r.risk;
      applyCellFormat(row.getCell(7), "status", r.risk, idx);

      row.getCell(8).value = r.rec_order;
      applyCellFormat(row.getCell(8), "qty", r.rec_order, idx);

      row.getCell(9).value = r.supplier;
      applyCellFormat(row.getCell(9), "text", r.supplier, idx);

      const estCost = r.rec_order * r.rate;
      row.getCell(10).value = estCost;
      applyCellFormat(row.getCell(10), "currency", estCost, idx);

      row.getCell(11).value = r.urgency;
      applyCellFormat(row.getCell(11), "status", r.urgency, idx);
    });

    const endRow = startRow + reorderRows.length - 1;
    if (reorderRows.length > 0) {
      const totalRow = ws.getRow(endRow + 1);
      totalRow.height = 24;
      totalRow.getCell(1).value = "TOTAL REPLENISHMENT COMMITMENT";
      totalRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(1).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(8).value = { formula: `=SUM(H${startRow}:H${endRow})` };
      totalRow.getCell(8).numFmt = '#,##0.00';
      totalRow.getCell(8).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(8).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(10).value = { formula: `=SUM(J${startRow}:J${endRow})` };
      totalRow.getCell(10).numFmt = '₹#,##0.00';
      totalRow.getCell(10).font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.accentGold } };
      totalRow.getCell(10).border = { top: { style: "thin" }, bottom: { style: "double" } };

      [2, 3, 4, 5, 6, 7, 9, 11].forEach((c) => {
        totalRow.getCell(c).border = { top: { style: "thin" }, bottom: { style: "double" } };
      });
    }

    autoFitColumns(ws);
  }

  /**
   * Sheet 7: Physical Audits & Variances
   */
  buildAuditVarianceSheet(workbook, data) {
    const ws = workbook.addWorksheet("Audit & Variances", {
      properties: { tabColor: { argb: "475569" } },
      views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
    });

    formatTitleBanner(ws, "Stock Audit & Physical Count Variance Ledger", "", data.todayStr);

    const headers = [
      "Audit Ref", "Audit Date", "Department", "Auditor", "Item Code",
      "Item Description", "System Qty", "Physical Count", "Variance Qty", "Unit",
      "Unit Cost (₹)", "Valuation Impact (₹)", "Discrepancy Reason", "Audit Status"
    ];

    const headerRow = ws.getRow(4);
    headers.forEach((h, idx) => headerRow.getCell(idx + 1).value = h);
    styleHeaderRow(headerRow, headers);

    const startRow = 5;
    data.auditItems.forEach((item, idx) => {
      const rNum = startRow + idx;
      const row = ws.getRow(rNum);
      row.height = 20;

      const sysQty = parseFloat(item.db_qty) || 0;
      const physQty = parseFloat(item.physical_qty) || 0;
      const diff = parseFloat(item.difference) || (physQty - sysQty);
      const rate = parseFloat(item.unit_price) || 0;

      let status = "Matched";
      if (diff < 0) status = "Shortage";
      else if (diff > 0) status = "Overage";

      row.getCell(1).value = item.reference || `AUD-${item.session_id}`;
      applyCellFormat(row.getCell(1), "code", item.reference, idx);

      row.getCell(2).value = item.audit_date;
      applyCellFormat(row.getCell(2), "date", item.audit_date, idx);

      row.getCell(3).value = item.department;
      applyCellFormat(row.getCell(3), "text", item.department, idx);

      row.getCell(4).value = item.auditor_name;
      applyCellFormat(row.getCell(4), "text", item.auditor_name, idx);

      row.getCell(5).value = item.item_code;
      applyCellFormat(row.getCell(5), "code", item.item_code, idx);

      row.getCell(6).value = item.item_name;
      applyCellFormat(row.getCell(6), "text", item.item_name, idx);

      row.getCell(7).value = sysQty;
      applyCellFormat(row.getCell(7), "qty", sysQty, idx);

      row.getCell(8).value = physQty;
      applyCellFormat(row.getCell(8), "qty", physQty, idx);

      // Formula: Variance = H - G
      row.getCell(9).value = { formula: `=H${rNum}-G${rNum}` };
      applyCellFormat(row.getCell(9), "qty", diff, idx);

      row.getCell(10).value = item.unit || "kg";
      applyCellFormat(row.getCell(10), "center", item.unit, idx);

      row.getCell(11).value = rate;
      applyCellFormat(row.getCell(11), "currency", rate, idx);

      // Formula: Impact = I * K
      row.getCell(12).value = { formula: `=I${rNum}*K${rNum}` };
      applyCellFormat(row.getCell(12), "currency", diff * rate, idx);

      row.getCell(13).value = item.discrepancy_reason || "Cycle Count Verification";
      applyCellFormat(row.getCell(13), "text", item.discrepancy_reason, idx);

      row.getCell(14).value = status;
      applyCellFormat(row.getCell(14), "status", status, idx);
    });

    const endRow = startRow + data.auditItems.length - 1;
    if (data.auditItems.length > 0) {
      const totalRow = ws.getRow(endRow + 1);
      totalRow.height = 24;
      totalRow.getCell(1).value = "TOTAL AUDIT NET VARIANCE";
      totalRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(1).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(9).value = { formula: `=SUM(I${startRow}:I${endRow})` };
      totalRow.getCell(9).numFmt = '#,##0.00';
      totalRow.getCell(9).font = { name: "Calibri", size: 10, bold: true };
      totalRow.getCell(9).border = { top: { style: "thin" }, bottom: { style: "double" } };

      totalRow.getCell(12).value = { formula: `=SUM(L${startRow}:L${endRow})` };
      totalRow.getCell(12).numFmt = '₹#,##0.00';
      totalRow.getCell(12).font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.accentGold } };
      totalRow.getCell(12).border = { top: { style: "thin" }, bottom: { style: "double" } };

      [2, 3, 4, 5, 6, 7, 8, 10, 11, 13, 14].forEach((c) => {
        totalRow.getCell(c).border = { top: { style: "thin" }, bottom: { style: "double" } };
      });
    }

    autoFitColumns(ws);
  }
}

const inventoryReportServiceInstance = new InventoryReportService();

// Export the style helpers as standalone named exports too, so other report
// services (e.g. eodReportService) can reuse the same enterprise look without
// duplicating the palette/border/auto-fit logic.
module.exports = inventoryReportServiceInstance;
module.exports.PALETTE = PALETTE;
module.exports.BORDER_BOX = BORDER_BOX;
module.exports.autoFitColumns = autoFitColumns;
module.exports.formatTitleBanner = formatTitleBanner;
module.exports.styleHeaderRow = styleHeaderRow;
module.exports.applyCellFormat = applyCellFormat;
module.exports.safeMergeCells = safeMergeCells;
