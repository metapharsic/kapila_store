// eodReportService.js
// End-of-Day stock report: per-item opening/received/issued/adjusted/closing
// quantities and values, derived entirely from real stock_ledger + stock
// rows (zero hardcoded item data), plus an Excel export and a WhatsApp
// digest of the day's totals.
//
// Data model recap (see db/migrations/056_create_stock_ledger.js and
// 001_create_stock.js):
//   stock_ledger.transaction_type ∈ OPENING_BALANCE, INWARD_GRN,
//     INWARD_PURCHASE, OUTWARD_ISSUE, ADJUSTMENT_ADD, ADJUSTMENT_DEDUCT,
//     RETURN_TO_VENDOR
//   stock.remaining / stock.min_alert_qty give current on-hand qty and the
//     reorder threshold used for the "below reorder" note/flag.
//
// Granularity: the EOD report can additionally be sliced by "department",
// "category", or "supplier" (on top of the default flat "overall" view).
// stock_ledger already carries `department`, `category`, and `supplier` as
// plain string columns on every row (no join required - see migration 056),
// so grouping is a straight GROUP BY on that column. Item-level note logic
// (buildItemNote) is completely unchanged; granularity only adds a grouping/
// subtotal layer on top of the same per-item rows.

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

const VALID_GRANULARITIES = ["overall", "department", "category", "supplier"];

// Maps a granularity to the stock_ledger column used to group movement rows.
const GRANULARITY_LEDGER_COLUMN = {
  department: "department",
  category: "category",
  supplier: "supplier",
};

/**
 * Build a short, deterministic, rule-based observation for one item from
 * its real computed deltas for the day. No LLM call - just numeric rules
 * evaluated in priority order so each item gets exactly one note.
 */
function buildItemNote({ opening, received, issued, adjusted, closing, minAlertQty }) {
  const notes = [];

  if (minAlertQty && closing <= minAlertQty) {
    notes.push(`Below reorder threshold (min ${minAlertQty})`);
  }

  if (received > 0 && issued === 0 && adjusted === 0) {
    notes.push(`Received new stock today (+${received.toFixed(2)})`);
  }

  if (opening > 0 && issued > 0) {
    const pctIssued = (issued / opening) * 100;
    if (pctIssued >= 85) {
      notes.push(`Fast-moving - issued ${pctIssued.toFixed(0)}% of opening stock today`);
    } else if (pctIssued >= 50) {
      notes.push(`High movement - issued ${pctIssued.toFixed(0)}% of opening stock today`);
    }
  }

  if (adjusted !== 0) {
    notes.push(`${adjusted > 0 ? "Positive" : "Negative"} adjustment of ${Math.abs(adjusted).toFixed(2)} recorded today`);
  }

  if (closing <= 0) {
    notes.push("Stock exhausted - zero remaining");
  }

  if (notes.length === 0) {
    if (opening === 0 && received === 0 && issued === 0 && adjusted === 0) {
      notes.push("No stock movement today");
    } else {
      notes.push("No significant movement today");
    }
  }

  return notes.join("; ");
}

/**
 * Aggregate stock_ledger by item for the given date, joined to the current
 * stock state, and compute opening/received/issued/adjusted/closing per item
 * plus day-level totals. Single date-scoped query set, run in parallel.
 *
 * @param {string} date - YYYY-MM-DD (defaults to today, server local date)
 * @param {string} granularity - "overall" (default, unchanged flat report),
 *   "department", "category", or "supplier". When set, the result also
 *   carries `groups`: an array of { key, items, totals } sections, one per
 *   distinct value of that dimension (plus an "Unassigned" bucket for items
 *   with no value), each with its own subtotal - on top of the same flat
 *   `items` list and overall `totals` that "overall" mode already returns.
 */
async function computeEodData(date = new Date().toISOString().slice(0, 10), granularity = "overall") {
  if (!VALID_GRANULARITIES.includes(granularity)) {
    throw new Error(`Invalid granularity '${granularity}'. Must be one of: ${VALID_GRANULARITIES.join(", ")}`);
  }

  const dayStart = `${date} 00:00:00`;
  const dayEnd = `${date} 23:59:59.999`;
  const groupCol = GRANULARITY_LEDGER_COLUMN[granularity] || null;

  const [currentStock, movementRows, openingRows] = await Promise.all([
    // Current state per item (this is the authoritative closing snapshot -
    // closing qty/value come straight from `stock`, not derived by summing
    // ledger deltas, so they always match what the rest of the app shows).
    db("stock")
      .select(
        db.raw("COALESCE(MAX(item_code), 'KPL-' || MIN(id)) AS item_code"),
        "name",
        db.raw("COALESCE(category, 'General') AS category"),
        db.raw("COALESCE(unit, 'kg') AS unit"),
        db.raw("SUM(COALESCE(remaining, 0)) AS closing_qty"),
        db.raw("ROUND(AVG(COALESCE(price, 0))::numeric, 2) AS price"),
        db.raw("MAX(COALESCE(min_alert_qty, 0)) AS min_alert_qty")
      )
      .groupBy("name", "category", "unit")
      .orderBy("name", "asc"),

    // Every ledger movement for the day, grouped by item + transaction type
    // (+ the granularity column, when one is requested, so we can attribute
    // each item's movement to a department/category/supplier bucket without
    // a second query or a join - stock_ledger carries these as plain
    // columns already).
    (() => {
      const cols = ["item_name", "transaction_type"];
      if (groupCol) cols.push(groupCol);
      return db("stock_ledger")
        .whereBetween("created_at", [dayStart, dayEnd])
        .select(
          ...cols,
          db.raw("SUM(qty) AS total_qty"),
          db.raw("SUM(total_value) AS total_value")
        )
        .groupBy(...cols);
    })(),

    // Opening balance for the day = balance_qty_before of each item's
    // earliest ledger row ON that day (what it stood at before anything
    // moved today). An item with no ledger activity that day falls back to
    // its current remaining (nothing has changed it since).
    db("stock_ledger")
      .whereBetween("created_at", [dayStart, dayEnd])
      .select("item_name", "balance_qty_before", "created_at")
      .orderBy("created_at", "asc"),
  ]);

  // Reduce openingRows to the first (earliest) balance_qty_before per item.
  const openingByItem = {};
  for (const row of openingRows) {
    if (!(row.item_name in openingByItem)) {
      openingByItem[row.item_name] = parseFloat(row.balance_qty_before) || 0;
    }
  }

  // Reduce movementRows into per-item inward/outward/adjustment totals, and
  // (when granularity is set) also track which group value had the largest
  // movement for that item today, so a flat item row can still be placed
  // into a group even though items themselves don't carry department/
  // supplier directly (only ledger rows do).
  const movementByItem = {};
  const groupByItemCandidates = {}; // item -> { groupValue -> movementWeight }
  for (const row of movementRows) {
    const key = row.item_name;
    if (!movementByItem[key]) {
      movementByItem[key] = { received: 0, issued: 0, adjusted: 0, receivedValue: 0, issuedValue: 0 };
    }
    const qty = parseFloat(row.total_qty) || 0;
    const value = parseFloat(row.total_value) || 0;
    const type = row.transaction_type;

    if (type === "INWARD_GRN" || type === "INWARD_PURCHASE") {
      movementByItem[key].received += qty;
      movementByItem[key].receivedValue += value;
    } else if (type === "OUTWARD_ISSUE") {
      movementByItem[key].issued += qty;
      movementByItem[key].issuedValue += value;
    } else if (type === "ADJUSTMENT_ADD") {
      movementByItem[key].adjusted += qty;
    } else if (type === "ADJUSTMENT_DEDUCT") {
      movementByItem[key].adjusted -= qty;
    } else if (type === "RETURN_TO_VENDOR") {
      movementByItem[key].issued += qty;
      movementByItem[key].issuedValue += value;
    }

    if (groupCol) {
      const groupValue = row[groupCol] || null;
      if (!groupByItemCandidates[key]) groupByItemCandidates[key] = {};
      const weight = Math.abs(qty) + Math.abs(value);
      groupByItemCandidates[key][groupValue] =
        (groupByItemCandidates[key][groupValue] || 0) + weight;
    }
  }

  // Pick, per item, whichever group value accounted for the most movement
  // weight today (ties broken by first-seen). Items with zero ledger
  // movement today (or a null group column) fall into "Unassigned" - their
  // group can't be known from today's activity alone.
  function pickGroupForItem(itemName, category) {
    if (granularity === "overall") return null;
    if (granularity === "category") return category || "Unassigned";
    const candidates = groupByItemCandidates[itemName];
    if (!candidates) return "Unassigned";
    let best = null;
    let bestWeight = -1;
    for (const [val, weight] of Object.entries(candidates)) {
      if (weight > bestWeight) {
        bestWeight = weight;
        best = val;
      }
    }
    return best && best !== "null" ? best : "Unassigned";
  }

  const items = currentStock.map((s) => {
    const name = s.name;
    const closingQty = parseFloat(s.closing_qty) || 0;
    const price = parseFloat(s.price) || 0;
    const minAlertQty = parseFloat(s.min_alert_qty) || 0;
    const m = movementByItem[name] || { received: 0, issued: 0, adjusted: 0, receivedValue: 0, issuedValue: 0 };

    // Opening = ledger's first balance_qty_before today, else (no activity
    // today) back-derive from current closing minus today's net movement,
    // which for a no-activity item is just closing itself.
    const opening = name in openingByItem
      ? openingByItem[name]
      : closingQty - m.received + m.issued - m.adjusted;

    const closingValue = Math.round(closingQty * price * 100) / 100;

    const note = buildItemNote({
      opening,
      received: m.received,
      issued: m.issued,
      adjusted: m.adjusted,
      closing: closingQty,
      minAlertQty,
    });

    return {
      item_code: s.item_code,
      name,
      category: s.category,
      unit: s.unit,
      opening_qty: Math.round(opening * 1000) / 1000,
      received_qty: Math.round(m.received * 1000) / 1000,
      issued_qty: Math.round(m.issued * 1000) / 1000,
      adjusted_qty: Math.round(m.adjusted * 1000) / 1000,
      closing_qty: Math.round(closingQty * 1000) / 1000,
      price,
      closing_value: closingValue,
      received_value: Math.round(m.receivedValue * 100) / 100,
      issued_value: Math.round(m.issuedValue * 100) / 100,
      below_reorder: minAlertQty > 0 && closingQty <= minAlertQty,
      min_alert_qty: minAlertQty,
      note,
      group_key: pickGroupForItem(name, s.category),
    };
  });

  const totals = items.reduce(
    (acc, it) => {
      acc.itemsMoved += (it.received_qty !== 0 || it.issued_qty !== 0 || it.adjusted_qty !== 0) ? 1 : 0;
      acc.totalValueReceived += it.received_value;
      acc.totalValueIssued += it.issued_value;
      acc.totalClosingValuation += it.closing_value;
      acc.belowReorderCount += it.below_reorder ? 1 : 0;
      return acc;
    },
    { itemsMoved: 0, totalValueReceived: 0, totalValueIssued: 0, totalClosingValuation: 0, belowReorderCount: 0 }
  );
  totals.totalValueReceived = Math.round(totals.totalValueReceived * 100) / 100;
  totals.totalValueIssued = Math.round(totals.totalValueIssued * 100) / 100;
  totals.totalClosingValuation = Math.round(totals.totalClosingValuation * 100) / 100;
  totals.totalItems = items.length;

  const result = { date, granularity, items, totals };

  if (granularity !== "overall") {
    const groupsMap = {};
    for (const it of items) {
      const key = it.group_key || "Unassigned";
      if (!groupsMap[key]) groupsMap[key] = [];
      groupsMap[key].push(it);
    }
    // Sort groups by total closing value descending, "Unassigned" last.
    const groupKeys = Object.keys(groupsMap).sort((a, b) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      const sumA = groupsMap[a].reduce((acc, it) => acc + it.closing_value, 0);
      const sumB = groupsMap[b].reduce((acc, it) => acc + it.closing_value, 0);
      return sumB - sumA;
    });

    result.groups = groupKeys.map((key) => {
      const groupItems = groupsMap[key];
      const groupTotals = groupItems.reduce(
        (acc, it) => {
          acc.itemsMoved += (it.received_qty !== 0 || it.issued_qty !== 0 || it.adjusted_qty !== 0) ? 1 : 0;
          acc.totalValueReceived += it.received_value;
          acc.totalValueIssued += it.issued_value;
          acc.totalClosingValuation += it.closing_value;
          acc.belowReorderCount += it.below_reorder ? 1 : 0;
          return acc;
        },
        { itemsMoved: 0, totalValueReceived: 0, totalValueIssued: 0, totalClosingValuation: 0, belowReorderCount: 0 }
      );
      groupTotals.totalValueReceived = Math.round(groupTotals.totalValueReceived * 100) / 100;
      groupTotals.totalValueIssued = Math.round(groupTotals.totalValueIssued * 100) / 100;
      groupTotals.totalClosingValuation = Math.round(groupTotals.totalClosingValuation * 100) / 100;
      groupTotals.totalItems = groupItems.length;
      return { key, items: groupItems, totals: groupTotals };
    });
  }

  return result;
}

/**
 * Write one EOD sheet's header/title/body/totals rows into a given
 * worksheet for a given slice of items (the flat "overall" list, or one
 * group's item list in granular mode). Shared by buildEodWorkbook so the
 * per-item rendering logic (zebra striping, below-reorder highlight,
 * numeric formats) stays identical in both modes.
 */
function writeEodSheet(ws, titleText, subtitleText, items) {
  safeMergeCells(ws, "A1:L1");
  const title = ws.getCell("A1");
  title.value = titleText;
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: PALETTE.headerText } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 32;

  safeMergeCells(ws, "A2:L2");
  const sub = ws.getCell("A2");
  sub.value = subtitleText;
  sub.font = { name: "Calibri", size: 10, bold: true, color: { argb: "94A3B8" } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 18;

  ws.getRow(3).height = 6;

  const columns = [
    "Item Code", "Item Name", "Category", "Unit",
    "Opening Qty", "Received Qty", "Issued Qty", "Adjusted Qty",
    "Closing Qty", "Price", "Closing Value", "Note",
  ];
  const headerRow = ws.getRow(4);
  headerRow.values = columns;
  headerRow.height = 26;
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

  let rowNum = 5;
  items.forEach((it, idx) => {
    const row = ws.getRow(rowNum);
    row.values = [
      it.item_code, it.name, it.category, it.unit,
      it.opening_qty, it.received_qty, it.issued_qty, it.adjusted_qty,
      it.closing_qty, it.price, it.closing_value, it.note,
    ];
    row.eachCell((cell, colNum) => {
      cell.border = BORDER_BOX;
      cell.font = { name: "Calibri", size: 10 };
      if (idx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraBg } };
      }
      if ([5, 6, 7, 8, 9].includes(colNum)) {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right" };
      } else if (colNum === 10 || colNum === 11) {
        cell.numFmt = '₹#,##0.00';
        cell.alignment = { horizontal: "right" };
      } else if (colNum === 3 || colNum === 4) {
        cell.alignment = { horizontal: "center" };
      }
    });
    if (it.below_reorder) {
      row.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.redFill } };
      row.getCell(9).font = { name: "Calibri", size: 10, bold: true, color: { argb: PALETTE.redText } };
    }
    rowNum++;
  });

  const totalsRow = ws.getRow(rowNum);
  totalsRow.getCell(1).value = "TOTALS";
  totalsRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
  const firstDataRow = 5;
  const lastDataRow = rowNum - 1;
  if (items.length > 0) {
    totalsRow.getCell(6).value = { formula: `SUM(F${firstDataRow}:F${lastDataRow})` };
    totalsRow.getCell(7).value = { formula: `SUM(G${firstDataRow}:G${lastDataRow})` };
    totalsRow.getCell(11).value = { formula: `SUM(K${firstDataRow}:K${lastDataRow})` };
  }
  [6, 7, 11].forEach((c) => {
    totalsRow.getCell(c).numFmt = c === 11 ? '₹#,##0.00' : "#,##0.00";
    totalsRow.getCell(c).font = { name: "Calibri", size: 10, bold: true, color: { argb: PALETTE.accentGold } };
  });
  totalsRow.eachCell((cell) => {
    cell.border = { top: { style: "thin" }, bottom: { style: "double" } };
  });

  autoFitColumns(ws);
}

/** Sanitize a group key into a valid, unique-enough Excel sheet name (<=31 chars, no []:*?/\). */
function sheetNameFor(key, usedNames) {
  let base = String(key).replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 28) || "Group";
  let name = base;
  let n = 2;
  while (usedNames.has(name.toLowerCase())) {
    name = `${base.slice(0, 28 - String(n).length - 1)} ${n}`;
    n++;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

/**
 * Build the EOD Excel workbook, reusing inventoryReportService's palette /
 * border / auto-fit helpers for a consistent look.
 *
 * In "overall" mode (default, unchanged), this produces exactly one "EOD
 * Report" sheet with the flat item list, identical to before.
 *
 * In granular mode (department/category/supplier), it produces one tab per
 * group (named after the group's value, e.g. "Kitchen", "Beverages"), each
 * built with the same writeEodSheet() layout/logic as the flat sheet, plus
 * a leading "Summary" tab listing each group's subtotal.
 */
function buildEodWorkbook(eodData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hotel Kapila Inventory System";
  workbook.created = new Date();

  if (!eodData.groups) {
    const ws = workbook.addWorksheet("EOD Report", {
      views: [{ state: "frozen", ySplit: 4 }],
    });
    embedLogoInWorksheet(workbook, ws, { col: 4.5, row: 0.1, width: 120, height: 32 });
    writeEodSheet(
      ws,
      "HOTEL KAPILA - END OF DAY STOCK REPORT",
      `Date: ${eodData.date} | Items tracked: ${eodData.totals.totalItems} | Items moved: ${eodData.totals.itemsMoved} | Below reorder: ${eodData.totals.belowReorderCount}`,
      eodData.items
    );
    return workbook;
  }

  // Granular mode: a Summary tab, then one tab per group.
  const summaryWs = workbook.addWorksheet("Summary");
  embedLogoInWorksheet(workbook, summaryWs, { col: 4.5, row: 0.1, width: 120, height: 32 });
  safeMergeCells(summaryWs, "A1:F1");
  const title = summaryWs.getCell("A1");
  title.value = `HOTEL KAPILA - END OF DAY STOCK REPORT (by ${eodData.granularity.toUpperCase()})`;
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: PALETTE.headerText } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  summaryWs.getRow(1).height = 32;

  safeMergeCells(summaryWs, "A2:F2");
  const sub = summaryWs.getCell("A2");
  sub.value = `Date: ${eodData.date} | Groups: ${eodData.groups.length} | Items tracked: ${eodData.totals.totalItems}`;
  sub.font = { name: "Calibri", size: 10, bold: true, color: { argb: "94A3B8" } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  summaryWs.getRow(2).height = 18;
  summaryWs.getRow(3).height = 6;

  const summaryColumns = ["Group", "Items", "Received Value", "Issued Value", "Closing Value", "Below Reorder"];
  const summaryHeaderRow = summaryWs.getRow(4);
  summaryHeaderRow.values = summaryColumns;
  summaryHeaderRow.height = 24;
  summaryColumns.forEach((_, idx) => {
    const cell = summaryHeaderRow.getCell(idx + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.headerText } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  let sRow = 5;
  const usedSheetNames = new Set(["summary"]);
  eodData.groups.forEach((group) => {
    const row = summaryWs.getRow(sRow);
    row.values = [
      group.key, group.totals.totalItems, group.totals.totalValueReceived,
      group.totals.totalValueIssued, group.totals.totalClosingValuation, group.totals.belowReorderCount,
    ];
    row.eachCell((cell, colNum) => {
      cell.border = BORDER_BOX;
      cell.font = { name: "Calibri", size: 10, bold: colNum === 1 };
      if (sRow % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraBg } };
      if ([3, 4, 5].includes(colNum)) {
        cell.numFmt = '₹#,##0.00';
        cell.alignment = { horizontal: "right" };
      } else if (colNum === 2 || colNum === 6) {
        cell.alignment = { horizontal: "center" };
      }
    });
    sRow++;

    const sheetName = sheetNameFor(group.key, usedSheetNames);
    const groupWs = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 4 }] });
    writeEodSheet(
      groupWs,
      `HOTEL KAPILA - EOD (${eodData.granularity}: ${group.key})`,
      `Date: ${eodData.date} | Items: ${group.totals.totalItems} | Below reorder: ${group.totals.belowReorderCount}`,
      group.items
    );
  });

  autoFitColumns(summaryWs);
  return workbook;
}

/**
 * Build a single group's highlight list for the WhatsApp digest (shared by
 * both overall and per-group rendering so the "pick the top 5 noteworthy
 * items" logic stays in one place).
 */
function buildTop5Highlights(items) {
  const belowReorder = items.filter((it) => it.below_reorder);
  const byIssuedValue = [...items].sort((a, b) => b.issued_value - a.issued_value).filter((it) => it.issued_value > 0);
  const byAdjustment = items.filter((it) => it.adjusted_qty !== 0);

  const highlightSet = [];
  const seen = new Set();
  const addHighlight = (it, reason) => {
    if (seen.has(it.name)) return;
    seen.add(it.name);
    highlightSet.push(`• ${it.name}: ${reason}`);
  };

  belowReorder.slice(0, 5).forEach((it) => addHighlight(it, `below reorder (${it.closing_qty} ${it.unit} left, min ${it.min_alert_qty})`));
  byIssuedValue.forEach((it) => {
    if (highlightSet.length >= 5) return;
    addHighlight(it, `issued Rs.${it.issued_value.toFixed(2)} worth today`);
  });
  byAdjustment.forEach((it) => {
    if (highlightSet.length >= 5) return;
    addHighlight(it, `${it.adjusted_qty > 0 ? "+" : ""}${it.adjusted_qty.toFixed(2)} ${it.unit} adjustment`);
  });

  return highlightSet.slice(0, 5).join("\n") || "No notable item-level events today.";
}

const WHATSAPP_MAX_CHARS = 4096;
// Leave headroom for the trailing "...and N more group(s)" note.
const WHATSAPP_SAFE_CHARS = WHATSAPP_MAX_CHARS - 120;

/**
 * Build the short WhatsApp digest.
 *
 * In "overall" mode (eodData.groups absent), this is unchanged: day totals
 * + top 5 most significant item-level notes.
 *
 * In granular mode, it instead emits one short block per group (department/
 * category/supplier) - opening/issued/closing totals + a below-reorder
 * count - in descending order of closing valuation, truncating the group
 * list (with a summary line) if the full digest would exceed WhatsApp's
 * 4096-character limit.
 */
function buildWhatsAppDigest(eodData) {
  const { date, totals, items } = eodData;

  if (!eodData.groups) {
    const top5 = buildTop5Highlights(items);
    return (
      `*Hotel Kapila - End of Day Stock Report*\n` +
      `Date: ${date}\n` +
      `Items tracked: ${totals.totalItems} | Moved today: ${totals.itemsMoved}\n` +
      `Received value: Rs.${totals.totalValueReceived.toFixed(2)}\n` +
      `Issued value: Rs.${totals.totalValueIssued.toFixed(2)}\n` +
      `Closing stock valuation: Rs.${totals.totalClosingValuation.toFixed(2)}\n` +
      `Below reorder threshold: ${totals.belowReorderCount} item(s)\n\n` +
      `Top items today:\n${top5}\n\n` +
      `Full item-by-item breakdown attached as Excel.`
    );
  }

  const granLabel = eodData.granularity.charAt(0).toUpperCase() + eodData.granularity.slice(1);
  const header =
    `*Hotel Kapila - End of Day Stock Report (by ${granLabel})*\n` +
    `Date: ${date}\n` +
    `Groups: ${eodData.groups.length} | Items tracked: ${totals.totalItems} | Moved today: ${totals.itemsMoved}\n` +
    `Overall received: Rs.${totals.totalValueReceived.toFixed(2)} | issued: Rs.${totals.totalValueIssued.toFixed(2)} | closing: Rs.${totals.totalClosingValuation.toFixed(2)}\n\n`;

  const footer = `\nFull item-by-item breakdown by ${eodData.granularity} attached as Excel.`;

  let body = "";
  let groupsIncluded = 0;
  for (const group of eodData.groups) {
    const belowReorderNote = group.totals.belowReorderCount > 0
      ? ` | ${group.totals.belowReorderCount} below reorder`
      : "";
    const block =
      `*${granLabel}: ${group.key}*\n` +
      `Received/Issued/Closing: Rs.${group.totals.totalValueReceived.toFixed(2)} / Rs.${group.totals.totalValueIssued.toFixed(2)} / Rs.${group.totals.totalClosingValuation.toFixed(2)}\n` +
      `${group.totals.totalItems} item(s)${belowReorderNote}\n\n`;

    if ((header.length + body.length + block.length + footer.length) > WHATSAPP_SAFE_CHARS) {
      break;
    }
    body += block;
    groupsIncluded++;
  }

  const remaining = eodData.groups.length - groupsIncluded;
  const truncationNote = remaining > 0
    ? `...and ${remaining} more group(s) - see attached Excel for full breakdown.\n`
    : "";

  return header + body + truncationNote + footer;
}

/**
 * Compute the EOD data, send the WhatsApp digest to the admin number, and
 * return everything the controller needs (data + a workbook builder the
 * controller streams out). Fails safe on WhatsApp - never throws if env
 * vars are blank; sendWhatsApp() itself logs a mock message in that case.
 *
 * @param {string} date - YYYY-MM-DD, defaults to today
 * @param {string} granularity - "overall" (default), "department",
 *   "category", or "supplier"
 */
async function runEodReport(date, granularity = "overall") {
  const eodData = await computeEodData(date, granularity);
  const digest = buildWhatsAppDigest(eodData);

  let whatsappResult = { mocked: true, sent: false };
  const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
  if (adminNumber) {
    try {
      const result = await sendWhatsApp(adminNumber, digest);
      whatsappResult = { ...result, sent: !result?.mocked };
    } catch (err) {
      console.error("[EOD Report] WhatsApp send failed:", err.message);
      whatsappResult = { sent: false, error: err.message };
    }
  } else {
    console.log("[EOD Report] ADMIN_WHATSAPP_NUMBER not set - skipping WhatsApp send.");
  }

  return { eodData, digest, whatsappResult };
}

module.exports = {
  VALID_GRANULARITIES,
  computeEodData,
  buildEodWorkbook,
  buildWhatsAppDigest,
  runEodReport,
};
