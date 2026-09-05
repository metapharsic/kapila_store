const db = require("../db");
const fs = require("fs");
const path = require("path");

async function seed() {
  console.log("🌱 Starting 15-Day Stock Database Seeding...");

  try {
    // 1. Clean up existing transaction and stock data to prevent conflicts
    await db("notifications").del();
    await db("approval_requests").del();
    await db("stock_adjustments").del();
    await db("leftovers").del();
    await db("production").del();
    await db("issuance_items").del();
    await db("issuances").del();
    await db("indent_items").del();
    await db("indents").del();
    await db("stock").del();
    await db("goods_receipt_items").del();
    await db("goods_receipt_notes").del();
    await db("purchase_order_items").del();
    await db("purchase_orders").del();
    await db("reorder_points").del();
    await db("stock_transfer_items").del();
    await db("stock_transfers").del();
    await db("suppliers").del();

    console.log("🧹 Existing transaction and stock data cleaned.");

    // 2. Ensure Suppliers exist
    let suppliers = await db("suppliers").insert([
      {
        name: "Super Foods Supplier",
        contact_name: "Ramesh Naidu",
        phone: "+91 98765 43210",
        email: "ramesh@superfoods.com",
        gstin: "37AAAAA1111A1Z1",
        address: "12/4 Broad Road, Guntur, AP"
      },
      {
        name: "Kapila Dairy Farms",
        contact_name: "Koteswara Rao",
        phone: "+91 87654 32109",
        email: "orders@kapiladairy.com",
        gstin: "37BBBBB2222B1Z2",
        address: "Dairy Colony, Vijayawada, AP"
      },
      {
        name: "Sri Venkateswara Provisions",
        contact_name: "Venkatesh S.",
        phone: "+91 76543 21098",
        email: "orders@svprovisions.com",
        gstin: "37CCCCC3333C1Z3",
        address: "Bazar Street, Nellore, AP"
      },
      {
        name: "Royal Disposables & Packaging",
        contact_name: "Suresh Kumar",
        phone: "+91 65432 10987",
        email: "suresh@royalpack.com",
        gstin: "33DDDDD4444D1Z4",
        address: "Red Hills Industrial Area, Chennai, TN"
      }
    ]).returning(["id", "name"]);
    console.log("🏭 Seeded 4 default suppliers.");

    // 3. Read department_items.json
    const jsonPath = path.join(__dirname, "../db/department_items.json");
    if (!fs.existsSync(jsonPath)) {
      throw new Error("department_items.json not found!");
    }
    const mapping = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    // Extract unique item names (case-insensitive)
    const uniqueNamesMap = new Map();
    for (const dept in mapping) {
      if (Array.isArray(mapping[dept])) {
        mapping[dept].forEach(item => {
          const itemName = typeof item === "string" ? item : item.name;
          const trimmed = itemName ? itemName.trim() : "";
          if (trimmed && trimmed !== "PREPARED BY:") {
            const key = trimmed.toLowerCase();
            if (!uniqueNamesMap.has(key)) {
              uniqueNamesMap.set(key, {
                name: trimmed.toUpperCase(),
                unit: item.unit || "kg"
              });
            }
          }
        });
      }
    }
    const uniqueItems = Array.from(uniqueNamesMap.values());
    console.log(`🔍 Found ${uniqueItems.length} unique items in department_items.json.`);

    // 4. Generate stock records
    const today = new Date();
    const d = (daysAgo) => {
      const date = new Date(today);
      date.setDate(today.getDate() - daysAgo);
      return date.toISOString().slice(0, 10);
    };
    const expDate = (daysAhead) => {
      const date = new Date(today);
      date.setDate(today.getDate() + daysAhead);
      return date.toISOString().slice(0, 10);
    };

    const stockItems = [];
    const reorderPoints = [];
    let counter = 1000;

    // Helper to estimate unit and price
    const getUnitAndPrice = (name) => {
      const lower = name.toLowerCase();
      // Dairy
      if (lower.includes("paneer")) return { unit: "kg", price: 320 };
      if (lower.includes("butter")) return { unit: "kg", price: 500 };
      if (lower.includes("cheese")) return { unit: "kg", price: 450 };
      if (lower.includes("ghee")) return { unit: "L", price: 650 };
      if (lower.includes("curd")) return { unit: "L", price: 60 };
      if (lower.includes("milk")) return { unit: "L", price: 55 };
      
      // Groceries / Staples
      if (lower.includes("basmati rice")) return { unit: "kg", price: 95 };
      if (lower.includes("sona masuri") || lower.includes("rice")) return { unit: "kg", price: 55 };
      if (lower.includes("toor dal") || lower.includes("arhar dal")) return { unit: "kg", price: 140 };
      if (lower.includes("urad dal")) return { unit: "kg", price: 130 };
      if (lower.includes("moong dal")) return { unit: "kg", price: 110 };
      if (lower.includes("chana dal")) return { unit: "kg", price: 85 };
      if (lower.includes("sugar")) return { unit: "kg", price: 42 };
      if (lower.includes("salt")) return { unit: "kg", price: 25 };
      if (lower.includes("atta") || lower.includes("wheat")) return { unit: "kg", price: 40 };
      if (lower.includes("maida")) return { unit: "kg", price: 38 };
      if (lower.includes("besan")) return { unit: "kg", price: 85 };
      if (lower.includes("suji") || lower.includes("rava")) return { unit: "kg", price: 45 };
      
      // Oils
      if (lower.includes("sunflower oil")) return { unit: "L", price: 120 };
      if (lower.includes("groundnut oil")) return { unit: "L", price: 160 };
      if (lower.includes("mustard oil")) return { unit: "L", price: 140 };
      if (lower.includes("oil")) return { unit: "L", price: 130 };

      // Spices & Condiments
      if (lower.includes("red chilli powder") || lower.includes("mirchi")) return { unit: "kg", price: 250 };
      if (lower.includes("turmeric") || lower.includes("haldi")) return { unit: "kg", price: 180 };
      if (lower.includes("coriander powder") || lower.includes("dhaniya")) return { unit: "kg", price: 140 };
      if (lower.includes("garam masala")) return { unit: "kg", price: 450 };
      if (lower.includes("cumin") || lower.includes("jeera")) return { unit: "kg", price: 350 };
      if (lower.includes("mustard seeds")) return { unit: "kg", price: 120 };
      if (lower.includes("cardamom") || lower.includes("elaichi")) return { unit: "kg", price: 2000 };
      if (lower.includes("cloves") || lower.includes("laung")) return { unit: "kg", price: 900 };
      
      // Vegetables
      if (lower.includes("onion")) return { unit: "kg", price: 35 };
      if (lower.includes("potato")) return { unit: "kg", price: 30 };
      if (lower.includes("tomato")) return { unit: "kg", price: 40 };
      if (lower.includes("garlic")) return { unit: "kg", price: 180 };
      if (lower.includes("ginger")) return { unit: "kg", price: 120 };
      if (lower.includes("green chilli")) return { unit: "kg", price: 50 };
      if (lower.includes("coriander leaves")) return { unit: "kg", price: 60 };
      if (lower.includes("lemon")) return { unit: "kg", price: 80 };
      
      // Meats
      if (lower.includes("chicken")) return { unit: "kg", price: 220 };
      if (lower.includes("mutton")) return { unit: "kg", price: 750 };
      if (lower.includes("fish")) return { unit: "kg", price: 250 };
      if (lower.includes("egg")) return { unit: "pcs", price: 6 };

      // Disposables / Misc
      if (lower.includes("carry bag") || lower.includes("paper") || lower.includes("roll") || lower.includes("cup") || lower.includes("plate") || lower.includes("box") || lower.includes("spoon") || lower.includes("softy") || lower.includes("tiffin")) {
        return { unit: "pcs", price: Math.floor(Math.random() * 5) + 2 };
      }
      if (lower.includes("juice") || lower.includes("water") || lower.includes("beverage") || lower.includes("sauce") || lower.includes("vinegar")) {
        return { unit: "L", price: Math.floor(Math.random() * 60) + 40 };
      }

      // default
      return { unit: "kg", price: Math.floor(Math.random() * 150) + 40 };
    };

    // Keep some standard items with consistent codes
    const standardCodes = {
      "premium basmati rice": "KPL-101",
      "refined sunflower oil": "KPL-102",
      "butter (500g)": "KPL-103",
      "ghee": "KPL-104",
      "sugar": "KPL-105"
    };

    for (const itemObj of uniqueItems) {
      counter++;
      const name = itemObj.name;
      const cleanLower = name.toLowerCase();
      const itemCode = standardCodes[cleanLower] || `KPL-${counter}`;
      
      const unit = itemObj.unit || "kg";
      const { price } = getUnitAndPrice(name);

      // Pick a supplier
      let supplierObj = suppliers[counter % suppliers.length];
      if (cleanLower.includes("milk") || cleanLower.includes("butter") || cleanLower.includes("cheese") || cleanLower.includes("paneer") || cleanLower.includes("curd") || cleanLower.includes("ghee")) {
        supplierObj = suppliers.find(s => s.name.includes("Dairy")) || supplierObj;
      }
      if (cleanLower.includes("roll") || cleanLower.includes("bag") || cleanLower.includes("cup") || cleanLower.includes("spoon") || cleanLower.includes("napkin")) {
        supplierObj = suppliers.find(s => s.name.includes("Royal")) || supplierObj;
      }

      // Generate a generous amount to last 15 days (e.g. between 300 and 800)
      const qty = Math.floor(Math.random() * 500) + 300;
      const remaining = qty; // Fully stocked

      stockItems.push({
        name,
        qty,
        remaining,
        unit,
        price,
        supplier: supplierObj.name,
        supplier_id: supplierObj.id,
        date: d(2), // Received 2 days ago
        expiry_date: expDate(Math.floor(Math.random() * 150) + 30), // Expires in 30-180 days
        item_code: itemCode,
        min_alert_qty: Math.floor(qty * 0.15) // Alert at 15% remaining
      });

      // Configure a reorder point rule for this item
      reorderPoints.push({
        item_code: itemCode,
        name,
        min_qty: Math.floor(qty * 0.15),
        reorder_qty: Math.floor(qty * 0.75)
      });
    }

    // Insert stock in batches of 100 to prevent query parameter limit errors in knex/pg
    const batchSize = 100;
    for (let i = 0; i < stockItems.length; i += batchSize) {
      const batch = stockItems.slice(i, i + batchSize);
      await db("stock").insert(batch);
    }
    console.log(`📦 Inserted ${stockItems.length} stock batch records.`);

    for (let i = 0; i < reorderPoints.length; i += batchSize) {
      const batch = reorderPoints.slice(i, i + batchSize);
      await db("reorder_points").insert(batch);
    }
    console.log(`🔔 Configured ${reorderPoints.length} reorder point rules.`);

    // 5. Seed some basic transactions for history
    // Create multiple POs for different suppliers
    const [po1] = await db("purchase_orders").insert({
      po_number: "PO-20260612-0001",
      supplier_id: suppliers[0].id,
      date: d(0),
      status: "Draft",
      total_amount: 15000.00,
      notes: "Initial restocking draft"
    }).returning("*");

    await db("purchase_order_items").insert([
      { po_id: po1.id, item_code: "KPL-101", name: "Premium Basmati Rice", qty: 100, unit: "kg", unit_price: 90, total_price: 9000 },
      { po_id: po1.id, item_code: "KPL-102", name: "Refined Sunflower Oil", qty: 50, unit: "L", unit_price: 120, total_price: 6000 }
    ]);

    const [po2] = await db("purchase_orders").insert({
      po_number: "PO-20260613-0002",
      supplier_id: suppliers[1].id,
      date: d(0),
      status: "Pending",
      total_amount: 25000.00,
      notes: "Dairy replenishment"
    }).returning("*");

    await db("purchase_order_items").insert([
      { po_id: po2.id, item_code: "KPL-103", name: "Butter (500g)", qty: 20, unit: "kg", unit_price: 500, total_price: 10000 },
      { po_id: po2.id, item_code: "KPL-104", name: "Ghee", qty: 23, unit: "L", unit_price: 650, total_price: 15000 }
    ]);
    
    const [po3] = await db("purchase_orders").insert({
      po_number: "PO-20260614-0003",
      supplier_id: suppliers[3].id,
      date: d(1),
      status: "Approved",
      total_amount: 1250.00,
      notes: "Packaging supplies"
    }).returning("*");
    
    await db("purchase_order_items").insert([
      { po_id: po3.id, item_code: "KPL-999", name: "Paper Cups", qty: 500, unit: "pcs", unit_price: 2.5, total_price: 1250 }
    ]);

    console.log("🧾 Initial Purchase Orders created across multiple suppliers.");

    // Create a pending indent for TIFFINS
    const [ind] = await db("indents").insert({
      dept: "TIFFINS",
      date: d(0),
      status: "pending"
    }).returning("*");

    await db("indent_items").insert([
      { indent_id: ind.id, name: "Poha", qty: 20, unit: "kg", item_code: stockItems.find(s => s.name === "Poha")?.item_code || "KPL-NEW" },
      { indent_id: ind.id, name: "GOLD MILK", qty: 50, unit: "L", item_code: stockItems.find(s => s.name === "GOLD MILK")?.item_code || "KPL-NEW" }
    ]);

    console.log("📋 Initial pending Indents placed for TIFFINS.");

    // Create an approved indent for SI-MEALS
    const [indMeals] = await db("indents").insert({
      dept: "SI-MEALS",
      date: d(0),
      status: "approved"
    }).returning("*");

    await db("indent_items").insert([
      { indent_id: indMeals.id, name: "ATTA", qty: 2, unit: "kg", item_code: stockItems.find(s => s.name === "ATTA")?.item_code || "KPL-NEW" },
      { indent_id: indMeals.id, name: "SUGAR", qty: 2, unit: "kg", item_code: stockItems.find(s => s.name === "SUGAR")?.item_code || "KPL-NEW" },
      { indent_id: indMeals.id, name: "BUTTER", qty: 5, unit: "kg", item_code: stockItems.find(s => s.name === "BUTTER")?.item_code || "KPL-NEW" }
    ]);

    console.log("📋 Initial approved Indents placed for SI-MEALS.");

    // 6. Seed Approval Requests & Notifications for 15-Day Seeding
    console.log("✍️ Seeding approvals and notifications for 15-day stock...");

    let storeManagerRole = await db("roles").where("key", "store_manager").first();
    if (!storeManagerRole) {
      const [inserted] = await db("roles").insert({
        key: "store_manager",
        name: "Store Manager",
        description: "Store inventory manager access",
        is_system: true
      }).returning("*");
      storeManagerRole = inserted;
    }

    const adminRole = await db("roles").where("key", "admin").first();
    const chefRole = await db("roles").where("key", "chef").first();

    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

    let storeUser = await db("users")
      .where({ email: "store@kapila.local" })
      .orWhere({ email: "store@kapila.com" })
      .orWhere({ employee_code: "KPL-STORE" })
      .first();
    if (!storeUser) {
      const [inserted] = await db("users").insert({
        employee_code: "KPL-STORE",
        name: "Store Keeper",
        email: "store@kapila.com",
        password_hash: passwordHash,
        is_active: true,
        must_change_password: false
      }).returning("*");
      storeUser = inserted;
    }
    
    const hasStoreRole = await db("user_roles").where({ user_id: storeUser.id, role_id: storeManagerRole.id }).first();
    if (!hasStoreRole) {
      await db("user_roles").insert({
        user_id: storeUser.id,
        role_id: storeManagerRole.id
      });
    }

    let chefUser = await db("users")
      .where({ email: "Chef@kapila.com" })
      .orWhere({ email: "chef@kapila.local" })
      .orWhere({ employee_code: "KPL-CHEF" })
      .first();
    if (!chefUser) {
      const [inserted] = await db("users").insert({
        employee_code: "KPL-CHEF",
        name: "Main Chef",
        email: "Chef@kapila.com",
        password_hash: passwordHash,
        is_active: true,
        must_change_password: false
      }).returning("*");
      chefUser = inserted;
    }

    if (chefRole) {
      const hasChefRole = await db("user_roles").where({ user_id: chefUser.id, role_id: chefRole.id }).first();
      if (!hasChefRole) {
        await db("user_roles").insert({
          user_id: chefUser.id,
          role_id: chefRole.id
        });
      }
    }

    // Seed pending indent approval request
    const [arIndent] = await db("approval_requests").insert({
      module: "indents",
      resource_id: ind.id,
      status: "pending",
      current_sequence: 1,
      created_by: chefUser.id
    }).returning("*");

    await db("notifications").insert({
      recipient_role_id: storeManagerRole.id,
      title: "New Approval Required",
      message: `A new indents request (ID: ${ind.id}) awaits your approval.`,
      type: "approval_pending",
      severity: "info",
      metadata: { module: "indents", resource_id: ind.id, request_id: arIndent.id }
    });

    // Seed some other alerts to make dashboard realistic
    await db("notifications").insert([
      {
        recipient_role_id: storeManagerRole.id,
        title: "Low Stock Alert: Refined Sunflower Oil",
        message: "Refined Sunflower Oil is below the reorder point of 30 L. Current stock: 24 L.",
        type: "low_stock",
        severity: "warning",
        metadata: { item_code: "KPL-102" }
      },
      {
        recipient_role_id: storeManagerRole.id,
        title: "Stock Expiry Warning: Butter",
        message: "Butter (500g) is expiring in 2 days.",
        type: "expiry",
        severity: "critical",
        metadata: { item_code: "KPL-103" }
      }
    ]);

    console.log("✅ Seeded approvals and notifications for 15-day stock.");
    console.log("🎉 Database Successfully Seeded with a Rich 15-Day Supply! 🎉");
  } catch (err) {
    console.error("❌ Seeding failed:", err.stack);
  } finally {
    db.destroy();
  }
}

seed();
