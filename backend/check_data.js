const knex = require("knex")(require("./knexfile").development);

async function checkData() {
  try {
    const stockCount = await knex("stock").count("id as count").first();
    const poCount = await knex("purchase_orders").count("id as count").first();
    const supplierCount = await knex("suppliers").count("id as count").first();
    const indentCount = await knex("indents").count("id as count").first();
    
    console.log("--- Database Overview ---");
    console.log("Stock Items:", stockCount.count);
    console.log("Suppliers:", supplierCount.count);
    console.log("Purchase Orders:", poCount.count);
    console.log("Indents:", indentCount.count);

    if (poCount.count > 0) {
      const pos = await knex("purchase_orders").limit(3);
      console.log("\nSample POs:", pos);
    }

    if (supplierCount.count > 0) {
      const suppliers = await knex("suppliers").limit(3);
      console.log("\nSample Suppliers:", suppliers.map(s => s.name));
    }

    // Check if stock has 15 days of data
    // Assuming 15 days is represented by some metric or just quantities being high enough.
    // Or check GRNs
    const grnCount = await knex("grns").count("id as count").first();
    console.log("GRNs (Goods Received Notes):", grnCount.count);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await knex.destroy();
  }
}

checkData();
