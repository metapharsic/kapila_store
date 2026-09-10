const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function main() {
  const templates = await db("indent_templates").select("template_name").count("id as count").groupBy("template_name");
  console.log("INDENT TEMPLATES BY TEMPLATE_NAME:\n", templates);

  const recipeCount = await db("recipes").count("id as c").first();
  console.log("\nRECIPES COUNT:", recipeCount);

  const issuanceCount = await db("issuances").count("id as c").first();
  console.log("ISSUANCES COUNT:", issuanceCount);

  const prodCount = await db("production").count("id as c").first();
  console.log("PRODUCTION COUNT:", prodCount);

  // Check indents export file
  const fs = require("fs");
  const exportFile = "C:/Kapila_store/backend/exports/indents_export_2026-07-21.xlsx";
  if (fs.existsSync(exportFile)) {
    const xlsx = require("xlsx");
    const wb = xlsx.readFile(exportFile);
    console.log("\nINDENTS EXPORT FILE SHEETS:", wb.SheetNames);
    const s = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(s, { header: 1 });
    console.log("INDENTS EXPORT SAMPLE ROWS:", rows.slice(0, 5));
    console.log("INDENTS EXPORT TOTAL ROWS:", rows.length);
  }

  // Check Indent_Template.xlsx
  const templateFile = "C:/Kapila_store/backend/exports/Indent_Template.xlsx";
  if (fs.existsSync(templateFile)) {
    const xlsx = require("xlsx");
    const wb = xlsx.readFile(templateFile);
    console.log("\nINDENT_TEMPLATE.XLSX SHEETS:", wb.SheetNames);
    for (const name of wb.SheetNames) {
      const s = wb.Sheets[name];
      const rows = xlsx.utils.sheet_to_json(s, { header: 1 });
      console.log(`Sheet "${name}" rows:`, rows.length, "Sample headers:", rows[0]);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
