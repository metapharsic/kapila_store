const db = require("../db");

jest.mock("../services/permissionService", () => ({
  getDepartmentNames: jest.fn().mockResolvedValue(null),
  assertDepartmentAccess: jest.fn().mockResolvedValue(undefined),
  applyDepartmentScope: jest.fn((query) => query),
}));
jest.mock("../services/kafkaProducer", () => ({
  publish: jest.fn().mockResolvedValue(undefined),
}));

const transferController = require("../controllers/transferController");

describe("Enterprise Multi-Agent Stock Transfers Suite", () => {
  const TEST_PREFIX = "TRF_TST_" + Math.floor(Date.now() % 100000);
  const ITEM_CODE_1 = `${TEST_PREFIX}_01`;
  const ITEM_CODE_2 = `${TEST_PREFIX}_02`;
  let stockId1;
  let createdTransferId;

  beforeAll(async () => {
    // Seed initial stock batches for testing
    const [s1] = await db("stock").insert({
      item_code: ITEM_CODE_1,
      name: "Transfer Test Ghee",
      category: "Dairy",
      qty: 50,
      remaining: 50,
      unit: "kg",
      price: 600,
      supplier: "Heritage Dairy",
      date: "2026-09-10",
      batch_no: "BATCH-GH-01",
      rack_location: "R1",
    }).returning("*");
    stockId1 = s1.id;

    const [s2] = await db("stock").insert({
      item_code: ITEM_CODE_2,
      name: "Transfer Test Paneer",
      category: "Dairy",
      qty: 20,
      remaining: 20,
      unit: "kg",
      price: 350,
      supplier: "Heritage Dairy",
      date: "2026-09-10",
      batch_no: "BATCH-PN-01",
      rack_location: "R2",
    }).returning("*");
  });

  afterAll(async () => {
    try {
      await db("stock_transfer_items").whereILike("item_code", `${TEST_PREFIX}%`).del();
      await db("stock_transfers").whereILike("transfer_number", `TRF-%`).where("remarks", "Automated Transfer Test").del();
      await db("stock_ledger").whereILike("item_code", `${TEST_PREFIX}%`).del();
      await db("stock_adjustments").where("notes", "like", "%Transfer%").del();
      await db("stock").whereILike("item_code", `${TEST_PREFIX}%`).del();
    } catch (err) {
      console.error("Cleanup error in transfers.test.js:", err.message);
    }
    await db.destroy();
  });

  describe("1. Real-Time Stock Query & Telemetry", () => {
    it("should query available stock with batch and location details", async () => {
      const req = { query: { from_location: "Store", q: ITEM_CODE_1 } };
      const res = { json: jest.fn() };
      const next = jest.fn();

      await transferController.getAvailableStock(req, res, next);
      expect(res.json).toHaveBeenCalled();
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.length).toBeGreaterThanOrEqual(1);

      const item = payload.data.find(i => i.item_code === ITEM_CODE_1);
      expect(item).toBeDefined();
      expect(item.available_qty).toBe(50);
      expect(item.avg_unit_price).toBe(600);
      expect(item.rack).toBe("R1");
    });

    it("should return summary analytics with active agent telemetry", async () => {
      const req = {};
      const res = { json: jest.fn() };
      const next = jest.fn();

      await transferController.getSummary(req, res, next);
      expect(res.json).toHaveBeenCalled();
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.agents_telemetry).toBeDefined();
      expect(payload.data.agents_telemetry.routeur.status).toBe("Active");
      expect(payload.data.agents_telemetry.veritas.status).toBe("Active");
    });
  });

  describe("2. Agent Routeur: Transfer Creation & Non-Overdraft Enforcement", () => {
    it("should reject transfer if requested quantity exceeds available stock", async () => {
      const req = {
        user: { isAdmin: true, name: "Admin" },
        body: {
          date: "2026-09-10",
          from_location: "Store",
          to_location: "TIFFINS",
          items: [{ item_code: ITEM_CODE_1, name: "Transfer Test Ghee", qty: 100, unit: "kg" }],
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await transferController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(false);
      expect(payload.error).toContain("Insufficient stock in Store");
    });

    it("should successfully create transfer, compute valuation, and dispatch in-transit", async () => {
      const req = {
        user: { isAdmin: true, name: "Storekeeper" },
        body: {
          date: "2026-09-10",
          from_location: "Store",
          to_location: "TIFFINS",
          initiated_by: "Store Head",
          remarks: "Automated Transfer Test",
          items: [
            { item_code: ITEM_CODE_1, name: "Transfer Test Ghee", qty: 10, unit: "kg" },
            { item_code: ITEM_CODE_2, name: "Transfer Test Paneer", qty: 5, unit: "kg" },
          ],
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await transferController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.transfer_number).toMatch(/^TRF-20260910-\d{4}$/);
      expect(payload.data.status).toBe("Pending");
      expect(payload.data.transit_status).toBe("DISPATCHED");
      expect(payload.data.transfer_type).toBe("STORE_TO_DEPT");

      // Valuation check: 10 * 600 + 5 * 350 = 6000 + 1750 = 7750
      expect(parseFloat(payload.data.total_value)).toBe(7750);
      expect(payload.data.items.length).toBe(2);

      createdTransferId = payload.data.id;
    });
  });

  describe("3. Agent Gatekeeper & Agent Veritas: Handshake & Atomic Ledger Postings", () => {
    it("should accept transfer with partial receipt variance and post double-entry ledger", async () => {
      const req = {
        params: { id: createdTransferId },
        user: { isAdmin: true, name: "Chef Tiffins" },
        body: {
          accepted_by: "Chef Suresh",
          remarks: "Received 9.5kg ghee (0.5kg leakage in transit)",
          items: [
            { item_code: ITEM_CODE_1, received_qty: 9.5, condition_status: "Good" },
            { item_code: ITEM_CODE_2, received_qty: 5.0, condition_status: "Good" },
          ],
        },
      };
      const res = { json: jest.fn() };
      const next = jest.fn();

      await transferController.accept(req, res, next);
      expect(res.json).toHaveBeenCalled();
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.status).toBe("Accepted");
      expect(payload.data.transit_status).toBe("PARTIAL"); // Flagged due to shrinkage

      // Verify stock table balance deduction in Store
      const updatedStock1 = await db("stock").where("id", stockId1).first();
      // Original 50 - 10 transferred = 40 remaining
      expect(parseFloat(updatedStock1.remaining)).toBe(40);

      // Verify Double-Entry Stock Ledger entries
      const ledgerEntries = await db("stock_ledger")
        .where("reference_doc_id", createdTransferId)
        .where("reference_doc_type", "TRANSFER");

      expect(ledgerEntries.length).toBeGreaterThanOrEqual(2);

      // Verify TRANSFER_OUT entry
      const outEntry = ledgerEntries.find(e => e.item_code === ITEM_CODE_1 && e.transaction_type === "TRANSFER_OUT");
      expect(outEntry).toBeDefined();
      expect(parseFloat(outEntry.qty)).toBe(9.5);
      expect(outEntry.department).toBe("TIFFINS");

      // Verify TRANSFER_LOSS entry for the 0.5kg transit variance
      const lossEntry = ledgerEntries.find(e => e.item_code === ITEM_CODE_1 && e.transaction_type === "TRANSFER_LOSS");
      expect(lossEntry).toBeDefined();
      expect(parseFloat(lossEntry.qty)).toBe(0.5);
    });

    it("should handle Department-to-Store return and restore stock inventory", async () => {
      // 1. Create a return transfer: TIFFINS -> Store
      const createReq = {
        user: { isAdmin: true, name: "Chef Suresh" },
        body: {
          date: "2026-09-10",
          from_location: "TIFFINS",
          to_location: "Store",
          initiated_by: "Chef Suresh",
          remarks: "Automated Transfer Test",
          items: [{ item_code: ITEM_CODE_1, name: "Transfer Test Ghee", qty: 2, unit: "kg", unit_price: 600 }],
        },
      };
      const createRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await transferController.create(createReq, createRes, jest.fn());
      const returnTrf = createRes.json.mock.calls[0][0].data;
      expect(returnTrf.transfer_type).toBe("DEPT_TO_STORE");

      // 2. Accept the return at Store
      const acceptReq = {
        params: { id: returnTrf.id },
        user: { isAdmin: true, name: "Store Head" },
        body: {
          accepted_by: "Store Head",
          remarks: "Verified and restocked to Shelf R1",
        },
      };
      const acceptRes = { json: jest.fn() };
      await transferController.accept(acceptReq, acceptRes, jest.fn());
      expect(acceptRes.json.mock.calls[0][0].success).toBe(true);

      // Verify stock table has a new/restocked batch with supplier note
      const returnBatch = await db("stock")
        .where("item_code", ITEM_CODE_1)
        .whereILike("supplier", "%Return from TIFFINS%")
        .first();

      expect(returnBatch).toBeDefined();
      expect(parseFloat(returnBatch.remaining)).toBe(2);

      // Verify TRANSFER_IN entry in stock_ledger
      const inLedger = await db("stock_ledger")
        .where("reference_doc_id", returnTrf.id)
        .where("transaction_type", "TRANSFER_IN")
        .first();

      expect(inLedger).toBeDefined();
      expect(parseFloat(inLedger.qty)).toBe(2);
      expect(inLedger.department).toBe("TIFFINS");
    });
  });
});
