const xlsx = require("xlsx");

function verifyGeneratedExcel() {
  const filePath = "C:\\Kapila_store\\Project_requirement\\Current stock report as on 24-08-26.xlsx";
  const wb = xlsx.readFile(filePath);
  console.log("Workbook Sheets:", wb.SheetNames);

  const sheet1 = wb.Sheets["Current Stock Report"];
  const rows1 = xlsx.utils.sheet_to_json(sheet1, { header: 1 });
  console.log("Sheet 1 Header Row:", rows1[0]);
  console.log("Sheet 1 First 3 Data Rows:", rows1.slice(1, 4));
  console.log("Sheet 1 Last Row (Totals):", rows1[rows1.length - 1]);
  console.log(`Sheet 1 Total Rows: ${rows1.length}`);

  const sheet2 = wb.Sheets["Reconciliation vs Aug 21 Sheet"];
  const rows2 = xlsx.utils.sheet_to_json(sheet2, { header: 1 });
  console.log("Sheet 2 Header Row:", rows2[0]);
  console.log(`Sheet 2 Total Comparison Rows: ${rows2.length}`);

  process.exit(0);
}

verifyGeneratedExcel();
