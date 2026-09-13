const fs = require("fs");
const path = require("path");

exports.up = async function (knex) {
  // 1. Create indent_subcategories table
  const hasSubcatTable = await knex.schema.hasTable("indent_subcategories");
  if (!hasSubcatTable) {
    await knex.schema.createTable("indent_subcategories", (t) => {
      t.increments("id").primary();
      t.string("code", 50).notNullable().unique();
      t.string("name", 100).notNullable();
      t.string("department_name", 100).notNullable();
      t.text("description");
      t.string("icon", 30).defaultTo("📦");
      t.boolean("is_active").defaultTo(true);
      t.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  // 2. Create indent_subcategory_items table
  const hasSubcatItemsTable = await knex.schema.hasTable("indent_subcategory_items");
  if (!hasSubcatItemsTable) {
    await knex.schema.createTable("indent_subcategory_items", (t) => {
      t.increments("id").primary();
      t.integer("subcategory_id").references("id").inTable("indent_subcategories").onDelete("CASCADE");
      t.string("item_name", 150).notNullable();
      t.string("sku", 50);
      t.string("unit", 30).defaultTo("KG");
      t.string("standard_pack_size", 100);
      t.decimal("default_cost", 10, 2).defaultTo(0);
      t.decimal("default_qty", 10, 2).defaultTo(1);
      t.decimal("min_order_qty", 10, 2).defaultTo(0.5);
      t.decimal("max_order_qty", 10, 2).defaultTo(500);
      t.text("notes");
      t.integer("sort_order").defaultTo(0);
      t.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  // Ensure stock item_code can accommodate up to 50 chars
  try {
    await knex.schema.alterTable("stock", (t) => {
      t.string("item_code", 50).alter();
    });
  } catch {}

  // 3. Subcategories definition mapping to Hotel Kapila's 9 canonical departments
  const SUBCATEGORIES_SEED = [
    // TIFFINS
    {
      code: "SUB-SOUTHTIFFIN",
      name: "South indian Tiffines",
      department_name: "TIFFINS",
      icon: "🥞",
      description: "Idli rava, urad gota, poha, upma rava, toor dal, curry leaves, mustard seeds, and fresh coconut.",
    },
    {
      code: "SUB-BATTER",
      name: "Dosa Batter",
      department_name: "TIFFINS",
      icon: "🥣",
      description: "Pre-fermented stone-ground Idli-Dosa batter, Ragi multigrain batter, and Pesarattu batter.",
    },
    {
      code: "SUB-DOSA",
      name: "Dosa",
      department_name: "CHINESE & DOSA",
      icon: "🫓",
      description: "Parboiled dosa rice, methi seeds, chana dal, pure ghee, sesame oil, and gun powder / podi.",
    },
    // SI-MEALS
    {
      code: "SUB-SOUTHMEALS",
      name: "Sount indian meals.",
      department_name: "SI-MEALS",
      icon: "🍛",
      description: "Sona Masoori raw rice, traditional sambar masala, rasam spices, tamarind, drumsticks, and appalams.",
    },
    // NORTH INDIAN & STAFF
    {
      code: "SUB-VEGETABLES",
      name: "Vegetables",
      department_name: "NORTH INDIAN",
      icon: "🥕",
      description: "Daily fresh kitchen produce: Nashik onions, hybrid tomatoes, table potatoes, ginger, and garlic.",
    },
    {
      code: "SUB-COOKIES",
      name: "Cookies",
      department_name: "STAFF",
      icon: "🍪",
      description: "Bakery shortbread cookies, cashew butter cookies, choco-chip dough, oatmeal biscuits, and butter.",
    },
    // CHAT & SOFTY
    {
      code: "SUB-STALL",
      name: "Stall",
      department_name: "CHAT & SOFTY",
      icon: "🍢",
      description: "Live chaat stall puri, papdi, sev, sweet date-tamarind chutney, spicy mint pani, and boiled sprouts.",
    },
    {
      code: "SUB-SOFTY",
      name: "Softy ice cream",
      department_name: "CHAT & SOFTY",
      icon: "🍦",
      description: "Commercial softy ice cream liquid premix (vanilla & chocolate), waffle cones, and dessert toppings.",
    },
    {
      code: "SUB-DISPOSABLE",
      name: "disposable",
      department_name: "CHAT & SOFTY",
      icon: "🥡",
      description: "Food grade hot beverage paper cups, birchwood spoons, garbage bags, and dinner paper napkins.",
    },
    {
      code: "SUB-JALPAN",
      name: "disposable jalpan",
      department_name: "CHAT & SOFTY",
      icon: "🍱",
      description: "3-compartment partitioned jalpan plates, foil snack containers, butter paper rolls, and cling wraps.",
    },
    // CHINESE & DOSA
    {
      code: "SUB-CHINESE",
      name: "Chinese",
      department_name: "CHINESE & DOSA",
      icon: "🍜",
      description: "Hakka noodles, szechuan paste, dark soy sauce, white vinegar, spring onions, capsicum, and corn starch.",
    },
    // MOCKTAILS & CONTINENTAL
    {
      code: "SUB-CONTINENTAL",
      name: "continental",
      department_name: "MOCKTAILS & CONTINENTAL",
      icon: "🍝",
      description: "Durum wheat penne, spaghetti, extra virgin olive oil, canned pelati tomatoes, parmesan, and basil.",
    },
    {
      code: "SUB-MOCKTAIL",
      name: "Mocktails & Ice cream",
      department_name: "MOCKTAILS & CONTINENTAL",
      icon: "🍹",
      description: "Cocktail syrups (Blue Curacao, Mojito, Grenadine), purees, soda, and bulk ice cream tubs.",
    },
    {
      code: "SUB-TEA",
      name: "tea",
      department_name: "MOCKTAILS & CONTINENTAL",
      icon: "☕",
      description: "Specialty CTC tea dust, whole Assam leaf, green tea, cardamom, fresh ginger, and tea brewing supplies.",
    },
    {
      code: "SUB-JUICE",
      name: "juice",
      department_name: "MOCKTAILS & CONTINENTAL",
      icon: "🧃",
      description: "Fresh farm juicing fruits (Valencia orange, mosambi, pineapple, watermelon), rock salt, and mint.",
    },
    // ROOM SERVICE
    {
      code: "SUB-ROOMSERVICE",
      name: "Room Services",
      department_name: "ROOM SERVICE",
      icon: "🛎️",
      description: "In-room dining tea-coffee sachets, butter chiplets, mini jams, bottled water, and presentation amenities.",
    },
  ];

  // Insert or update subcategories
  for (const sc of SUBCATEGORIES_SEED) {
    const existing = await knex("indent_subcategories").where("code", sc.code).first();
    if (existing) {
      await knex("indent_subcategories").where("code", sc.code).update(sc);
    } else {
      await knex("indent_subcategories").insert(sc);
    }
  }

  // Load exported items & templates from trend_mr_indents_export.json
  const exportPath = path.join(__dirname, "../../scratch/trend_mr_indents_export.json");
  if (fs.existsSync(exportPath)) {
    try {
      const dump = JSON.parse(fs.readFileSync(exportPath, "utf8"));
      const categoryMap = new Map();
      const subcatsInDb = await knex("indent_subcategories").select("id", "code");
      subcatsInDb.forEach((s) => categoryMap.set(s.code, s.id));

      const oldCatToCode = new Map();
      if (dump.categories) {
        dump.categories.forEach((c) => {
          oldCatToCode.set(c.id, c.code);
        });
      }

      // Populate items into indent_subcategory_items and stock
      if (dump.items && dump.items.length > 0) {
        for (let i = 0; i < dump.items.length; i++) {
          const it = dump.items[i];
          const subcatCode = oldCatToCode.get(it.categoryId) || it.categoryId;
          const subcatId = categoryMap.get(subcatCode);

          if (subcatId) {
            const existingItem = await knex("indent_subcategory_items")
              .where({ subcategory_id: subcatId, item_name: it.name })
              .first();

            const itemData = {
              subcategory_id: subcatId,
              item_name: it.name,
              sku: it.sku || `SKU-${i + 1}`,
              unit: (it.unit || "KG").toUpperCase(),
              standard_pack_size: it.standardPackSize || null,
              default_cost: parseFloat(it.defaultCost) || 0,
              default_qty: 1,
              min_order_qty: parseFloat(it.minOrderQty) || 1,
              max_order_qty: parseFloat(it.maxOrderQty) || 500,
              notes: it.notes || null,
              sort_order: i + 1,
            };

            if (existingItem) {
              await knex("indent_subcategory_items").where("id", existingItem.id).update(itemData);
            } else {
              await knex("indent_subcategory_items").insert(itemData);
            }
          }

          // Also ensure item exists in central `stock` table
          const existingStock = await knex("stock")
            .whereRaw("LOWER(name) = LOWER(?)", [it.name.trim()])
            .first();

          const numPackSize = parseFloat(it.standardPackSize) || 1;
          const stockQty = parseFloat(it.currentStock) || 50;
          if (!existingStock) {
            await knex("stock").insert({
              name: it.name.trim(),
              item_code: (it.sku || `SKU-${i + 1}`).slice(0, 50),
              qty: stockQty,
              remaining: stockQty,
              date: knex.fn.now(),
              category: it.unit === "LITRE" ? "Beverages" : "Groceries",
              unit: (it.unit || "kg").toLowerCase(),
              price: parseFloat(it.defaultCost) || 0,
              pack_size: numPackSize,
              min_alert_qty: parseFloat(it.minOrderQty) || 5,
            });
          } else {
            // Update pack_size & item_code if missing
            const updateFields = {};
            if (!existingStock.pack_size) updateFields.pack_size = numPackSize;
            if (!existingStock.item_code && it.sku) updateFields.item_code = it.sku.slice(0, 50);
            if (Object.keys(updateFields).length > 0) {
              await knex("stock").where("id", existingStock.id).update(updateFields);
            }
          }
        }
      }

      // Link items into indent_templates if not already present
      if (dump.templates && dump.templates.length > 0) {
        for (const tmpl of dump.templates) {
          const subcatCode = oldCatToCode.get(tmpl.categoryId);
          const subcat = SUBCATEGORIES_SEED.find((s) => s.code === subcatCode);
          const deptName = subcat ? subcat.department_name : "TIFFINS";

          if (tmpl.items && tmpl.items.length > 0) {
            for (let idx = 0; idx < tmpl.items.length; idx++) {
              const ti = tmpl.items[idx];
              const itemName = ti.item ? ti.item.name : ti.notes || "Item";
              const existingRow = await knex("indent_templates")
                .where({ template_name: deptName, item_name: itemName })
                .first();

              if (!existingRow) {
                // Find next row_no
                const maxRow = await knex("indent_templates")
                  .where("template_name", deptName)
                  .max("row_no as max_row")
                  .first();
                const nextRowNo = (maxRow?.max_row || 0) + 1;

                await knex("indent_templates").insert({
                  template_name: deptName,
                  row_no: nextRowNo,
                  item_name: itemName,
                  item_code: ti.item?.sku || null,
                  default_unit: (ti.unit || "Kg").toLowerCase(),
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[Migration 065] Data load warning:", err.message);
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("indent_subcategory_items");
  await knex.schema.dropTableIfExists("indent_subcategories");
};
