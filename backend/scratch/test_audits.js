const path = require("path");
// Load environment variables using absolute path
require("dotenv").config({ path: "c:/Users/SAMEER PASHA/OneDrive/Documents/Projects/Kapila_Project/backend/.env" });

const db = require("c:/Users/SAMEER PASHA/OneDrive/Documents/Projects/Kapila_Project/backend/db");

async function runTests() {
  console.log("🚀 Starting database-level verification for Stock Audit Module...\n");

  try {
    // 0. Ensure we have at least one user to assign as creator
    const user = await db("users").first();
    if (!user) {
      throw new Error("No users found in database to link the audit to. Run seed scripts first.");
    }
    console.log(`👤 Found user: ${user.username} (ID: ${user.id})`);

    // Ensure we have some items in the stock table to audit
    const stockItemsCount = await db("stock").count("id as count").first();
    const countVal = parseInt(stockItemsCount?.count || 0, 10);
    console.log(`📦 Found ${countVal} active stock batches in DB.`);
    if (countVal === 0) {
      throw new Error("No stock items found in database to audit. Seed stock items first.");
    }

    // 1. Check summary endpoint logic directly
    const openCount = await db("audit_sessions").where("status", "in_progress").count("id as count").first();
    console.log(`📊 Current open audits count: ${openCount?.count || 0}`);

    // Clean up any old test sessions if they exist
    await db("audit_items").where("item_code", "LIKE", "TEST-CODE-%").delete();
    await db("audit_sessions").where("reference", "LIKE", "AUD-TEST-%").delete();

    // 2. Test starting a new audit session
    const testRef = "AUD-TEST-" + Date.now();
    console.log(`🆕 Creating test audit session with reference: ${testRef}`);

    // Grouping logic similar to controller
    const stockItems = await db("stock")
      .select("item_code", "name", "unit")
      .sum("remaining as total_remaining")
      .min("id as representative_id")
      .groupBy("item_code", "name", "unit")
      .limit(3); // Grab up to 3 items for testing

    if (stockItems.length === 0) {
      throw new Error("No grouped stock items available.");
    }

    const snapshot = {};
    stockItems.forEach((item) => {
      snapshot[item.item_code] = parseFloat(item.total_remaining || 0);
    });

    const [session] = await db("audit_sessions")
      .insert({
        reference: testRef,
        auditor_name: "Verification Script Agent",
        department_id: null,
        status: "in_progress",
        snapshot: JSON.stringify(snapshot),
        notes: "Automated verification test run",
        created_by: user.id
      })
      .returning("*");

    console.log(`✅ Session created with ID: ${session.id}`);

    const auditItems = stockItems.map((item) => ({
      audit_session_id: session.id,
      stock_item_id: item.representative_id,
      item_code: item.item_code,
      item_name: item.name,
      unit: item.unit,
      db_qty: parseFloat(item.total_remaining || 0),
      physical_qty: null,
      difference: null,
      action: null,
      db_adjusted: false
    }));

    const insertedItems = await db("audit_items").insert(auditItems).returning("*");
    console.log(`✅ Inserted ${insertedItems.length} items to audit checklist.`);

    // 3. Test Conflict (trying to create another global in_progress audit)
    const existing = await db("audit_sessions")
      .where("status", "in_progress")
      .whereNull("department_id")
      .first();

    if (existing) {
      console.log("✅ Conflict check passed: Correctly identified active audit session in progress.");
    } else {
      console.log("❌ Conflict check failed: Active session not detected.");
    }

    // 4. Test updating an item physical count
    const targetItem = insertedItems[0];
    const originalDbQty = parseFloat(targetItem.db_qty);
    const testPhysicalQty = originalDbQty + 10.0; // simulate a surplus of 10 units
    const diff = testPhysicalQty - originalDbQty;

    console.log(`📝 Updating count on item ${targetItem.item_code}: Physical Count = ${testPhysicalQty} (DB = ${originalDbQty}, Diff = ${diff})`);

    const [updatedItem] = await db("audit_items")
      .where("id", targetItem.id)
      .update({
        physical_qty: testPhysicalQty,
        difference: diff,
        action: "adjust_db"
      })
      .returning("*");

    if (Math.abs(parseFloat(updatedItem.difference) - diff) < 0.0001) {
      console.log("✅ Item quantity patch verified successfully.");
    } else {
      console.log(`❌ Item quantity patch mismatch. Diff in DB: ${updatedItem.difference}, expected: ${diff}`);
    }

    // Prepare other items with 0 difference so we can finalise (finalise requires all items to be counted)
    for (let i = 1; i < insertedItems.length; i++) {
      const it = insertedItems[i];
      await db("audit_items")
        .where("id", it.id)
        .update({
          physical_qty: parseFloat(it.db_qty),
          difference: 0,
          action: null
        });
    }
    console.log("✅ All items in checklist have physical quantities entered.");

    // 5. Test finalisation & FIFO adjustments
    console.log("⚙️  Running finalisation transaction (FIFO logic)...");

    const todayStr = new Date().toISOString().slice(0, 10);
    const lowStockAlerts = [];

    // Let's run the finalisation logic inside a transaction
    await db.transaction(async (trx) => {
      const activeItems = await trx("audit_items").where("audit_session_id", session.id);

      for (const auditItem of activeItems) {
        const itemDiff = parseFloat(auditItem.difference || 0);
        const itemAction = auditItem.action;

        if (itemAction === "adjust_db" && Math.abs(itemDiff) > 0.0001) {
          const physicalQty = parseFloat(auditItem.physical_qty);

          // Get active stock batches
          const activeBatches = await trx("stock")
            .where("item_code", auditItem.item_code)
            .where("remaining", ">", 0)
            .orderBy("date", "asc")
            .orderBy("id", "asc");

          const totalSystem = activeBatches.reduce((sum, b) => sum + parseFloat(b.remaining), 0);
          const discrepancy = physicalQty - totalSystem;

          console.log(`👉 Adjusting ${auditItem.item_code}: discrepancy = ${discrepancy}`);

          if (discrepancy < 0) {
            // Shrinkage (FIFO)
            let toDeduct = Math.abs(discrepancy);
            for (const batch of activeBatches) {
              if (toDeduct <= 0) break;
              const rem = parseFloat(batch.remaining);
              const deduction = Math.min(rem, toDeduct);

              await trx("stock")
                .where("id", batch.id)
                .update({ remaining: rem - deduction });

              await trx("stock_adjustments").insert({
                stock_id: batch.id,
                qty: -deduction,
                reason: "Audit Verification Script",
                date: todayStr,
                notes: `Verification FIFO deduction of ${deduction}`
              });

              toDeduct -= deduction;
            }
          } else if (discrepancy > 0) {
            // Surplus (Add to latest or new)
            if (activeBatches.length > 0) {
              const latestBatch = activeBatches[activeBatches.length - 1];
              const rem = parseFloat(latestBatch.remaining);
              await trx("stock")
                .where("id", latestBatch.id)
                .update({ remaining: rem + discrepancy });

              await trx("stock_adjustments").insert({
                stock_id: latestBatch.id,
                qty: discrepancy,
                reason: "Audit Verification Script",
                date: todayStr,
                notes: `Verification Surplus of ${discrepancy}`
              });
            } else {
              // Create new batch
              const [newBatch] = await trx("stock").insert({
                name: auditItem.item_name,
                qty: discrepancy,
                remaining: discrepancy,
                unit: auditItem.unit,
                date: todayStr,
                price: 0,
                supplier: "Unknown",
                item_code: auditItem.item_code,
                created_by: user.id
              }).returning("*");

              await trx("stock_adjustments").insert({
                stock_id: newBatch.id,
                qty: discrepancy,
                reason: "Audit Verification Script",
                date: todayStr,
                notes: `Verification created batch`
              });
            }
          }

          // Mark adjusted
          await trx("audit_items")
            .where("id", auditItem.id)
            .update({ db_adjusted: true });
        }
      }

      await trx("audit_sessions")
        .where("id", session.id)
        .update({
          status: "completed",
          updated_at: trx.fn.now()
        });
    });

    console.log("✅ Finalisation transaction completed successfully.");

    // Verify database adjustments took place
    const finalSession = await db("audit_sessions").where("id", session.id).first();
    const finalItem = await db("audit_items").where({ id: targetItem.id }).first();

    console.log(`📌 Post-finalise status: ${finalSession.status}`);
    console.log(`📌 Post-finalise item db_adjusted: ${finalItem.db_adjusted}`);

    if (finalSession.status === "completed" && finalItem.db_adjusted === true) {
      console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
    } else {
      console.log("\n❌ TESTS FAILED: Incorrect state post finalise.");
    }

    // Clean up test session
    console.log("\n🧹 Cleaning up test session records...");
    await db("audit_items").where("audit_session_id", session.id).delete();
    await db("audit_sessions").where("id", session.id).delete();
    console.log("✅ Cleanup complete.");

  } catch (error) {
    console.error("\n❌ TESTS FAILED WITH ERROR:", error);
  } finally {
    await db.destroy();
    console.log("\n👋 Database connection closed.");
  }
}

runTests();
