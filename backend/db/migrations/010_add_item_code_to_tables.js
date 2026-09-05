exports.up = async (knex) => {
  // 1. Add column as nullable initially to allow schema creation
  await knex.schema.alterTable("stock", (t) => {
    t.string("item_code", 20).nullable();
  });
  await knex.schema.alterTable("indent_items", (t) => {
    t.string("item_code", 20).nullable();
  });
  await knex.schema.alterTable("issuance_items", (t) => {
    t.string("item_code", 20).nullable();
  });

  // 2. Fetch distinct item names to generate sequential codes
  const stockItems = await knex("stock").distinct("name");
  const indentItems = await knex("indent_items").distinct("name");
  const issuanceItems = await knex("issuance_items").distinct("name");
  
  const allNames = Array.from(new Set([
    ...stockItems.map(s => s.name.trim()),
    ...indentItems.map(i => i.name.trim()),
    ...issuanceItems.map(is => is.name.trim())
  ])).filter(Boolean);

  // 3. Map names to sequential codes starting at KPL-101
  const nameToCode = {};
  allNames.forEach((name, index) => {
    const codeNum = 101 + index;
    nameToCode[name.toLowerCase()] = `KPL-${codeNum}`;
  });

  // 4. Update existing rows in stock, indent_items, issuance_items
  for (const name of allNames) {
    const code = nameToCode[name.toLowerCase()];
    await knex("stock").whereRaw("LOWER(name) = LOWER(?)", [name]).update({ item_code: code });
    await knex("indent_items").whereRaw("LOWER(name) = LOWER(?)", [name]).update({ item_code: code });
    await knex("issuance_items").whereRaw("LOWER(name) = LOWER(?)", [name]).update({ item_code: code });
  }

  // 5. Default/backfill any remaining nulls to KPL-999, then alter column to be not nullable
  await knex("stock").whereNull("item_code").update({ item_code: "KPL-999" });
  await knex("indent_items").whereNull("item_code").update({ item_code: "KPL-999" });
  await knex("issuance_items").whereNull("item_code").update({ item_code: "KPL-999" });

  await knex.schema.alterTable("stock", (t) => {
    t.string("item_code", 20).notNullable().alter();
  });
  await knex.schema.alterTable("indent_items", (t) => {
    t.string("item_code", 20).notNullable().alter();
  });
  await knex.schema.alterTable("issuance_items", (t) => {
    t.string("item_code", 20).notNullable().alter();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable("stock", (t) => {
    t.dropColumn("item_code");
  });
  await knex.schema.alterTable("indent_items", (t) => {
    t.dropColumn("item_code");
  });
  await knex.schema.alterTable("issuance_items", (t) => {
    t.dropColumn("item_code");
  });
};
