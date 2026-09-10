/**
 * 060_create_food_safety_and_waste.js
 * Migration for Food Safety HACCP Inspections, Kitchen Food Waste Accounting,
 * and FSSAI RUCO (Repurpose Used Cooking Oil) Statutory Compliance.
 * Adapted from MK Paper Mill ERP quality & scrap modules into Hotel Kapila.
 */

exports.up = async function (knex) {
  // 1. Create food_quality_inspections
  const hasInspections = await knex.schema.hasTable("food_quality_inspections");
  if (!hasInspections) {
    await knex.schema.createTable("food_quality_inspections", (table) => {
      table.bigIncrements("id").primary();
      table.date("inspection_date").notNullable().index();
      table.string("item_name", 255).notNullable().index();
      table.string("item_code", 50).nullable();
      table.string("category", 100).notNullable().index(); // DAIRY, POULTRY_MEAT, SEAFOOD, VEGETABLES_FRUITS, STAPLES_GROCERY, COOKING_OIL, PACKAGED_GOODS
      table.string("supplier_name", 150).nullable();
      table.integer("supplier_id").unsigned().nullable()
        .references("id").inTable("suppliers").onDelete("SET NULL");
      table.string("challan_number", 100).nullable();
      table.decimal("receiving_temp_c", 5, 2).nullable();
      table.decimal("temp_threshold_min_c", 5, 2).nullable();
      table.decimal("temp_threshold_max_c", 5, 2).nullable();
      table.boolean("temp_compliant").notNullable().defaultTo(true).index();
      table.string("packaging_seal", 50).notNullable().defaultTo("INTACT"); // INTACT, TORN, LEAKING, DIRTY
      table.string("sensory_rating", 50).notNullable().defaultTo("EXCELLENT"); // EXCELLENT, GOOD, ACCEPTABLE, REJECTED
      table.boolean("expiry_date_verified").notNullable().defaultTo(true);
      table.string("status", 50).notNullable().defaultTo("PASSED").index(); // PASSED, CONDITIONALLY_ACCEPTED, REJECTED
      table.text("rejection_reason").nullable();
      table.string("action_taken", 100).notNullable().defaultTo("Accepted into Cold Storage");
      table.string("inspector_name", 100).notNullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 060] Created table 'food_quality_inspections'.");
  }

  // 2. Create food_waste_logs
  const hasWaste = await knex.schema.hasTable("food_waste_logs");
  if (!hasWaste) {
    await knex.schema.createTable("food_waste_logs", (table) => {
      table.bigIncrements("id").primary();
      table.date("waste_date").notNullable().index();
      table.string("department", 100).notNullable().index();
      table.string("waste_type", 50).notNullable().index(); // PREP_TRIMMING, SPOILAGE_EXPIRED, BUFFET_LEFTOVER_DISCARD, KITCHEN_BURNT_MISHAP, PLATE_WASTE
      table.string("item_name", 255).notNullable();
      table.integer("stock_id").unsigned().nullable()
        .references("id").inTable("stock").onDelete("SET NULL");
      table.decimal("qty", 10, 3).notNullable();
      table.string("unit", 30).notNullable();
      table.decimal("unit_cost", 10, 2).notNullable().defaultTo(0);
      table.decimal("total_cost", 12, 2).notNullable().defaultTo(0);
      table.text("reason").notNullable();
      table.string("disposal_method", 100).notNullable().defaultTo("Organic Composting Bin");
      table.string("logged_by", 100).notNullable();
      table.string("authorized_by", 100).nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 060] Created table 'food_waste_logs'.");
  }

  // 3. Create used_cooking_oil_logs (RUCO)
  const hasRuco = await knex.schema.hasTable("used_cooking_oil_logs");
  if (!hasRuco) {
    await knex.schema.createTable("used_cooking_oil_logs", (table) => {
      table.bigIncrements("id").primary();
      table.date("log_date").notNullable().index();
      table.string("department", 100).notNullable().index();
      table.string("fryer_name", 100).notNullable();
      table.string("oil_type", 100).notNullable().defaultTo("Sunflower Oil");
      table.decimal("tpc_percentage", 4, 1).notNullable();
      table.string("status", 50).notNullable().defaultTo("SAFE_FOR_FRYING"); // SAFE_FOR_FRYING, TOP_UP_REQUIRED, DISCARDED_TO_RUCO_DRUM
      table.decimal("discarded_litres", 8, 2).notNullable().defaultTo(0);
      table.decimal("current_drum_stock_litres", 8, 2).notNullable().defaultTo(0);
      table.decimal("collected_litres", 8, 2).notNullable().defaultTo(0);
      table.string("collection_vendor", 150).nullable();
      table.string("collection_certificate_no", 100).nullable();
      table.decimal("revenue_recovered", 10, 2).notNullable().defaultTo(0);
      table.string("recorded_by", 100).notNullable();
      table.text("notes").nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 060] Created table 'used_cooking_oil_logs'.");
  }

  // 4. Create hygiene_pest_control_logs
  const hasPest = await knex.schema.hasTable("hygiene_pest_control_logs");
  if (!hasPest) {
    await knex.schema.createTable("hygiene_pest_control_logs", (table) => {
      table.bigIncrements("id").primary();
      table.date("service_date").notNullable().index();
      table.string("service_type", 100).notNullable(); // PEST_CONTROL_SERVICE, DEEP_CLEANING_AUDIT, GREASE_TRAP_CLEANOUT, HOOD_CHEMICAL_WASH
      table.string("service_agency", 150).notNullable();
      table.string("technician_name", 100).nullable();
      table.jsonb("areas_covered").notNullable();
      table.text("chemicals_used").nullable();
      table.integer("trap_count_installed").notNullable().defaultTo(0);
      table.string("pest_activity_detected", 50).notNullable().defaultTo("NONE"); // NONE, LOW, MODERATE, HIGH
      table.integer("hygiene_score").notNullable().defaultTo(95);
      table.string("supervisor_signoff", 100).nullable();
      table.text("remarks").nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 060] Created table 'hygiene_pest_control_logs'.");
  }

  // 5. Seed Permissions
  const permissionsToAdd = [
    { key: "quality.view", resource: "quality", action: "view", label: "View HACCP Quality Inspections" },
    { key: "quality.create", resource: "quality", action: "create", label: "Create Quality Inspection & Pest Log" },
    { key: "waste.view", resource: "waste", action: "view", label: "View Kitchen Waste & RUCO Logs" },
    { key: "waste.create", resource: "waste", action: "create", label: "Log Kitchen Waste & RUCO Readings" },
    { key: "waste.export", resource: "waste", action: "export", label: "Export Waste & Quality Excel" }
  ];

  for (const perm of permissionsToAdd) {
    const existing = await knex("permissions").where("key", perm.key).first();
    if (!existing) {
      const [newPerm] = await knex("permissions").insert(perm).returning("id");
      const permId = typeof newPerm === "object" ? newPerm.id : newPerm;

      const rolesToAssign = await knex("roles").whereIn("key", ["admin", "store_manager", "manager", "chef"]).select("id");
      for (const r of rolesToAssign) {
        await knex("role_permissions").insert({ role_id: r.id, permission_id: permId }).onConflict(["role_id", "permission_id"]).ignore();
      }
    }
  }

  // 6. Seed Demo Quality Inspections
  const countInspections = await knex("food_quality_inspections").count("id as count").first();
  if (parseInt(countInspections.count, 10) === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    await knex("food_quality_inspections").insert([
      {
        inspection_date: today,
        item_name: "Fresh Whole Milk 3.0% Fat",
        item_code: "MILK-001",
        category: "DAIRY",
        supplier_name: "Vijaya Fresh Dairy Cooperative",
        challan_number: "DC-VFD-103",
        receiving_temp_c: 3.50,
        temp_threshold_min_c: 1.00,
        temp_threshold_max_c: 4.00,
        temp_compliant: true,
        packaging_seal: "INTACT",
        sensory_rating: "EXCELLENT",
        expiry_date_verified: true,
        status: "PASSED",
        action_taken: "Accepted into Walk-In Chiller #1",
        inspector_name: "Chef Suresh"
      },
      {
        inspection_date: today,
        item_name: "Malai Paneer Fresh Blocks",
        item_code: "PAN-001",
        category: "DAIRY",
        supplier_name: "Heritage Foods India",
        challan_number: "DC-HET-441",
        receiving_temp_c: 3.80,
        temp_threshold_min_c: 1.00,
        temp_threshold_max_c: 5.00,
        temp_compliant: true,
        packaging_seal: "INTACT",
        sensory_rating: "EXCELLENT",
        expiry_date_verified: true,
        status: "PASSED",
        action_taken: "Accepted into Dairy Chiller",
        inspector_name: "Chef Suresh"
      },
      {
        inspection_date: today,
        item_name: "Boneless Chicken Breast Fillets",
        item_code: "CHK-001",
        category: "POULTRY_MEAT",
        supplier_name: "Sneha Farms Quality Poultry",
        challan_number: "DC-SN-9982",
        receiving_temp_c: -18.50,
        temp_threshold_min_c: -22.00,
        temp_threshold_max_c: -16.00,
        temp_compliant: true,
        packaging_seal: "INTACT",
        sensory_rating: "GOOD",
        expiry_date_verified: true,
        status: "PASSED",
        action_taken: "Accepted into Deep Freezer (-18°C)",
        inspector_name: "Sous Chef Imran"
      },
      {
        inspection_date: yesterday,
        item_name: "Farm Fresh Desi Tomatoes",
        item_code: "VEG-TOM-01",
        category: "VEGETABLES_FRUITS",
        supplier_name: "Bowenpally Rythu Bazaar Direct",
        challan_number: "DC-RB-114",
        receiving_temp_c: 24.00,
        temp_threshold_min_c: 15.00,
        temp_threshold_max_c: 28.00,
        temp_compliant: true,
        packaging_seal: "INTACT",
        sensory_rating: "EXCELLENT",
        expiry_date_verified: true,
        status: "PASSED",
        action_taken: "Accepted into Veg Cold Room (12°C)",
        inspector_name: "Storekeeper Ramesh"
      },
      {
        inspection_date: yesterday,
        item_name: "Fresh Seer Fish Steaks (Vanjaram)",
        item_code: "SEA-FISH-01",
        category: "SEAFOOD",
        supplier_name: "Coastal Marine Catch",
        challan_number: "DC-CMC-091",
        receiving_temp_c: 11.20, // Failed cold chain
        temp_threshold_min_c: 0.00,
        temp_threshold_max_c: 4.00,
        temp_compliant: false,
        packaging_seal: "LEAKING",
        sensory_rating: "REJECTED",
        expiry_date_verified: true,
        status: "REJECTED",
        rejection_reason: "Critical Cold Chain Failure: Fish delivered in melting ice at 11.2°C with off-odor. Returned on supplier delivery vehicle.",
        action_taken: "Immediate RTV Return to Vendor with Gate Pass",
        inspector_name: "Executive Chef"
      }
    ]);
    console.log("[Migration 060] Seeded 5 demo food quality inspections.");
  }

  // 7. Seed Demo Kitchen Waste Logs
  const countWaste = await knex("food_waste_logs").count("id as count").first();
  if (parseInt(countWaste.count, 10) === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    await knex("food_waste_logs").insert([
      {
        waste_date: today,
        department: "TIFFINS",
        waste_type: "PREP_TRIMMING",
        item_name: "Onion & Coriander Prep Trimmings",
        qty: 6.500,
        unit: "kg",
        unit_cost: 35.00,
        total_cost: 227.50,
        reason: "Morning batch masala dosa & uttapam vegetable prep trimming loss",
        disposal_method: "Organic Composting Bin",
        logged_by: "Tiffin Commis Raju",
        authorized_by: "Chef Suresh"
      },
      {
        waste_date: today,
        department: "SI-MEALS",
        waste_type: "BUFFET_LEFTOVER_DISCARD",
        item_name: "South Indian Sambar & Rasam",
        qty: 12.000,
        unit: "kg",
        unit_cost: 45.00,
        total_cost: 540.00,
        reason: "Lunch buffet service completion; exceeded 4-hour hot holding safe window",
        disposal_method: "Organic Composting Bin",
        logged_by: "Meals Lead Cook",
        authorized_by: "Chef Suresh"
      },
      {
        waste_date: today,
        department: "NORTH INDIAN",
        waste_type: "KITCHEN_BURNT_MISHAP",
        item_name: "Makhani Gravy Base",
        qty: 4.000,
        unit: "kg",
        unit_cost: 110.00,
        total_cost: 440.00,
        reason: "Handi bottom burned during high-flame reduction; discarded to avoid bitter flavor",
        disposal_method: "Organic Composting Bin",
        logged_by: "Tandoor Chef Amar",
        authorized_by: "Chef Suresh"
      },
      {
        waste_date: yesterday,
        department: "CHINESE & DOSA",
        waste_type: "PREP_TRIMMING",
        item_name: "Cabbage & Spring Onion Shred Trimmings",
        qty: 5.000,
        unit: "kg",
        unit_cost: 25.00,
        total_cost: 125.00,
        reason: "Hakka noodles & fried rice vegetable prep outer leaves",
        disposal_method: "Organic Composting Bin",
        logged_by: "Wok Cook Chen",
        authorized_by: "Chef Suresh"
      },
      {
        waste_date: yesterday,
        department: "MOCKTAILS & CONTINENTAL",
        waste_type: "SPOILAGE_EXPIRED",
        item_name: "Dairy Whipping Cream (Opened)",
        qty: 2.000,
        unit: "ltr",
        unit_cost: 220.00,
        total_cost: 440.00,
        reason: "Exceeded 72h post-opening shelf life in continental cold room",
        disposal_method: "Sink Drainage with Grease Trap",
        logged_by: "Pantry Commis",
        authorized_by: "Chef Suresh"
      }
    ]);
    console.log("[Migration 060] Seeded 5 demo food waste logs.");
  }

  // 8. Seed Demo RUCO Used Cooking Oil Logs
  const countRuco = await knex("used_cooking_oil_logs").count("id as count").first();
  if (parseInt(countRuco.count, 10) === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const date3DaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const date5DaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);

    await knex("used_cooking_oil_logs").insert([
      {
        log_date: date5DaysAgo,
        department: "TIFFINS",
        fryer_name: "Tiffin 20L Double Deep Fryer",
        oil_type: "Refined Palmolein Oil",
        tpc_percentage: 26.50, // Exceeded 25% threshold
        status: "DISCARDED_TO_RUCO_DRUM",
        discarded_litres: 20.00,
        current_drum_stock_litres: 120.00,
        recorded_by: "Tiffin Chef",
        notes: "TPC tested 26.5% using Testo 270 digital oil meter. Fully drained into 200L RUCO Drum #1."
      },
      {
        log_date: date3DaysAgo,
        department: "CHINESE & DOSA",
        fryer_name: "Chinese Wok Deep Frying Station",
        oil_type: "Sunflower Oil",
        tpc_percentage: 21.00,
        status: "TOP_UP_REQUIRED",
        discarded_litres: 0.00,
        current_drum_stock_litres: 120.00,
        recorded_by: "Wok Chef",
        notes: "TPC at 21.0%. Filtered debris and topped up 5L fresh oil."
      },
      {
        log_date: today,
        department: "TIFFINS",
        fryer_name: "Central Store Yard RUCO Drum #1",
        oil_type: "Mixed Used Cooking Oil",
        tpc_percentage: 27.00,
        status: "DISCARDED_TO_RUCO_DRUM",
        discarded_litres: 0.00,
        current_drum_stock_litres: 0.00,
        collected_litres: 120.00,
        collection_vendor: "EcoGreen Biodiesel Fuels India Ltd (FSSAI Reg: RUCO-AP-1029)",
        collection_certificate_no: "RUCO-CERT-2026-881",
        revenue_recovered: 3000.00, // ₹25/L for 120L
        recorded_by: "Store Manager",
        notes: "Collected 120 Litres certified by authorized aggregator. Official FSSAI RUCO manifest signed."
      }
    ]);
    console.log("[Migration 060] Seeded 3 demo RUCO cooking oil logs.");
  }

  // 9. Seed Demo Pest Control Logs
  const countPest = await knex("hygiene_pest_control_logs").count("id as count").first();
  if (parseInt(countPest.count, 10) === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const date15DaysAgo = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);

    await knex("hygiene_pest_control_logs").insert([
      {
        service_date: date15DaysAgo,
        service_type: "PEST_CONTROL_SERVICE",
        service_agency: "Pest Control India (PCI) Hyderabad",
        technician_name: "K. Rakesh",
        areas_covered: JSON.stringify(["Central Kitchen", "Dry Store", "Cold Rooms", "Buffet Counters", "Garbage Dock", "Staff Cafeteria"]),
        chemicals_used: "Boric acid gel baiting, Cypermethrin spray, Glue traps, Fly insect light tubes replaced",
        trap_count_installed: 18,
        pest_activity_detected: "NONE",
        hygiene_score: 98,
        supervisor_signoff: "Executive Chef Suresh",
        remarks: "Bi-weekly preventive pest management complete. Zero rodent or insect activity found."
      }
    ]);
    console.log("[Migration 060] Seeded 1 demo hygiene & pest control log.");
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("hygiene_pest_control_logs");
  await knex.schema.dropTableIfExists("used_cooking_oil_logs");
  await knex.schema.dropTableIfExists("food_waste_logs");
  await knex.schema.dropTableIfExists("food_quality_inspections");
};
