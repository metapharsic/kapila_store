const db = require("../db");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

async function generateInventoryExcel() {
  console.log("=== Multi-Agent Generating Complete Inventory Excel Report ===");

  // 1. Fetch live aggregated stock from database
  const stockRows = await db("stock")
    .select("name")
    .select(db.raw("SUM(remaining) as total_remaining"))
    .select(db.raw("CASE WHEN SUM(remaining) > 0 THEN SUM(remaining * price) / SUM(remaining) ELSE AVG(price) END as avg_purchase_price"))
    .select(db.raw("SUM(remaining * price) as total_val"))
    .groupBy("name")
    .orderBy("name", "asc");

  console.log(`Fetched ${stockRows.length} unique inventory items from Database.`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hotel Kapila Inventory System (Multi-Agent Swarm)";
  workbook.created = new Date();

  // -------------------------------------------------------------
  // SHEET 1: Current Stock Report (Exact Match to User Reference)
  // -------------------------------------------------------------
  const sheet1 = workbook.addWorksheet("Current Stock Report", {
    views: [{ showGridLines: true }]
  });

  const currentDateStr = "24-08-26"; // YY-MM-DD or DD-MM-YY as in user format

  // Row 1: Header matching reference image
  // Col A: "Item" (with "Date: 24-08-26" or column header)
  // Col B: "Current Stock"
  // Col C: "Average Purchase Price (₹)"
  // Col D: "Total (₹)"
  
  sheet1.columns = [
    { key: "item", width: 42 },
    { key: "current_stock", width: 18 },
    { key: "avg_price", width: 28 },
    { key: "total_val", width: 22 },
  ];

  // Header row matching reference:
  const headerRow = sheet1.addRow([
    `Date: ${currentDateStr}`,
    "Current Stock",
    "Average Purchase Price (₹)",
    "Total (₹)"
  ]);

  // Style Header Row
  headerRow.height = 28;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 11, color: { argb: "FF003366" }, name: "Segoe UI" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F4F8" }
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FFD0D5DD" } },
      right: { style: "thin", color: { argb: "FFD0D5DD" } }
    };
    if (colNumber === 1) {
      cell.alignment = { vertical: "middle", horizontal: "left" };
    } else {
      cell.alignment = { vertical: "middle", horizontal: "right" };
    }
  });

  // Second sub-header for clarity: Item
  // Actually in the user image:
  // Col 1 has "Item", Col 2 "Current Stock", Col 3 "Average Purchase Price (₹)", Col 4 "Total (₹)"
  // And the date was in the header or filename. Let's make row 1 clean:
  headerRow.getCell(1).value = "Item";

  let sumQty = 0;
  let sumTotal = 0;

  stockRows.forEach((row, index) => {
    const qty = parseFloat(row.total_remaining) || 0;
    const avgPrice = parseFloat(row.avg_purchase_price) || 0;
    const total = parseFloat(row.total_val) || (qty * avgPrice);

    sumQty += qty;
    sumTotal += total;

    const dataRow = sheet1.addRow([
      row.name,
      qty,
      avgPrice,
      total
    ]);

    dataRow.height = 20;

    // Formatting
    dataRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    dataRow.getCell(2).alignment = { vertical: "middle", horizontal: "right" };
    dataRow.getCell(2).numFmt = "#,##0.00";
    dataRow.getCell(3).alignment = { vertical: "middle", horizontal: "right" };
    dataRow.getCell(3).numFmt = "₹#,##0.00";
    dataRow.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
    dataRow.getCell(4).numFmt = "₹#,##0.00";

    // Alternate row shading
    if (index % 2 === 1) {
      dataRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFBFDFF" }
        };
      });
    }

    dataRow.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } }
      };
      cell.font = { size: 10, name: "Segoe UI" };
    });
  });

  // Summary / Total Row
  const totalRow = sheet1.addRow([
    "Total Inventory Valuation",
    sumQty,
    "",
    sumTotal
  ]);
  totalRow.height = 26;
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FF000000" }, name: "Segoe UI" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFDE68A" } // Soft Gold Highlight
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "double", color: { argb: "FF000000" } }
    };
  });
  totalRow.getCell(2).numFmt = "#,##0.00";
  totalRow.getCell(4).numFmt = "₹#,##0.00";

  // -------------------------------------------------------------
  // SHEET 2: Multi-Agent Discrepancy & Reconciliation Comparison
  // -------------------------------------------------------------
  const sheet2 = workbook.addWorksheet("Reconciliation vs Aug 21 Sheet", {
    views: [{ showGridLines: true }]
  });

  sheet2.columns = [
    { header: "Item Name", key: "name", width: 38 },
    { header: "Excel Qty (21-Aug)", key: "ex_qty", width: 18 },
    { header: "App DB Qty (24-Aug)", key: "db_qty", width: 20 },
    { header: "Quantity Variance", key: "qty_diff", width: 18 },
    { header: "Excel Rate (₹)", key: "ex_rate", width: 16 },
    { header: "App Avg Rate (₹)", key: "db_rate", width: 18 },
    { header: "Excel Valuation (₹)", key: "ex_val", width: 20 },
    { header: "App Valuation (₹)", key: "db_val", width: 20 },
    { header: "Valuation Variance (₹)", key: "val_diff", width: 22 },
    { header: "Status / Analysis", key: "status", width: 24 },
  ];

  const sheet2Header = sheet2.getRow(1);
  sheet2Header.height = 26;
  sheet2Header.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Read previous Excel to compute side-by-side reconciliation
  const xlsx = require("xlsx");
  const origWb = xlsx.readFile("C:\\Kapila_store\\Project_requirement\\Current stock report as on 21-08-26.xlsx");
  const origSheet = origWb.Sheets[origWb.SheetNames[0]];
  const origRows = xlsx.utils.sheet_to_json(origSheet, { defval: "" });

  const excelMap = new Map();
  origRows.forEach(r => {
    const n = String(r["Dare: 21-08-26"] || "").trim();
    if (!n || n.toLowerCase() === "item") return;
    const q = parseFloat(r["__EMPTY"]) || 0;
    const p = parseFloat(r["__EMPTY_1"]) || 0;
    const v = parseFloat(r["__EMPTY_2"]) || (q * p);
    excelMap.set(n.toLowerCase().trim(), { name: n, q, p, v });
  });

  const dbItemMap = new Map();
  stockRows.forEach(r => {
    dbItemMap.set(r.name.toLowerCase().trim(), {
      name: r.name,
      qty: parseFloat(r.total_remaining) || 0,
      price: parseFloat(r.avg_purchase_price) || 0,
      total: parseFloat(r.total_val) || 0
    });
  });

  const allItemNames = Array.from(new Set([...excelMap.keys(), ...dbItemMap.keys()])).sort();

  allItemNames.forEach((key) => {
    const ex = excelMap.get(key) || { name: key, q: 0, p: 0, v: 0 };
    const dbItem = dbItemMap.get(key) || { name: key, qty: 0, price: 0, total: 0 };

    const displayName = ex.name !== key ? ex.name : dbItem.name;
    const qtyDiff = dbItem.qty - ex.q;
    const valDiff = dbItem.total - ex.v;

    let status = "Match";
    if (!excelMap.has(key)) status = "New in App DB";
    else if (!dbItemMap.has(key)) status = "Missing in App DB";
    else if (Math.abs(qtyDiff) > 0.01) status = "Qty Variance";

    const r = sheet2.addRow([
      displayName,
      ex.q,
      dbItem.qty,
      qtyDiff,
      ex.p,
      dbItem.price,
      ex.v,
      dbItem.total,
      valDiff,
      status
    ]);

    r.height = 19;
    r.getCell(2).numFmt = "#,##0.00";
    r.getCell(3).numFmt = "#,##0.00";
    r.getCell(4).numFmt = "#,##0.00";
    r.getCell(5).numFmt = "₹#,##0.00";
    r.getCell(6).numFmt = "₹#,##0.00";
    r.getCell(7).numFmt = "₹#,##0.00";
    r.getCell(8).numFmt = "₹#,##0.00";
    r.getCell(9).numFmt = "₹#,##0.00";

    // Highlight status
    if (status === "Missing in App DB") {
      r.getCell(10).font = { color: { argb: "FFEF4444" }, bold: true };
    } else if (status === "Qty Variance") {
      r.getCell(10).font = { color: { argb: "FFF59E0B" }, bold: true };
    } else if (status === "Match") {
      r.getCell(10).font = { color: { argb: "FF10B981" }, bold: true };
    }
  });

  // Save Workbook to target paths
  const outputPath1 = "C:\\Kapila_store\\Project_requirement\\Current stock report as on 24-08-26.xlsx";
  const outputPath2 = "C:\\Kapila_store\\backend\\exports\\Current stock report as on 24-08-26.xlsx";

  // Ensure directories exist
  fs.mkdirSync(path.dirname(outputPath1), { recursive: true });
  fs.mkdirSync(path.dirname(outputPath2), { recursive: true });

  await workbook.xlsx.writeFile(outputPath1);
  await workbook.xlsx.writeFile(outputPath2);

  console.log(`Successfully generated and saved Excel report:`);
  console.log(`  -> ${outputPath1}`);
  console.log(`  -> ${outputPath2}`);
  console.log(`Total items documented: ${stockRows.length}`);
  console.log(`Total Quantity: ${sumQty.toFixed(2)}`);
  console.log(`Total Inventory Value: ₹${sumTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

  process.exit(0);
}

generateInventoryExcel().catch(e => {
  console.error("Failed to generate Excel:", e);
  process.exit(1);
});
