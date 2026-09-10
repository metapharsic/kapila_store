const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function main() {
  const recipeCols = await db("recipes").columnInfo();
  console.log("RECIPE COLUMNS:", Object.keys(recipeCols));

  const sampleRecipes = await db("recipes").select("*").limit(5);
  console.log("SAMPLE RECIPES:", sampleRecipes);

  const recipeItemCols = await db("recipe_items").columnInfo();
  console.log("RECIPE_ITEM COLUMNS:", Object.keys(recipeItemCols));

  const sampleItems = await db("recipe_items").select("*").limit(5);
  console.log("SAMPLE RECIPE ITEMS:", sampleItems);

  // Check recipes per department / category
  const recipesByDept = await db("recipes").select("department").count("id as count").groupBy("department");
  console.log("\nRECIPES BY DEPARTMENT:\n", recipesByDept);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
