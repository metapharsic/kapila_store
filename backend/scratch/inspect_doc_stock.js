const xlsx = require("xlsx");
const path = require("path");

const fDoc = "C:/Kapila_store/Documentation/Current stock with price.xlsx";
const wb = xlsx.readFile(fDoc);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log("Headers:", rows[3]);
console.log("Sample rows 4-8:", rows.slice(4, 9));
console.log("Total items:", rows.slice(4).filter(r => r && r[1]).length);
