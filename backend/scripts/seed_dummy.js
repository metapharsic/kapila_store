const db = require("../db");

async function seed() {
  console.log("🌱 Starting Database Seeding...");

  try {
    // 1. Clean up existing data (respecting foreign keys)
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
    await db("suppliers").del();
    await db("reorder_points").del();
    await db("stock_transfer_items").del();
    await db("stock_transfers").del();

    console.log("🧹 Existing transaction and stock data cleaned.");

    // Ensure departments are seeded (should exist from migration, but let's double check/insert if empty)
    const deptsCount = await db("departments").count("id as count").first();
    if (parseInt(deptsCount.count) === 0) {
      await db("departments").insert([
        { name: "TIFFINS", code: "TFN", chef_name: "Chef Ravi Kumar" },
        { name: "STAFF", code: "STF", chef_name: "Chef Mohammed" },
        { name: "SI-MEALS", code: "SIM", chef_name: "Chef Srinivasan" },
        { name: "NORTH INDIAN", code: "NIN", chef_name: "Chef Sharma" },
        { name: "CHAT & SOFTY", code: "CHT", chef_name: "Chef Gupta" },
        { name: "CHINESE & DOSA", code: "CND", chef_name: "Chef Chen" },
        { name: "MOCKTAILS & CONTINENTAL", code: "MCT", chef_name: "Chef David" },
        { name: "RESTAURANT", code: "RST", chef_name: "Manager Anand" },
        { name: "ROOM SERVICE", code: "RMS", chef_name: "Manager Kishore" }
      ]);
      console.log("🏢 Departments seeded.");
    }

    // 2. Insert Suppliers
    const [sup1, sup2, sup3, sup4] = await db("suppliers").insert([
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
        email: "venky@svprovisions.com",
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
    ]).returning("*");
    console.log("🏭 Suppliers seeded successfully.");

    // 3. Insert Reorder Points (Alert Thresholds)
    await db("reorder_points").insert([
      { item_code: "KPL-101", name: "Premium Basmati Rice", min_qty: 50, reorder_qty: 200 },
      { item_code: "KPL-102", name: "Refined Sunflower Oil", min_qty: 30, reorder_qty: 100 },
      { item_code: "KPL-103", name: "Butter (500g)", min_qty: 15, reorder_qty: 50 },
      { item_code: "KPL-104", name: "Ghee", min_qty: 10, reorder_qty: 30 },
      { item_code: "KPL-105", name: "Sugar", min_qty: 40, reorder_qty: 150 }
    ]);
    console.log("🔔 Reorder Points configured.");

    // 4. Seed Stock Batches
    const today = new Date();
    const d = (daysAgo) => {
      const date = new Date(today);
      date.setDate(today.getDate() - daysAgo);
      return date.toISOString().slice(0, 10);
    };

    // Stock Master list with multiple batches
    const stockBatches = [
      // Rice (2 batches)
      { name: "Premium Basmati Rice", qty: 100, remaining: 82, unit: "kg", date: d(15), price: 92, supplier: "Sri Venkateswara Provisions", supplier_id: sup3.id, expiry_date: d(-200), item_code: "KPL-101" },
      { name: "Premium Basmati Rice", qty: 150, remaining: 150, unit: "kg", date: d(3), price: 95, supplier: "Sri Venkateswara Provisions", supplier_id: sup3.id, expiry_date: d(-300), item_code: "KPL-101" },
      
      // Oil (1 batch)
      { name: "Refined Sunflower Oil", qty: 80, remaining: 44, unit: "L", date: d(10), price: 122, supplier: "Super Foods Supplier", supplier_id: sup1.id, expiry_date: d(-180), item_code: "KPL-102" },
      
      // Butter (2 batches)
      { name: "Butter (500g)", qty: 30, remaining: 12, unit: "pcs", date: d(8), price: 235, supplier: "Kapila Dairy Farms", supplier_id: sup2.id, expiry_date: d(-25), item_code: "KPL-103" },
      { name: "Butter (500g)", qty: 50, remaining: 50, unit: "pcs", date: d(1), price: 240, supplier: "Kapila Dairy Farms", supplier_id: sup2.id, expiry_date: d(-35), item_code: "KPL-103" },

      // Ghee
      { name: "Ghee", qty: 25, remaining: 8, unit: "L", date: d(12), price: 620, supplier: "Kapila Dairy Farms", supplier_id: sup2.id, expiry_date: d(-150), item_code: "KPL-104" },

      // Sugar
      { name: "Sugar", qty: 200, remaining: 175, unit: "kg", date: d(20), price: 42, supplier: "Sri Venkateswara Provisions", supplier_id: sup3.id, expiry_date: d(-365), item_code: "KPL-105" },

      // Disposables
      { name: "Carry Bag 13x16", qty: 1000, remaining: 750, unit: "pcs", date: d(25), price: 1.5, supplier: "Royal Disposables & Packaging", supplier_id: sup4.id, expiry_date: d(-365), item_code: "KPL-108" },
      { name: "Paper Rolls", qty: 150, remaining: 110, unit: "pcs", date: d(18), price: 14.8, supplier: "Royal Disposables & Packaging", supplier_id: sup4.id, expiry_date: d(-365), item_code: "KPL-109" }
    ];

    await db("stock").insert(stockBatches);
    console.log("📦 Stock Batches ingested.");

    // 5. Purchase Orders (Draft, Sent, and Received)
    const [po1] = await db("purchase_orders").insert({
      po_number: "PO-20260607-0001",
      supplier_id: sup3.id,
      date: d(4),
      status: "Received",
      total_amount: 14250.00,
      notes: "Stock refill for basmati rice"
    }).returning("*");

    await db("purchase_order_items").insert([
      { po_id: po1.id, item_code: "KPL-101", name: "Premium Basmati Rice", qty: 150, unit: "kg", unit_price: 95, total_price: 150 * 95 }
    ]);

    const [po2] = await db("purchase_orders").insert({
      po_number: "PO-20260607-0002",
      supplier_id: sup2.id,
      date: d(1),
      status: "Sent",
      total_amount: 12000.00,
      notes: "Urgent dairy restocking"
    }).returning("*");

    await db("purchase_order_items").insert([
      { po_id: po2.id, item_code: "KPL-103", name: "Butter (500g)", qty: 50, unit: "pcs", unit_price: 240, total_price: 50 * 240 }
    ]);

    const [po3] = await db("purchase_orders").insert({
      po_number: "PO-20260607-0003",
      supplier_id: sup1.id,
      date: d(0),
      status: "Draft",
      total_amount: 6100.00,
      notes: "Weekly oil purchase draft"
    }).returning("*");

    await db("purchase_order_items").insert([
      { po_id: po3.id, item_code: "KPL-102", name: "Refined Sunflower Oil", qty: 50, unit: "L", unit_price: 122, total_price: 50 * 122 }
    ]);

    console.log("🧾 Purchase Orders generated.");

    // 6. Goods Receipt Notes (GRN) matching Received POs
    const [grn1] = await db("goods_receipt_notes").insert({
      grn_number: "GRN-20260607-0001",
      po_id: po1.id,
      supplier_id: sup3.id,
      date: d(3),
      invoice_no: "INV-RICE-2510",
      received_by: "Store Manager Anand",
      remarks: "Basmati rice received in pristine condition. Weight crosschecked."
    }).returning("*");

    await db("goods_receipt_items").insert([
      { grn_id: grn1.id, item_code: "KPL-101", name: "Premium Basmati Rice", qty_ordered: 150, qty_received: 150, qty_accepted: 150, qty_rejected: 0, unit: "kg", unit_price: 95, landed_cost: 14250 }
    ]);

    console.log("📥 Goods Receipt Notes logged.");

    // 7. Chef Nightly Indents (Pending, Issued)
    const [ind1] = await db("indents").insert({
      dept: "TIFFINS",
      date: d(0),
      status: "pending"
    }).returning("*");

    await db("indent_items").insert([
      { indent_id: ind1.id, name: "Butter (500g)", qty: 5, unit: "pcs", item_code: "KPL-103" },
      { indent_id: ind1.id, name: "Ghee", qty: 2, unit: "L", item_code: "KPL-104" }
    ]);

    const [ind2] = await db("indents").insert({
      dept: "NORTH INDIAN",
      date: d(1),
      status: "issued"
    }).returning("*");

    await db("indent_items").insert([
      { indent_id: ind2.id, name: "Premium Basmati Rice", qty: 18, unit: "kg", item_code: "KPL-101" },
      { indent_id: ind2.id, name: "Refined Sunflower Oil", qty: 6, unit: "L", item_code: "KPL-102" }
    ]);

    console.log("📋 Nightly Indents placed.");

    // 8. Store Issuances corresponding to Issued Indents
    const [iss1] = await db("issuances").insert({
      indent_id: ind2.id,
      dept: "NORTH INDIAN",
      date: d(1),
      scanned: false
    }).returning("*");

    await db("issuance_items").insert([
      { issuance_id: iss1.id, name: "Premium Basmati Rice", qty: 18, issued: 18, unit: "kg", item_code: "KPL-101" },
      { issuance_id: iss1.id, name: "Refined Sunflower Oil", qty: 6, issued: 6, unit: "L", item_code: "KPL-102" }
    ]);

    console.log("🔄 Store Issuances completed.");

    // 9. Daily Production & Leftovers logs
    await db("production").insert([
      { dept: "TIFFINS", date: d(1), plates: 320, notes: "Idly, Dosa, Vada buffet morning rush" },
      { dept: "NORTH INDIAN", date: d(1), plates: 180, notes: "Biryani and Roti dinners" },
      { dept: "SI-MEALS", date: d(1), plates: 240, notes: "South Indian lunch meals thali count" }
    ]);

    await db("leftovers").insert([
      { dept: "NORTH INDIAN", date: d(1), item: "Premium Basmati Rice", qty: 4.5, unit: "kg" },
      { dept: "TIFFINS", date: d(1), item: "Curd", qty: 3, unit: "L" }
    ]);

    console.log("🍽️ Production & leftovers logged.");

    // 10. Audit stock adjustments
    const firstStock = await db("stock").first();
    if (firstStock) {
      await db("stock_adjustments").insert([
        { stock_id: firstStock.id, qty: -8, reason: "Shrinkage", date: d(5), notes: "Moisture loss during bulk storage" }
      ]);
      console.log("⚖️ Audit adjustments entered.");
    }

    // 11. Seed Approval Requests & Notifications (Perfect Test Cases)
    console.log("✍️ Seeding dummy approvals and notifications...");

    // Query roles and create/get users for associations
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

    let adminUser = await db("users")
      .where({ email: "admin@kapila.local" })
      .orWhere({ employee_code: "KPL-ADMIN" })
      .first();
    if (!adminUser) {
      const [inserted] = await db("users").insert({
        employee_code: "KPL-ADMIN",
        name: "Kapila Admin",
        email: "admin@kapila.local",
        password_hash: passwordHash,
        is_active: true,
        must_change_password: false
      }).returning("*");
      adminUser = inserted;
    }

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
    
    // Ensure storeUser has the store_manager role
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

    // A. Pending PO above threshold (₹35,000) -> Requires Admin
    const [poPendingAdmin] = await db("purchase_orders").insert({
      po_number: "PO-20260607-0004",
      supplier_id: sup1.id,
      date: d(0),
      status: "Pending",
      total_amount: 35000.00,
      notes: "Bulk premium ingredients restocking, requires admin signature"
    }).returning("*");

    await db("purchase_order_items").insert([
      { po_id: poPendingAdmin.id, item_code: "KPL-101", name: "Premium Basmati Rice", qty: 200, unit: "kg", unit_price: 100, total_price: 20000.00 },
      { po_id: poPendingAdmin.id, item_code: "KPL-102", name: "Refined Sunflower Oil", qty: 125, unit: "L", unit_price: 120, total_price: 15000.00 }
    ]);

    const [arPendingAdmin] = await db("approval_requests").insert({
      module: "purchase_orders",
      resource_id: poPendingAdmin.id,
      status: "pending",
      current_sequence: 1,
      created_by: storeUser.id
    }).returning("*");

    await db("notifications").insert({
      recipient_role_id: adminRole ? adminRole.id : null,
      title: "New Approval Required",
      message: `A new purchase_orders request (ID: ${poPendingAdmin.id}) awaits your approval.`,
      type: "approval_pending",
      severity: "info",
      metadata: { module: "purchase_orders", resource_id: poPendingAdmin.id, request_id: arPendingAdmin.id }
    });

    // B. Pending PO below threshold (₹15,000) -> Requires Store Manager
    const [poPendingMgr] = await db("purchase_orders").insert({
      po_number: "PO-20260607-0005",
      supplier_id: sup2.id,
      date: d(0),
      status: "Pending",
      total_amount: 15000.00,
      notes: "Urgent dairy ingredients replenishment"
    }).returning("*");

    await db("purchase_order_items").insert([
      { po_id: poPendingMgr.id, item_code: "KPL-103", name: "Butter (500g)", qty: 50, unit: "pcs", unit_price: 240, total_price: 12000.00 },
      { po_id: poPendingMgr.id, item_code: "KPL-104", name: "Ghee", qty: 5, unit: "L", unit_price: 600, total_price: 3000.00 }
    ]);

    const [arPendingMgr] = await db("approval_requests").insert({
      module: "purchase_orders",
      resource_id: poPendingMgr.id,
      status: "pending",
      current_sequence: 1,
      created_by: storeUser.id
    }).returning("*");

    await db("notifications").insert({
      recipient_role_id: storeManagerRole.id,
      title: "New Approval Required",
      message: `A new purchase_orders request (ID: ${poPendingMgr.id}) awaits your approval.`,
      type: "approval_pending",
      severity: "info",
      metadata: { module: "purchase_orders", resource_id: poPendingMgr.id, request_id: arPendingMgr.id }
    });

    // C. Pending Indent -> Requires Store Manager
    const [arIndentPending] = await db("approval_requests").insert({
      module: "indents",
      resource_id: ind1.id,
      status: "pending",
      current_sequence: 1,
      created_by: chefUser.id
    }).returning("*");

    await db("notifications").insert({
      recipient_role_id: storeManagerRole.id,
      title: "New Approval Required",
      message: `A new indents request (ID: ${ind1.id}) awaits your approval.`,
      type: "approval_pending",
      severity: "info",
      metadata: { module: "indents", resource_id: ind1.id, request_id: arIndentPending.id }
    });

    // D. Approved PO -> Already sent/received history
    const [arApprovedPO] = await db("approval_requests").insert({
      module: "purchase_orders",
      resource_id: po2.id,
      status: "approved",
      current_sequence: 1,
      created_by: storeUser.id,
      approved_by: adminUser.id,
      notes: "Approved immediately: essential restocking"
    }).returning("*");

    await db("notifications").insert({
      recipient_user_id: storeUser.id,
      title: "Request Approved",
      message: `Your purchase_orders request (ID: ${po2.id}) has been fully approved.`,
      type: "approval_action",
      severity: "success",
      metadata: { module: "purchase_orders", resource_id: po2.id }
    });

    // E. Rejected PO -> Exceeds budget limits
    const [poRejected] = await db("purchase_orders").insert({
      po_number: "PO-20260607-0006",
      supplier_id: sup3.id,
      date: d(2),
      status: "Rejected",
      total_amount: 45000.00,
      notes: "Excess premium Basmati rice stock"
    }).returning("*");

    await db("purchase_order_items").insert([
      { po_id: poRejected.id, item_code: "KPL-101", name: "Premium Basmati Rice", qty: 500, unit: "kg", unit_price: 90, total_price: 45000.00 }
    ]);

    const [arRejectedPO] = await db("approval_requests").insert({
      module: "purchase_orders",
      resource_id: poRejected.id,
      status: "rejected",
      current_sequence: 1,
      created_by: storeUser.id,
      rejected_by: adminUser.id,
      notes: "Rejected: Basmati rice stock levels are already high. Check current stock."
    }).returning("*");

    await db("notifications").insert({
      recipient_user_id: storeUser.id,
      title: "Request Rejected",
      message: `Your purchase_orders request (ID: ${poRejected.id}) has been rejected. Reason: Rejected: Basmati rice stock levels are already high. Check current stock.`,
      type: "approval_action",
      severity: "critical",
      metadata: { module: "purchase_orders", resource_id: poRejected.id }
    });

    // F. System Alerts (Low Stock, Expiry, Anomaly)
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
        message: "Butter (500g) (Batch BAT-BUT-01) is expiring in 2 days.",
        type: "expiry",
        severity: "critical",
        metadata: { item_code: "KPL-103" }
      },
      {
        recipient_role_id: adminRole ? adminRole.id : null,
        title: "Consumption Anomaly Detected",
        message: "Premium Basmati Rice consumption in NORTH INDIAN department is 35% higher than average.",
        type: "anomaly",
        severity: "warning",
        metadata: { dept: "NORTH INDIAN", item_code: "KPL-101" }
      }
    ]);

    console.log("✅ Seeded dummy approvals and notifications successfully.");
    console.log("🎉 Database Successfully Seeded with Dummy Data! 🎉");
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    db.destroy();
  }
}

seed();
