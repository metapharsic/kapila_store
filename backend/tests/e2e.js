const db = require("../db");
const http = require("http");
const express = require("express");
const cors = require("cors");
const errorHandler = require("../middleware/errorHandler");

// Set up server for testing
const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  req.user = {
    id: 1,
    name: "Test Admin",
    email: "admin@kapila.local",
    isAdmin: true,
    roles: [{ id: 1, key: "admin", name: "Admin" }],
    permissions: new Set(),
  };
  next();
});
app.use("/api/stock",      require("../routes/stock"));
app.use("/api/suppliers",       require("../routes/suppliers"));
app.use("/api/departments",     require("../routes/departments"));
app.use("/api/indents",         require("../routes/indents"));
app.use("/api/issuances",       require("../routes/issuances"));
app.use("/api/purchase-orders", require("../routes/purchaseOrders"));
app.use("/api/grn",             require("../routes/grn"));
app.use("/api/dashboard",  require("../routes/dashboard"));
app.use("/api/notifications", require("../routes/notificationRoutes"));
app.use("/api/approvals",   require("../routes/approvalRoutes"));
app.use(errorHandler);

const PORT = 3005;
let server;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : "";
    const options = {
      hostname: "localhost",
      port: PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => (responseBody += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on("error", (err) => reject(err));
    if (body) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log("🚀 Starting E2E Integration Tests on Port " + PORT);
  server = app.listen(PORT);

  // Clean up existing test database entries to prevent conflicts
  await db("approval_requests").del();
  await db("approval_rules").del();
  await db("notifications").del();
  await db("audit_items").del();
  await db("audit_sessions").del();
  await db("stock_adjustments").del();
  await db("stock").del();
  await db("goods_receipt_items").del();
  await db("goods_receipt_notes").del();
  await db("purchase_order_items").del();
  await db("purchase_orders").del();
  await db("suppliers").del();
  await db("departments").where("name", "Continental Kitchen").del();

  console.log("🧹 Test database cleaned.");

  try {
    // ----------------------------------------------------
    // TEST 1: Supplier Creation and Retrieval
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Supplier CRUD ---");
    const createSupplierRes = await request("POST", "/api/suppliers", {
      name: "Super Foods Supplier",
      contact_name: "John Doe",
      phone: "9876543210",
      email: "john@superfoods.com",
      gstin: "37AAAAA1111A1Z1",
      address: "123 Food Street, Guntur"
    });

    if (createSupplierRes.status !== 201 || !createSupplierRes.body.success) {
      throw new Error(`Failed to create supplier. Status: ${createSupplierRes.status}, Body: ${JSON.stringify(createSupplierRes.body)}`);
    }
    const supplierId = createSupplierRes.body.data.id;
    console.log(`✅ Created Supplier: ${createSupplierRes.body.data.name} (ID: ${supplierId})`);

    const listSuppliersRes = await request("GET", "/api/suppliers");
    if (listSuppliersRes.body.data.length !== 1) {
      throw new Error("Supplier list count mismatch after creation.");
    }
    console.log("✅ Supplier listed successfully.");

    // ----------------------------------------------------
    // TEST 2: Purchase Order Lifecycle
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Purchase Order Creation & Retrieval ---");
    const createPORes = await request("POST", "/api/purchase-orders", {
      supplier_id: supplierId,
      date: new Date().toISOString().slice(0, 10),
      status: "Draft",
      notes: "Urgent purchase for the upcoming weekend rush",
      items: [
        { item_code: "KPL-101", name: "Premium Basmati Rice", qty: 100, unit: "kg", unit_price: 90 },
        { item_code: "KPL-102", name: "Refined Sunflower Oil", qty: 50, unit: "L", unit_price: 120 }
      ]
    });

    if (createPORes.status !== 201 || !createPORes.body.success) {
      throw new Error(`Failed to create PO. Body: ${JSON.stringify(createPORes.body)}`);
    }
    const poId = createPORes.body.data.id;
    const poNumber = createPORes.body.data.po_number;
    console.log(`✅ Created Purchase Order ${poNumber} with 2 items. Total: ${createPORes.body.data.total_amount}`);

    const getPORes = await request("GET", `/api/purchase-orders/${poId}`);
    if (getPORes.body.data.items.length !== 2) {
      throw new Error("PO item retrieval count mismatch.");
    }
    console.log("✅ PO and items retrieved successfully.");

    // ----------------------------------------------------
    // TEST 3: Goods Receipt Note (GRN) & Stock Ingestion
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Goods Receipt Note (GRN) Ingestion ---");
    const createGRNRes = await request("POST", "/api/grn", {
      po_id: poId,
      supplier_id: supplierId,
      date: new Date().toISOString().slice(0, 10),
      invoice_no: "INV-9999",
      received_by: "Store Manager",
      remarks: "Received in good condition, slight oil damage on outer box rejected",
      items: [
        {
          item_code: "KPL-101",
          name: "Premium Basmati Rice",
          qty_ordered: 100,
          qty_received: 100,
          qty_accepted: 100,
          qty_rejected: 0,
          unit: "kg",
          unit_price: 90,
          landed_cost: 9200, // Includes freight/tax
          batch_no: "BAT-RICE-001",
          expiry_date: "2027-06-01"
        },
        {
          item_code: "KPL-102",
          name: "Refined Sunflower Oil",
          qty_ordered: 50,
          qty_received: 50,
          qty_accepted: 48, // 2 rejected
          qty_rejected: 2,
          unit: "L",
          unit_price: 120,
          landed_cost: 5900,
          batch_no: "BAT-OIL-99",
          expiry_date: "2026-12-31"
        }
      ]
    });

    if (createGRNRes.status !== 201 || !createGRNRes.body.success) {
      throw new Error(`Failed to create GRN. Body: ${JSON.stringify(createGRNRes.body)}`);
    }
    console.log(`✅ Created GRN: ${createGRNRes.body.data.grn_number}. PO ${poNumber} status updated.`);

    // Check PO status automatically updated to Received
    const checkPORes = await request("GET", `/api/purchase-orders/${poId}`);
    if (checkPORes.body.data.status !== "Received") {
      throw new Error(`PO status not updated. Expected Received, got ${checkPORes.body.data.status}`);
    }
    console.log(`✅ Verified PO status transitioned to Received.`);

    // Verify stock records were created
    const stockListRes = await request("GET", "/api/stock");
    console.log("Debug Stock List response:", JSON.stringify(stockListRes.body));
    if (stockListRes.body.data.length !== 2) {
      throw new Error(`Stock table did not ingest batches. Expected 2 rows, found ${stockListRes.body.data.length}`);
    }
    const riceStock = stockListRes.body.data.find(s => s.item_code === "KPL-101");
    const oilStock = stockListRes.body.data.find(s => s.item_code === "KPL-102");
    
    if (riceStock.remaining !== 100 || oilStock.remaining !== 48) {
      throw new Error("Stock remaining quantity mismatch from GRN accepted values.");
    }
    console.log(`✅ Ingested Stock verified: Rice remaining: ${riceStock.remaining}, Oil remaining: ${oilStock.remaining}`);

    // ----------------------------------------------------
    // TEST 4: Reconciliation (FIFO Audit Adjustments)
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Stock Reconciliation (FIFO Audit Correction) ---");
    // Let's audit Rice down from 100 to 92 (Shrinkage of 8 kg)
    // Let's audit Oil up from 48 to 52 (Surplus of 4 L)
    const reconcileRes = await request("POST", "/api/stock/reconcile", {
      items: [
        { item_code: "KPL-101", physical_qty: 92, reason: "Spoiled / Spilled", notes: "Audit check" },
        { item_code: "KPL-102", physical_qty: 52, reason: "Audit Correction", notes: "Extra stock found" }
      ]
    });

    if (reconcileRes.status !== 200 || !reconcileRes.body.success) {
      throw new Error(`Reconciliation request failed: ${JSON.stringify(reconcileRes.body)}`);
    }
    console.log("✅ Reconciliation request completed successfully.");

    // Check adjusted stock levels
    const checkStockRes = await request("GET", "/api/stock");
    const updatedRice = checkStockRes.body.data.find(s => s.item_code === "KPL-101");
    const updatedOil = checkStockRes.body.data.find(s => s.item_code === "KPL-102");

    if (updatedRice.remaining !== 92) {
      throw new Error(`Rice remaining quantity wrong after audit. Expected 92, got ${updatedRice.remaining}`);
    }
    if (updatedOil.remaining !== 52) {
      throw new Error(`Oil remaining quantity wrong after audit. Expected 52, got ${updatedOil.remaining}`);
    }
    console.log(`✅ Verified adjusted quantities. Rice: ${updatedRice.remaining}, Oil: ${updatedOil.remaining}`);

    // Verify stock adjustments table logs
    const adjCount = await db("stock_adjustments").count("id as count").first();
    if (parseInt(adjCount.count) !== 2) {
      throw new Error(`Expected 2 stock adjustments logs, found ${adjCount.count}`);
    }
    console.log("✅ Stock adjustments audited and logged correctly.");

    // ----------------------------------------------------
    // TEST 5: Procurement Analytics Summary
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Procurement Dashboard Analytics ---");
    const analyticsRes = await request("GET", "/api/dashboard/procurement");
    if (analyticsRes.status !== 200 || !analyticsRes.body.success) {
      throw new Error(`Analytics retrieval failed: ${JSON.stringify(analyticsRes.body)}`);
    }

    const { shrinkage, supplier_performance, outstanding } = analyticsRes.body.data;
    if (shrinkage.length === 0 || shrinkage[0].total_qty !== 8) {
      throw new Error(`Analytics shrinkage computation wrong. Expected qty 8, got ${JSON.stringify(shrinkage)}`);
    }
    
    console.log("📊 Analytics Shrinkage Cost: ₹" + shrinkage[0].total_cost);
    console.log("📊 Supplier Performance Fulfillment: " + supplier_performance[0].fulfillment_rate + "%");
    console.log("✅ Verified Procurement Dashboard Analytics metrics!");

    // ----------------------------------------------------
    // TEST 6: Supplier Performance Dashboard
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Supplier Performance Dashboard Endpoint ---");
    const supplierPerfRes = await request("GET", `/api/suppliers/${supplierId}/performance`);
    if (supplierPerfRes.status !== 200 || !supplierPerfRes.body.success) {
      throw new Error(`Supplier performance dashboard retrieval failed: ${JSON.stringify(supplierPerfRes.body)}`);
    }
    const perfData = supplierPerfRes.body.data;
    if (perfData.stats.total_pos !== 1 || perfData.recentPOs.length !== 1 || perfData.itemsSupplied.length !== 2) {
      throw new Error(`Supplier performance data mismatch: ${JSON.stringify(perfData)}`);
    }
    console.log(`✅ Verified Supplier stats: Total POs=${perfData.stats.total_pos}, Items Supplied=${perfData.itemsSupplied.length}`);

    // ----------------------------------------------------
    // TEST 7: Departments, Indents & FIFO Issuance Workflow
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Departments, Indents & FIFO Issuance ---");
    
    // 1. Fetch departments
    const listDepts = await request("GET", "/api/departments");
    if (listDepts.status !== 200 || !listDepts.body.success || listDepts.body.data.length === 0) {
      throw new Error(`Failed to list departments: ${JSON.stringify(listDepts.body)}`);
    }
    console.log(`✅ Fetched ${listDepts.body.data.length} departments.`);

    // 2. Create custom department
    const createDept = await request("POST", "/api/departments", {
      name: "Continental Kitchen",
      code: "CON",
      chef_name: "Chef Anthony"
    });
    if (createDept.status !== 201 || !createDept.body.success) {
      throw new Error(`Failed to create department: ${JSON.stringify(createDept.body)}`);
    }
    console.log(`✅ Created Department: ${createDept.body.data.name} (Code: ${createDept.body.data.code})`);

    // 2.5 Get department items mapping
    const deptItemsRes = await request("GET", "/api/departments/items");
    if (deptItemsRes.status !== 200 || !deptItemsRes.body.success) {
      throw new Error(`Failed to get department items mapping: ${JSON.stringify(deptItemsRes.body)}`);
    }
    if (!deptItemsRes.body.data["NORTH INDIAN"] || deptItemsRes.body.data["NORTH INDIAN"].length === 0) {
      throw new Error("Department items mapping missing expected NORTH INDIAN items list.");
    }
    console.log(`✅ Fetched department items mapping. Found ${deptItemsRes.body.data["NORTH INDIAN"].length} items for NORTH INDIAN.`);

    // 3. Check stock availability helper endpoint
    const availStockRes = await request("GET", "/api/stock/available?names=Premium%20Basmati%20Rice");
    if (availStockRes.status !== 200 || !availStockRes.body.success) {
      throw new Error(`Failed to check stock availability: ${JSON.stringify(availStockRes.body)}`);
    }
    const riceAvail = availStockRes.body.data["premium basmati rice"]?.available || 0;
    console.log(`✅ Stock check: Premium Basmati Rice available qty = ${riceAvail}`);

    // 4. Create an indent
    const createIndentRes = await request("POST", "/api/indents", {
      dept: "Continental Kitchen",
      date: new Date().toISOString().slice(0, 10),
      items: [
        { name: "Premium Basmati Rice", qty: 10, unit: "kg", item_code: "KPL-101" }
      ]
    });
    if (createIndentRes.status !== 201 || !createIndentRes.body.success) {
      throw new Error(`Failed to create indent: ${JSON.stringify(createIndentRes.body)}`);
    }
    const indentId = createIndentRes.body.data.id;
    console.log(`✅ Created Indent for ${createIndentRes.body.data.dept} (ID: ${indentId})`);

    // 5. Issue the indent items (deleting from stock using FIFO logic)
    const issueRes = await request("POST", "/api/issuances", {
      indent_id: indentId,
      dept: "Continental Kitchen",
      date: new Date().toISOString().slice(0, 10),
      scanned: false,
      items: [
        { name: "Premium Basmati Rice", qty: 10, issued: 10, unit: "kg", item_code: "KPL-101" }
      ]
    });
    if (issueRes.status !== 201 || !issueRes.body.success) {
      throw new Error(`Failed to issue material: ${JSON.stringify(issueRes.body)}`);
    }
    console.log(`✅ Material issued successfully.`);

    // 6. Verify stock depletion
    const postAvailRes = await request("GET", "/api/stock/available?names=Premium%20Basmati%20Rice");
    const postRiceAvail = postAvailRes.body.data["premium basmati rice"]?.available || 0;
    if (riceAvail - postRiceAvail !== 10) {
      throw new Error(`FIFO stock deduction failed. Expected remaining: ${riceAvail - 10}, found: ${postRiceAvail}`);
    }
    console.log(`✅ Stock depleted correctly (FIFO check): ${postRiceAvail} remaining.`);

    // 7. Verify over-issuance throws error
    const overIssueRes = await request("POST", "/api/issuances", {
      dept: "Continental Kitchen",
      date: new Date().toISOString().slice(0, 10),
      scanned: false,
      items: [
        { name: "Premium Basmati Rice", qty: 500, issued: 500, unit: "kg", item_code: "KPL-101" }
      ]
    });
    if (overIssueRes.status === 201) {
      throw new Error("Over-issuing stock should have failed but succeeded!");
    }
    console.log(`✅ Verified over-issuance failed as expected: ${overIssueRes.body.error}`);

    // ----------------------------------------------------
    // TEST 8: Approval Matrix & Notifications System
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Approval Matrix & Notifications ---");
    
    // Seed an approval rule for POs requiring Admin role
    const adminRole = await db("roles").where("key", "admin").first();
    if (!adminRole) {
      throw new Error("Admin role not found in database to seed rules.");
    }
    
    const [rule] = await db("approval_rules").insert({
      module: "purchase_orders",
      min_amount: 0.00,
      max_amount: null,
      role_id: adminRole.id,
      sequence: 1
    }).returning("*");
    console.log(`✅ Seeded approval rule for POs (ID: ${rule.id})`);

    // Create a pending PO
    const supplier = await db("suppliers").first();
    if (!supplier) {
      throw new Error("Supplier not found in database.");
    }

    const poRes = await request("POST", "/api/purchase-orders", {
      supplier_id: supplier.id,
      date: new Date().toISOString().slice(0, 10),
      status: "Pending",
      notes: "E2E Test PO for approval matrix",
      items: [
        { name: "Premium Basmati Rice", qty: 10, unit: "kg", unit_price: 150, item_code: "KPL-101" }
      ]
    });
    if (poRes.status !== 201 || !poRes.body.success) {
      throw new Error(`Failed to create pending PO: ${JSON.stringify(poRes.body)}`);
    }
    const poIdApproval = poRes.body.data.id;
    console.log(`✅ Created Pending PO (ID: ${poIdApproval})`);

    // Verify approval pending notification created
    const notifRes = await request("GET", "/api/notifications");
    if (notifRes.status !== 200 || !notifRes.body.success) {
      throw new Error(`Failed to list notifications: ${JSON.stringify(notifRes.body)}`);
    }
    const approvalNotif = notifRes.body.data.find(n => n.type === "approval_pending");
    if (!approvalNotif) {
      throw new Error("Expected notification for pending approval, but none was found.");
    }
    console.log(`✅ Verified approval pending notification created: "${approvalNotif.title}"`);

    // Verify pending approval request exists in queue
    const pendingRes = await request("GET", "/api/approvals/pending");
    if (pendingRes.status !== 200 || !pendingRes.body.success) {
      throw new Error(`Failed to list pending approvals: ${JSON.stringify(pendingRes.body)}`);
    }
    const approvalReq = pendingRes.body.data.find(r => r.module === "purchase_orders" && r.resource_id === poIdApproval);
    if (!approvalReq) {
      throw new Error("Expected pending approval request, but none was found.");
    }
    console.log(`✅ Verified pending approval request exists in queue (ID: ${approvalReq.id})`);

    // Approve the request
    const approveActionRes = await request("POST", `/api/approvals/${approvalReq.id}/approve`, {
      notes: "Approved in E2E integration test"
    });
    if (approveActionRes.status !== 200 || !approveActionRes.body.success) {
      throw new Error(`Failed to approve request: ${JSON.stringify(approveActionRes.body)}`);
    }
    console.log("✅ Approved the request via POST /api/approvals/:id/approve");

    // Verify PO status updated to 'Approved'
    const updatedPo = await db("purchase_orders").where("id", poIdApproval).first();
    if (updatedPo.status !== "Approved") {
      throw new Error(`Expected PO status to be 'Approved', found: ${updatedPo.status}`);
    }
    console.log("✅ Verified PO status updated to 'Approved' in database.");

    // Verify success action notification was triggered
    const postNotifRes = await request("GET", "/api/notifications");
    const actionNotif = postNotifRes.body.data.find(n => n.type === "approval_action" && n.severity === "success");
    if (!actionNotif) {
      throw new Error("Expected success notification for approval action, but none was found.");
    }
    console.log(`✅ Verified action notification created: "${actionNotif.title}" - ${actionNotif.message}`);

    console.log("\n🎉 ALL E2E INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉");
    cleanupAndExit(0);
  } catch (err) {
    console.error("\n❌ TEST FAILED: ", err.message);
    cleanupAndExit(1);
  }
}

function cleanupAndExit(code) {
  if (server) server.close();
  db.destroy().then(() => {
    process.exit(code);
  });
}

runTests();
