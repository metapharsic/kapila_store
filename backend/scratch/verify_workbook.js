const ExcelJS = require("exceljs");

async function verify() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("C:/Kapila_store/backend/exports/Automated_Indent_Pattern_and_Forecasting_Engine.xlsx");
  console.log("SHEETS IN GENERATED WORKBOOK:");
  wb.worksheets.forEach((ws, i) => {
    console.log(`  Sheet ${i + 1}: "${ws.name}" (Rows: ${ws.rowCount}, Columns: ${ws.columnCount})`);
  });

  // Verify sheet 3 sample row
  const wsItems = wb.getWorksheet("Item-by-Item Indent Engine");
  console.log("\nSample Row 5 (Item-by-Item):");
  const r5 = wsItems.getRow(5);
  console.log({
    code: r5.getCell(1).value,
    name: r5.getCell(2).value,
    cat: r5.getCell(3).value,
    unit: r5.getCell(4).value,
    stock: r5.getCell(6).value,
    dept: r5.getCell(7).value,
    baseDaily: r5.getCell(8).value,
    monFormula: r5.getCell(9).value,
    statusFormula: r5.getCell(19).value,
    indentQtyFormula: r5.getCell(20).value,
  });

  // Verify sheet 5 sample row
  const wsSim = wb.getWorksheet("Auto-Indent Simulator");
  console.log("\nSimulator Parameters:");
  console.log("C5 (Dept):", wsSim.getCell("C5").value);
  console.log("C6 (Day):", wsSim.getCell("C6").value);
  console.log("C7 (Surge Multiplier):", wsSim.getCell("C7").value);
  console.log("Sample Simulator Row 11:");
  const sim11 = wsSim.getRow(11);
  console.log({
    name: sim11.getCell(2).value,
    stock: sim11.getCell(5).value,
    burnFormula: sim11.getCell(6).value,
    indentFormula: sim11.getCell(7).value,
  });

  process.exit(0);
}

verify().catch(console.error);
