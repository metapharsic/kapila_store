/**
 * 059_create_security_gate_and_utilities.js
 * Migration to create Security Gate Pass and Hotel Kitchen Utility tables.
 * Adapted from MK Paper Mill ERP (security.js & utility.js) for Hotel Kapila.
 * 
 * Includes:
 * 1. security_gate_passes: Vehicle entry/exit, material inward/outward, Returnable Gate Pass (RGP) for LPG cylinders/crates/cans
 * 2. hotel_utility_readings: Commercial LPG cylinder bank telemetry, EB electricity kWh, DG set diesel fuel, Water tanker & RO yield
 * 3. Seed permissions and initial realistic hotel gate & utility records
 */

exports.up = async function (knex) {
  // 1. Create security_gate_passes
  const hasGatePasses = await knex.schema.hasTable("security_gate_passes");
  if (!hasGatePasses) {
    await knex.schema.createTable("security_gate_passes", (table) => {
      table.bigIncrements("id").primary();
      table.string("pass_number", 50).notNullable().unique().index();
      table.string("pass_type", 50).notNullable().index(); // INWARD_MATERIAL, OUTWARD_RTV, RGP_RETURNABLE, NRGP_NON_RETURNABLE, VISITOR_CONTRACTOR
      table.string("vehicle_type", 50).notNullable(); // TRUCK, TEMPO, AUTO, TWO_WHEELER, WATER_TANKER, LPG_TRUCK, OTHER
      table.string("vehicle_number", 50).notNullable().index();
      table.string("driver_name", 100).notNullable();
      table.string("driver_phone", 50).nullable();
      table.string("vendor_name", 150).nullable();
      table.integer("supplier_id").unsigned().nullable()
        .references("id").inTable("suppliers").onDelete("SET NULL");
      table.string("purpose", 255).notNullable();
      table.text("material_description").nullable();
      table.string("challan_number", 100).nullable();
      table.string("invoice_number", 100).nullable();
      table.string("po_number", 100).nullable();
      table.timestamp("in_time", { useTz: true }).notNullable().defaultTo(knex.fn.now()).index();
      table.timestamp("out_time", { useTz: true }).nullable();
      table.string("status", 50).notNullable().defaultTo("IN_PREMISES").index(); // IN_PREMISES, COMPLETED, REJECTED, CANCELLED
      
      // Returnable Container Tracking (RGP)
      table.string("returnable_item_type", 100).nullable(); // e.g. "47.5kg Commercial LPG Cylinders", "50L SS Milk Cans", "Plastic Vegetable Crates"
      table.integer("returnable_qty_out").notNullable().defaultTo(0);
      table.integer("returnable_qty_in").notNullable().defaultTo(0);
      table.integer("returnable_balance_due").notNullable().defaultTo(0);
      table.date("return_due_date").nullable();
      table.boolean("is_return_completed").notNullable().defaultTo(false).index();

      table.string("security_guard_name", 100).nullable();
      table.text("remarks").nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now()).index();
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 059] Created table 'security_gate_passes'.");
  }

  // 2. Create hotel_utility_readings
  const hasUtility = await knex.schema.hasTable("hotel_utility_readings");
  if (!hasUtility) {
    await knex.schema.createTable("hotel_utility_readings", (table) => {
      table.bigIncrements("id").primary();
      table.date("reading_date").notNullable().index();
      table.string("shift", 30).notNullable().defaultTo("FULL_DAY").index(); // MORNING, EVENING, NIGHT, FULL_DAY

      // LPG Cylinder Bank
      table.decimal("lpg_start_kg", 10, 2).notNullable().defaultTo(0);
      table.decimal("lpg_end_kg", 10, 2).notNullable().defaultTo(0);
      table.decimal("lpg_consumed_kg", 10, 2).notNullable().defaultTo(0);
      table.integer("lpg_active_cylinders").notNullable().defaultTo(8);
      table.integer("lpg_empty_cylinders").notNullable().defaultTo(0);
      table.integer("lpg_full_cylinders").notNullable().defaultTo(0);
      table.decimal("lpg_pressure_bar", 5, 2).notNullable().defaultTo(1.50);

      // Electricity EB & DG Backup
      table.decimal("eb_meter_start", 12, 2).notNullable().defaultTo(0);
      table.decimal("eb_meter_end", 12, 2).notNullable().defaultTo(0);
      table.decimal("eb_units_consumed", 12, 2).notNullable().defaultTo(0);
      table.decimal("dg_run_hours", 6, 2).notNullable().defaultTo(0);
      table.decimal("dg_units_kwh", 10, 2).notNullable().defaultTo(0);
      table.decimal("dg_diesel_consumed_litres", 8, 2).notNullable().defaultTo(0);
      table.decimal("dg_diesel_stock_litres", 8, 2).notNullable().defaultTo(0);

      // Water & RO Plant
      table.integer("water_tanker_count").notNullable().defaultTo(0);
      table.decimal("water_tanker_litres", 10, 2).notNullable().defaultTo(0);
      table.decimal("municipal_water_kl", 8, 2).notNullable().defaultTo(0);
      table.decimal("ro_plant_output_litres", 10, 2).notNullable().defaultTo(0);

      table.string("recorded_by", 100).nullable();
      table.text("notes").nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 059] Created table 'hotel_utility_readings'.");
  }

  // 3. Seed Permissions
  const permissionsToAdd = [
    { key: "security.view", resource: "security", action: "view", label: "View Security Gate Passes" },
    { key: "security.create", resource: "security", action: "create", label: "Create Gate Pass & Log Entry" },
    { key: "security.edit", resource: "security", action: "edit", label: "Log Vehicle Exit & Reconcile RGP" },
    { key: "utility.view", resource: "utility", action: "view", label: "View Kitchen Utilities Telemetry" },
    { key: "utility.create", resource: "utility", action: "create", label: "Log Shift Utility Readings" },
    { key: "utility.export", resource: "utility", action: "export", label: "Export Utility & Gate Excel" }
  ];

  for (const perm of permissionsToAdd) {
    const existing = await knex("permissions").where("key", perm.key).first();
    if (!existing) {
      const [newPerm] = await knex("permissions").insert(perm).returning("id");
      const permId = typeof newPerm === "object" ? newPerm.id : newPerm;

      const rolesToAssign = await knex("roles").whereIn("key", ["admin", "store_manager", "manager"]).select("id");
      for (const r of rolesToAssign) {
        await knex("role_permissions").insert({ role_id: r.id, permission_id: permId }).onConflict(["role_id", "permission_id"]).ignore();
      }
    }
  }

  // 4. Seed Demo Gate Passes if empty
  const countPasses = await knex("security_gate_passes").count("id as count").first();
  if (parseInt(countPasses.count, 10) === 0) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dueDate3Days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    await knex("security_gate_passes").insert([
      {
        pass_number: "GP-2026-0001",
        pass_type: "INWARD_MATERIAL",
        vehicle_type: "TEMPO",
        vehicle_number: "TS-09-EA-3120",
        driver_name: "Ramesh Kumar",
        driver_phone: "9876543210",
        vendor_name: "Sri Krishna Agro Provisions",
        purpose: "Morning Rice, Dals, and Oil Delivery for Main Store",
        material_description: "Sona Masoori Rice (20 bags), Toor Dal (5 bags), Gold Winner Oil (10 tins)",
        challan_number: "DC-SK-8921",
        invoice_number: "INV-2026-441",
        po_number: "PO-2026-0112",
        in_time: new Date(Date.now() - 3600000),
        status: "IN_PREMISES",
        security_guard_name: "Head Guard Shankar",
        remarks: "Unloading in Central Dry Store basement bay"
      },
      {
        pass_number: "GP-2026-0002",
        pass_type: "RGP_RETURNABLE",
        vehicle_type: "LPG_TRUCK",
        vehicle_number: "AP-29-TA-8844",
        driver_name: "K. Venkatesh",
        driver_phone: "9848022334",
        vendor_name: "Apex Commercial Gas Agency (HP Gas)",
        purpose: "Outward empty 47.5kg commercial LPG cylinders for refill exchange",
        material_description: "12 Empty 47.5 kg Commercial LPG Cylinders",
        challan_number: "RGP-LPG-094",
        in_time: new Date(Date.now() - 14400000),
        out_time: new Date(Date.now() - 12600000),
        status: "COMPLETED",
        returnable_item_type: "47.5kg Commercial LPG Cylinders",
        returnable_qty_out: 12,
        returnable_qty_in: 0,
        returnable_balance_due: 12,
        return_due_date: dueDate3Days,
        is_return_completed: false,
        security_guard_name: "Guard Narsimha",
        remarks: "Cylinders inspected and certified empty before loading on delivery truck"
      },
      {
        pass_number: "GP-2026-0003",
        pass_type: "RGP_RETURNABLE",
        vehicle_type: "AUTO",
        vehicle_number: "TS-07-UA-4190",
        driver_name: "M. Satyanarayana",
        driver_phone: "9988776655",
        vendor_name: "Vijaya Fresh Dairy Cooperative",
        purpose: "Morning Dairy Milk Supply & Crates Return Exchange",
        material_description: "6x 50L SS Milk Cans + 20 Plastic Curd Crates",
        challan_number: "DC-VFD-103",
        in_time: new Date(Date.now() - 25200000),
        out_time: new Date(Date.now() - 23400000),
        status: "COMPLETED",
        returnable_item_type: "50L SS Milk Cans",
        returnable_qty_out: 6,
        returnable_qty_in: 6,
        returnable_balance_due: 0,
        return_due_date: todayStr,
        is_return_completed: true,
        security_guard_name: "Guard Narsimha",
        remarks: "Received 6 full milk cans and returned 6 empty cans from previous morning"
      },
      {
        pass_number: "GP-2026-0004",
        pass_type: "INWARD_MATERIAL",
        vehicle_type: "WATER_TANKER",
        vehicle_number: "TS-08-WB-9912",
        driver_name: "Anand Raju",
        driver_phone: "9123456780",
        vendor_name: "Metro Spring Water Tankers",
        purpose: "Potable Bulk Kitchen & Utility Water Delivery",
        material_description: "12,000 Litres treated soft water for kitchen & guest rooms",
        challan_number: "WT-2026-559",
        in_time: new Date(Date.now() - 7200000),
        out_time: new Date(Date.now() - 5400000),
        status: "COMPLETED",
        security_guard_name: "Head Guard Shankar",
        remarks: "Pumped into Main Sump Tank #2. TDS tested 140 ppm, chlorine OK."
      }
    ]);
    console.log("[Migration 059] Seeded 4 initial demo security gate passes.");
  }

  // 5. Seed Demo Utility Shift Readings if empty
  const countUtility = await knex("hotel_utility_readings").count("id as count").first();
  if (parseInt(countUtility.count, 10) === 0) {
    const historicalReadings = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);

      // Morning shift
      historicalReadings.push({
        reading_date: dateStr,
        shift: "MORNING",
        lpg_start_kg: 380.00,
        lpg_end_kg: 335.50,
        lpg_consumed_kg: 44.50,
        lpg_active_cylinders: 8,
        lpg_empty_cylinders: 4,
        lpg_full_cylinders: 10,
        lpg_pressure_bar: 1.55,
        eb_meter_start: 142000.00 + (5 - i) * 850,
        eb_meter_end: 142450.00 + (5 - i) * 850,
        eb_units_consumed: 450.00,
        dg_run_hours: 0.50,
        dg_units_kwh: 45.00,
        dg_diesel_consumed_litres: 12.00,
        dg_diesel_stock_litres: 480.00,
        water_tanker_count: 1,
        water_tanker_litres: 12000.00,
        municipal_water_kl: 18.50,
        ro_plant_output_litres: 4500.00,
        recorded_by: "Morning Duty Supervisor",
        notes: "Peak breakfast & tiffin preparation hours. LPG manifold steady."
      });

      // Evening shift
      historicalReadings.push({
        reading_date: dateStr,
        shift: "EVENING",
        lpg_start_kg: 335.50,
        lpg_end_kg: 282.00,
        lpg_consumed_kg: 53.50,
        lpg_active_cylinders: 8,
        lpg_empty_cylinders: 5,
        lpg_full_cylinders: 9,
        lpg_pressure_bar: 1.50,
        eb_meter_start: 142450.00 + (5 - i) * 850,
        eb_meter_end: 142950.00 + (5 - i) * 850,
        eb_units_consumed: 500.00,
        dg_run_hours: 0.00,
        dg_units_kwh: 0.00,
        dg_diesel_consumed_litres: 0.00,
        dg_diesel_stock_litres: 480.00,
        water_tanker_count: 0,
        water_tanker_litres: 0.00,
        municipal_water_kl: 14.20,
        ro_plant_output_litres: 3800.00,
        recorded_by: "Evening Duty Supervisor",
        notes: "Heavy dinner rush across Chinese and Tandoor stations."
      });
    }

    await knex("hotel_utility_readings").insert(historicalReadings);
    console.log(`[Migration 059] Seeded ${historicalReadings.length} utility shift readings.`);
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("hotel_utility_readings");
  await knex.schema.dropTableIfExists("security_gate_passes");
};
