exports.up = async function (knex) {
  await knex.schema.createTable("indent_templates", (t) => {
    t.increments("id").primary();
    t.string("template_name").notNullable();     // e.g. "SOUTH INDIAN"
    t.integer("row_no").notNullable();            // fixed row position on the printed sheet
    t.string("item_name").notNullable();          // canonical printed name
    t.string("item_code");                        // linked stock item_code, nullable if unmatched
    t.string("default_unit").notNullable();       // printed unit column, trusted over OCR guess
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.unique(["template_name", "row_no"]);
  });

  const rows = [
    ["Aromatic Powder", "Kg"], ["Atta", "Kg"], ["Atukulu", "Kg"], ["Baby Corn", "Kg"],
    ["Badam", "Kg"], ["Baking Powder", "PCS"], ["Banana", "DOZEN"], ["Bedsheet", "NO'S"],
    ["Bharath Gas", "NO'S"], ["Biryani Leaf", "Kg"], ["Biryani Rice", "Kg"],
    ["Bis Coffe Biscuits", "Pkts"], ["Bis Coffe Paste", "BOTTLE"], ["Black Grapes", "Kg"],
    ["Black Olives", "BOTTLE"], ["Black Pepper", "Kg"], ["Black Salt", "KG"],
    ["Black Urad Dal", "KG"], ["Blue Lagoon", "bottle"], ["Bobberlu", "Kg"],
    ["Boiled Rice", "KG"], ["Boost", "PKT"], ["Bournvita", "Kg"],
    ["Box Container 1000 Ml", "No's"], ["Chicken Small", "Kg"], ["Chicken Staff", "Kg"],
    ["Chilly Flakes Kg", "Kg"], ["Chilly Flakes Sachets", "pkt"], ["Chilly Powder", "Kg"],
    ["Chinese Container 1000ml", "No's"], ["Chinese Container 500ml", "No's"],
    ["Chinese Container 750ml", "No's"], ["Chocolate Ice Cream", "BULK"],
    ["Chocolate Sauce", "bottle"], ["Dosa Rice", "Kg"], ["Dr Ravva", "Kg"],
    ["Dry Coconut", "Kg"], ["Dry Yeast", "PKT"], ["Dust Bin Covers", "PKT"],
    ["Dust Pan", "NOS"], ["Eating Soda", "Kg"], ["Eggs", "NOS"], ["Elaichi", "Kg"],
    ["Faluda Glass", "PKT"], ["Fish", "Kg"], ["Floor Cleaner", "Ltr."], ["French Fries", "pkt"],
  ].map(([name, unit], i) => ({
    template_name: "SOUTH INDIAN",
    row_no: i + 1,
    item_name: name,
    default_unit: unit,
  }));

  await knex("indent_templates").insert(rows);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("indent_templates");
};
