const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const indentAutomationService = require("../services/indentAutomationService");
const fs = require("fs");

async function testService() {
  console.log("Testing indentAutomationService.getAutomationSummary()...");
  const summary = await indentAutomationService.getAutomationSummary();
  console.log("Summary Result:", JSON.stringify(summary, null, 2));

  console.log("\nTesting indentAutomationService.generateWorkbook()...");
  const startTime = Date.now();
  const wb = await indentAutomationService.generateWorkbook({}, { userName: "QA Test Agent" });
  const testOut = path.join(__dirname, "test_automated_service.xlsx");
  await wb.xlsx.writeFile(testOut);
  const dur = ((Date.now() - startTime) / 1000).toFixed(2);
  const sz = (fs.statSync(testOut).size / 1024).toFixed(1);
  console.log(`Workbook generated successfully in ${dur}s, size: ${sz} KB`);

  // Overwrite the primary output files so Desktop and project root get the dynamic version!
  const rootOut = "C:/Kapila_store/Automated_Indent_Pattern_and_Forecasting_Engine.xlsx";
  const desktopOut = "C:/Users/Dell/Desktop/Automated_Indent_Pattern_and_Forecasting_Engine.xlsx";
  const exportsOut = "C:/Kapila_store/backend/exports/Automated_Indent_Pattern_and_Forecasting_Engine.xlsx";

  await wb.xlsx.writeFile(rootOut);
  await wb.xlsx.writeFile(desktopOut);
  await wb.xlsx.writeFile(exportsOut);
  console.log("All 3 destination files refreshed with dynamic database data!");

  process.exit(0);
}

testService().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
