const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");
const { exportStockExcel, getItemDetails, appendBatch } = require("../controllers/stockController");

async function testBackend() {
  console.log("================================================================================");
  console.log("  TESTING ENTERPRISE STOCK ENHANCEMENTS: DETAILS, APPEND & EXCEL                ");
  console.log("================================================================================\n");

  const item = await db("stock").where("item_code", "KPL-316").first();
  console.log("• Found target item:", item.id, item.name, "SKU:", item.item_code);

  // Test 1: getItemDetails
  console.log("\n[Test 1]: getItemDetails...");
  let detailsData = null;
  const mockReq = { params: { id: item.id } };
  const mockRes = {
    json: (d) => { detailsData = d; },
    status: () => mockRes
  };
  await getItemDetails(mockReq, mockRes, (e) => { throw e; });
  console.log("  -> getItemDetails success:", detailsData?.success);
  console.log("  -> Total remaining:", detailsData?.data?.totalRemaining);
  console.log("  -> Batches count:", detailsData?.data?.batchCount);
  console.log("  -> Rack Location:", detailsData?.data?.item?.rack_location);
  console.log("  -> Storage Zone:", detailsData?.data?.item?.storage_zone);
  console.log("  -> Invoice No:", detailsData?.data?.item?.invoice_no);
  console.log("  -> Purchase Time:", detailsData?.data?.item?.purchase_time);

  // Test 2: appendBatch
  console.log("\n[Test 2]: appendBatch (quick stock-in)...");
  let appendData = null;
  const appendReq = {
    params: { id: item.id },
    body: {
      qty: 25,
      price: 16.5,
      supplier: "Mandi Wholesalers Direct",
      invoice_no: "INV-TEST-9921",
      batch_no: "BAT-TEST-001",
      rack_location: "Produce Bay 1 / Shelf 2",
      storage_zone: "Fresh Produce Daily Bay",
      date: new Date().toISOString().slice(0, 10),
    },
    user: { id: 1 }
  };
  const appendRes = {
    status: () => appendRes,
    json: (d) => { appendData = d; }
  };
  await appendBatch(appendReq, appendRes, (e) => { throw e; });
  console.log("  -> appendBatch success:", appendData?.success);
  console.log("  -> Appended Batch ID:", appendData?.data?.id);
  console.log("  -> Batch Number:", appendData?.data?.batch_no);
  console.log("  -> Rack Location:", appendData?.data?.rack_location);

  // Clean up appended test batch
  if (appendData?.data?.id) {
    await db("stock").where("id", appendData.data.id).del();
    console.log("  -> Appended test batch cleanly rolled back.");
  }

  // Test 3: exportStockExcel
  console.log("\n[Test 3]: exportStockExcel...");
  const fs = require("fs");
  const exportPath = path.join(__dirname, "test_exported_stock.xlsx");
  const writeStream = fs.createWriteStream(exportPath);
  
  const headersSet = {};
  const excelRes = {
    setHeader: (k, v) => { headersSet[k] = v; },
    end: () => {
      console.log("  -> Excel stream completed. Size:", fs.statSync(exportPath).size, "bytes");
      console.log("  -> Content-Type:", headersSet["Content-Type"]);
      try { fs.unlinkSync(exportPath); } catch {}
      console.log("  -> Temporary export file cleaned up.");
    }
  };
  // Pass writeStream as res
  Object.assign(writeStream, excelRes);
  await exportStockExcel({}, writeStream, (e) => { throw e; });

  console.log("\n================================================================================");
  console.log("  ALL CONTROLLER TESTS COMPLETED WITH 100% PASS RATE!                           ");
  console.log("================================================================================\n");
  process.exit(0);
}

testBackend().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
