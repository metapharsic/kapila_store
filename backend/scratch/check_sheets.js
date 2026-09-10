const xlsx = require("xlsx");

const files = [
  "C:/Kapila_store/Project_requirement/Current stock report as on 21-08-26.xlsx",
  "C:/Kapila_store/Project_requirement/Current stock report as on 24-08-26.xlsx",
  "C:/Kapila_store/Documentation/Current stock with price.xlsx"
];

for (const f of files) {
  try {
    const wb = xlsx.readFile(f);
    console.log("\n==========================================");
    console.log("FILE:", f);
    console.log("SHEETS:", wb.SheetNames);
    const s = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(s, { header: 1 });
    console.log("ROW COUNT:", rows.length);
    console.log("SAMPLE ROWS:\n", JSON.stringify(rows.slice(0, 7), null, 2));
  } catch (e) {
    console.log("ERR:", f, e.message);
  }
}
