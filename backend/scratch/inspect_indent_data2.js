const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function main() {
  const depts = await db("indents").distinct("dept").select();
  console.log("DISTINCT DEPTS IN INDENTS:", depts.map(d => d.dept));

  const indentsPerDept = await db("indents").select("dept").count("id as count").groupBy("dept");
  console.log("\nINDENTS PER DEPT:", indentsPerDept);

  const indentsPerDate = await db("indents").select(db.raw("date::date as dt")).count("id as count").groupByRaw("date::date").orderBy("dt", "desc");
  console.log("\nINDENTS PER DATE:", indentsPerDate);

  // Check indent templates
  const templateCount = await db("indent_templates").count("id as c").first().catch(e => ({ c: e.message }));
  console.log("\nINDENT TEMPLATES COUNT:", templateCount);
  if (templateCount.c > 0) {
    const sampleTemplates = await db("indent_templates").select("*").limit(5);
    console.log("SAMPLE TEMPLATES:", sampleTemplates);
    const templateDepts = await db("indent_templates").distinct("dept").select();
    console.log("TEMPLATE DEPTS:", templateDepts.map(t => t.dept));
  }

  // Check recipes
  const recipeCount = await db("recipes").count("id as c").first().catch(e => ({ c: e.message }));
  console.log("\nRECIPES COUNT:", recipeCount);
  if (recipeCount.c > 0) {
    const sampleRecipes = await db("recipes").select("*").limit(5);
    console.log("SAMPLE RECIPES:", sampleRecipes);
  }

  // Check issuances
  const issuanceCount = await db("issuances").count("id as c").first().catch(e => ({ c: e.message }));
  console.log("\nISSUANCES COUNT:", issuanceCount);

  // Check production
  const prodCount = await db("production").count("id as c").first().catch(e => ({ c: e.message }));
  console.log("\nPRODUCTION COUNT:", prodCount);

  // Check exports directory for existing indent export files
  const exportFile = "C:/Kapila_store/backend/exports/indents_export_2026-07-21.xlsx";
  const fs = require("fs");
  if (fs.existsSync(exportFile)) {
    const xlsx = require("xlsx");
    const wb = xlsx.readFile(exportFile);
    console.log("\nINDENTS EXPORT FILE SHEETS:", wb.SheetNames);
    const s = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(s, { header: 1 });
    console.log("INDENTS EXPORT SAMPLE ROWS:", rows.slice(0, 5));
    console.log("INDENTS EXPORT TOTAL ROWS:", rows.length);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
