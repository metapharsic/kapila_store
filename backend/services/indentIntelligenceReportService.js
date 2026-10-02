// indentIntelligenceReportService.js
// Daily "Indent & Purchase Intelligence Report" — real data, zero hardcoding,
// delivered as Excel + WhatsApp digest to both admin and store manager.
//
// Modeled directly on eodReportService.js (same shape, same Excel helpers,
// same WhatsApp-digest truncation pattern). Data model recap:
//   indents(id, dept, date, status, indent_type[routine|adhoc|urgent], created_at, ...)
//   indent_items(id, indent_id, name, item_code, qty, issued_qty, unit, ...)
//   purchase_orders(id, po_number, supplier_id, date, status, total_amount, ...)
//   goods_receipt_notes(id, grn_number, po_id, supplier_id, date, total_amount, ...)
//   goods_receipt_items(id, grn_id, item_code, name, qty_accepted, qty_rejected,
//     unit_price, landed_cost, ...)
//   approval_requests(id, module, resource_id, status, created_by, approved_by,
//     created_at, updated_at, escalated_at, ...) — for module="indents",
//     resource_id references indents.id. There is no dedicated approved_at
//     column: a request's `updated_at` is its last status-changing write, so
//     for rows with status="approved" that *is* the approval timestamp, and
//     `created_at` is when the approval was raised.
//   anomaly_alerts(id, item, department, date, baseline_ratio, current_ratio,
//     severity, description, status, created_at, resolved_at) — written by
//     cron/anomalyDetector.js's nightly scan (previous-day, 7-day baseline).
//   stock_ledger(item_code, item_name, department, transaction_type, qty,
//     total_value, created_at) — transaction_type "OUTWARD_ISSUE" is real
//     consumption, already used the same way by eodReportService.
//
// "Beyond expectation" items (section 4) are computed independently of
// anomaly_alerts (which only runs once nightly, for *yesterday*, against a
// fixed-lookback baseline) so today's report always has a same-day answer:
// an item's total OUTWARD_ISSUE qty today vs. its trailing N-day daily
// average OUTWARD_ISSUE qty (N from report_settings, see below), flagged
// when it exceeds that average by more than a configurable spike percentage.
// Real anomaly_alerts rows for the same date are also surfaced separately
// (section 4b) since they're a second, independently-computed real signal
// (per-plate ratio vs 7-day baseline, item sensitivity-aware) worth keeping
// visible rather than reinventing or discarding.

const ExcelJS = require("exceljs");
const db = require("../db");
const { sendWhatsApp } = require("./whatsapp");
const {
  PALETTE,
  BORDER_BOX,
  autoFitColumns,
  safeMergeCells,
} = require("./inventoryReportService");
const { embedLogoInWorksheet } = require("../assets/logoBase64");

// Admin-configurable thresholds, stored in report_settings (same pattern as
// price_spike_pct / dormancy_days in reportController.js's
// REPORT_SETTINGS_DEFAULTS / loadReportSettings()). Keys only used by this
// report so they don't collide with the cross-module-insights ones.
const INDENT_INTELLIGENCE_SETTINGS_DEFAULTS = {
  consumption_spike_pct: 20, // % above trailing-baseline daily avg issued qty to flag "beyond expectation"
  consumption_baseline_days: 7, // trailing window (days) used to compute that baseline
};

async function loadIndentIntelligenceSettings() {
  const settings = { ...INDENT_INTELLIGENCE_SETTINGS_DEFAULTS };
  try {
    const rows = await db("report_settings").whereIn("key", Object.keys(INDENT_INTELLIGENCE_SETTINGS_DEFAULTS));
    rows.forEach((row) => {
      const raw = row.value;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed !== null && parsed !== undefined && !Number.isNaN(Number(parsed))) {
        settings[row.key] = Number(parsed);
      }
    });
  } catch (err) {
    console.error("[IndentIntelligence] Failed to load report_settings, using defaults:", err.message);
  }
  return settings;
}

/** Ensure the default rows exist in report_settings (idempotent, insert-if-missing). */
async function ensureIndentIntelligenceSettingsSeeded() {
  try {
    const rows = Object.entries(INDENT_INTELLIGENCE_SETTINGS_DEFAULTS).map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
    }));
    await db("report_settings").insert(rows).onConflict("key").ignore();
  } catch (err) {
    console.error("[IndentIntelligence] Failed to seed default report_settings:", err.message);
  }
}

/**
 * Compute every section of the report for a given date from real tables,
 * running independent queries in parallel.
 *
 * @param {string} date - YYYY-MM-DD (defaults to today, server local date)
 */
async function computeIndentIntelligence(date = new Date().toISOString().slice(0, 10)) {
  await ensureIndentIntelligenceSettingsSeeded();
  const settings = await loadIndentIntelligenceSettings();
  const { consumption_spike_pct: spikePct, consumption_baseline_days: baselineDays } = settings;

  const dayStart = `${date} 00:00:00`;
  const dayEnd = `${date} 23:59:59.999`;
  const baselineStartDate = new Date(`${date}T00:00:00Z`);
  baselineStartDate.setUTCDate(baselineStartDate.getUTCDate() - baselineDays);
  const baselineStart = `${baselineStartDate.toISOString().slice(0, 10)} 00:00:00`;

  const [
    indentsToday,
    poRows,
    grnRows,
    grnItemRows,
    todayIssuedRows,
    baselineIssuedRows,
    anomalyRows,
    approvalRows,
  ] = await Promise.all([
    // 1. Indents raised today, with their items (for the detail sheet + amount).
    db("indents")
      .whereBetween("created_at", [dayStart, dayEnd])
      .orWhere("date", date)
      .select("id", "dept", "date", "status", "indent_type", "created_at", "shift", "priority", "remarks"),

    // 2. Purchase orders raised today.
    db("purchase_orders as po")
      .leftJoin("suppliers as s", "po.supplier_id", "s.id")
      .where("po.date", date)
      .select("po.id", "po.po_number", "po.date", "po.status", "po.total_amount", "s.name as supplier_name"),

    // 3. GRNs received today.
    db("goods_receipt_notes as grn")
      .leftJoin("suppliers as s", "grn.supplier_id", "s.id")
      .where("grn.date", date)
      .select("grn.id", "grn.grn_number", "grn.date", "grn.invoice_no", "grn.received_by", "grn.total_amount", "s.id as supplier_id", "s.name as supplier_name"),

    // 3b. GRN line items today (for per-supplier rollups and item counts).
    db("goods_receipt_items as gri")
      .join("goods_receipt_notes as grn", "gri.grn_id", "grn.id")
      .leftJoin("suppliers as s", "grn.supplier_id", "s.id")
      .where("grn.date", date)
      .select(
        "gri.item_code", "gri.name", "gri.qty_received", "gri.qty_accepted", "gri.qty_rejected",
        "gri.unit", "gri.unit_price", "gri.landed_cost",
        "grn.id as grn_id", "grn.grn_number", "s.id as supplier_id", "s.name as supplier_name"
      ),

    // 4. Today's real consumption per item (stock_ledger OUTWARD_ISSUE), with
    //    hour bucket for section 7's... no, hour bucket comes from indents,
    //    not issues. This is pure item totals for the spike comparison.
    db("stock_ledger")
      .where("transaction_type", "OUTWARD_ISSUE")
      .whereBetween("created_at", [dayStart, dayEnd])
      .select("item_code", "item_name")
      .sum({ qty: "qty" })
      .sum({ value: "total_value" })
      .groupBy("item_code", "item_name"),

    // 4b. Trailing-baseline consumption per item (same window used by the
    //     EOD granularity work), to derive each item's average daily issued
    //     qty over the preceding N days (excludes today itself).
    db("stock_ledger")
      .where("transaction_type", "OUTWARD_ISSUE")
      .whereBetween("created_at", [baselineStart, dayStart])
      .select("item_code", "item_name")
      .sum({ qty: "qty" })
      .groupBy("item_code", "item_name"),

    // 4c. Real anomaly_alerts rows already raised for this date by the
    //     nightly cron (cron/anomalyDetector.js) — a second, independently
    //     computed signal (per-plate ratio vs 7-day baseline).
    db("anomaly_alerts").where("date", date).orderBy("current_ratio", "desc"),

    // 6. Approval requests for indents, raised or resolved today, joined to
    //    the indent for its department and to users for approver name.
    db("approval_requests as ar")
      .join("indents as ind", function () {
        this.on("ar.resource_id", "=", "ind.id").andOn("ar.module", "=", db.raw("?", ["indents"]));
      })
      .leftJoin("users as u", "ar.approved_by", "u.id")
      .where(function () {
        this.whereBetween("ar.created_at", [dayStart, dayEnd])
          .orWhereBetween("ar.updated_at", [dayStart, dayEnd]);
      })
      .select(
        "ar.id", "ar.status", "ar.created_at as raised_at", "ar.updated_at as resolved_at",
        "ar.approved_by", "u.name as approver_name", "ind.dept as department", "ind.id as indent_id"
      ),
  ]);

  // Pull indent items for today's indents in one more query (depends on indentsToday ids).
  const indentIds = indentsToday.map((i) => i.id);
  const indentItemRows = indentIds.length
    ? await db("indent_items").whereIn("indent_id", indentIds).select("indent_id", "name", "item_code", "qty", "issued_qty", "unit")
    : [];

  // ── Section 1: Indents raised today, regular vs ad-hoc ───────────────────
  const itemsByIndent = {};
  for (const it of indentItemRows) {
    if (!itemsByIndent[it.indent_id]) itemsByIndent[it.indent_id] = [];
    itemsByIndent[it.indent_id].push(it);
  }
  const indentDetails = indentsToday.map((ind) => ({
    ...ind,
    items: itemsByIndent[ind.id] || [],
    item_count: (itemsByIndent[ind.id] || []).length,
  }));
  const indentTypeCounts = {};
  indentDetails.forEach((ind) => {
    const t = ind.indent_type || "routine";
    indentTypeCounts[t] = (indentTypeCounts[t] || 0) + 1;
  });
  const totalIndents = indentDetails.length;
  const routineCount = indentTypeCounts["routine"] || 0;
  const adhocCount = totalIndents - routineCount; // everything not "routine" (adhoc, urgent, etc.)

  // ── Section 2: Total purchase value today (purchase_orders raised today) ─
  const totalPurchaseOrders = poRows.length;
  const totalPurchaseValue = Math.round(poRows.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0) * 100) / 100;

  // ── Section 3: GRN summary today, by supplier ─────────────────────────────
  const grnBySupplier = {};
  grnRows.forEach((g) => {
    const key = g.supplier_name || "Unknown Supplier";
    if (!grnBySupplier[key]) grnBySupplier[key] = { supplier: key, grn_count: 0, total_value: 0 };
    grnBySupplier[key].grn_count += 1;
    grnBySupplier[key].total_value += parseFloat(g.total_amount) || 0;
  });
  const grnSupplierSummary = Object.values(grnBySupplier)
    .map((g) => ({ ...g, total_value: Math.round(g.total_value * 100) / 100 }))
    .sort((a, b) => b.total_value - a.total_value);
  const totalGrnCount = grnRows.length;
  const totalGrnValue = Math.round(grnRows.reduce((s, g) => s + (parseFloat(g.total_amount) || 0), 0) * 100) / 100;

  // ── Section 4: Items beyond expectation today ─────────────────────────────
  const baselineByItem = {};
  baselineIssuedRows.forEach((r) => {
    baselineByItem[r.item_code] = {
      item_name: r.item_name,
      avgDailyQty: (parseFloat(r.qty) || 0) / baselineDays,
    };
  });
  const beyondExpectationItems = [];
  todayIssuedRows.forEach((r) => {
    const todayQty = parseFloat(r.qty) || 0;
    const baseline = baselineByItem[r.item_code];
    if (!baseline || baseline.avgDailyQty <= 0) return; // need a real baseline to compare against
    const pctAboveBaseline = ((todayQty - baseline.avgDailyQty) / baseline.avgDailyQty) * 100;
    if (pctAboveBaseline >= spikePct) {
      beyondExpectationItems.push({
        item_code: r.item_code,
        item_name: r.item_name,
        today_issued_qty: Math.round(todayQty * 1000) / 1000,
        baseline_daily_avg_qty: Math.round(baseline.avgDailyQty * 1000) / 1000,
        pct_above_baseline: Math.round(pctAboveBaseline * 10) / 10,
        today_issued_value: Math.round((parseFloat(r.value) || 0) * 100) / 100,
      });
    }
  });
  beyondExpectationItems.sort((a, b) => b.pct_above_baseline - a.pct_above_baseline);

  const anomalyAlertsToday = anomalyRows.map((a) => ({
    item: a.item,
    department: a.department,
    baseline_ratio: parseFloat(a.baseline_ratio),
    current_ratio: parseFloat(a.current_ratio),
    severity: a.severity,
    description: a.description,
    status: a.status,
  }));

  // ── Section 5: Per-department consumption summary today ──────────────────
  const deptRows = await db("stock_ledger")
    .where("transaction_type", "OUTWARD_ISSUE")
    .whereBetween("created_at", [dayStart, dayEnd])
    .select("department")
    .sum({ qty: "qty" })
    .sum({ value: "total_value" })
    .count({ line_count: "*" })
    .groupBy("department");
  const departmentConsumption = deptRows
    .map((d) => ({
      department: d.department || "Unassigned",
      total_qty: Math.round((parseFloat(d.qty) || 0) * 1000) / 1000,
      total_value: Math.round((parseFloat(d.value) || 0) * 100) / 100,
      line_count: parseInt(d.line_count, 10) || 0,
    }))
    .sort((a, b) => b.total_value - a.total_value);
  const topDepartmentByConsumption = departmentConsumption[0] || null;

  // ── Section 6: Approval time analytics ────────────────────────────────────
  const resolvedApprovals = approvalRows.filter((a) => a.status === "approved" && a.raised_at && a.resolved_at);
  const approvalDurationsMins = resolvedApprovals.map((a) => {
    const raised = new Date(a.raised_at).getTime();
    const resolved = new Date(a.resolved_at).getTime();
    return Math.max(0, (resolved - raised) / 60000);
  });
  function median(arr) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
  const avgApprovalMins = approvalDurationsMins.length
    ? Math.round((approvalDurationsMins.reduce((s, m) => s + m, 0) / approvalDurationsMins.length) * 10) / 10
    : null;
  const medianApprovalMins = approvalDurationsMins.length ? Math.round(median(approvalDurationsMins) * 10) / 10 : null;

  // By department.
  const byDept = {};
  resolvedApprovals.forEach((a) => {
    const key = a.department || "Unassigned";
    if (!byDept[key]) byDept[key] = [];
    byDept[key].push((new Date(a.resolved_at) - new Date(a.raised_at)) / 60000);
  });
  const approvalTimeByDepartment = Object.entries(byDept)
    .map(([department, mins]) => ({
      department,
      count: mins.length,
      avg_minutes: Math.round((mins.reduce((s, m) => s + m, 0) / mins.length) * 10) / 10,
      median_minutes: Math.round(median(mins) * 10) / 10,
    }))
    .sort((a, b) => b.avg_minutes - a.avg_minutes);

  // By approver.
  const byApprover = {};
  resolvedApprovals.forEach((a) => {
    const key = a.approver_name || (a.approved_by ? `User #${a.approved_by}` : "Unknown");
    if (!byApprover[key]) byApprover[key] = [];
    byApprover[key].push((new Date(a.resolved_at) - new Date(a.raised_at)) / 60000);
  });
  const approvalTimeByApprover = Object.entries(byApprover)
    .map(([approver, mins]) => ({
      approver,
      count: mins.length,
      avg_minutes: Math.round((mins.reduce((s, m) => s + m, 0) / mins.length) * 10) / 10,
      median_minutes: Math.round(median(mins) * 10) / 10,
    }))
    .sort((a, b) => b.avg_minutes - a.avg_minutes);

  const pendingApprovalsToday = approvalRows.filter((a) => a.status === "pending").length;

  // ── Section 7: Indent raised-time distribution (hour of day) ─────────────
  const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  indentDetails.forEach((ind) => {
    if (!ind.created_at) return;
    const hour = new Date(ind.created_at).getHours();
    if (hourBuckets[hour]) hourBuckets[hour].count += 1;
  });

  return {
    date,
    settings: { consumption_spike_pct: spikePct, consumption_baseline_days: baselineDays },
    indents: {
      total: totalIndents,
      routine_count: routineCount,
      adhoc_count: adhocCount,
      by_type: indentTypeCounts,
      details: indentDetails,
    },
    purchases: {
      total_pos: totalPurchaseOrders,
      total_po_value: totalPurchaseValue,
      pos: poRows.map((p) => ({ ...p, total_amount: Math.round((parseFloat(p.total_amount) || 0) * 100) / 100 })),
    },
    grn: {
      total_count: totalGrnCount,
      total_value: totalGrnValue,
      by_supplier: grnSupplierSummary,
      notes: grnRows,
      items: grnItemRows,
    },
    beyondExpectation: {
      items: beyondExpectationItems,
      anomaly_alerts: anomalyAlertsToday,
    },
    departmentConsumption: {
      departments: departmentConsumption,
      top_department: topDepartmentByConsumption,
    },
    approvalAnalytics: {
      resolved_count: resolvedApprovals.length,
      pending_count: pendingApprovalsToday,
      avg_minutes: avgApprovalMins,
      median_minutes: medianApprovalMins,
      by_department: approvalTimeByDepartment,
      by_approver: approvalTimeByApprover,
    },
    hourlyDistribution: hourBuckets,
  };
}

// ────────────────────────────── Excel workbook ──────────────────────────────

function writeTitleBlock(ws, mergeRange, titleText, subtitleText, subtitleRow = 2) {
  safeMergeCells(ws, mergeRange.replace(/\d+$/, "1"));
  const title = ws.getCell("A1");
  title.value = titleText;
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: PALETTE.headerText } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 32;

  safeMergeCells(ws, mergeRange.replace(/\d+$/, String(subtitleRow)));
  const sub = ws.getCell(`A${subtitleRow}`);
  sub.value = subtitleText;
  sub.font = { name: "Calibri", size: 10, bold: true, color: { argb: "94A3B8" } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(subtitleRow).height = 18;
  ws.getRow(subtitleRow + 1).height = 6;
}

function writeTable(ws, startRow, columns, rows, cellMappers = {}) {
  const headerRow = ws.getRow(startRow);
  headerRow.values = columns;
  headerRow.height = 24;
  columns.forEach((_, idx) => {
    const cell = headerRow.getCell(idx + 1);
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

  let rowNum = startRow + 1;
  rows.forEach((rowValues, idx) => {
    const row = ws.getRow(rowNum);
    row.values = rowValues;
    row.eachCell((cell, colNum) => {
      cell.border = BORDER_BOX;
      cell.font = { name: "Calibri", size: 10 };
      if (idx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraBg } };
      }
      if (cellMappers[colNum]) cellMappers[colNum](cell);
    });
    rowNum++;
  });
  return rowNum; // next free row
}

function buildIndentIntelligenceWorkbook(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hotel Kapila Inventory System";
  workbook.created = new Date();

  // ── Summary sheet ──────────────────────────────────────────────────────
  const summaryWs = workbook.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 4 }] });
  embedLogoInWorksheet(workbook, summaryWs, { col: 2.5, row: 0.1, width: 120, height: 32 });
  writeTitleBlock(summaryWs, "A1:D1", "HOTEL KAPILA - INDENT & PURCHASE INTELLIGENCE REPORT", `Date: ${data.date}`);
  const summaryRows = [
    ["Total indents raised", data.indents.total, "", ""],
    ["  Routine", data.indents.routine_count, "", ""],
    ["  Ad-hoc / other", data.indents.adhoc_count, "", ""],
    ["Total purchase orders raised", data.purchases.total_pos, "Value (Rs.)", data.purchases.total_po_value],
    ["Total GRNs received", data.grn.total_count, "Value (Rs.)", data.grn.total_value],
    ["Items beyond expectation (consumption spike)", data.beyondExpectation.items.length, "", ""],
    ["Real anomaly alerts (cron) today", data.beyondExpectation.anomaly_alerts.length, "", ""],
    ["Top department by consumption", data.departmentConsumption.top_department?.department || "N/A", "Value (Rs.)", data.departmentConsumption.top_department?.total_value || 0],
    ["Approvals resolved today", data.approvalAnalytics.resolved_count, "Still pending", data.approvalAnalytics.pending_count],
    ["Avg approval time (minutes)", data.approvalAnalytics.avg_minutes ?? "N/A", "Median (minutes)", data.approvalAnalytics.median_minutes ?? "N/A"],
  ];
  let r = 5;
  summaryRows.forEach(([label, value, label2, value2]) => {
    const row = summaryWs.getRow(r);
    row.values = [label, value, label2, value2];
    row.getCell(1).font = { name: "Calibri", size: 10, bold: true };
    row.getCell(3).font = { name: "Calibri", size: 10, bold: true };
    r++;
  });
  summaryWs.getRow(r + 1).values = [`Thresholds used — consumption_spike_pct: ${data.settings.consumption_spike_pct}%, consumption_baseline_days: ${data.settings.consumption_baseline_days}`];
  autoFitColumns(summaryWs);

  // ── Indents Detail sheet ───────────────────────────────────────────────
  const indentsWs = workbook.addWorksheet("Indents Detail", { views: [{ state: "frozen", ySplit: 4 }] });
  writeTitleBlock(indentsWs, "A1:H1", "INDENTS RAISED TODAY", `Date: ${data.date} | Total: ${data.indents.total}`);
  writeTable(
    indentsWs, 4,
    ["Indent ID", "Department", "Type", "Status", "Shift", "Priority", "Item Count", "Created At"],
    data.indents.details.map((ind) => [
      ind.id, ind.dept, ind.indent_type || "routine", ind.status, ind.shift || "", ind.priority || "",
      ind.item_count, ind.created_at ? new Date(ind.created_at).toLocaleString("en-IN") : "",
    ]),
    { 1: (c) => (c.alignment = { horizontal: "center" }), 7: (c) => (c.alignment = { horizontal: "center" }) }
  );
  autoFitColumns(indentsWs);

  // ── Purchases / GRN sheet ──────────────────────────────────────────────
  const pgWs = workbook.addWorksheet("Purchases & GRN", { views: [{ state: "frozen", ySplit: 4 }] });
  writeTitleBlock(pgWs, "A1:F1", "PURCHASE ORDERS & GRNs TODAY", `Date: ${data.date} | POs: ${data.purchases.total_pos} | GRNs: ${data.grn.total_count}`);
  let nextRow = writeTable(
    pgWs, 4,
    ["PO Number", "Supplier", "Status", "Date", "Total Amount", ""],
    data.purchases.pos.map((p) => [p.po_number, p.supplier_name || "", p.status, p.date, p.total_amount, ""]),
    { 5: (c) => { c.numFmt = "₹#,##0.00"; c.alignment = { horizontal: "right" }; } }
  );
  nextRow += 1;
  pgWs.getRow(nextRow).values = ["GRN Number", "Supplier", "Invoice No", "Received By", "Total Amount", ""];
  nextRow += 1;
  data.grn.notes.forEach((g) => {
    pgWs.getRow(nextRow).values = [g.grn_number, g.supplier_name || "", g.invoice_no || "", g.received_by || "", Math.round((parseFloat(g.total_amount) || 0) * 100) / 100, ""];
    pgWs.getRow(nextRow).getCell(5).numFmt = "₹#,##0.00";
    nextRow += 1;
  });
  autoFitColumns(pgWs);

  const grnSupplierWs = workbook.addWorksheet("GRN by Supplier", { views: [{ state: "frozen", ySplit: 4 }] });
  writeTitleBlock(grnSupplierWs, "A1:C1", "GRN SUMMARY BY SUPPLIER", `Date: ${data.date}`);
  writeTable(
    grnSupplierWs, 4,
    ["Supplier", "GRN Count", "Total Value"],
    data.grn.by_supplier.map((g) => [g.supplier, g.grn_count, g.total_value]),
    { 3: (c) => { c.numFmt = "₹#,##0.00"; c.alignment = { horizontal: "right" }; } }
  );
  autoFitColumns(grnSupplierWs);

  // ── Beyond-Expectation Items sheet ──────────────────────────────────────
  const beWs = workbook.addWorksheet("Beyond-Expectation Items", { views: [{ state: "frozen", ySplit: 4 }] });
  writeTitleBlock(
    beWs, "A1:F1", "ITEMS BEYOND EXPECTATION TODAY",
    `Date: ${data.date} | Spike threshold: >${data.settings.consumption_spike_pct}% above ${data.settings.consumption_baseline_days}-day avg`
  );
  writeTable(
    beWs, 4,
    ["Item Code", "Item Name", "Today Issued Qty", `${data.settings.consumption_baseline_days}d Avg Daily Qty`, "% Above Baseline", "Today Issued Value"],
    data.beyondExpectation.items.map((it) => [
      it.item_code, it.item_name, it.today_issued_qty, it.baseline_daily_avg_qty, it.pct_above_baseline, it.today_issued_value,
    ]),
    {
      3: (c) => { c.numFmt = "#,##0.000"; c.alignment = { horizontal: "right" }; },
      4: (c) => { c.numFmt = "#,##0.000"; c.alignment = { horizontal: "right" }; },
      5: (c) => { c.numFmt = "0.0%"; c.value = c.value != null ? c.value / 100 : c.value; c.alignment = { horizontal: "right" }; },
      6: (c) => { c.numFmt = "₹#,##0.00"; c.alignment = { horizontal: "right" }; },
    }
  );
  const anomalyStartRow = 4 + data.beyondExpectation.items.length + 3;
  beWs.getRow(anomalyStartRow - 1).values = ["Real anomaly_alerts (nightly cron, 7-day baseline, per-plate ratio) for this date:"];
  writeTable(
    beWs, anomalyStartRow,
    ["Item", "Department", "Baseline Ratio", "Current Ratio", "Severity", "Description"],
    data.beyondExpectation.anomaly_alerts.map((a) => [a.item, a.department, a.baseline_ratio, a.current_ratio, a.severity, a.description]),
    { 3: (c) => (c.numFmt = "0.0000"), 4: (c) => (c.numFmt = "0.0000") }
  );
  autoFitColumns(beWs);

  // ── Department Consumption sheet ────────────────────────────────────────
  const deptWs = workbook.addWorksheet("Department Consumption", { views: [{ state: "frozen", ySplit: 4 }] });
  writeTitleBlock(deptWs, "A1:D1", "PER-DEPARTMENT CONSUMPTION TODAY", `Date: ${data.date}`);
  writeTable(
    deptWs, 4,
    ["Department", "Total Qty Issued", "Total Value", "Ledger Lines"],
    data.departmentConsumption.departments.map((d) => [d.department, d.total_qty, d.total_value, d.line_count]),
    { 2: (c) => (c.numFmt = "#,##0.000"), 3: (c) => { c.numFmt = "₹#,##0.00"; c.alignment = { horizontal: "right" }; } }
  );
  autoFitColumns(deptWs);

  // ── Approval Times sheet ────────────────────────────────────────────────
  const apWs = workbook.addWorksheet("Approval Times", { views: [{ state: "frozen", ySplit: 4 }] });
  writeTitleBlock(
    apWs, "A1:D1", "APPROVAL TIME ANALYTICS",
    `Date: ${data.date} | Resolved: ${data.approvalAnalytics.resolved_count} | Pending: ${data.approvalAnalytics.pending_count} | Avg: ${data.approvalAnalytics.avg_minutes ?? "N/A"} min | Median: ${data.approvalAnalytics.median_minutes ?? "N/A"} min`
  );
  let apRow = writeTable(
    apWs, 4,
    ["Department", "Resolved Count", "Avg Minutes", "Median Minutes"],
    data.approvalAnalytics.by_department.map((d) => [d.department, d.count, d.avg_minutes, d.median_minutes])
  );
  apRow += 2;
  apWs.getRow(apRow - 1).values = ["By Approver"];
  writeTable(
    apWs, apRow,
    ["Approver", "Resolved Count", "Avg Minutes", "Median Minutes"],
    data.approvalAnalytics.by_approver.map((a) => [a.approver, a.count, a.avg_minutes, a.median_minutes])
  );
  autoFitColumns(apWs);

  // ── Hourly Distribution sheet ────────────────────────────────────────────
  const hourWs = workbook.addWorksheet("Hourly Distribution", { views: [{ state: "frozen", ySplit: 4 }] });
  writeTitleBlock(hourWs, "A1:B1", "INDENT RAISED-TIME DISTRIBUTION", `Date: ${data.date} | Total: ${data.indents.total}`);
  writeTable(
    hourWs, 4,
    ["Hour of Day", "Indents Raised"],
    data.hourlyDistribution.map((h) => [`${String(h.hour).padStart(2, "0")}:00`, h.count])
  );
  autoFitColumns(hourWs);

  return workbook;
}

// ────────────────────────────── WhatsApp digest ─────────────────────────────

const WHATSAPP_MAX_CHARS = 4096;
const WHATSAPP_SAFE_CHARS = WHATSAPP_MAX_CHARS - 80;

function buildWhatsAppDigest(data) {
  const top3Beyond = data.beyondExpectation.items
    .slice(0, 3)
    .map((it) => `• ${it.item_name}: +${it.pct_above_baseline}% vs avg (${it.today_issued_qty} today)`)
    .join("\n") || "None today.";

  const topDept = data.departmentConsumption.top_department;

  let msg =
    `*Hotel Kapila - Indent & Purchase Intelligence*\n` +
    `Date: ${data.date}\n\n` +
    `*Indents:* ${data.indents.total} total (${data.indents.routine_count} routine, ${data.indents.adhoc_count} ad-hoc)\n` +
    `*Purchases:* ${data.purchases.total_pos} PO(s), Rs.${data.purchases.total_po_value.toFixed(2)}\n` +
    `*GRNs:* ${data.grn.total_count} received, Rs.${data.grn.total_value.toFixed(2)}\n\n` +
    `*Top beyond-expectation items:*\n${top3Beyond}\n\n` +
    `*Anomaly alerts today:* ${data.beyondExpectation.anomaly_alerts.length}\n` +
    `*Highest-consumption department:* ${topDept ? `${topDept.department} (Rs.${topDept.total_value.toFixed(2)})` : "N/A"}\n\n` +
    `*Approval time:* avg ${data.approvalAnalytics.avg_minutes ?? "N/A"} min, median ${data.approvalAnalytics.median_minutes ?? "N/A"} min (${data.approvalAnalytics.resolved_count} resolved, ${data.approvalAnalytics.pending_count} pending)\n\n` +
    `Full breakdown attached as Excel.`;

  if (msg.length > WHATSAPP_SAFE_CHARS) {
    msg = msg.slice(0, WHATSAPP_SAFE_CHARS - 20) + "\n...(truncated, see Excel)";
  }
  return msg;
}

// ────────────────────────────── Orchestration ───────────────────────────────

/**
 * Compute the report, send the WhatsApp digest to BOTH the admin and the
 * store manager, and return everything the controller needs — same return
 * shape as eodReportService.runEodReport (data + whatsappResult), plus the
 * digest text.
 */
async function runIndentIntelligenceReport(date) {
  const data = await computeIndentIntelligence(date);
  const digest = buildWhatsAppDigest(data);

  const recipients = [
    { label: "admin", number: process.env.ADMIN_WHATSAPP_NUMBER },
    { label: "store_manager", number: process.env.STORE_MANAGER_WHATSAPP_NUMBER },
  ].filter((r) => r.number);

  let whatsappResult = { mocked: true, sent: false, recipients: [] };
  if (recipients.length) {
    const results = [];
    for (const r of recipients) {
      try {
        const res = await sendWhatsApp(r.number, digest);
        results.push({ label: r.label, number: r.number, sent: !res?.mocked, mocked: !!res?.mocked });
      } catch (err) {
        console.error(`[IndentIntelligence] WhatsApp send to ${r.label} failed:`, err.message);
        results.push({ label: r.label, number: r.number, sent: false, error: err.message });
      }
    }
    whatsappResult = { recipients: results, sent: results.some((r) => r.sent) };
  } else {
    console.log("[IndentIntelligence] No WhatsApp numbers configured - skipping WhatsApp send.");
  }

  return { data, digest, whatsappResult };
}

module.exports = {
  INDENT_INTELLIGENCE_SETTINGS_DEFAULTS,
  loadIndentIntelligenceSettings,
  computeIndentIntelligence,
  buildIndentIntelligenceWorkbook,
  buildWhatsAppDigest,
  runIndentIntelligenceReport,
};
