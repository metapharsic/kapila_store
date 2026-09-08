/**
 * generate_indent_template.js
 *
 * Produces a BLANK, printable Indent Request Template that a chef can
 * hand-fill (on paper, or in Excel) and hand to the Store Manager, outside
 * the live app UI.
 *
 * Sheet 1 "Indent Template": header fields (Department / Chef Name / Date /
 * Indent No) + a bordered blank table with 40 rows: Item Code | Item Name |
 * Unit | Requested Qty | Remarks.
 *
 * Sheet 2 "Item Reference List": the real item_code / name / unit for every
 * item currently in the `stock` table, so the chef can look up valid codes
 * instead of guessing.
 *
 * Sheet 3 "Departments": the fixed department list + code + chef name, for
 * reference when filling the "Department" field.
 *
 * Column names match the real schema (backend/db/migrations):
 *   indents:      dept, date, status, indent_type
 *   indent_items: name, qty, unit, item_code
 *   stock:        item_code, name, unit
 *   departments:  name, code, chef_name
 *
 * Usage: node backend/scripts/generate_indent_template.js
 */

const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");
const db = require("../db");

// Same palette/border used by services/inventoryReportService.js, kept in
// sync manually since that module's constants aren't exported.
const PALETTE = {
  headerBg: "1E293B",
  headerText: "FFFFFF",
  subHeaderBg: "334155",
  accentGold: "D97706",
  accentGoldLight: "FEF3C7",
  borderLight: "CBD5E1",
  borderDark: "64748B",
  zebraBg: "F8FAFC",
};

const BORDER_BOX = {
  top: { style: "thin", color: { argb: PALETTE.borderLight } },
  left: { style: "thin", color: { argb: PALETTE.borderLight } },
  bottom: { style: "thin", color: { argb: PALETTE.borderLight } },
  right: { style: "thin", color: { argb: PALETTE.borderLight } },
};

const BLANK_ROWS = 40;

async function buildTemplateSheet(workbook) {
  const ws = workbook.addWorksheet("Indent Template", {
    properties: { tabColor: { argb: PALETTE.accentGold } },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { width: 14 }, // Item Code
    { width: 34 }, // Item Name
    { width: 10 }, // Unit
    { width: 16 }, // Requested Qty
    { width: 30 }, // Remarks
  ];

  // Title
  ws.mergeCells("A1:E1");
  const title = ws.getCell("A1");
  title.value = "HOTEL KAPILA - INDENT REQUEST FORM";
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: PALETTE.headerText } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  ws.mergeCells("A2:E2");
  const sub = ws.getCell("A2");
  sub.value = "Fill in by hand or in Excel, then hand to the Store Manager.";
  sub.font = { name: "Calibri", size: 10, italic: true, color: { argb: PALETTE.headerText } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.subHeaderBg } };
  sub.alignment = { horizontal: "center", vertical: "middle" };

  // Header fields block (rows 4-5)
  const labelStyle = (cell, text) => {
    cell.value = text;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: PALETTE.borderDark } };
    cell.alignment = { vertical: "middle" };
  };
  const fillLine = (cell) => {
    cell.border = { bottom: { style: "thin", color: { argb: PALETTE.borderDark } } };
  };

  labelStyle(ws.getCell("A4"), "Department:");
  ws.mergeCells("B4:C4");
  fillLine(ws.getCell("B4"));
  labelStyle(ws.getCell("D4"), "Indent No:");
  fillLine(ws.getCell("E4"));

  labelStyle(ws.getCell("A5"), "Chef Name:");
  ws.mergeCells("B5:C5");
  fillLine(ws.getCell("B5"));
  labelStyle(ws.getCell("D5"), "Date:");
  fillLine(ws.getCell("E5"));

  ws.getRow(4).height = 20;
  ws.getRow(5).height = 20;

  // Table header (row 7)
  const headerRow = ws.getRow(7);
  const headers = ["Item Code", "Item Name", "Unit", "Requested Qty", "Remarks"];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.headerText } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: PALETTE.borderDark } },
      bottom: { style: "medium", color: { argb: PALETTE.accentGold } },
      left: { style: "thin", color: { argb: PALETTE.borderDark } },
      right: { style: "thin", color: { argb: PALETTE.borderDark } },
    };
  });
  headerRow.height = 20;

  // Blank bordered data rows
  const firstDataRow = 8;
  for (let i = 0; i < BLANK_ROWS; i++) {
    const row = ws.getRow(firstDataRow + i);
    for (let col = 1; col <= 5; col++) {
      const cell = row.getCell(col);
      cell.border = BORDER_BOX;
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraBg } };
      }
      cell.alignment = { vertical: "middle", horizontal: col === 4 ? "right" : "left" };
    }
    row.height = 18;
  }

  ws.views = [{ state: "frozen", ySplit: 7 }];
  ws.pageSetup.printArea = `A1:E${firstDataRow + BLANK_ROWS}`;

  return ws;
}

async function buildItemReferenceSheet(workbook) {
  const ws = workbook.addWorksheet("Item Reference List", {
    properties: { tabColor: { argb: PALETTE.borderDark } },
  });

  ws.columns = [
    { header: "Item Code", key: "item_code", width: 14 },
    { header: "Item Name", key: "name", width: 36 },
    { header: "Unit", key: "unit", width: 10 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.headerText } };
    cell.border = {
      top: { style: "thin", color: { argb: PALETTE.borderDark } },
      bottom: { style: "medium", color: { argb: PALETTE.accentGold } },
      left: { style: "thin", color: { argb: PALETTE.borderDark } },
      right: { style: "thin", color: { argb: PALETTE.borderDark } },
    };
  });
  headerRow.height = 20;

  // Distinct, real item_code/name/unit currently in the stock master.
  const items = await db("stock")
    .distinct("item_code", "name", "unit")
    .orderBy("name", "asc");

  items.forEach((item, idx) => {
    const row = ws.addRow({
      item_code: item.item_code,
      name: item.name,
      unit: item.unit,
    });
    row.eachCell((cell) => {
      cell.border = BORDER_BOX;
      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraBg } };
      }
    });
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

async function buildDepartmentsSheet(workbook) {
  const ws = workbook.addWorksheet("Departments", {
    properties: { tabColor: { argb: PALETTE.borderDark } },
  });

  ws.columns = [
    { header: "Department", key: "name", width: 28 },
    { header: "Code", key: "code", width: 10 },
    { header: "Chef / In-charge", key: "chef_name", width: 24 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerBg } };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: PALETTE.headerText } };
    cell.border = {
      top: { style: "thin", color: { argb: PALETTE.borderDark } },
      bottom: { style: "medium", color: { argb: PALETTE.accentGold } },
      left: { style: "thin", color: { argb: PALETTE.borderDark } },
      right: { style: "thin", color: { argb: PALETTE.borderDark } },
    };
  });
  headerRow.height = 20;

  let departments = [];
  try {
    departments = await db("departments").select("name", "code", "chef_name").orderBy("name", "asc");
  } catch (e) {
    // departments table may not exist in some environments; fall back silently
    departments = [];
  }

  departments.forEach((dept, idx) => {
    const row = ws.addRow(dept);
    row.eachCell((cell) => {
      cell.border = BORDER_BOX;
      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraBg } };
      }
    });
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

async function main() {
  console.log("Generating blank Indent Request Template...");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hotel Kapila Inventory System";
  workbook.created = new Date();

  await buildTemplateSheet(workbook);
  await buildItemReferenceSheet(workbook);
  await buildDepartmentsSheet(workbook);

  const exportsDir = path.join(__dirname, "../exports");
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const outPath = path.join(exportsDir, "Indent_Template.xlsx");
  await workbook.xlsx.writeFile(outPath);

  console.log(`Indent template written to: ${outPath}`);

  await db.destroy();
}

main().catch(async (err) => {
  console.error("Failed to generate indent template:", err);
  try {
    await db.destroy();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
