/**
 * 055_add_warehouse_positioning_to_stock.js
 * Migration to add enterprise warehouse tracking fields to stock table:
 * - rack_location: Specific rack, shelf, or bin coordinate (e.g. "Rack A-02 / Shelf 3")
 * - storage_zone: Warehouse zone or room (e.g. "Main Dry Store - Grains & Oils", "Cold Chain / Chiller")
 * - invoice_no: Supplier invoice or bill reference number
 * - purchase_time: Exact timestamp of inward receipt or purchase entry
 */

exports.up = async function (knex) {
  const hasRack = await knex.schema.hasColumn("stock", "rack_location");
  if (!hasRack) {
    await knex.schema.alterTable("stock", (table) => {
      table.string("rack_location", 100).nullable().index();
      table.string("storage_zone", 100).nullable().index();
      table.string("invoice_no", 100).nullable();
      table.timestamp("purchase_time", { useTz: true }).defaultTo(knex.fn.now());
    });
  }

  // Intelligently assign storage zones and rack coordinates based on item categories
  const categoryZoneMap = {
    "Rice": { zone: "Main Dry Store - Heavy Grains & Rice", rackPrefix: "Rack A" },
    "Flour": { zone: "Main Dry Store - Heavy Grains & Flour", rackPrefix: "Rack A" },
    "Dals": { zone: "Main Dry Store - Pulses & Lentils", rackPrefix: "Rack A" },
    "Oils": { zone: "Main Dry Store - Edible Oils & Ghee", rackPrefix: "Rack B" },
    "Spices": { zone: "Main Dry Store - Spices & Seasonings", rackPrefix: "Rack B" },
    "Dry Friuts": { zone: "Main Dry Store - Nuts & Dry Fruits", rackPrefix: "Rack B" },
    "Sauces": { zone: "Main Dry Store - Condiments & Sauces", rackPrefix: "Rack C" },
    "Bakery": { zone: "Main Dry Store - Bakery & Essences", rackPrefix: "Rack C" },
    "Dairy": { zone: "Cold Chain - Walk-in Dairy Chiller", rackPrefix: "Chiller Bay" },
    "Frozen": { zone: "Cold Chain - Deep Freeze (-18°C)", rackPrefix: "Freezer Unit" },
    "Meat": { zone: "Cold Chain - Meat & Poultry Chiller", rackPrefix: "Cold Storage" },
    "Ice Cream": { zone: "Cold Chain - Ice Cream Deep Freezer", rackPrefix: "Freezer Unit" },
    "Vegetables": { zone: "Fresh Produce - Daily Vegetable Bay", rackPrefix: "Produce Rack" },
    "Fruits": { zone: "Fresh Produce - Daily Fruit Bay", rackPrefix: "Produce Rack" },
    "Beverages": { zone: "Beverage Cellar & Soft Drink Store", rackPrefix: "Rack D" },
    "Syrup": { zone: "Beverage Cellar - Syrups & Mixers", rackPrefix: "Rack D" },
    "Disposal": { zone: "Packaging & Non-Food Bay", rackPrefix: "Rack E" },
    "Linen": { zone: "Housekeeping & Linen Store", rackPrefix: "Rack E" },
    "Chemicals": { zone: "Hazardous & Cleaning Store", rackPrefix: "Secure Bay F" },
    "Fuel": { zone: "Utilities & Fuel Safety Bay", rackPrefix: "Safety Bay G" },
    "General": { zone: "General Store & Provisions", rackPrefix: "Rack G" },
  };

  const allItems = await knex("stock").select("id", "category", "supplier", "created_at", "date").orderBy("id", "asc");

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const cat = (item.category || "General").trim();
    const config = categoryZoneMap[cat] || { zone: "General Store & Provisions", rackPrefix: "Rack G" };
    
    // Distribute across shelves 1 to 4 and rack numbers 1 to 3
    const rackNumber = (i % 4) + 1;
    const shelfNumber = ((i >> 2) % 3) + 1;
    const rackLocation = `${config.rackPrefix}-${String(rackNumber).padStart(2, "0")} / Shelf ${shelfNumber}`;
    
    // Generate logical invoice reference
    const invoiceNo = item.supplier ? `INV-${(item.supplier.slice(0, 3)).toUpperCase()}-${202600 + (item.id % 900)}` : `INV-GEN-${1000 + (item.id % 500)}`;
    
    const purchaseTimestamp = item.created_at || (item.date ? new Date(item.date).toISOString() : new Date().toISOString());

    await knex("stock")
      .where("id", item.id)
      .update({
        storage_zone: config.zone,
        rack_location: rackLocation,
        invoice_no: invoiceNo,
        purchase_time: purchaseTimestamp,
      });
  }
};

exports.down = async function (knex) {
  const hasRack = await knex.schema.hasColumn("stock", "rack_location");
  if (hasRack) {
    await knex.schema.alterTable("stock", (table) => {
      table.dropColumn("rack_location");
      table.dropColumn("storage_zone");
      table.dropColumn("invoice_no");
      table.dropColumn("purchase_time");
    });
  }
};
