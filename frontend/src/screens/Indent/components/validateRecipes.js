const { recipes } = require("../../api");

export async function validateRecipes() {
  const res = await recipes.list();
  if (!res.success) throw new Error("Failed to load recipes");
  
  const allRecipes = res.data;
  let invalid = 0;
  
  for (const r of allRecipes) {
    if (!r.items || r.items.length === 0) {
      console.warn(`[Validation Failed] Recipe ${r.name} (ID: ${r.id}) has NO items!`);
      invalid++;
    }
  }
  
  if (invalid > 0) {
    console.error(`Total invalid recipes: ${invalid}`);
    return false;
  }
  
  console.log("All recipes are valid and have items.");
  return true;
}
