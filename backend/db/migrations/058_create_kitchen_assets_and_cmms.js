/**
 * 058_create_kitchen_assets_and_cmms.js
 * Migration to create the Commercial Kitchen & Facility Asset CMMS tables.
 * Adapted from MK Paper Mill ERP into Hotel Kapila Inventory & Kitchen System.
 * 
 * Includes:
 * 1. hotel_assets: Equipment registry (Cold rooms, ovens, burners, dishwashers, DG, RO)
 * 2. maintenance_schedules: Recurring preventive maintenance (PM) routines
 * 3. maintenance_work_orders: Corrective breakdown and preventive work orders
 * 4. maintenance_parts_consumed: Spare parts and consumables linkage to store inventory
 * 5. Seeding permissions and initial 15 commercial assets
 */

exports.up = async function (knex) {
  // 1. Create hotel_assets
  const hasAssets = await knex.schema.hasTable("hotel_assets");
  if (!hasAssets) {
    await knex.schema.createTable("hotel_assets", (table) => {
      table.bigIncrements("id").primary();
      table.string("asset_code", 50).notNullable().unique().index();
      table.string("name", 255).notNullable().index();
      table.string("department", 100).notNullable().index();
      table.string("location", 100).nullable();
      table.string("category", 100).notNullable().index();
      table.string("manufacturer", 100).nullable();
      table.string("model_no", 100).nullable();
      table.string("serial_no", 100).nullable();
      table.date("purchase_date").nullable();
      table.date("warranty_expiry").nullable();
      table.string("amc_vendor", 255).nullable();
      table.string("status", 50).notNullable().defaultTo("OPERATIONAL").index();
      table.string("criticality", 20).notNullable().defaultTo("MEDIUM");
      table.string("qr_code", 255).nullable();
      table.jsonb("specifications").nullable();
      table.text("notes").nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now()).index();
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 058] Created table 'hotel_assets'.");
  }

  // 2. Create maintenance_schedules
  const hasSchedules = await knex.schema.hasTable("maintenance_schedules");
  if (!hasSchedules) {
    await knex.schema.createTable("maintenance_schedules", (table) => {
      table.bigIncrements("id").primary();
      table.integer("asset_id").unsigned().notNullable()
        .references("id").inTable("hotel_assets").onDelete("CASCADE").index();
      table.string("title", 255).notNullable();
      table.string("frequency", 50).notNullable(); // DAILY, WEEKLY, BI_WEEKLY, MONTHLY, QUARTERLY, ANNUAL
      table.date("last_performed_at").nullable();
      table.date("next_due_date").notNullable().index();
      table.jsonb("checklist").nullable();
      table.string("assigned_to", 100).nullable();
      table.boolean("is_active").notNullable().defaultTo(true);
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 058] Created table 'maintenance_schedules'.");
  }

  // 3. Create maintenance_work_orders
  const hasWorkOrders = await knex.schema.hasTable("maintenance_work_orders");
  if (!hasWorkOrders) {
    await knex.schema.createTable("maintenance_work_orders", (table) => {
      table.bigIncrements("id").primary();
      table.string("wo_number", 50).notNullable().unique().index();
      table.integer("asset_id").unsigned().notNullable()
        .references("id").inTable("hotel_assets").onDelete("CASCADE").index();
      table.integer("schedule_id").unsigned().nullable()
        .references("id").inTable("maintenance_schedules").onDelete("SET NULL").index();
      table.string("order_type", 50).notNullable().index(); // PREVENTIVE, BREAKDOWN, EMERGENCY, INSPECTION
      table.string("priority", 20).notNullable().defaultTo("MEDIUM").index(); // CRITICAL, HIGH, MEDIUM, LOW
      table.string("status", 50).notNullable().defaultTo("OPEN").index(); // OPEN, ASSIGNED, IN_PROGRESS, PARTS_AWAITING, COMPLETED, CLOSED
      table.text("issue_description").notNullable();
      table.text("action_taken").nullable();
      table.text("root_cause").nullable();
      table.string("reported_by", 100).notNullable();
      table.string("assigned_to", 100).nullable();
      table.timestamp("start_time", { useTz: true }).nullable();
      table.timestamp("completed_at", { useTz: true }).nullable();
      table.integer("downtime_minutes").defaultTo(0);
      table.decimal("labor_cost", 12, 2).defaultTo(0);
      table.decimal("parts_cost", 12, 2).defaultTo(0);
      table.decimal("total_cost", 12, 2).defaultTo(0);
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now()).index();
    });
    console.log("[Migration 058] Created table 'maintenance_work_orders'.");
  }

  // 4. Create maintenance_parts_consumed
  const hasParts = await knex.schema.hasTable("maintenance_parts_consumed");
  if (!hasParts) {
    await knex.schema.createTable("maintenance_parts_consumed", (table) => {
      table.bigIncrements("id").primary();
      table.integer("work_order_id").unsigned().notNullable()
        .references("id").inTable("maintenance_work_orders").onDelete("CASCADE").index();
      table.integer("stock_id").unsigned().nullable()
        .references("id").inTable("stock").onDelete("SET NULL").index();
      table.string("item_code", 50).notNullable().index();
      table.string("item_name", 255).notNullable();
      table.decimal("qty", 12, 3).notNullable();
      table.string("unit", 50).notNullable();
      table.decimal("unit_price", 12, 2).defaultTo(0);
      table.decimal("total_cost", 12, 2).defaultTo(0);
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 058] Created table 'maintenance_parts_consumed'.");
  }

  // 5. Seed Permissions
  const permissionsToAdd = [
    { key: "maintenance.view", resource: "maintenance", action: "view", label: "View Maintenance & Assets" },
    { key: "maintenance.create", resource: "maintenance", action: "create", label: "Create Work Orders & Assets" },
    { key: "maintenance.edit", resource: "maintenance", action: "edit", label: "Update Work Orders & Assets" },
    { key: "maintenance.complete", resource: "maintenance", action: "complete", label: "Complete Work Orders & Schedules" },
  ];

  for (const perm of permissionsToAdd) {
    const existing = await knex("permissions").where("key", perm.key).first();
    if (!existing) {
      const [newPerm] = await knex("permissions").insert(perm).returning("id");
      const permId = typeof newPerm === "object" ? newPerm.id : newPerm;

      // Assign to admin, manager, and store_manager
      const rolesToAssign = await knex("roles").whereIn("key", ["admin", "store_manager", "manager"]).select("id");
      for (const r of rolesToAssign) {
        await knex("role_permissions").insert({ role_id: r.id, permission_id: permId }).onConflict(["role_id", "permission_id"]).ignore();
      }

      // Assign view and create to chef
      if (["maintenance.view", "maintenance.create"].includes(perm.key)) {
        const chefRole = await knex("roles").where("key", "chef").first();
        if (chefRole) {
          await knex("role_permissions").insert({ role_id: chefRole.id, permission_id: permId }).onConflict(["role_id", "permission_id"]).ignore();
        }
      }
    }
  }

  // 6. Seed 15 core commercial kitchen equipment
  const existingAssetsCount = await knex("hotel_assets").count("id as count").first();
  if (parseInt(existingAssetsCount.count, 10) === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const initialAssets = [
      {
        asset_code: "KPL-EQ-001",
        name: "Three-Burner High-Pressure Chinese Cooking Range",
        department: "CHINESE & DOSA",
        location: "Chinese Kitchen Hot Line",
        category: "COOKING_RANGE",
        manufacturer: "Continental Kitchen Craft",
        model_no: "CKC-HP-3B",
        serial_no: "CKC-2023-8891",
        purchase_date: "2023-03-15",
        warranty_expiry: "2025-03-15",
        amc_vendor: "Apex Commercial Gas Services",
        status: "OPERATIONAL",
        criticality: "CRITICAL",
        specifications: JSON.stringify({ burners: 3, fuel: "Commercial LPG", pilot_ignition: true }),
        notes: "Primary wok station. Inspect gas valves and pilot flame weekly."
      },
      {
        asset_code: "KPL-EQ-002",
        name: "Double-Deck Stone Hearth Bakery & Pizza Oven",
        department: "MOCKTAILS & CONTINENTAL",
        location: "Continental Prep Line",
        category: "COOKING_RANGE",
        manufacturer: "Sinmag Baking Solutions",
        model_no: "SM-2D4T",
        serial_no: "SN-98214-B",
        purchase_date: "2023-05-10",
        warranty_expiry: "2025-05-10",
        amc_vendor: "Bakers Tech India",
        status: "OPERATIONAL",
        criticality: "HIGH",
        specifications: JSON.stringify({ power: "14 kW 3-Phase", max_temp_c: 400, decks: 2 }),
        notes: "Used for fresh garlic bread, artisanal rolls and continental pizzas."
      },
      {
        asset_code: "KPL-EQ-003",
        name: "Walk-in Cold Room Chiller (+4°C)",
        department: "SI-MEALS",
        location: "Central Storage Corridor Block A",
        category: "REFRIGERATION",
        manufacturer: "Blue Star Commercial Refrigeration",
        model_no: "CR-1200-PLUS",
        serial_no: "BS-CR-7721",
        purchase_date: "2022-11-20",
        warranty_expiry: "2024-11-20",
        amc_vendor: "Blue Star Direct Care",
        status: "OPERATIONAL",
        criticality: "CRITICAL",
        specifications: JSON.stringify({ refrigerant: "R404A", capacity_cu_ft: 1200, temp_range: "2°C to 6°C" }),
        notes: "Central dairy, batter, and prepared gravy storage. Daily temperature logging mandatory."
      },
      {
        asset_code: "KPL-EQ-004",
        name: "Walk-in Deep Freezer Room (-18°C)",
        department: "NORTH INDIAN",
        location: "Central Storage Corridor Block B",
        category: "REFRIGERATION",
        manufacturer: "Voltas Commercial Cool",
        model_no: "VF-900-HD",
        serial_no: "VOL-DF-3412",
        purchase_date: "2022-11-20",
        warranty_expiry: "2024-11-20",
        amc_vendor: "Voltas AMC Solutions",
        status: "OPERATIONAL",
        criticality: "CRITICAL",
        specifications: JSON.stringify({ refrigerant: "R404A", capacity_cu_ft: 900, temp_range: "-18°C to -22°C" }),
        notes: "Frozen paneer, peas, French fries and ice cream storage."
      },
      {
        asset_code: "KPL-EQ-005",
        name: "Commercial Hood-Type Conveyor Dishwasher",
        department: "RESTAURANT",
        location: "Pot & Plate Wash Area",
        category: "WASHING",
        manufacturer: "Hobart Industrial",
        model_no: "HBT-PRO-120",
        serial_no: "HBT-88741",
        purchase_date: "2023-01-18",
        warranty_expiry: "2025-01-18",
        amc_vendor: "EcoLab Equipment Care",
        status: "OPERATIONAL",
        criticality: "HIGH",
        specifications: JSON.stringify({ racks_per_hr: 80, boiler_temp_c: 85, water_consumption_l_per_rack: 2.4 }),
        notes: "Main service plate sanitization. Chemical rinse aid levels to be monitored daily."
      },
      {
        asset_code: "KPL-EQ-006",
        name: "Traditional Dual-Burner Clay Tandoor Bhatti",
        department: "NORTH INDIAN",
        location: "Indian Kitchen Tandoor Corner",
        category: "COOKING_RANGE",
        manufacturer: "Amritsar Tandoor Co",
        model_no: "ATC-GAS-900",
        serial_no: "ATC-2023-009",
        purchase_date: "2023-06-12",
        warranty_expiry: "2024-06-12",
        amc_vendor: "Apex Commercial Gas Services",
        status: "OPERATIONAL",
        criticality: "HIGH",
        specifications: JSON.stringify({ clay_body: "Traditional Clay Insulated", burners: 2, fuel: "Commercial LPG" }),
        notes: "Inspect interior clay for fissures and ensure burner air-shutter adjustment."
      },
      {
        asset_code: "KPL-EQ-007",
        name: "Rotary Idli & Dosa Batter Wet Grinder Bank (30L)",
        department: "TIFFINS",
        location: "South Indian Wet Prep Room",
        category: "GRINDING_BAKERY",
        manufacturer: "Lakshmi Commercial Grinders",
        model_no: "LCG-TILTING-30",
        serial_no: "LCG-2022-554",
        purchase_date: "2022-09-10",
        warranty_expiry: "2024-09-10",
        amc_vendor: "Hotel Spares & Service Co",
        status: "OPERATIONAL",
        criticality: "CRITICAL",
        specifications: JSON.stringify({ capacity_liters: 30, motor_hp: 2.0, mechanism: "Tilting Stone Roller" }),
        notes: "Operates 04:00 to 07:00 and 15:00 to 18:00 daily. Drive belt tension check weekly."
      },
      {
        asset_code: "KPL-EQ-008",
        name: "Heavy-Duty Spiral Dough Kneader (50kg)",
        department: "TIFFINS",
        location: "Dough & Batter Room",
        category: "GRINDING_BAKERY",
        manufacturer: "CSM Bakery Machinery",
        model_no: "CSM-SK-50",
        serial_no: "CSM-2023-412",
        purchase_date: "2023-02-14",
        warranty_expiry: "2025-02-14",
        amc_vendor: "Bakers Tech India",
        status: "OPERATIONAL",
        criticality: "HIGH",
        specifications: JSON.stringify({ flour_capacity_kg: 50, bowl_volume_l: 80, dual_speed: true }),
        notes: "Parotta and Poori dough preparation. Food-grade gearbox grease check monthly."
      },
      {
        asset_code: "KPL-EQ-009",
        name: "Commercial Soft-Serve Ice Cream Dispenser",
        department: "CHAT & SOFTY",
        location: "Chat & Softy Counter",
        category: "REFRIGERATION",
        manufacturer: "Taylor Freeze Craft",
        model_no: "TF-C708",
        serial_no: "TF-90812-X",
        purchase_date: "2023-07-25",
        warranty_expiry: "2025-07-25",
        amc_vendor: "Taylor India Support",
        status: "OPERATIONAL",
        criticality: "MEDIUM",
        specifications: JSON.stringify({ hoppers: 2, flavors: "2 + 1 Twist", air_cooled: true }),
        notes: "Daily sanitization and scraper blade wear inspection required."
      },
      {
        asset_code: "KPL-EQ-010",
        name: "Four-Pot Electric Bain-Marie Warm Station",
        department: "STAFF",
        location: "Staff Dining Serving Line",
        category: "COOKING_RANGE",
        manufacturer: "SS Equipment Works",
        model_no: "BM-4P-EL",
        serial_no: "SSE-2022-198",
        purchase_date: "2022-08-01",
        warranty_expiry: "2023-08-01",
        amc_vendor: "Internal Maintenance Team",
        status: "OPERATIONAL",
        criticality: "MEDIUM",
        specifications: JSON.stringify({ pots: 4, power_kw: 3.5, water_drain_valve: true }),
        notes: "Heating element descaling to be carried out monthly."
      },
      {
        asset_code: "KPL-EQ-011",
        name: "Kitchen Main Exhaust Blower & Centrifugal Scrubber",
        department: "CHINESE & DOSA",
        location: "Roof Exhaust Deck",
        category: "HVAC_EXHAUST",
        manufacturer: "AirCon Blowers India",
        model_no: "AC-BLW-10000",
        serial_no: "AC-EXH-4412",
        purchase_date: "2022-10-15",
        warranty_expiry: "2024-10-15",
        amc_vendor: "AirCon Engineering AMC",
        status: "OPERATIONAL",
        criticality: "CRITICAL",
        specifications: JSON.stringify({ airflow_cfm: 10000, motor_hp: 7.5, belt_driven: true }),
        notes: "Fire safety critical. Bi-weekly grease trap clearance and fan belt alignment."
      },
      {
        asset_code: "KPL-EQ-012",
        name: "Commercial Gourmet Ice Cube Machine (150kg/Day)",
        department: "MOCKTAILS & CONTINENTAL",
        location: "Bar & Beverage Station",
        category: "REFRIGERATION",
        manufacturer: "Scotsman Ice Systems",
        model_no: "NW-308",
        serial_no: "SCT-2023-7761",
        purchase_date: "2023-04-18",
        warranty_expiry: "2025-04-18",
        amc_vendor: "Beverage Equip Care",
        status: "OPERATIONAL",
        criticality: "HIGH",
        specifications: JSON.stringify({ production_24h_kg: 150, storage_bin_kg: 70, condenser: "Air-cooled" }),
        notes: "Water filtration inline cartridge replacement and antimicrobial flush."
      },
      {
        asset_code: "KPL-EQ-013",
        name: "Industrial RO Water Purification System (1000 LPH)",
        department: "ROOM SERVICE",
        location: "Water Treatment Room",
        category: "UTILITY_POWER",
        manufacturer: "Ion Exchange Water Tech",
        model_no: "RO-IND-1000",
        serial_no: "ION-2022-094",
        purchase_date: "2022-06-10",
        warranty_expiry: "2024-06-10",
        amc_vendor: "Ion Exchange Care",
        status: "OPERATIONAL",
        criticality: "CRITICAL",
        specifications: JSON.stringify({ output_lph: 1000, recovery_pct: 60, pressure_vessels: 2 }),
        notes: "Supplies cooking, drinking and ice maker water. Weekly TDS and pressure differential log."
      },
      {
        asset_code: "KPL-EQ-014",
        name: "Central Kitchen LPG Cylinder Manifold & Leak Sensor Bank",
        department: "SI-MEALS",
        location: "Exterior LPG Yard",
        category: "UTILITY_POWER",
        manufacturer: "Bharat Petroleum Commercial Yard",
        model_no: "MAN-20X20",
        serial_no: "BPCL-MAN-110",
        purchase_date: "2022-05-01",
        warranty_expiry: "2025-05-01",
        amc_vendor: "BPCL Technical Services",
        status: "OPERATIONAL",
        criticality: "CRITICAL",
        specifications: JSON.stringify({ manifold_arms: "20 Active + 20 Reserve", auto_changeover: true }),
        notes: "Critical safety. Soap bubble test on copper pigtails and high-pressure regulator weekly."
      },
      {
        asset_code: "KPL-EQ-015",
        name: "Diesel Generator (DG) Backup Power Unit (125 kVA)",
        department: "RESTAURANT",
        location: "Generator Acoustic Enclosure",
        category: "UTILITY_POWER",
        manufacturer: "Kirloskar Oil Engines",
        model_no: "KG-125-WS",
        serial_no: "KOEL-2022-882",
        purchase_date: "2022-04-12",
        warranty_expiry: "2025-04-12",
        amc_vendor: "Kirloskar Care South",
        status: "OPERATIONAL",
        criticality: "CRITICAL",
        specifications: JSON.stringify({ capacity_kva: 125, fuel: "Diesel", battery_voltage: 24, auto_mains_failure: true }),
        notes: "Hotel power emergency standby. Weekly 15-minute off-load test run and battery terminal check."
      }
    ];

    const insertedAssets = await knex("hotel_assets").insert(initialAssets).returning(["id", "asset_code", "name"]);
    console.log(`[Migration 058] Seeded ${insertedAssets.length} commercial kitchen & facility assets.`);

    // Seed preventive maintenance schedules for primary critical assets
    const scheduleData = [
      {
        asset_code: "KPL-EQ-001",
        title: "Weekly Gas Burner & Pigtail Leak Inspection",
        frequency: "WEEKLY",
        next_due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        checklist: JSON.stringify(["Check burner pilot flame", "Test gas valve tightness", "Inspect gas pigtail hoses", "Clean air shutter grease"]),
        assigned_to: "Facility Engineer"
      },
      {
        asset_code: "KPL-EQ-003",
        title: "Bi-Weekly Cold Room Defrost & Condenser Cleaning",
        frequency: "BI_WEEKLY",
        next_due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        checklist: JSON.stringify(["Check thermostat calibration (+4°C)", "Clean external condenser coils", "Inspect door magnetic gasket seal", "Test defrost heater cycle"]),
        assigned_to: "Refrigeration Specialist"
      },
      {
        asset_code: "KPL-EQ-004",
        title: "Bi-Weekly Deep Freezer Coil Defrost & Evaporator Check",
        frequency: "BI_WEEKLY",
        next_due_date: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
        checklist: JSON.stringify(["Verify temp display (-18°C)", "Inspect evaporator fan rotation", "Clean door heater ribbon", "Inspect refrigerant gas sight-glass"]),
        assigned_to: "Refrigeration Specialist"
      },
      {
        asset_code: "KPL-EQ-005",
        title: "Monthly Dishwasher Descaling & Wash Arm Flush",
        frequency: "MONTHLY",
        next_due_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
        checklist: JSON.stringify(["Run acid descaling cycle", "Unclog upper/lower wash jet nozzles", "Inspect chemical dosing pump tubes", "Test water heater cutoff (85°C)"]),
        assigned_to: "Steward Technician"
      },
      {
        asset_code: "KPL-EQ-007",
        title: "Weekly Wet Grinder Stone Roller & V-Belt Tension Check",
        frequency: "WEEKLY",
        next_due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        checklist: JSON.stringify(["Inspect V-belt slack and wear", "Check stone roller clearance", "Grease drum pivot bearings", "Test motor thermal overload trip"]),
        assigned_to: "Kitchen Technician"
      },
      {
        asset_code: "KPL-EQ-011",
        title: "Monthly Exhaust Duct & Hood Degreasing Inspection",
        frequency: "MONTHLY",
        next_due_date: new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10),
        checklist: JSON.stringify(["Clean baffle filters with caustic degreaser", "Inspect exhaust duct grease buildup", "Check blower belt deflection", "Inspect motor vibration"]),
        assigned_to: "Facility Engineer"
      },
      {
        asset_code: "KPL-EQ-013",
        title: "Monthly Water RO Micron Filter & TDS Calibration",
        frequency: "MONTHLY",
        next_due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        checklist: JSON.stringify(["Replace 5-micron pre-filter cartridge", "Measure raw vs permeate TDS", "Log high-pressure pump PSI", "Backwash carbon and sand filter"]),
        assigned_to: "Water Treatment Tech"
      },
      {
        asset_code: "KPL-EQ-015",
        title: "Weekly DG Generator Load Run & Battery Voltage Log",
        frequency: "WEEKLY",
        next_due_date: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
        checklist: JSON.stringify(["Check diesel fuel level in day tank", "Check 24V starting battery electrolyte", "Run engine 10 minutes off-load", "Log engine oil level & coolant level"]),
        assigned_to: "Electrical Engineer"
      }
    ];

    for (const sch of scheduleData) {
      const asset = insertedAssets.find(a => a.asset_code === sch.asset_code);
      if (asset) {
        await knex("maintenance_schedules").insert({
          asset_id: asset.id,
          title: sch.title,
          frequency: sch.frequency,
          next_due_date: sch.next_due_date,
          checklist: sch.checklist,
          assigned_to: sch.assigned_to,
          is_active: true
        });
      }
    }
    console.log(`[Migration 058] Seeded ${scheduleData.length} preventive maintenance schedules.`);
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("maintenance_parts_consumed");
  await knex.schema.dropTableIfExists("maintenance_work_orders");
  await knex.schema.dropTableIfExists("maintenance_schedules");
  await knex.schema.dropTableIfExists("hotel_assets");
};
